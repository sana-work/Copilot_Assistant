import type {
  BuildCommand,
  ConfidenceLevel,
  FormatCommand,
  LintCommand,
  PackageManagerInfo,
  TestCommand,
  ValidationCommand
} from "@copilot-architect/shared";

import type { AdapterContext, AdapterFile } from "./types.js";

export interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

export function findFile(
  context: AdapterContext,
  predicate: (file: AdapterFile) => boolean
): AdapterFile | undefined {
  return context.files.find(predicate);
}

export function findFiles(
  context: AdapterContext,
  predicate: (file: AdapterFile) => boolean
): AdapterFile[] {
  return context.files.filter(predicate);
}

export function hasFile(
  context: AdapterContext,
  predicate: (file: AdapterFile) => boolean
): boolean {
  return Boolean(findFile(context, predicate));
}

export function fileName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
}

export function fileExtension(filePath: string): string {
  const name = fileName(filePath);
  const lastDot = name.lastIndexOf(".");
  return lastDot >= 0 ? name.slice(lastDot) : "";
}

export function pathSegments(filePath: string): string[] {
  return filePath.split("/").filter(Boolean);
}

export function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

export function hasAnyExtension(filePath: string, extensions: string[]): boolean {
  return extensions.includes(fileExtension(filePath));
}

export function readJsonFile<T>(
  context: AdapterContext,
  targetPath: string
): T | undefined {
  const file = findFile(context, (candidate) => candidate.path === targetPath);

  if (!file?.text) {
    return undefined;
  }

  try {
    return JSON.parse(file.text) as T;
  } catch {
    return undefined;
  }
}

export function getPackageJson(context: AdapterContext): PackageJson | undefined {
  return readJsonFile<PackageJson>(context, "package.json");
}

export function getPackageDependencies(
  packageJson: PackageJson | undefined
): Record<string, string> {
  return {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
    ...(packageJson?.peerDependencies ?? {}),
    ...(packageJson?.optionalDependencies ?? {})
  };
}

export function hasPackageDependency(
  packageJson: PackageJson | undefined,
  dependencyName: string
): boolean {
  return Object.prototype.hasOwnProperty.call(
    getPackageDependencies(packageJson),
    dependencyName
  );
}

export function getPackageDependencyVersion(
  packageJson: PackageJson | undefined,
  dependencyName: string
): string | undefined {
  return getPackageDependencies(packageJson)[dependencyName];
}

export function detectJavaScriptPackageManagers(
  context: AdapterContext
): PackageManagerInfo[] {
  const managers: PackageManagerInfo[] = [];
  const hasPackageJson = context.hasFile("package.json");

  if (context.hasFile("pnpm-lock.yaml")) {
    managers.push({
      name: "pnpm",
      lockfile: "pnpm-lock.yaml",
      manifest: hasPackageJson ? "package.json" : undefined,
      confidence: "high"
    });
  }

  if (context.hasFile("yarn.lock")) {
    managers.push({
      name: "yarn",
      lockfile: "yarn.lock",
      manifest: hasPackageJson ? "package.json" : undefined,
      confidence: "high"
    });
  }

  if (context.hasFile("package-lock.json")) {
    managers.push({
      name: "npm",
      lockfile: "package-lock.json",
      manifest: hasPackageJson ? "package.json" : undefined,
      confidence: "high"
    });
  }

  if (hasPackageJson && managers.length === 0) {
    managers.push({
      name: "npm",
      manifest: "package.json",
      confidence: "medium"
    });
  }

  return managers;
}

export function preferredJavaScriptPackageManager(
  managers: PackageManagerInfo[]
): string {
  return managers[0]?.name ?? "npm";
}

export function scriptCommandParts(
  packageManager: string,
  scriptName: string
): { command: string; args: string[] } {
  if (packageManager === "npm" && scriptName === "test") {
    return { command: "npm", args: ["test"] };
  }

  return { command: packageManager, args: ["run", scriptName] };
}

export function buildScriptCommand(
  packageManager: string,
  scriptName: string,
  confidence: ConfidenceLevel = "high"
): BuildCommand {
  const parts = scriptCommandParts(packageManager, scriptName);
  return {
    kind: "build",
    name: scriptName,
    ...parts,
    confidence,
    source: "package.json scripts"
  };
}

export function testScriptCommand(
  packageManager: string,
  scriptName: string,
  confidence: ConfidenceLevel = "high"
): TestCommand {
  const parts = scriptCommandParts(packageManager, scriptName);
  return {
    kind: "test",
    name: scriptName,
    ...parts,
    confidence,
    source: "package.json scripts"
  };
}

export function lintScriptCommand(
  packageManager: string,
  scriptName: string,
  confidence: ConfidenceLevel = "high"
): LintCommand {
  const parts = scriptCommandParts(packageManager, scriptName);
  return {
    kind: "lint",
    name: scriptName,
    ...parts,
    confidence,
    source: "package.json scripts"
  };
}

export function formatScriptCommand(
  packageManager: string,
  scriptName: string,
  confidence: ConfidenceLevel = "high"
): FormatCommand {
  const parts = scriptCommandParts(packageManager, scriptName);
  return {
    kind: "format",
    name: scriptName,
    ...parts,
    confidence,
    source: "package.json scripts"
  };
}

export function validationScriptCommand(
  packageManager: string,
  scriptName: string,
  confidence: ConfidenceLevel = "high"
): ValidationCommand {
  const parts = scriptCommandParts(packageManager, scriptName);
  return {
    kind: "validation",
    name: scriptName,
    ...parts,
    confidence,
    source: "package.json scripts",
    required: false
  };
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function inferFoldersBySegment(
  context: AdapterContext,
  candidates: string[]
): string[] {
  const matches = new Set<string>();

  for (const file of context.files) {
    const segments = pathSegments(file.path);
    const match = segments.find((segment) => candidates.includes(segment));

    if (match) {
      matches.add(match);
    }
  }

  return uniqueSorted([...matches]);
}

export function filesWithNames(context: AdapterContext, names: string[]): string[] {
  return context.files
    .map((file) => file.path)
    .filter((filePath) => names.includes(fileName(filePath)));
}

export function filesMatching(
  context: AdapterContext,
  predicate: (filePath: string) => boolean
): string[] {
  return context.files.map((file) => file.path).filter(predicate);
}

export function fileTextIncludes(
  context: AdapterContext,
  predicate: (text: string) => boolean
): boolean {
  return context.files.some((file) => file.text && predicate(file.text));
}
