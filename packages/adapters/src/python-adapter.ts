import type {
  BuildCommand,
  EntryPoint,
  FrameworkInfo,
  LanguageInfo,
  PackageManagerInfo,
  TestCommand
} from "@copilot-architect/shared";

import { AdapterDetectionResult, AdapterScore } from "./results.js";
import {
  AdapterCapability,
  type AdapterContext,
  type IBuildCommandDetector,
  type IFrameworkDetector,
  type ILanguageAdapter,
  type IPackageManagerDetector,
  type IRepoHeuristicsProvider,
  type ITestCommandDetector
} from "./types.js";
import {
  fileName,
  filesMatching,
  hasAnyExtension,
  inferFoldersBySegment
} from "./utils.js";

export class PythonAdapter
  implements
    ILanguageAdapter,
    IFrameworkDetector,
    IPackageManagerDetector,
    IBuildCommandDetector,
    ITestCommandDetector,
    IRepoHeuristicsProvider
{
  readonly name = "python";
  readonly version = "0.1.0";
  readonly capabilities = [
    new AdapterCapability("language", "python"),
    new AdapterCapability("framework", "python-frameworks"),
    new AdapterCapability("package-manager", "python-package-tools"),
    new AdapterCapability("test-command", "python-test-commands"),
    new AdapterCapability("repo-heuristics", "python-layout")
  ];

  canHandle(context: AdapterContext): boolean {
    return (
      pythonConfigFiles.some((configFile) => context.hasFile(configFile)) ||
      context.files.some((file) => hasAnyExtension(file.path, [".py"]))
    );
  }

  detect(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  analyze(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  detectLanguages(context: AdapterContext): LanguageInfo[] {
    return context.files.some((file) => hasAnyExtension(file.path, [".py"]))
      ? [
          {
            name: "Python",
            fileExtensions: [".py"],
            confidence: "high",
            source: "Python files"
          }
        ]
      : [];
  }

  detectFrameworks(context: AdapterContext): FrameworkInfo[] {
    const evidenceText = collectPythonEvidenceText(context);
    const frameworks: FrameworkInfo[] = [];

    for (const detector of [
      ["FastAPI", /fastapi/i],
      ["Flask", /(^|\W)flask(\W|$)/i],
      ["Django", /django/i],
      ["pytest", /pytest/i],
      ["unittest", /unittest/i]
    ] as const) {
      const [name, pattern] = detector;

      if (pattern.test(evidenceText)) {
        frameworks.push({
          name,
          ecosystem: "python",
          confidence: name === "unittest" ? "medium" : "high",
          evidence: ["Python dependency/config/source evidence"]
        });
      }
    }

    return frameworks;
  }

  detectPackageManagers(context: AdapterContext): PackageManagerInfo[] {
    const managers: PackageManagerInfo[] = [];
    const pyproject = context.hasFile("pyproject.toml");

    if (pyproject && context.hasFile("poetry.lock")) {
      managers.push({
        name: "poetry",
        manifest: "pyproject.toml",
        lockfile: "poetry.lock",
        confidence: "high"
      });
    } else if (pyproject) {
      managers.push({
        name: "pyproject",
        manifest: "pyproject.toml",
        confidence: "medium"
      });
    }

    if (context.hasFile("requirements.txt")) {
      managers.push({
        name: "pip",
        manifest: "requirements.txt",
        confidence: "high"
      });
    }

    if (context.hasFile("Pipfile")) {
      managers.push({
        name: "pipenv",
        manifest: "Pipfile",
        lockfile: context.hasFile("Pipfile.lock") ? "Pipfile.lock" : undefined,
        confidence: "high"
      });
    }

    if (context.hasFile("setup.py") || context.hasFile("setup.cfg")) {
      managers.push({
        name: "setuptools",
        manifest: context.hasFile("setup.py") ? "setup.py" : "setup.cfg",
        confidence: "medium"
      });
    }

    return managers;
  }

  detectBuildCommands(context: AdapterContext): BuildCommand[] {
    if (context.hasFile("pyproject.toml") || context.hasFile("setup.py")) {
      return [
        {
          kind: "build",
          name: "python build",
          command: "python",
          args: ["-m", "build"],
          confidence: "low",
          source: "Python packaging config"
        }
      ];
    }

    return [];
  }

  detectTestCommands(context: AdapterContext): TestCommand[] {
    const frameworks = this.detectFrameworks(context).map(
      (framework) => framework.name
    );
    const commands: TestCommand[] = [];

    if (frameworks.includes("pytest") || hasPytestConfig(context)) {
      commands.push(
        {
          kind: "test",
          name: "pytest",
          command: "pytest",
          args: [],
          confidence: "high",
          source: "pytest evidence"
        },
        {
          kind: "test",
          name: "python -m pytest",
          command: "python",
          args: ["-m", "pytest"],
          confidence: "high",
          source: "pytest evidence"
        }
      );
    }

    if (
      this.detectPackageManagers(context).some((manager) => manager.name === "poetry")
    ) {
      commands.push({
        kind: "test",
        name: "poetry run pytest",
        command: "poetry",
        args: ["run", "pytest"],
        confidence: "high",
        source: "poetry.lock"
      });
    }

    if (
      frameworks.includes("unittest") ||
      context.files.some((file) => fileName(file.path).startsWith("test_"))
    ) {
      commands.push({
        kind: "test",
        name: "python -m unittest",
        command: "python",
        args: ["-m", "unittest"],
        confidence: "medium",
        source: "unittest evidence"
      });
    }

    return commands;
  }

  detectSourceFolders(context: AdapterContext): string[] {
    return inferFoldersBySegment(context, ["src", "app"]);
  }

  detectTestFolders(context: AdapterContext): string[] {
    return inferFoldersBySegment(context, ["test", "tests"]);
  }

  detectConfigFiles(context: AdapterContext): string[] {
    return filesMatching(context, (filePath) => pythonConfigFiles.includes(filePath));
  }

  detectArchitecturalPatterns(context: AdapterContext): string[] {
    const patterns = ["python-project"];
    const frameworks = this.detectFrameworks(context).map(
      (framework) => framework.name
    );

    if (frameworks.includes("FastAPI")) {
      patterns.push("fastapi-application");
    }

    if (frameworks.includes("Flask")) {
      patterns.push("flask-application");
    }

    if (frameworks.includes("Django")) {
      patterns.push("django-application");
    }

    return patterns;
  }

  private createResult(context: AdapterContext): AdapterDetectionResult {
    const frameworks = this.detectFrameworks(context);
    const configFiles = this.detectConfigFiles(context);
    const scoreEvidence = [
      ...configFiles,
      ...(context.files.some((file) => hasAnyExtension(file.path, [".py"]))
        ? ["Python files"]
        : [])
    ];

    return new AdapterDetectionResult({
      adapterName: this.name,
      adapterVersion: this.version,
      capabilities: this.capabilities,
      score: new AdapterScore({
        value: Math.min(0.95, 0.35 + scoreEvidence.length * 0.12),
        reasons: scoreEvidence
      }),
      languages: this.detectLanguages(context),
      frameworks,
      packageManagers: this.detectPackageManagers(context),
      commands: {
        build: this.detectBuildCommands(context),
        test: this.detectTestCommands(context)
      },
      sourceFolders: this.detectSourceFolders(context),
      testFolders: this.detectTestFolders(context),
      configFiles,
      entryPoints: detectPythonEntryPoints(context),
      architecturalPatterns: this.detectArchitecturalPatterns(context)
    });
  }
}

const pythonConfigFiles = [
  "pyproject.toml",
  "requirements.txt",
  "setup.py",
  "setup.cfg",
  "pytest.ini",
  "tox.ini",
  "poetry.lock",
  "Pipfile",
  "Pipfile.lock"
];

function hasPytestConfig(context: AdapterContext): boolean {
  return ["pytest.ini", "tox.ini", "pyproject.toml"].some((filePath) =>
    context.hasFile(filePath)
  );
}

function collectPythonEvidenceText(context: AdapterContext): string {
  return context.files
    .filter(
      (file) =>
        file.text &&
        (pythonConfigFiles.includes(file.path) || hasAnyExtension(file.path, [".py"]))
    )
    .map((file) => file.text)
    .join("\n");
}

function detectPythonEntryPoints(context: AdapterContext): EntryPoint[] {
  return filesMatching(context, (filePath) =>
    ["manage.py", "main.py", "app/main.py", "src/main.py"].includes(filePath)
  ).map((filePath) => ({
    name: fileName(filePath),
    kind: filePath === "manage.py" ? "script" : "application",
    filePath,
    confidence: "medium"
  }));
}
