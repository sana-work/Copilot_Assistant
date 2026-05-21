import type { CodeSymbol } from "@copilot-architect/shared";
import type {
  WorkspaceRepoDescriptor,
  WorkspaceServiceResult
} from "@copilot-architect/core";

export interface LocalIndex {
  schemaVersion: string;
  generatedAt: string;
  indexVersion: string;
  repoRoot: string;
  documents: IndexedFile[];
  stats: IndexStats;
}

export interface IndexedFile {
  filePath: string;
  relativePath: string;
  extension: string;
  languageGuess: string;
  contentHash: string;
  modifiedTimeMs: number;
  fileSizeBytes: number;
  textPreview: string;
  symbols: CodeSymbol[];
  imports: string[];
  isTestFile: boolean;
  isConfigFile: boolean;
  isDocFile: boolean;
  indexedAt: string;
}

export interface IndexStats {
  documentCount: number;
  indexedFileCount: number;
  skippedFileCount: number;
  totalBytes: number;
  languageCounts: Record<string, number>;
  testFileCount: number;
  configFileCount: number;
  docFileCount: number;
}

export interface IndexStatus {
  schemaVersion: string;
  generatedAt: string;
  repoRoot: string;
  indexPath: string;
  statusPath: string;
  documentCount: number;
  lastIndexedAt?: string;
  exists: boolean;
}

export interface IndexOptions {
  startPath?: string;
  rebuild?: boolean;
  maxFileBytes?: number;
}

export interface IndexResult {
  repoRoot: string;
  index: LocalIndex;
  indexPath: string;
  statusPath: string;
  mode: "full" | "incremental" | "rebuild";
}

export interface SearchOptions {
  startPath?: string;
  query: string;
  limit?: number;
}

export interface SearchResult {
  filePath: string;
  relativePath: string;
  score: number;
  languageGuess: string;
  textPreview: string;
  matchedFields: string[];
  symbols: CodeSymbol[];
  imports: string[];
  isTestFile: boolean;
  isConfigFile: boolean;
  isDocFile: boolean;
}

export interface SearchResponse {
  schemaVersion: string;
  generatedAt: string;
  query: string;
  repoRoot: string;
  results: SearchResult[];
}

export interface SimilarFeatureOptions {
  startPath?: string;
  query: string;
  limit?: number;
}

export interface WorkspaceIndexOptions {
  startPath?: string;
  rebuild?: boolean;
  maxFileBytes?: number;
}

export interface WorkspaceIndexEntry {
  repo: WorkspaceRepoDescriptor;
  result: IndexResult;
}

export interface WorkspaceIndexResult {
  workspace: WorkspaceServiceResult["workspace"];
  workspacePath: string;
  repoMapPath: string;
  repos: WorkspaceRepoDescriptor[];
  results: WorkspaceIndexEntry[];
}

export interface WorkspaceSearchOptions {
  startPath?: string;
  query: string;
  limit?: number;
}

export interface WorkspaceSearchResult extends SearchResult {
  repoName: string;
  repoRole?: string;
  repoRoot: string;
}

export interface WorkspaceSearchEntry {
  repo: WorkspaceRepoDescriptor;
  response: SearchResponse;
}

export interface WorkspaceSearchResponse {
  schemaVersion: string;
  generatedAt: string;
  query: string;
  workspace: WorkspaceServiceResult["workspace"];
  repos: WorkspaceRepoDescriptor[];
  results: WorkspaceSearchEntry[];
  combinedResults: WorkspaceSearchResult[];
}
