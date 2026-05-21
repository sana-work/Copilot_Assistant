import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  WorkspaceService,
  type WorkspaceRepoDescriptor
} from "@copilot-architect/core";
import {
  CURRENT_SCHEMA_VERSION,
  type CodeSymbol,
  getArtifactDirectoryPath,
  readJsonFile,
  writeJsonFile
} from "@copilot-architect/shared";

import type {
  IndexedFile,
  IndexOptions,
  IndexResult,
  IndexStats,
  IndexStatus,
  LocalIndex,
  SearchOptions,
  SearchResponse,
  SearchResult,
  SimilarFeatureOptions,
  WorkspaceIndexOptions,
  WorkspaceIndexResult,
  WorkspaceSearchOptions,
  WorkspaceSearchResponse,
  WorkspaceSearchResult
} from "./models.js";

const INDEX_VERSION = "0.1.0-json";
const INDEX_FILE_NAME = "index.json";
const STATUS_FILE_NAME = "status.json";
const DEFAULT_MAX_FILE_BYTES = 512_000;
const PREVIEW_LENGTH = 2_000;

export class IndexingService {
  async index(options: IndexOptions = {}): Promise<IndexResult> {
    const startPath = path.resolve(options.startPath ?? process.cwd());
    const repoRoot = await resolveRepoRoot(startPath, options.strictRoot);
    const indexPath = getIndexPath(repoRoot);
    const statusPath = getStatusPath(repoRoot);
    const existingIndex =
      options.rebuild === true ? undefined : await tryReadIndex(indexPath);
    const documents = await scanDocuments(repoRoot, existingIndex, {
      maxFileBytes: options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
    });
    const index: LocalIndex = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      indexVersion: INDEX_VERSION,
      repoRoot,
      documents,
      stats: createStats(documents)
    };
    const mode = options.rebuild ? "rebuild" : existingIndex ? "incremental" : "full";

    await mkdir(getArtifactDirectoryPath(repoRoot, "index"), { recursive: true });
    await writeJsonFile(indexPath, index);
    await writeJsonFile(statusPath, createStatus(repoRoot, index));

    return {
      repoRoot,
      index,
      indexPath,
      statusPath,
      mode
    };
  }

  async search(options: SearchOptions): Promise<SearchResponse> {
    const startPath = path.resolve(options.startPath ?? process.cwd());
    const repoRoot = await resolveRepoRoot(startPath, options.strictRoot);
    const index = await this.readOrCreateIndex(repoRoot, options.strictRoot);
    const results = searchIndex(index, options.query, options.limit ?? 20);

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      query: options.query,
      repoRoot,
      results
    };
  }

  async findSimilarFeatures(options: SimilarFeatureOptions): Promise<SearchResponse> {
    const response = await this.search(options);

    return {
      ...response,
      results: response.results.filter(
        (result) => !result.isConfigFile || result.isTestFile || result.isDocFile
      )
    };
  }

  async status(startPath = process.cwd()): Promise<IndexStatus> {
    const repoRoot = await findRepoRoot(path.resolve(startPath));
    const indexPath = getIndexPath(repoRoot);
    const statusPath = getStatusPath(repoRoot);
    const index = await tryReadIndex(indexPath);

    return createStatus(repoRoot, index, indexPath, statusPath);
  }

  async indexWorkspace(
    options: WorkspaceIndexOptions = {}
  ): Promise<WorkspaceIndexResult> {
    const workspaceService = new WorkspaceService();
    const workspaceMap = await workspaceService.createWorkspaceMap({
      startPath: options.startPath
    });
    const results = [];

    for (const repo of workspaceMap.repos) {
      results.push({
        repo,
        result: await this.index({
          startPath: repo.repoRoot,
          rebuild: options.rebuild,
          maxFileBytes: options.maxFileBytes
        })
      });
    }

    return {
      workspace: workspaceMap.workspace,
      workspacePath: workspaceMap.workspacePath,
      repoMapPath: workspaceMap.repoMapPath,
      repos: workspaceMap.repos,
      results
    };
  }

  async searchWorkspace(
    options: WorkspaceSearchOptions
  ): Promise<WorkspaceSearchResponse> {
    const workspaceService = new WorkspaceService();
    const workspace = await workspaceService.show({ startPath: options.startPath });
    const repos = workspaceService.resolveRepos(workspace.workspace);
    const results = [];

    for (const repo of repos) {
      results.push({
        repo,
        response: await this.search({
          startPath: repo.repoRoot,
          query: options.query,
          limit: options.limit
        })
      });
    }

    const combinedResults = combineWorkspaceResults(results);

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      query: options.query,
      workspace: workspace.workspace,
      repos,
      results,
      combinedResults
    };
  }

  private async readOrCreateIndex(
    repoRoot: string,
    strictRoot?: boolean
  ): Promise<LocalIndex> {
    const index = await tryReadIndex(getIndexPath(repoRoot));

    if (index) {
      return index;
    }

    return (await this.index({ startPath: repoRoot, strictRoot })).index;
  }
}

