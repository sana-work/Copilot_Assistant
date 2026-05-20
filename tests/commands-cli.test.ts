import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../packages/cli/src/index.js";
import { getArtifactFilePath } from "../packages/shared/src/index.js";

function createCapture() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    io: {
      stdout: (message: string) => stdout.push(message),
      stderr: (message: string) => stderr.push(message)
    }
  };
}

describe("commands CLI", () => {
  it("initializes and validates commands.json", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-commands-cli-"));
    const initCapture = createCapture();
    const validateCapture = createCapture();

    const initResult = await runCli(["init", "--path", repoRoot], initCapture.io);
    const validateResult = await runCli(
      ["commands", "validate", "--path", repoRoot],
      validateCapture.io
    );

    expect(initResult.exitCode).toBe(0);
    expect(validateResult.exitCode).toBe(0);
    expect(initCapture.stdout.join("\n")).toContain("commands.json template created");
    expect(validateCapture.stdout.join("\n")).toContain("Status: ok");
    expect(validateCapture.stdout.join("\n")).toContain("No custom commands");
  });

  it("lists configured custom commands", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-commands-list-"));
    const artifactRoot = path.join(repoRoot, ".copilot-architect");
    const capture = createCapture();

    await mkdir(artifactRoot, { recursive: true });
    await writeFile(
      getArtifactFilePath(repoRoot, "commands"),
      JSON.stringify({
        test: [
          {
            name: "API tests",
            workingDirectory: "api",
            command: "python -m pytest"
          }
        ]
      }),
      "utf8"
    );

    const result = await runCli(["commands", "list", "--path", repoRoot], capture.io);

    expect(result.exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("test: API tests [cwd: api]");
    expect(capture.stdout.join("\n")).toContain("python -m pytest");
  });

  it("returns non-zero for invalid command config", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-commands-invalid-"));
    const artifactRoot = path.join(repoRoot, ".copilot-architect");
    const capture = createCapture();

    await mkdir(artifactRoot, { recursive: true });
    await writeFile(
      getArtifactFilePath(repoRoot, "commands"),
      JSON.stringify({ test: [{ name: "Broken" }] }),
      "utf8"
    );

    const result = await runCli(
      ["commands", "validate", "--path", repoRoot],
      capture.io
    );

    expect(result.exitCode).toBe(1);
    expect(capture.stdout.join("\n")).toContain("Status: error");
    expect(capture.stdout.join("\n")).toContain(
      "test[0].command must be a non-empty string"
    );
  });
});
