import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  type AdapterDetectionResult,
  createDefaultAdapterRegistry,
  type AdapterContextInput,
  type AdapterFile
} from "@copilot-architect/adapters";
import {
  CURRENT_SCHEMA_VERSION,
  type ArchitectureSummary,
  type DiagnosticMessage,
  type FeaturePattern,
  type ProjectMap,
  type RepoMap,
  type UniversalRepoMap,
  ensureArtifactDirectories,
  getArtifactFilePath,
  writeJsonFile
} from "@copilot-architect/shared";

export interface RepoDiscoveryOptions {
  startPath?: string;
  outputPath?: string;
  maxFileBytes?: number;
}

export interface RepoDiscoveryResult {
  repoRoot: string;
  repoMap: UniversalRepoMap;
  repoMapPath: string;
}

export class RepoDiscoveryService {
  async analyze(options: RepoDiscoveryOptions = {}): Promise<RepoDiscoveryResult> {
    const startPath = path.resolve(options.startPath ?? process.cwd());
    const repoRoot = await findRepoRoot(startPath);
    const files = await scanRepoFiles(repoRoot, options.maxFileBytes);
    const adapterContext: AdapterContextInput = {
      repoRoot,
      workspaceRoot: repoRoot,
      files
    };
    const adapterResult = await createDefaultAdapterRegistry().analyze(adapterContext);
    const repoMap = buildUniversalRepoMap(repoRoot, files, adapterResult.merged);
    const repoMapPath = resolveOutputPath(repoRoot, options.outputPath);

    await writeRepoMap(repoRoot, repoMapPath, repoMap);

    return {
      repoRoot,
      repoMap,
      repoMapPath
    };
  }
}

function resolveOutputPath(repoRoot: string, outputPath: string | undefined): string {
  if (!outputPath) {
    return getArtifactFilePath(repoRoot, "repoMap");
  }

  return path.isAbsolute(outputPath) ? outputPath : path.resolve(repoRoot, outputPath);
}

async function writeRepoMap(
  repoRoot: string,
  repoMapPath: string,
  repoMap: UniversalRepoMap
): Promise<void> {
  const defaultPath = getArtifactFilePath(repoRoot, "repoMap");

  if (repoMapPath === defaultPath) {
    await ensureArtifactDirectories(repoRoot);
    await writeJsonFile(repoMapPath, repoMap);
    return;
  }

  await ensureArtifactDirectories(repoRoot);
  await writeJsonFile(defaultPath, repoMap);
  await writeJsonFile(repoMapPath, repoMap);
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

async function scanRepoFiles(
  repoRoot: string,
  maxFileBytes = 256_000
): Promise<AdapterFile[]> {
  const files: AdapterFile[] = [];

  await walkDirectory(repoRoot, repoRoot, files, maxFileBytes);

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function walkDirectory(
  repoRoot: string,
  directory: string,
  files: AdapterFile[],
  maxFileBytes: number
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
      await walkDirectory(repoRoot, fullPath, files, maxFileBytes);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStats = await stat(fullPath);
    const relativePath = normalizeRelativePath(path.relative(repoRoot, fullPath));
    const adapterFile: AdapterFile = {
      path: relativePath,
      extension: path.extname(entry.name),
      sizeBytes: fileStats.size
    };

    if (fileStats.size <= maxFileBytes && shouldReadText(relativePath)) {
      try {
        adapterFile.text = await readFile(fullPath, "utf8");
      } catch {
        // Binary or invalid UTF-8 files are still useful by path.
      }
    }

    files.push(adapterFile);
  }
}

function buildUniversalRepoMap(
  repoRoot: string,
  files: AdapterFile[],
  detection: DiscoveryDetection
): UniversalRepoMap {
  const repoMap = createRepoMap(repoRoot, files, detection);
  const summary = createArchitectureSummary([repoMap]);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    workspaceRoot: repoRoot,
    repos: [repoMap],
    summary
  };
}