function combineWorkspaceResults(
  entries: Array<{
    repo: WorkspaceRepoDescriptor;
    response: SearchResponse;
  }>
): WorkspaceSearchResult[] {
  return entries
    .flatMap((entry) =>
      entry.response.results.map((result) => ({
        ...result,
        repoName: entry.repo.name,
        repoRole: entry.repo.role,
        repoRoot: entry.repo.repoRoot
      }))
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.repoName.localeCompare(right.repoName) ||
        left.relativePath.localeCompare(right.relativePath)
    );
}

async function scanDocuments(
  repoRoot: string,
  existingIndex: LocalIndex | undefined,
  options: { maxFileBytes: number }
): Promise<IndexedFile[]> {
  const existingByPath = new Map(
    existingIndex?.documents.map((document) => [document.relativePath, document]) ?? []
  );
  const documents: IndexedFile[] = [];

  await walk(repoRoot, repoRoot, documents, existingByPath, options);

  return documents.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
}

async function walk(
  repoRoot: string,
  directory: string,
  documents: IndexedFile[],
  existingByPath: Map<string, IndexedFile>,
  options: { maxFileBytes: number }
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoredNames.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      await walk(repoRoot, fullPath, documents, existingByPath, options);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStats = await stat(fullPath);
    const relativePath = normalizeRelativePath(path.relative(repoRoot, fullPath));

    if (fileStats.size > options.maxFileBytes || isBinaryFile(relativePath)) {
      continue;
    }

    const text = await readTextFile(fullPath);

    if (text === undefined) {
      continue;
    }

    const contentHash = sha256(text);
    const existing = existingByPath.get(relativePath);

    if (
      existing &&
      existing.contentHash === contentHash &&
      existing.fileSizeBytes === fileStats.size &&
      existing.modifiedTimeMs === fileStats.mtimeMs
    ) {
      documents.push(existing);
      continue;
    }

    documents.push(
      createIndexedFile({
        fullPath,
        relativePath,
        text,
        contentHash,
        modifiedTimeMs: fileStats.mtimeMs,
        fileSizeBytes: fileStats.size
      })
    );
  }
}

function createIndexedFile(input: {
  fullPath: string;
  relativePath: string;
  text: string;
  contentHash: string;
  modifiedTimeMs: number;
  fileSizeBytes: number;
}): IndexedFile {
  const extension = path.extname(input.relativePath);

  return {
    filePath: input.fullPath,
    relativePath: input.relativePath,
    extension,
    languageGuess: guessLanguage(input.relativePath),
    contentHash: input.contentHash,
    modifiedTimeMs: input.modifiedTimeMs,
    fileSizeBytes: input.fileSizeBytes,
    textPreview: input.text.slice(0, PREVIEW_LENGTH),
    symbols: extractSymbols(input.relativePath, input.text),
    imports: extractImports(input.text),
    isTestFile: isTestFile(input.relativePath),
    isConfigFile: isConfigFile(input.relativePath),
    isDocFile: isDocFile(input.relativePath),
    indexedAt: new Date().toISOString()
  };
}

function searchIndex(index: LocalIndex, query: string, limit: number): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (queryTerms.length === 0) {
    return [];
  }

  return index.documents
    .map((document) => scoreDocument(document, normalizedQuery, queryTerms))
    .filter((result): result is SearchResult => Boolean(result))
    .sort(
      (left, right) =>
        right.score - left.score || left.relativePath.localeCompare(right.relativePath)
    )
    .slice(0, limit);
}

