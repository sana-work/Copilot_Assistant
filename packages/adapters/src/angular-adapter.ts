import type {
  BuildCommand,
  FeaturePattern,
  FormatCommand,
  FrameworkInfo,
  LanguageInfo,
  LintCommand,
  TestCommand
} from "@copilot-architect/shared";

import { AdapterDetectionResult, AdapterScore } from "./results.js";
import {
  AdapterCapability,
  type AdapterContext,
  type IBuildCommandDetector,
  type IFrameworkDetector,
  type IFormatCommandDetector,
  type ILanguageAdapter,
  type ILintCommandDetector,
  type IRepoHeuristicsProvider,
  type ITestCommandDetector
} from "./types.js";
import {
  buildScriptCommand,
  detectJavaScriptPackageManagers,
  fileName,
  filesMatching,
  formatScriptCommand,
  getPackageDependencyVersion,
  getPackageJson,
  hasAnyExtension,
  hasPackageDependency,
  inferFoldersBySegment,
  lintScriptCommand,
  preferredJavaScriptPackageManager,
  readJsonFile,
  testScriptCommand
} from "./utils.js";

interface AngularWorkspaceJson {
  projects?: Record<
    string,
    {
      root?: string;
      sourceRoot?: string;
      projectType?: "application" | "library" | string;
    }
  >;
}