function createRepoMap(
  repoRoot: string,
  files: AdapterFile[],
  detection: DiscoveryDetection
): RepoMap {
  const documentationFiles = detectDocumentationFiles(files);
  const projectRoots = detectProjectRoots(files);
  const architecturalPatterns = [
    ...detection.architecturalPatterns,
    ...(projectRoots.length > 1 ? ["monorepo"] : ["single-project"]),
    ...(detection.languages.length > 1 ? ["polyglot"] : []),
    ...(documentationFiles.length > 0 ? ["documented-repository"] : [])
  ];
  const projects = createProjects(
    projectRoots,
    detection,
    files,
    architecturalPatterns
  );

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    repoRoot,
    displayName: path.basename(repoRoot),
    projects,
    languages: detection.languages,
    frameworks: detection.frameworks,
    packageManagers: detection.packageManagers,
    commands: detection.commands,
    entryPoints: detection.entryPoints,
    featurePatterns: [
      ...detection.featurePatterns,
      ...docsFeaturePattern(documentationFiles)
    ],
    documentationFiles,
    architecturalPatterns: uniqueSorted(architecturalPatterns),
    diagnostics: createDiagnostics(repoRoot, detection.diagnostics, projectRoots)
  };
}

function createProjects(
  projectRoots: string[],
  detection: DiscoveryDetection,
  files: AdapterFile[],
  architecturalPatterns: string[]
): ProjectMap[] {
  return projectRoots.map((projectRoot) => {
    const projectFiles = files.filter(
      (file) => projectRoot === "." || file.path.startsWith(`${projectRoot}/`)
    );

    return {
      id: projectRoot === "." ? "root" : projectRoot.replaceAll("/", "-"),
      name: projectRoot === "." ? "root" : path.basename(projectRoot),
      rootPath: projectRoot,
      sourceFolders: uniqueSorted([
        ...filterPathsForProject(detection.sourceFolders, projectRoot),
        ...detectFoldersForProject(projectFiles, projectRoot, [
          "src",
          "lib",
          "app",
          "main",
          "java"
        ])
      ]),
      testFolders: uniqueSorted([
        ...filterPathsForProject(detection.testFolders, projectRoot),
        ...detectFoldersForProject(projectFiles, projectRoot, [
          "test",
          "tests",
          "__tests__",
          "spec",
          "e2e"
        ])
      ]),
      configFiles: projectFiles
        .map((file) => file.path)
        .filter(isLikelyConfigFile)
        .sort((left, right) => left.localeCompare(right)),
      languages: detection.languages,
      frameworks: detection.frameworks,
      packageManagers: detection.packageManagers,
      entryPoints: detection.entryPoints.filter(
        (entryPoint) =>
          projectRoot === "." || entryPoint.filePath.startsWith(`${projectRoot}/`)
      ),
      architecturalPatterns
    };
  });
}

function filterPathsForProject(paths: string[], projectRoot: string): string[] {
  if (projectRoot === ".") {
    return paths;
  }

  return paths.filter(
    (folderPath) =>
      folderPath === projectRoot || folderPath.startsWith(`${projectRoot}/`)
  );
}

function detectFoldersForProject(
  files: AdapterFile[],
  projectRoot: string,
  folderNames: string[]
): string[] {
  const folders = new Set<string>();

  for (const file of files) {
    const relativeToProject =
      projectRoot === "." ? file.path : file.path.slice(projectRoot.length + 1);
    const segments = relativeToProject.split("/");
    const matchIndex = segments.findIndex((segment) => folderNames.includes(segment));

    if (matchIndex >= 0) {
      const folderPath = segments.slice(0, matchIndex + 1).join("/");
      folders.add(projectRoot === "." ? folderPath : `${projectRoot}/${folderPath}`);
    }
  }

  return [...folders];
}

function createArchitectureSummary(repoMaps: RepoMap[]): ArchitectureSummary {
  const primaryLanguages = uniqueSorted(
    repoMaps.flatMap((repoMap) => repoMap.languages.map((language) => language.name))
  );
  const primaryFrameworks = uniqueSorted(
    repoMaps.flatMap((repoMap) => repoMap.frameworks.map((framework) => framework.name))
  );

  return {
    summary: `Detected ${repoMaps.length} repo(s), ${primaryLanguages.length} language(s), and ${primaryFrameworks.length} framework(s).`,
    primaryLanguages,
    primaryFrameworks,
    projectCount: repoMaps.reduce(
      (total, repoMap) => total + repoMap.projects.length,
      0
    ),
    repoCount: repoMaps.length
  };
}