function scoreDocument(
  document: IndexedFile,
  normalizedQuery: string,
  queryTerms: string[]
): SearchResult | undefined {
  const matchedFields = new Set<string>();
  let score = 0;
  const pathText = document.relativePath.toLowerCase();
  const previewText = document.textPreview.toLowerCase();
  const symbolText = document.symbols
    .map((symbol) => `${symbol.name} ${symbol.kind}`)
    .join(" ")
    .toLowerCase();
  const importText = document.imports.join(" ").toLowerCase();

  if (pathText.includes(normalizedQuery)) {
    score += 30;
    matchedFields.add("path");
  }

  if (symbolText.includes(normalizedQuery)) {
    score += 20;
    matchedFields.add("symbols");
  }

  if (previewText.includes(normalizedQuery)) {
    score += 12;
    matchedFields.add("preview");
  }

  if (importText.includes(normalizedQuery)) {
    score += 10;
    matchedFields.add("imports");
  }

  for (const term of queryTerms) {
    if (pathText.includes(term)) {
      score += 8;
      matchedFields.add("path");
    }

    if (symbolText.includes(term)) {
      score += 6;
      matchedFields.add("symbols");
    }

    if (previewText.includes(term)) {
      score += 3;
      matchedFields.add("preview");
    }

    if (importText.includes(term)) {
      score += 2;
      matchedFields.add("imports");
    }
  }

  if (score === 0) {
    return undefined;
  }

  return {
    filePath: document.filePath,
    relativePath: document.relativePath,
    score,
    languageGuess: document.languageGuess,
    textPreview: document.textPreview,
    matchedFields: [...matchedFields].sort(),
    symbols: document.symbols,
    imports: document.imports,
    isTestFile: document.isTestFile,
    isConfigFile: document.isConfigFile,
    isDocFile: document.isDocFile
  };
}

function extractSymbols(filePath: string, text: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const patterns = [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /\bfunction\s+([A-Za-z_$][\w$]*)/g,
    /\bclass\s+([A-Za-z_$][\w$]*)/g,
    /\binterface\s+([A-Za-z_$][\w$]*)/g,
    /\bdef\s+([A-Za-z_][\w]*)/g,
    /\bpublic\s+(?:final\s+)?class\s+([A-Za-z_][\w]*)/g
  ] as const;

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1];

      if (!name) {
        continue;
      }

      symbols.push({
        name,
        kind: inferSymbolKind(match[0]),
        filePath,
        startLine: lineNumberAt(text, match.index ?? 0)
      });
    }
  }

  return dedupeSymbols(symbols).slice(0, 100);
}

function extractImports(text: string): string[] {
  const imports = new Set<string>();
  const patterns = [
    /^\s*import\s+.*?\s+from\s+["']([^"']+)["']/gm,
    /^\s*import\s+["']([^"']+)["']/gm,
    /^\s*from\s+([\w.]+)\s+import\s+/gm,
    /^\s*import\s+([\w.]+)/gm,
    /^\s*#include\s+[<"]([^>"]+)[>"]/gm,
    /^\s*include\s+["']?([^"'\s]+)["']?/gm,
    /require\(["']([^"']+)["']\)/g
  ] as const;

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) {
        imports.add(match[1]);
      }
    }
  }

  return [...imports].sort((left, right) => left.localeCompare(right)).slice(0, 100);
}

function createStats(documents: IndexedFile[]): IndexStats {
  const languageCounts: Record<string, number> = {};

  for (const document of documents) {
    languageCounts[document.languageGuess] =
      (languageCounts[document.languageGuess] ?? 0) + 1;
  }

  return {
    documentCount: documents.length,
    indexedFileCount: documents.length,
    skippedFileCount: 0,
    totalBytes: documents.reduce(
      (total, document) => total + document.fileSizeBytes,
      0
    ),
    languageCounts,
    testFileCount: documents.filter((document) => document.isTestFile).length,
    configFileCount: documents.filter((document) => document.isConfigFile).length,
    docFileCount: documents.filter((document) => document.isDocFile).length
  };
}

