import {
  AdapterDetectionResult,
  AdapterScore,
  GenericFallbackResult
} from "./results.js";
import { AdapterCapability, type AdapterContext, type IAdapter } from "./types.js";
import {
  fileName,
  filesMatching,
  fileTextIncludes,
  inferFoldersBySegment,
  pathSegments
} from "./utils.js";

export class GenericTextAdapter implements IAdapter {
  readonly name = "generic-text";
  readonly version = "0.1.0";
  readonly capabilities = [
    new AdapterCapability(
      "fallback",
      "generic-text-indexing",
      "Fallback support through file scanning, indexing, search, and custom commands."
    ),
    new AdapterCapability(
      "repo-heuristics",
      "generic-repo-heuristics",
      "Basic repo heuristics for unknown or custom repositories."
    )
  ];

  canHandle(): boolean {
    return true;
  }

  detect(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context, "Generic fallback detection completed.");
  }

  analyze(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context, "Generic fallback analysis completed.");
  }

  private createResult(
    context: AdapterContext,
    message: string
  ): GenericFallbackResult {
    return new GenericFallbackResult({
      adapterName: this.name,
      adapterVersion: this.version,
      capabilities: this.capabilities,
      fallbackReason:
        "No specialized adapter matched; using universal text indexing and custom command support.",
      score: new AdapterScore({
        value: context.files.length > 0 ? 0.3 : 0.2,
        reasons: ["Generic fallback is always available."]
      }),
      sourceFolders: inferFoldersBySegment(context, [
        "src",
        "lib",
        "app",
        "packages",
        "cmd"
      ]),
      testFolders: inferFoldersBySegment(context, [
        "test",
        "tests",
        "__tests__",
        "spec",
        "e2e"
      ]),
      configFiles: context.files
        .map((file) => file.path)
        .filter((filePath) => isLikelyConfigFile(filePath)),
      featurePatterns: detectGenericFeaturePatterns(context),
      architecturalPatterns: [
        "generic-text-indexing",
        ...(fileTextIncludes(context, hasImportOrInclude)
          ? ["import-include-usage"]
          : [])
      ],
      diagnostics: [
        {
          severity: "info",
          code: "GENERIC_FALLBACK",
          message
        }
      ]
    });
  }
}

function isLikelyConfigFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".json") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".ini") ||
    lower.endsWith("dockerfile") ||
    lower.includes("config")
  );
}

function detectGenericFeaturePatterns(context: AdapterContext) {
  const docs = filesMatching(context, isDocFile);
  const tests = filesMatching(context, isGenericTestFile);
  const patterns = [];

  if (docs.length > 0) {
    patterns.push({
      id: "generic-docs",
      name: "Documentation files",
      summary: "Documentation files detected.",
      files: docs,
      symbols: [],
      tags: ["docs"],
      confidence: "medium" as const
    });
  }

  if (tests.length > 0) {
    patterns.push({
      id: "generic-tests",
      name: "Generic test files",
      summary: "Test files detected from common naming conventions.",
      files: tests,
      symbols: [],
      tags: ["tests"],
      confidence: "medium" as const
    });
  }

  if (fileTextIncludes(context, hasImportOrInclude)) {
    patterns.push({
      id: "generic-imports",
      name: "Import/include usage",
      summary: "Import or include statements detected in source text.",
      files: context.files
        .filter((file) => file.text && hasImportOrInclude(file.text))
        .map((file) => file.path),
      symbols: [],
      tags: ["imports"],
      confidence: "low" as const
    });
  }

  return patterns;
}

function isDocFile(filePath: string): boolean {
  const name = fileName(filePath).toLowerCase();
  return (
    pathSegments(filePath).includes("docs") ||
    name === "readme.md" ||
    name.endsWith(".md") ||
    name.endsWith(".rst")
  );
}

function isGenericTestFile(filePath: string): boolean {
  const name = fileName(filePath).toLowerCase();
  return (
    pathSegments(filePath).some((segment) =>
      ["test", "tests", "__tests__", "spec"].includes(segment)
    ) ||
    name.includes(".test.") ||
    name.includes(".spec.") ||
    name.startsWith("test_")
  );
}

function hasImportOrInclude(text: string): boolean {
  return /^\s*(import|from|require\(|#include|include\s)/m.test(text);
}
