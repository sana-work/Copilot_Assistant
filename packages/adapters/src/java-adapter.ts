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

export class JavaAdapter
  implements
    ILanguageAdapter,
    IFrameworkDetector,
    IPackageManagerDetector,
    IBuildCommandDetector,
    ITestCommandDetector,
    IRepoHeuristicsProvider
{
  readonly name = "java";
  readonly version = "0.1.0";
  readonly capabilities = [
    new AdapterCapability("language", "java"),
    new AdapterCapability("framework", "spring-boot-junit"),
    new AdapterCapability("package-manager", "maven-gradle"),
    new AdapterCapability("build-command", "java-build"),
    new AdapterCapability("test-command", "java-test"),
    new AdapterCapability("repo-heuristics", "java-layout")
  ];

  canHandle(context: AdapterContext): boolean {
    return (
      javaConfigFiles.some((configFile) => context.hasFile(configFile)) ||
      context.files.some((file) => hasAnyExtension(file.path, [".java"]))
    );
  }

  detect(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  analyze(context: AdapterContext): AdapterDetectionResult {
    return this.createResult(context);
  }

  detectLanguages(context: AdapterContext): LanguageInfo[] {
    return context.files.some((file) => hasAnyExtension(file.path, [".java"]))
      ? [
          {
            name: "Java",
            fileExtensions: [".java"],
            confidence: "high",
            source: "Java files"
          }
        ]
      : [];
  }

  detectFrameworks(context: AdapterContext): FrameworkInfo[] {
    const evidenceText = collectJavaEvidenceText(context);
    const frameworks: FrameworkInfo[] = [];

    if (context.hasFile("pom.xml") || context.hasFile("mvnw")) {
      frameworks.push({
        name: "Maven",
        ecosystem: "java",
        confidence: context.hasFile("pom.xml") ? "high" : "medium",
        evidence: [context.hasFile("pom.xml") ? "pom.xml" : "mvnw"]
      });
    }

    if (
      context.hasFile("build.gradle") ||
      context.hasFile("build.gradle.kts") ||
      context.hasFile("gradlew")
    ) {
      frameworks.push({
        name: "Gradle",
        ecosystem: "java",
        confidence:
          context.hasFile("build.gradle") || context.hasFile("build.gradle.kts")
            ? "high"
            : "medium",
        evidence: [
          context.hasFile("build.gradle") || context.hasFile("build.gradle.kts")
            ? "build.gradle"
            : "gradlew"
        ]
      });
    }

    if (/spring-boot|org\.springframework\.boot/i.test(evidenceText)) {
      frameworks.push({
        name: "Spring Boot",
        ecosystem: "java",
        confidence: "high",
        evidence: ["Spring Boot dependency/plugin evidence"]
      });
    }

    if (/junit|jupiter/i.test(evidenceText)) {
      frameworks.push({
        name: "JUnit",
        ecosystem: "java",
        confidence: "high",
        evidence: ["JUnit dependency/source evidence"]
      });
    }

    return frameworks;
  }

  detectPackageManagers(context: AdapterContext): PackageManagerInfo[] {
    const managers: PackageManagerInfo[] = [];

    if (context.hasFile("pom.xml")) {
      managers.push({
        name: "maven",
        manifest: "pom.xml",
        lockfile: context.hasFile("mvnw") ? "mvnw" : undefined,
        confidence: "high"
      });
    }

    if (context.hasFile("build.gradle") || context.hasFile("build.gradle.kts")) {
      managers.push({
        name: "gradle",
        manifest: context.hasFile("build.gradle") ? "build.gradle" : "build.gradle.kts",
        lockfile: context.hasFile("gradlew") ? "gradlew" : undefined,
        confidence: "high"
      });
    }

    return managers;
  }

  detectBuildCommands(context: AdapterContext): BuildCommand[] {
    const commands: BuildCommand[] = [];

    if (context.hasFile("pom.xml") && !context.hasFile("mvnw")) {
      commands.push({
        kind: "build",
        name: "mvn package",
        command: "mvn",
        args: ["package"],
        confidence: "high",
        source: "pom.xml"
      });
    }

    if (context.hasFile("mvnw")) {
      commands.push({
        kind: "build",
        name: "./mvnw package",
        command: "./mvnw",
        args: ["package"],
        confidence: "high",
        source: "mvnw"
      });
    }

    if (
      (context.hasFile("build.gradle") || context.hasFile("build.gradle.kts")) &&
      !context.hasFile("gradlew")
    ) {
      commands.push({
        kind: "build",
        name: "gradle build",
        command: "gradle",
        args: ["build"],
        confidence: "high",
        source: "build.gradle"
      });
    }

    if (context.hasFile("gradlew")) {
      commands.push({
        kind: "build",
        name: "./gradlew build",
        command: "./gradlew",
        args: ["build"],
        confidence: "high",
        source: "gradlew"
      });
    }

    return commands;
  }

  detectTestCommands(context: AdapterContext): TestCommand[] {
    const commands: TestCommand[] = [];

    if (context.hasFile("pom.xml") && !context.hasFile("mvnw")) {
      commands.push({
        kind: "test",
        name: "mvn test",
        command: "mvn",
        args: ["test"],
        confidence: "high",
        source: "pom.xml"
      });
    }

    if (context.hasFile("mvnw")) {
      commands.push({
        kind: "test",
        name: "./mvnw test",
        command: "./mvnw",
        args: ["test"],
        confidence: "high",
        source: "mvnw"
      });
    }

    if (
      (context.hasFile("build.gradle") || context.hasFile("build.gradle.kts")) &&
      !context.hasFile("gradlew")
    ) {
      commands.push({
        kind: "test",
        name: "gradle test",
        command: "gradle",
        args: ["test"],
        confidence: "high",
        source: "build.gradle"
      });
    }

    if (context.hasFile("gradlew")) {
      commands.push({
        kind: "test",
        name: "./gradlew test",
        command: "./gradlew",
        args: ["test"],
        confidence: "high",
        source: "gradlew"
      });
    }

    return commands;
  }

  detectSourceFolders(context: AdapterContext): string[] {
    return [
      ...new Set([
        ...inferFoldersBySegment(context, ["src"]),
        ...filesMatching(context, (filePath) => filePath.startsWith("src/main/java"))
          .map(() => "src/main/java")
          .slice(0, 1)
      ])
    ];
  }

  detectTestFolders(context: AdapterContext): string[] {
    return [
      ...new Set([
        ...inferFoldersBySegment(context, ["test", "tests"]),
        ...filesMatching(context, (filePath) => filePath.startsWith("src/test/java"))
          .map(() => "src/test/java")
          .slice(0, 1)
      ])
    ];
  }

  detectConfigFiles(context: AdapterContext): string[] {
    return filesMatching(context, (filePath) => javaConfigFiles.includes(filePath));
  }

  detectArchitecturalPatterns(context: AdapterContext): string[] {
    const patterns = ["java-project"];

    if (context.hasFile("pom.xml")) {
      patterns.push("maven-project");
    }

    if (context.hasFile("build.gradle") || context.hasFile("build.gradle.kts")) {
      patterns.push("gradle-project");
    }

    if (
      context.files.some(
        (file) =>
          file.path.endsWith("Application.java") &&
          file.text?.includes("SpringApplication")
      )
    ) {
      patterns.push("spring-boot-application");
    }

    return patterns;
  }

  private createResult(context: AdapterContext): AdapterDetectionResult {
    const frameworks = this.detectFrameworks(context);
    const configFiles = this.detectConfigFiles(context);

    return new AdapterDetectionResult({
      adapterName: this.name,
      adapterVersion: this.version,
      capabilities: this.capabilities,
      score: new AdapterScore({
        value: Math.min(0.98, 0.35 + configFiles.length * 0.2),
        reasons: configFiles
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
      entryPoints: detectJavaEntryPoints(context),
      architecturalPatterns: this.detectArchitecturalPatterns(context)
    });
  }
}

const javaConfigFiles = [
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "settings.gradle.kts",
  "gradlew",
  "mvnw"
];

function collectJavaEvidenceText(context: AdapterContext): string {
  return context.files
    .filter(
      (file) =>
        file.text &&
        (javaConfigFiles.includes(file.path) || hasAnyExtension(file.path, [".java"]))
    )
    .map((file) => file.text)
    .join("\n");
}

function detectJavaEntryPoints(context: AdapterContext): EntryPoint[] {
  return filesMatching(
    context,
    (filePath) =>
      filePath.endsWith("Application.java") || fileName(filePath) === "Main.java"
  ).map((filePath) => ({
    name: fileName(filePath),
    kind: "application",
    filePath,
    confidence: "medium"
  }));
}
