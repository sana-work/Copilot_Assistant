import type {
  BuildCommand,
  ConfidenceLevel,
  FormatCommand,
  FrameworkInfo,
  JsonObject,
  LanguageInfo,
  LintCommand,
  PackageManagerInfo,
  TestCommand
} from "@copilot-architect/shared";

import type { AdapterDetectionResult } from "./results.js";

export type AdapterCapabilityKind =
  | "language"
  | "framework"
  | "package-manager"
  | "build-command"
  | "test-command"
  | "lint-command"
  | "format-command"
  | "repo-heuristics"
  | "fallback";

export interface AdapterFile {
  path: string;
  extension?: string;
  sizeBytes?: number;
  text?: string;
}

export interface AdapterContextInput {
  repoRoot: string;
  workspaceRoot?: string;
  files?: AdapterFile[];
  metadata?: JsonObject;
}

export class AdapterContext {
  readonly repoRoot: string;
  readonly workspaceRoot: string;
  readonly files: AdapterFile[];
  readonly metadata: JsonObject;

  constructor(input: AdapterContextInput) {
    this.repoRoot = input.repoRoot;
    this.workspaceRoot = input.workspaceRoot ?? input.repoRoot;
    this.files = input.files ?? [];
    this.metadata = input.metadata ?? {};
  }

  hasFile(filePath: string): boolean {
    return this.files.some((file) => file.path === filePath);
  }

  findFilesByExtension(extension: string): AdapterFile[] {
    const normalized = extension.startsWith(".") ? extension : `.${extension}`;
    return this.files.filter((file) => {
      const fileExtension = file.extension ?? getFileExtension(file.path);
      return fileExtension === normalized;
    });
  }
}

export class AdapterCapability {
  readonly kind: AdapterCapabilityKind;
  readonly name: string;
  readonly description?: string;

  constructor(kind: AdapterCapabilityKind, name: string, description?: string) {
    this.kind = kind;
    this.name = name;
    this.description = description;
  }
}

export interface IAdapter {
  readonly name: string;
  readonly version: string;
  readonly capabilities: AdapterCapability[];
  canHandle(context: AdapterContext): boolean | Promise<boolean>;
  detect(
    context: AdapterContext
  ): AdapterDetectionResult | Promise<AdapterDetectionResult>;
  analyze(
    context: AdapterContext
  ): AdapterDetectionResult | Promise<AdapterDetectionResult>;
}

export interface ILanguageAdapter extends IAdapter {
  detectLanguages(context: AdapterContext): LanguageInfo[] | Promise<LanguageInfo[]>;
}

export interface IFrameworkDetector extends IAdapter {
  detectFrameworks(context: AdapterContext): FrameworkInfo[] | Promise<FrameworkInfo[]>;
}

export interface IPackageManagerDetector extends IAdapter {
  detectPackageManagers(
    context: AdapterContext
  ): PackageManagerInfo[] | Promise<PackageManagerInfo[]>;
}

export interface IBuildCommandDetector extends IAdapter {
  detectBuildCommands(
    context: AdapterContext
  ): BuildCommand[] | Promise<BuildCommand[]>;
}

export interface ITestCommandDetector extends IAdapter {
  detectTestCommands(context: AdapterContext): TestCommand[] | Promise<TestCommand[]>;
}

export interface ILintCommandDetector extends IAdapter {
  detectLintCommands(context: AdapterContext): LintCommand[] | Promise<LintCommand[]>;
}

export interface IFormatCommandDetector extends IAdapter {
  detectFormatCommands(
    context: AdapterContext
  ): FormatCommand[] | Promise<FormatCommand[]>;
}

export interface IRepoHeuristicsProvider extends IAdapter {
  detectSourceFolders(context: AdapterContext): string[] | Promise<string[]>;
  detectTestFolders(context: AdapterContext): string[] | Promise<string[]>;
  detectConfigFiles(context: AdapterContext): string[] | Promise<string[]>;
  detectArchitecturalPatterns(context: AdapterContext): string[] | Promise<string[]>;
}

function getFileExtension(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot) : "";
}

export function confidenceToRank(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}
