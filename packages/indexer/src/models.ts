import type { CodeSymbol } from "@copilot-architect/shared";

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
