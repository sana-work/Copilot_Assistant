import {
  AdapterDetectionResult,
  AdapterScore,
  GenericFallbackResult
} from "./results.js";
import { AdapterCapability, type AdapterContext, type IAdapter } from "./types.js";

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
        value: 0.2,
        reasons: ["Generic fallback is always available."]
      }),
      sourceFolders: inferFolders(context, ["src", "lib", "app", "packages"]),
      testFolders: inferFolders(context, ["test", "tests", "__tests__", "spec"]),
      configFiles: context.files
        .map((file) => file.path)
        .filter((filePath) => isLikelyConfigFile(filePath)),
      architecturalPatterns: ["generic-text-indexing"],
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

function inferFolders(context: AdapterContext, names: string[]): string[] {
  const matches = new Set<string>();

  for (const file of context.files) {
    const segments = file.path.split("/");
    const match = segments.find((segment) => names.includes(segment));

    if (match) {
      matches.add(match);
    }
  }

  return [...matches].sort((left, right) => left.localeCompare(right));
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
