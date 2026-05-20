import { describe, expect, it } from "vitest";

import type {
  BuildCommand,
  LanguageInfo,
  TestCommand
} from "../packages/shared/src/index.js";
import {
  AdapterCapability,
  AdapterDetectionResult,
  AdapterRegistry,
  AdapterScore,
  type IAdapter
} from "../packages/adapters/src/index.js";

class StubAdapter implements IAdapter {
  readonly version = "0.1.0";
  readonly capabilities: AdapterCapability[];

  constructor(
    readonly name: string,
    private readonly handles: boolean,
    private readonly result: AdapterDetectionResult
  ) {
    this.capabilities = [new AdapterCapability("language", `${name}-language-support`)];
  }

  canHandle(): boolean {
    return this.handles;
  }

  detect(): AdapterDetectionResult {
    return AdapterDetectionResult.empty(this.name, this.version);
  }

  analyze(): AdapterDetectionResult {
    return this.result;
  }
}

describe("adapter registry", () => {
  it("registers and runs a matching adapter", async () => {
    const registry = new AdapterRegistry([
      new StubAdapter(
        "typescript",
        true,
        adapterResult("typescript", {
          score: 0.9,
          languages: [language("TypeScript", "high")],
          commands: {
            build: [buildCommand("npm", ["run", "build"], "high")]
          }
        })
      )
    ]);

    const result = await registry.analyze({
      repoRoot: "/workspace/app",
      files: [{ path: "package.json" }, { path: "src/index.ts" }]
    });

    expect(result.usedFallback).toBe(false);
    expect(result.matchedAdapters).toEqual(["typescript"]);
    expect(result.detections[0]?.adapterName).toBe("typescript");
    expect(result.merged.languages).toEqual([language("TypeScript", "high")]);
    expect(result.merged.commands.build).toHaveLength(1);
  });

  it("runs multiple matching adapters and sorts results by confidence", async () => {
    const registry = new AdapterRegistry([
      new StubAdapter(
        "generic-js",
        true,
        adapterResult("generic-js", {
          score: 0.45,
          languages: [language("JavaScript", "medium")]
        })
      ),
      new StubAdapter(
        "react",
        true,
        adapterResult("react", {
          score: 0.88,
          languages: [language("TypeScript", "high")]
        })
      ),
      new StubAdapter(
        "java",
        false,
        adapterResult("java", {
          score: 0.95,
          languages: [language("Java", "high")]
        })
      )
    ]);

    const result = await registry.analyze({
      repoRoot: "/workspace/app",
      files: [{ path: "package.json" }, { path: "src/App.tsx" }]
    });

    expect(result.matchedAdapters).toEqual(["generic-js", "react"]);
    expect(result.detections.map((detection) => detection.adapterName)).toEqual([
      "react",
      "generic-js"
    ]);
    expect(result.merged.languages.map((item) => item.name)).toEqual([
      "TypeScript",
      "JavaScript"
    ]);
  });

  it("uses the generic text adapter when no specialized adapter matches", async () => {
    const registry = new AdapterRegistry([
      new StubAdapter("non-match", false, adapterResult("non-match", { score: 0.95 }))
    ]);

    const result = await registry.analyze({
      repoRoot: "/workspace/custom",
      files: [
        { path: "src/main.custom" },
        { path: "tests/main.custom" },
        { path: "config/settings.yml" }
      ]
    });

    expect(result.usedFallback).toBe(true);
    expect(result.matchedAdapters).toEqual(["generic-text"]);
    expect(result.merged.architecturalPatterns).toContain("generic-text-indexing");
    expect(result.merged.sourceFolders).toEqual(["src"]);
    expect(result.merged.testFolders).toEqual(["tests"]);
    expect(result.merged.configFiles).toEqual(["config/settings.yml"]);
  });

  it("merges duplicate commands and keeps the highest-confidence command", async () => {
    const lowConfidenceCommand = testCommand("npm", ["test"], "low");
    const highConfidenceCommand = testCommand("npm", ["test"], "high");
    const registry = new AdapterRegistry([
      new StubAdapter(
        "package-json",
        true,
        adapterResult("package-json", {
          score: 0.7,
          commands: {
            test: [lowConfidenceCommand]
          }
        })
      ),
      new StubAdapter(
        "node",
        true,
        adapterResult("node", {
          score: 0.8,
          commands: {
            test: [highConfidenceCommand]
          }
        })
      )
    ]);

    const result = await registry.analyze({
      repoRoot: "/workspace/app",
      files: [{ path: "package.json" }]
    });

    expect(result.merged.commands.test).toEqual([highConfidenceCommand]);
  });

  it("replaces adapters registered with the same name", async () => {
    const registry = new AdapterRegistry();
    registry.register(
      new StubAdapter("replace-me", true, adapterResult("replace-me", { score: 0.2 }))
    );
    registry.register(
      new StubAdapter("replace-me", true, adapterResult("replace-me", { score: 0.9 }))
    );

    const result = await registry.analyze({
      repoRoot: "/workspace/app"
    });

    expect(registry.list()).toHaveLength(1);
    expect(result.detections[0]?.score.value).toBe(0.9);
  });
});

function adapterResult(
  adapterName: string,
  options: {
    score: number;
    languages?: LanguageInfo[];
    commands?: Partial<{
      build: BuildCommand[];
      test: TestCommand[];
    }>;
  }
): AdapterDetectionResult {
  return new AdapterDetectionResult({
    adapterName,
    adapterVersion: "0.1.0",
    score: new AdapterScore({ value: options.score }),
    languages: options.languages,
    commands: options.commands
  });
}

function language(name: string, confidence: "low" | "medium" | "high"): LanguageInfo {
  return {
    name,
    confidence,
    fileExtensions: name === "TypeScript" ? [".ts", ".tsx"] : [".js"],
    source: "test"
  };
}

function buildCommand(
  command: string,
  args: string[],
  confidence: "low" | "medium" | "high"
): BuildCommand {
  return {
    kind: "build",
    name: "build",
    command,
    args,
    confidence,
    source: "test"
  };
}

function testCommand(
  command: string,
  args: string[],
  confidence: "low" | "medium" | "high"
): TestCommand {
  return {
    kind: "test",
    name: "test",
    command,
    args,
    confidence,
    source: "test"
  };
}
