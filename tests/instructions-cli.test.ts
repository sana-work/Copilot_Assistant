import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../packages/cli/src/index.js";

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

describe("instructions CLI", () => {
  it("previews repo-aware instructions", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({
        scripts: { build: "tsc -b", test: "vitest run" }
      }),
      "src/index.ts": "export const value = 1;"
    });
    const capture = createCapture();

    const result = await runCli(
      ["instructions", "preview", "--path", repoRoot],
      capture.io
    );

    expect(result.exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("## Repo Architecture Summary");
    expect(capture.stdout.join("\n")).toContain("npm run build");
  });

  it("generates and validates instructions and skills", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({
        scripts: {
          test: "vitest run",
          lint: "eslint ."
        }
      }),
      "src/invoice.ts": "export const invoice = true;"
    });
    const generateCapture = createCapture();
    const validateCapture = createCapture();

    expect(
      (
        await runCli(
          ["instructions", "generate", "--path", repoRoot],
          generateCapture.io
        )
      ).exitCode
    ).toBe(0);
    expect(
      (
        await runCli(
          ["instructions", "validate", "--path", repoRoot],
          validateCapture.io
        )
      ).exitCode
    ).toBe(0);
    expect(generateCapture.stdout.join("\n")).toContain("Skills: 5");
    expect(generateCapture.stdout.join("\n")).toContain("Prompts: 4");
    expect(validateCapture.stdout.join("\n")).toContain("Status: ok");
    await access(path.join(repoRoot, ".github/copilot-instructions.md"));
    await access(path.join(repoRoot, ".github/skills/code-review/SKILL.md"));
    await access(
      path.join(repoRoot, ".github/prompts/copilot-architect-review.prompt.md")
    );
  });

  it("supports custom instruction output and JSON output", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({ name: "custom-instructions" })
    });
    const outputPath = "docs/copilot-instructions.md";
    const existingPath = path.join(repoRoot, outputPath);
    const capture = createCapture();

    await mkdir(path.dirname(existingPath), { recursive: true });
    await writeFile(existingPath, "Existing team section", "utf8");

    const result = await runCli(
      [
        "instructions",
        "generate",
        "--path",
        repoRoot,
        "--output",
        outputPath,
        "--json"
      ],
      capture.io
    );
    const json = JSON.parse(capture.stdout.join("\n"));

    expect(result.exitCode).toBe(0);
    expect(json.outputPath).toBe(existingPath);
    expect(json.backupPath).toBeDefined();
    expect(json.skills).toHaveLength(5);
    expect(json.prompts).toHaveLength(4);
    expect(await readFile(existingPath, "utf8")).toContain("Existing team section");
  });
});

async function createRepo(files: Record<string, string>): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-instructions-cli-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(repoRoot, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, "utf8");
  }

  return repoRoot;
}