export class AngularAdapter
  implements
    ILanguageAdapter,
    IFrameworkDetector,
    IBuildCommandDetector,
    ITestCommandDetector,
    ILintCommandDetector,
    IFormatCommandDetector,
    IRepoHeuristicsProvider
{
  readonly name = "angular";
  readonly version = "0.1.0";
  readonly capabilities = [
    new AdapterCapability("framework", "angular"),
    new AdapterCapability("build-command", "angular-build"),
    new AdapterCapability("test-command", "angular-test"),
    new AdapterCapability("lint-command", "angular-lint"),
    new AdapterCapability("repo-heuristics", "angular-workspace")
  ];

  canHandle(context: AdapterContext): boolean {
    const packageJson = getPackageJson(context);
    return (
      context.hasFile("angular.json") ||
      hasPackageDependency(packageJson, "@angular/core") ||
      hasPackageDependency(packageJson, "@angular/cli")
    );
  }

  detect(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  analyze(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  detectLanguages(context: AdapterContext): LanguageInfo[] {
    return context.files.some((file) => hasAnyExtension(file.path, [".ts", ".html"]))
      ? [
          {
            name: "TypeScript",
            fileExtensions: [".ts", ".html"],
            confidence: "high",
            source: "Angular workspace files"
          }
        ]
      : [];
  }

  detectFrameworks(context: AdapterContext): FrameworkInfo[] {
    const packageJson = getPackageJson(context);
    const frameworks: FrameworkInfo[] = [];

    if (
      context.hasFile("angular.json") ||
      hasPackageDependency(packageJson, "@angular/core")
    ) {
      frameworks.push({
        name: "Angular",
        version: getPackageDependencyVersion(packageJson, "@angular/core"),
        ecosystem: "javascript",
        confidence: context.hasFile("angular.json") ? "high" : "medium",
        evidence: context.hasFile("angular.json")
          ? ["angular.json"]
          : ["package.json dependency: @angular/core"]
      });
    }

    if (hasPackageDependency(packageJson, "@angular/cli")) {
      frameworks.push({
        name: "Angular CLI",
        version: getPackageDependencyVersion(packageJson, "@angular/cli"),
        ecosystem: "javascript",
        confidence: "high",
        evidence: ["package.json dependency: @angular/cli"]
      });
    }

    return frameworks;
  }

  detectBuildCommands(context: AdapterContext): BuildCommand[] {
    const packageCommands = packageScriptCommands(context);
    return [
      {
        kind: "build",
        name: "ng build",
        command: "ng",
        args: ["build"],
        confidence: context.hasFile("angular.json") ? "high" : "medium",
        source: "Angular CLI"
      },
      ...packageCommands.build
    ];
  }

  detectTestCommands(context: AdapterContext): TestCommand[] {
    const packageCommands = packageScriptCommands(context);
    return [
      {
        kind: "test",
        name: "ng test",
        command: "ng",
        args: ["test"],
        confidence: context.hasFile("angular.json") ? "high" : "medium",
        source: "Angular CLI"
      },
      ...packageCommands.test
    ];
  }

  detectLintCommands(context: AdapterContext): LintCommand[] {
    const packageCommands = packageScriptCommands(context);
    return [
      {
        kind: "lint",
        name: "ng lint",
        command: "ng",
        args: ["lint"],
        confidence: "medium",
        source: "Angular CLI"
      },
      ...packageCommands.lint
    ];
  }

  detectFormatCommands(context: AdapterContext): FormatCommand[] {
    return packageScriptCommands(context).format;
  }

  detectSourceFolders(context: AdapterContext): string[] {
    const workspace = readJsonFile<AngularWorkspaceJson>(context, "angular.json");
    const sourceRoots = Object.values(workspace?.projects ?? {})
      .flatMap((project) => [project.sourceRoot, project.root])
      .filter((value): value is string => Boolean(value));

    return [...new Set([...sourceRoots, ...inferFoldersBySegment(context, ["src"])])];
  }

  detectTestFolders(context: AdapterContext): string[] {
    return inferFoldersBySegment(context, ["test", "tests", "e2e", "spec"]);
  }

  detectConfigFiles(context: AdapterContext): string[] {
    return filesMatching(
      context,
      (filePath) =>
        [
          "angular.json",
          "package.json",
          "tsconfig.json",
          "tsconfig.app.json",
          "tsconfig.spec.json"
        ].includes(filePath) || fileName(filePath).startsWith(".eslintrc")
    );
  }

  detectArchitecturalPatterns(context: AdapterContext): string[] {
    const workspace = readJsonFile<AngularWorkspaceJson>(context, "angular.json");
    const projectTypes = Object.values(workspace?.projects ?? {}).map(
      (project) => project.projectType
    );
    const patterns = ["angular-workspace"];

    if (projectTypes.includes("application")) {
      patterns.push("angular-app");
    }

    if (projectTypes.includes("library")) {
      patterns.push("angular-library");
    }

    return patterns;
  }

  private createResult(context: AdapterContext): AdapterDetectionResult {
    const frameworks = this.detectFrameworks(context);
    const featurePatterns = detectAngularFeaturePatterns(context);

    return new AdapterDetectionResult({
      adapterName: this.name,
      adapterVersion: this.version,
      capabilities: this.capabilities,
      score: new AdapterScore({
        value: context.hasFile("angular.json") ? 0.95 : 0.8,
        reasons: frameworks.flatMap((framework) => framework.evidence)
      }),
      languages: this.detectLanguages(context),
      frameworks,
      commands: {
        build: this.detectBuildCommands(context),
        test: this.detectTestCommands(context),
        lint: this.detectLintCommands(context),
        format: this.detectFormatCommands(context)
      },
      sourceFolders: this.detectSourceFolders(context),
      testFolders: this.detectTestFolders(context),
      configFiles: this.detectConfigFiles(context),
      featurePatterns,
      architecturalPatterns: this.detectArchitecturalPatterns(context)
    });
  }
}

function packageScriptCommands(context: AdapterContext): {
  build: BuildCommand[];
  test: TestCommand[];
  lint: LintCommand[];
  format: FormatCommand[];
} {
  const packageJson = getPackageJson(context);
  const scripts = packageJson?.scripts ?? {};
  const packageManager = preferredJavaScriptPackageManager(
    detectJavaScriptPackageManagers(context)
  );

  return {
    build: "build" in scripts ? [buildScriptCommand(packageManager, "build")] : [],
    test: "test" in scripts ? [testScriptCommand(packageManager, "test")] : [],
    lint: "lint" in scripts ? [lintScriptCommand(packageManager, "lint")] : [],
    format: "format" in scripts ? [formatScriptCommand(packageManager, "format")] : []
  };
}

function detectAngularFeaturePatterns(context: AdapterContext): FeaturePattern[] {
  const groups = [
    ["angular-components", "Angular components", ".component.ts"],
    ["angular-services", "Angular services", ".service.ts"],
    ["angular-modules", "Angular modules", ".module.ts"],
    ["angular-guards", "Angular guards", ".guard.ts"],
    ["angular-interceptors", "Angular interceptors", ".interceptor.ts"],
    ["angular-specs", "Angular spec files", ".spec.ts"]
  ] as const;

  return groups
    .map(([id, name, suffix]) => ({
      id,
      name,
      files: filesMatching(context, (filePath) => filePath.endsWith(suffix))
    }))
    .filter((group) => group.files.length > 0)
    .map((group) => ({
      id: group.id,
      name: group.name,
      summary: `${group.name} detected from Angular file naming conventions.`,
      files: group.files,
      symbols: [],
      tags: ["angular"],
      confidence: "medium"
    }));
}
