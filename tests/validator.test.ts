import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CommandConfigService,
  mergeCustomCommandsWithDetected,
  parseCommandConfig
} from "../packages/validator/src/index.js";
import {
  CURRENT_SCHEMA_VERSION,
  getArtifactFilePath,
  type RepoCommandSet
} from "../packages/shared/src/index.js";

describe("CommandConfigService", () => {
  it("creates a commands.json template during init", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-commands-init-"));
    const result = await new CommandConfigService().init({ startPath: repoRoot });
    const configText = await readFile(result.configPath, "utf8");

    expect(result.created).toBe(true);
    expect(result.configPath).toBe(getArtifactFilePath(repoRoot, "commands"));
    expect(existsSync(result.configPath)).toBe(true);
    expect(configText).toContain('"build": []');

    const second = await new CommandConfigService().init({ startPath: repoRoot });

    expect(second.created).toBe(false);
  });

  it("loads categorized custom commands with defaults", async () => {
    const parsed = parseCommandConfig({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      defaults: {
        timeoutMs: 90_000,
        retryCount: 1,
        required: true
      },
      test: [
        {
          name: "Python tests",
          workingDirectory: "api",
          command: "python -m pytest tests",
          description: "Run API tests"
        }
      ],
      lint: [
        {
          name: "Frontend lint",
          workingDirectory: "web",
          command: "npm run lint",
          overrideDetected: true
        }
      ]
    });

    expect(parsed.commands).toHaveLength(2);
    expect(parsed.commands[0]?.category).toBe("test");
    expect(parsed.commands[0]?.command).toEqual(
      expect.objectContaining({
        name: "Python tests",
        command: "python",
        args: ["-m", "pytest", "tests"],
        cwd: "api",
        required: true,
        timeoutMs: 90_000,
        retryCount: 1
      })
    );
    expect(parsed.commands[1]?.overrideDetected).toBe(true);
    expect(parsed.normalized.commands.map((command) => command.name)).toEqual([
      "Python tests",
      "Frontend lint"
    ]);
  });

  it("returns helpful validation errors for invalid config", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-commands-bad-"));
    const artifactRoot = path.join(repoRoot, ".copilot-architect");

    await mkdir(artifactRoot, { recursive: true });
    await writeFile(
      path.join(artifactRoot, "commands.json"),
      JSON.stringify({
        test: [{ name: "", command: "" }],
        mystery: []
      }),
      "utf8"
    );

    const result = await new CommandConfigService().validate({
      startPath: repoRoot
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain('Unknown top-level property "mystery"');
    expect(result.errors.join("\n")).toContain(
      "test[0].name must be a non-empty string"
    );
    expect(result.errors.join("\n")).toContain(
      "test[0].command must be a non-empty string"
    );
  });

  it("merges custom commands ahead of detected commands and supports overrides", () => {
    const parsed = parseCommandConfig({
      defaults: { overrideDetected: false },
      test: [
        {
          name: "test",
          command: "npm run test:custom",
          overrideDetected: true
        }
      ],
      build: [
        {
          name: "Frontend build",
          command: "npm run build:web"
        }
      ]
    });
    const detected: RepoCommandSet = {
      test: [
        {
          kind: "test",
          name: "test",
          command: "npm",
          args: ["test"],
          confidence: "high",
          source: "package.json scripts"
        }
      ],
      build: [
        {
          kind: "build",
          name: "build",
          command: "npm",
          args: ["run", "build"],
          confidence: "high",
          source: "package.json scripts"
        }
      ],
      lint: [],
      format: [],
      validation: []
    };

    const merged = mergeCustomCommandsWithDetected(detected, parsed.commands);

    expect(merged.map((command) => command.name)).toEqual([
      "Frontend build",
      "test",
      "build"
    ]);
    expect(
      merged.map((command) => [command.command, ...command.args].join(" "))
    ).toEqual(["npm run build:web", "npm run test:custom", "npm run build"]);
  });
});
