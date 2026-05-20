import type {
  BuildCommand,
  FormatCommand,
  FrameworkInfo,
  LanguageInfo,
  LintCommand,
  PackageManagerInfo,
  TestCommand,
  ValidationCommand
} from "@copilot-architect/shared";

import { AdapterDetectionResult, AdapterScore } from "./results.js";
import {
  AdapterCapability,
  type AdapterContext,
  type IBuildCommandDetector,
  type IFormatCommandDetector,
  type ILanguageAdapter,
  type ILintCommandDetector,
  type IPackageManagerDetector,
  type IRepoHeuristicsProvider,
  type ITestCommandDetector
} from "./types.js";
import {
  buildScriptCommand,
  detectJavaScriptPackageManagers,
  fileName,
  filesMatching,
  formatScriptCommand,
  getPackageJson,
  hasAnyExtension,
  hasPackageDependency,
  inferFoldersBySegment,
  lintScriptCommand,
  preferredJavaScriptPackageManager,
  testScriptCommand,
  validationScriptCommand
} from "./utils.js";

export class JavaScriptTypeScriptAdapter
  implements
    ILanguageAdapter,
    IPackageManagerDetector,
    IBuildCommandDetector,
    ITestCommandDetector,
    ILintCommandDetector,
    IFormatCommandDetector,
    IRepoHeuristicsProvider
{
  readonly name = "javascript-typescript";
  readonly version = "0.1.0";
  readonly capabilities = [
    new AdapterCapability("language", "javascript"),
    new AdapterCapability("language", "typescript"),
    new AdapterCapability("package-manager", "npm-pnpm-yarn"),
    new AdapterCapability("build-command", "package-json-build-scripts"),
    new AdapterCapability("test-command", "package-json-test-scripts"),
    new AdapterCapability("lint-command", "package-json-lint-scripts"),
    new AdapterCapability("format-command", "package-json-format-scripts"),
    new AdapterCapability("repo-heuristics", "javascript-typescript-layout")
  ];

  canHandle(context: AdapterContext): boolean {
    return (
      context.hasFile("package.json") ||
      context.hasFile("tsconfig.json") ||
      context.hasFile("jsconfig.json") ||
      context.files.some((file) => isJsTsSource(file.path)) ||
      context.files.some((file) => isKnownJsToolConfig(file.path))
    );
  }

  detect(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  analyze(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  detectLanguages(context: AdapterContext): LanguageInfo[] {
    const languages: LanguageInfo[] = [];
    const hasTypeScript =
      context.hasFile("tsconfig.json") ||
      context.files.some((file) =>
        hasAnyExtension(file.path, [".ts", ".tsx", ".mts", ".cts"])
      );
    const hasJavaScript =
      context.hasFile("jsconfig.json") ||
      context.files.some((file) =>
        hasAnyExtension(file.path, [".js", ".jsx", ".mjs", ".cjs"])
      );

    if (hasTypeScript) {
      languages.push({
        name: "TypeScript",
        fileExtensions: [".ts", ".tsx", ".mts", ".cts"],
        confidence: context.hasFile("tsconfig.json") ? "high" : "medium",
        source: context.hasFile("tsconfig.json") ? "tsconfig.json" : "source files"
      });
    }

    if (hasJavaScript || (context.hasFile("package.json") && languages.length === 0)) {
      languages.push({
        name: "JavaScript",
        fileExtensions: [".js", ".jsx", ".mjs", ".cjs"],
        confidence:
          context.hasFile("jsconfig.json") || hasJavaScript ? "high" : "medium",
        source: context.hasFile("jsconfig.json") ? "jsconfig.json" : "source files"
      });
    }

    return languages;
  }

  detectFrameworks(context: AdapterContext): FrameworkInfo[] {
    const packageJson = getPackageJson(context);
    const frameworks: FrameworkInfo[] = [];

    if (
      hasPackageDependency(packageJson, "express") ||
      hasPackageDependency(packageJson, "fastify") ||
      hasPackageDependency(packageJson, "@nestjs/core") ||
      packageJson?.engines?.node
    ) {
      frameworks.push({
        name: "Node.js",
        ecosystem: "javascript",
        confidence: packageJson?.engines?.node ? "high" : "medium",
        evidence: ["package.json"]
      });
    }

    return frameworks;
  }

  detectPackageManagers(context: AdapterContext): PackageManagerInfo[] {
    return detectJavaScriptPackageManagers(context);
  }

  detectBuildCommands(context: AdapterContext): BuildCommand[] {
    return packageScriptCommands(context).build;
  }

  detectTestCommands(context: AdapterContext): TestCommand[] {
    return packageScriptCommands(context).test;
  }

  detectLintCommands(context: AdapterContext): LintCommand[] {
    return packageScriptCommands(context).lint;
  }

  detectFormatCommands(context: AdapterContext): FormatCommand[] {
    return packageScriptCommands(context).format;
  }

  detectValidationCommands(context: AdapterContext): ValidationCommand[] {
    return packageScriptCommands(context).validation;
  }

  detectSourceFolders(context: AdapterContext): string[] {
    return inferFoldersBySegment(context, ["src", "lib", "app", "packages"]);
  }

  detectTestFolders(context: AdapterContext): string[] {
    return inferFoldersBySegment(context, [
      "test",
      "tests",
      "__tests__",
      "spec",
      "e2e"
    ]);
  }

  detectConfigFiles(context: AdapterContext): string[] {
    return filesMatching(
      context,
      (filePath) =>
        [
          "package.json",
          "package-lock.json",
          "pnpm-lock.yaml",
          "yarn.lock",
          "tsconfig.json",
          "jsconfig.json"
        ].includes(filePath) || isKnownJsToolConfig(filePath)
    );
  }

  detectArchitecturalPatterns(context: AdapterContext): string[] {
    const patterns = ["javascript-typescript-project"];

    if (context.hasFile("tsconfig.json")) {
      patterns.push("typescript-configured");
    }

    if (context.files.some((file) => file.path.startsWith("packages/"))) {
      patterns.push("javascript-monorepo-layout");
    }

    return patterns;
  }

  private createResult(context: AdapterContext): AdapterDetectionResult {
    const commands = packageScriptCommands(context);
    const evidence = scoreEvidence(context);

    return new AdapterDetectionResult({
      adapterName: this.name,
      adapterVersion: this.version,
      capabilities: this.capabilities,
      score: new AdapterScore({
        value: Math.min(0.95, 0.25 + evidence.length * 0.15),
        reasons: evidence
      }),
      languages: this.detectLanguages(context),
      frameworks: this.detectFrameworks(context),
      packageManagers: this.detectPackageManagers(context),
      commands,
      sourceFolders: this.detectSourceFolders(context),
      testFolders: this.detectTestFolders(context),
      configFiles: this.detectConfigFiles(context),
      architecturalPatterns: this.detectArchitecturalPatterns(context)
    });
  }
}

function packageScriptCommands(context: AdapterContext): {
  build: BuildCommand[];
  test: TestCommand[];
  lint: LintCommand[];
  format: FormatCommand[];
  validation: ValidationCommand[];
} {
  const packageJson = getPackageJson(context);
  const scripts = packageJson?.scripts ?? {};
  const packageManager = preferredJavaScriptPackageManager(
    detectJavaScriptPackageManagers(context)
  );

  return {
    build: "build" in scripts ? [buildScriptCommand(packageManager, "build")] : [],
    test: [
      ...("test" in scripts ? [testScriptCommand(packageManager, "test")] : []),
      ...("e2e" in scripts ? [testScriptCommand(packageManager, "e2e", "medium")] : [])
    ],
    lint: "lint" in scripts ? [lintScriptCommand(packageManager, "lint")] : [],
    format: "format" in scripts ? [formatScriptCommand(packageManager, "format")] : [],
    validation: [
      ...("typecheck" in scripts
        ? [validationScriptCommand(packageManager, "typecheck")]
        : []),
      ...("e2e" in scripts ? [validationScriptCommand(packageManager, "e2e")] : [])
    ]
  };
}

function scoreEvidence(context: AdapterContext): string[] {
  const evidence: string[] = [];

  for (const filePath of [
    "package.json",
    "tsconfig.json",
    "jsconfig.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock"
  ]) {
    if (context.hasFile(filePath)) {
      evidence.push(filePath);
    }
  }

  if (context.files.some((file) => isJsTsSource(file.path))) {
    evidence.push("source files");
  }

  return evidence;
}

function isJsTsSource(filePath: string): boolean {
  return hasAnyExtension(filePath, [
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".mts",
    ".cts"
  ]);
}

function isKnownJsToolConfig(filePath: string): boolean {
  const name = fileName(filePath);
  return (
    name.startsWith("vite.config.") ||
    name.startsWith("next.config.") ||
    name.startsWith("webpack.config.") ||
    name.startsWith("eslint.config.") ||
    name.startsWith("prettier.config.") ||
    name.startsWith(".eslintrc") ||
    name.startsWith(".prettierrc")
  );
}
