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

describe("validate CLI", () => {
  it("runs selected validation categories", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-validate-cli-"));
    const artifactRoot = path.join(repoRoot, ".copilot-architect");
    const capture = createCapture();

    await mkdir(artifactRoot, { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "validate-cli" }),
      "utf8"
    );
    await writeFile(
      getArtifactFilePath(repoRoot, "commands"),
      JSON.stringify({
        lint: [
          {
            name: "Lint smoke",
            command: "node -e \"console.log('lint ok')\""
          }
        ]
      }),
      "utf8"
    );

    const result = await runCli(["validate", "--lint", "--path", repoRoot], capture.io);

    expect(result.exitCode).toBe(0);
    expect(capture.stderr).toEqual([]);
    expect(capture.stdout.join("\n")).toContain("Status: passed");
    expect(capture.stdout.join("\n")).toContain("Validation Logs:");
  });

  it("returns non-zero when validation is blocked", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-validate-blocked-"));
    const artifactRoot = path.join(repoRoot, ".copilot-architect");
    const capture = createCapture();

    await mkdir(artifactRoot, { recursive: true });
    await writeFile(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "validate-blocked" }),
      "utf8"
    );
    await writeFile(
      getArtifactFilePath(repoRoot, "commands"),
      JSON.stringify({
        test: [{ name: "Nope", command: "git reset --hard" }]
      }),
      "utf8"
    );

    const result = await runCli(["validate", "--test", "--path", repoRoot], capture.io);

    expect(result.exitCode).toBe(1);
    expect(capture.stdout.join("\n")).toContain("Status: blocked");
  });
});