function createStatus(
  repoRoot: string,
  index: LocalIndex | undefined,
  indexPath = getIndexPath(repoRoot),
  statusPath = getStatusPath(repoRoot)
): IndexStatus {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    repoRoot,
    indexPath,
    statusPath,
    documentCount: index?.documents.length ?? 0,
    lastIndexedAt: index?.generatedAt,
    exists: Boolean(index)
  };
}

async function findRepoRoot(startPath: string): Promise<string> {
  const startStats = await stat(startPath);
  let current = startStats.isDirectory() ? startPath : path.dirname(startPath);

  while (true) {
    if (await pathExists(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return startStats.isDirectory() ? startPath : path.dirname(startPath);
    }

    current = parent;
  }
}

async function resolveRepoRoot(
  startPath: string,
  strictRoot: boolean | undefined
): Promise<string> {
  if (!strictRoot) {
    return findRepoRoot(startPath);
  }

  const startStats = await stat(startPath);
  return startStats.isDirectory() ? startPath : path.dirname(startPath);
}

async function tryReadIndex(indexPath: string): Promise<LocalIndex | undefined> {
  try {
    return await readJsonFile<LocalIndex>(indexPath);
  } catch {
    return undefined;
  }
}

async function readTextFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function getIndexPath(repoRoot: string): string {
  return path.join(getArtifactDirectoryPath(repoRoot, "index"), INDEX_FILE_NAME);
}

function getStatusPath(repoRoot: string): string {
  return path.join(getArtifactDirectoryPath(repoRoot, "index"), STATUS_FILE_NAME);
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function guessLanguage(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath).toLowerCase();

  if ([".ts", ".tsx", ".mts", ".cts"].includes(extension)) return "TypeScript";
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension)) return "JavaScript";
  if (extension === ".py") return "Python";
  if (extension === ".java") return "Java";
  if ([".md", ".rst"].includes(extension)) return "Markdown";
  if ([".json", ".yaml", ".yml", ".toml", ".ini", ".cfg"].includes(extension)) {
    return "Config";
  }
  if (extension === ".sql") return "SQL";
  if ([".sh", ".bash", ".zsh"].includes(extension)) return "Shell";
  if (name === "dockerfile" || name === "makefile") return "Config";

  return extension ? extension.slice(1).toUpperCase() : "Text";
}

function isTestFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const name = path.basename(lower);
  return (
    lower.includes("/test/") ||
    lower.includes("/tests/") ||
    lower.includes("/__tests__/") ||
    lower.includes("/spec/") ||
    name.includes(".test.") ||
    name.includes(".spec.") ||
    name.startsWith("test_")
  );
}

function isConfigFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const name = path.basename(lower);
  return (
    lower.endsWith(".json") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".ini") ||
    lower.endsWith(".cfg") ||
    lower.endsWith(".xml") ||
    lower.includes("config") ||
    [
      "dockerfile",
      "makefile",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "pom.xml",
      "build.gradle",
      "settings.gradle"
    ].includes(name)
  );
}

function isDocFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".md") || lower.startsWith("docs/") || lower.endsWith(".rst");
}

function isBinaryFile(filePath: string): boolean {
  return binaryExtensions.has(path.extname(filePath).toLowerCase());
}

function inferSymbolKind(matchText: string): string {
  if (matchText.includes("class")) return "class";
  if (matchText.includes("interface")) return "interface";
  if (matchText.includes("def ")) return "function";
  return "function";
}

function lineNumberAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function dedupeSymbols(symbols: CodeSymbol[]): CodeSymbol[] {
  const byKey = new Map<string, CodeSymbol>();

  for (const symbol of symbols) {
    byKey.set(`${symbol.kind}:${symbol.name}:${symbol.startLine ?? ""}`, symbol);
  }

  return [...byKey.values()];
}

const ignoredNames = new Set([
  ".git",
  ".copilot-architect",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".angular",
  "target",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  "vendor",
  ".idea",
  ".vscode",
  ".DS_Store"
]);

const binaryExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".jar",
  ".class",
  ".exe",
  ".dll",
  ".so",
  ".dylib"
]);
