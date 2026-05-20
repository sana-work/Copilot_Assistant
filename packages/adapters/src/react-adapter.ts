import type {
  EntryPoint,
  FeaturePattern,
  FrameworkInfo,
  LanguageInfo
} from "@copilot-architect/shared";

import { AdapterDetectionResult, AdapterScore } from "./results.js";
import {
  AdapterCapability,
  type AdapterContext,
  type IFrameworkDetector,
  type ILanguageAdapter,
  type IRepoHeuristicsProvider
} from "./types.js";
import {
  fileName,
  filesMatching,
  getPackageDependencyVersion,
  getPackageJson,
  hasAnyExtension,
  hasPackageDependency,
  inferFoldersBySegment,
  pathSegments
} from "./utils.js";

export class ReactAdapter
  implements ILanguageAdapter, IFrameworkDetector, IRepoHeuristicsProvider
{
  readonly name = "react";
  readonly version = "0.1.0";
  readonly capabilities = [
    new AdapterCapability("framework", "react"),
    new AdapterCapability("framework", "nextjs"),
    new AdapterCapability("repo-heuristics", "react-files")
  ];

  canHandle(context: AdapterContext): boolean {
    const packageJson = getPackageJson(context);
    return (
      hasPackageDependency(packageJson, "react") ||
      hasPackageDependency(packageJson, "react-dom") ||
      hasPackageDependency(packageJson, "@vitejs/plugin-react") ||
      hasPackageDependency(packageJson, "next") ||
      hasPackageDependency(packageJson, "react-scripts") ||
      hasViteReactConfig(context) ||
      context.files.some((file) => isReactSource(file.path))
    );
  }

  detect(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  analyze(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  detectLanguages(context: AdapterContext): LanguageInfo[] {
    if (
      context.files.some((file) =>
        hasAnyExtension(file.path, [".tsx", ".ts", ".jsx", ".js"])
      )
    ) {
      return [
        {
          name: context.files.some((file) =>
            hasAnyExtension(file.path, [".tsx", ".ts"])
          )
            ? "TypeScript"
            : "JavaScript",
          fileExtensions: [".tsx", ".jsx", ".ts", ".js"],
          confidence: "medium",
          source: "React source files"
        }
      ];
    }

    return [];
  }

  detectFrameworks(context: AdapterContext): FrameworkInfo[] {
    const packageJson = getPackageJson(context);
    const frameworks: FrameworkInfo[] = [];

    if (hasPackageDependency(packageJson, "react")) {
      frameworks.push({
        name: "React",
        version: getPackageDependencyVersion(packageJson, "react"),
        ecosystem: "javascript",
        confidence: "high",
        evidence: ["package.json dependency: react"]
      });
    }

    if (hasPackageDependency(packageJson, "react-dom")) {
      frameworks.push({
        name: "React DOM",
        version: getPackageDependencyVersion(packageJson, "react-dom"),
        ecosystem: "javascript",
        confidence: "high",
        evidence: ["package.json dependency: react-dom"]
      });
    }

    if (hasPackageDependency(packageJson, "next")) {
      frameworks.push({
        name: "Next.js",
        version: getPackageDependencyVersion(packageJson, "next"),
        ecosystem: "javascript",
        confidence: "high",
        evidence: ["package.json dependency: next"]
      });
    }

    if (
      hasPackageDependency(packageJson, "@vitejs/plugin-react") ||
      hasViteReactConfig(context)
    ) {
      frameworks.push({
        name: "Vite React",
        ecosystem: "javascript",
        confidence: "high",
        evidence: ["@vitejs/plugin-react"]
      });
    }

    if (hasPackageDependency(packageJson, "react-scripts")) {
      frameworks.push({
        name: "Create React App",
        version: getPackageDependencyVersion(packageJson, "react-scripts"),
        ecosystem: "javascript",
        confidence: "high",
        evidence: ["package.json dependency: react-scripts"]
      });
    }

    return frameworks;
  }

  detectSourceFolders(context: AdapterContext): string[] {
    return inferFoldersBySegment(context, ["src", "app", "pages", "routes"]);
  }

  detectTestFolders(context: AdapterContext): string[] {
    return inferFoldersBySegment(context, ["test", "tests", "__tests__", "spec"]);
  }

  detectConfigFiles(context: AdapterContext): string[] {
    return filesMatching(
      context,
      (filePath) =>
        ["package.json"].includes(filePath) ||
        fileName(filePath).startsWith("vite.config.") ||
        fileName(filePath).startsWith("next.config.")
    );
  }

  detectArchitecturalPatterns(context: AdapterContext): string[] {
    const patterns = ["react-application"];

    if (context.files.some((file) => pathSegments(file.path).includes("hooks"))) {
      patterns.push("react-hooks");
    }

    if (
      context.files.some((file) =>
        pathSegments(file.path).some((segment) =>
          ["pages", "routes", "app"].includes(segment)
        )
      )
    ) {
      patterns.push("file-based-routes");
    }

    return patterns;
  }

  private createResult(context: AdapterContext): AdapterDetectionResult {
    const frameworks = this.detectFrameworks(context);
    const featurePatterns = detectReactFeaturePatterns(context);

    return new AdapterDetectionResult({
      adapterName: this.name,
      adapterVersion: this.version,
      capabilities: this.capabilities,
      score: new AdapterScore({
        value: frameworks.some((framework) => framework.name === "React") ? 0.92 : 0.55,
        reasons: frameworks.flatMap((framework) => framework.evidence)
      }),
      languages: this.detectLanguages(context),
      frameworks,
      sourceFolders: this.detectSourceFolders(context),
      testFolders: this.detectTestFolders(context),
      configFiles: this.detectConfigFiles(context),
      entryPoints: detectReactEntryPoints(context),
      featurePatterns,
      architecturalPatterns: this.detectArchitecturalPatterns(context)
    });
  }
}

function hasViteReactConfig(context: AdapterContext): boolean {
  return context.files.some(
    (file) =>
      fileName(file.path).startsWith("vite.config.") &&
      file.text?.includes("@vitejs/plugin-react")
  );
}

function detectReactFeaturePatterns(context: AdapterContext): FeaturePattern[] {
  const components = filesMatching(context, isReactComponent);
  const hooks = filesMatching(context, isReactHook);
  const routes = filesMatching(context, isReactRoute);
  const tests = filesMatching(context, isTestFile);
  const patterns: FeaturePattern[] = [];

  if (components.length > 0) {
    patterns.push(featurePattern("react-components", "React components", components));
  }

  if (hooks.length > 0) {
    patterns.push(featurePattern("react-hooks", "React hooks", hooks));
  }

  if (routes.length > 0) {
    patterns.push(featurePattern("react-routes", "React pages/routes", routes));
  }

  if (tests.length > 0) {
    patterns.push(featurePattern("react-tests", "React test files", tests));
  }

  return patterns;
}

function detectReactEntryPoints(context: AdapterContext): EntryPoint[] {
  return filesMatching(context, (filePath) =>
    [
      "src/main.tsx",
      "src/main.jsx",
      "src/index.tsx",
      "src/index.jsx",
      "src/App.tsx",
      "src/App.jsx",
      "app/page.tsx",
      "pages/_app.tsx"
    ].includes(filePath)
  ).map((filePath) => ({
    name: fileName(filePath),
    kind: "application",
    filePath,
    confidence: "medium"
  }));
}

function featurePattern(id: string, name: string, files: string[]): FeaturePattern {
  return {
    id,
    name,
    summary: `${name} detected from file layout.`,
    files,
    symbols: [],
    tags: ["react"],
    confidence: "medium"
  };
}

function isReactSource(filePath: string): boolean {
  return hasAnyExtension(filePath, [".tsx", ".jsx"]);
}

function isReactComponent(filePath: string): boolean {
  const name = fileName(filePath);
  return (
    isReactSource(filePath) &&
    !isTestFile(filePath) &&
    (pathSegments(filePath).includes("components") || /^[A-Z]/.test(name))
  );
}

function isReactHook(filePath: string): boolean {
  return (
    hasAnyExtension(filePath, [".ts", ".tsx", ".js", ".jsx"]) &&
    !isTestFile(filePath) &&
    (pathSegments(filePath).includes("hooks") || /^use[A-Z]/.test(fileName(filePath)))
  );
}

function isReactRoute(filePath: string): boolean {
  return (
    isReactSource(filePath) &&
    pathSegments(filePath).some((segment) =>
      ["pages", "routes", "app"].includes(segment)
    )
  );
}

function isTestFile(filePath: string): boolean {
  return (
    filePath.includes("__tests__/") ||
    fileName(filePath).includes(".test.") ||
    fileName(filePath).includes(".spec.")
  );
}