function detectProjectRoots(files: AdapterFile[]): string[] {
  const roots = new Set<string>();
  const packageJson = files.find((file) => file.path === "package.json");
  const workspacePrefixes = parsePackageWorkspaces(packageJson?.text);

  roots.add(".");

  for (const file of files) {
    if (
      file.path.match(/^(apps|packages|services|libs)\/[^/]+\/package\.json$/) ||
      file.path.match(/^(apps|packages|services|libs)\/[^/]+\/pyproject\.toml$/) ||
      file.path.match(/^(apps|packages|services|libs)\/[^/]+\/pom\.xml$/) ||
      file.path.match(/^(apps|packages|services|libs)\/[^/]+\/build\.gradle(\.kts)?$/)
    ) {
      roots.add(file.path.split("/").slice(0, 2).join("/"));
    }

    for (const workspacePrefix of workspacePrefixes) {
      if (
        file.path.startsWith(`${workspacePrefix}/`) &&
        file.path.split("/").length >= 3 &&
        [
          "package.json",
          "pyproject.toml",
          "pom.xml",
          "build.gradle",
          "build.gradle.kts"
        ].includes(path.basename(file.path))
      ) {
        roots.add(file.path.split("/").slice(0, 2).join("/"));
      }
    }
  }

  return [...roots].sort((left, right) => left.localeCompare(right));
}

function parsePackageWorkspaces(text: string | undefined): string[] {
  if (!text) {
    return [];
  }

  try {
    const packageJson = JSON.parse(text) as {
      workspaces?: string[] | { packages?: string[] };
    };
    const workspaces = Array.isArray(packageJson.workspaces)
      ? packageJson.workspaces
      : (packageJson.workspaces?.packages ?? []);

    return workspaces
      .filter((workspace) => workspace.endsWith("/*"))
      .map((workspace) => workspace.slice(0, -2))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function detectDocumentationFiles(files: AdapterFile[]): string[] {
  return files
    .map((file) => file.path)
    .filter(isDocumentationFile)
    .sort((left, right) => left.localeCompare(right));
}

function docsFeaturePattern(documentationFiles: string[]): FeaturePattern[] {
  if (documentationFiles.length === 0) {
    return [];
  }

  return [
    {
      id: "documentation",
      name: "Documentation",
      summary: "Documentation files detected during repo discovery.",
      files: documentationFiles,
      symbols: [],
      tags: ["docs"],
      confidence: "medium"
    }
  ];
}

function createDiagnostics(
  repoRoot: string,
  adapterDiagnostics: DiagnosticMessage[],
  projectRoots: string[]
): DiagnosticMessage[] {
  return [
    ...adapterDiagnostics,
    {
      severity: "info",
      code: "REPO_DISCOVERY",
      message: `Analyzed ${path.basename(repoRoot)} with ${projectRoots.length} project root(s).`
    }
  ];
}

type DiscoveryDetection = Pick<
  AdapterDetectionResult,
  | "languages"
  | "frameworks"
  | "packageManagers"
  | "commands"
  | "sourceFolders"
  | "testFolders"
  | "configFiles"
  | "entryPoints"
  | "featurePatterns"
  | "architecturalPatterns"
  | "diagnostics"
>;

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
  "vendor",
  ".idea",
  ".vscode",
  ".DS_Store"
]);

const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".py",
  ".java",
  ".gradle",
  ".kts",
  ".xml",
  ".md",
  ".rst",
  ".txt",
  ".cfg"
]);

const textFileNames = new Set([
  "Dockerfile",
  "Makefile",
  "mvnw",
  "gradlew",
  "Pipfile",
  "requirements.txt",
  "setup.py",
  "setup.cfg",
  "pytest.ini",
  "tox.ini",
  "pom.xml",
  "package.json",
  "angular.json"
]);

function shouldReadText(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return (
    textExtensions.has(extension) ||
    textFileNames.has(path.basename(filePath)) ||
    !binaryExtensions.has(extension)
  );
}

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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function isDocumentationFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower === "readme.md" ||
    lower.startsWith("docs/") ||
    lower.endsWith(".md") ||
    lower.endsWith(".rst")
  );
}

function isLikelyConfigFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".json") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".ini") ||
    lower.endsWith(".cfg") ||
    lower.endsWith(".xml") ||
    lower.includes("config") ||
    ["dockerfile", "makefile", "pom.xml", "build.gradle", "settings.gradle"].includes(
      path.basename(lower)
    )
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
