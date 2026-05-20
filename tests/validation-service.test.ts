import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ValidationService } from "../packages/validator/src/index.js";
import {
  getArtifactDirectoryPath,
  getArtifactFilePath
} from "../packages/shared/src/index.js";

describe("ValidationService", () => {
  it("runs safe custom commands and saves redacted reports and logs", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({ name: "validation-safe" })
    });
    await writeCommands(repoRoot, {
      test: [
        {
          name: "Safe test",
          command: "node -e \"console.log('TOKEN=abc123')\""
        }
      ]
    });

    const result = await new ValidationService().validate({
      startPath: repoRoot,
      categories: ["test"]
    });
    const logText = await readFile(
      result.report.artifactPaths.timestampLogPath,
      "utf8"
    );
    const auditText = await readFile(
      path.join(getArtifactDirectoryPath(repoRoot, "audit"), "audit.jsonl"),
      "utf8"
    );

    expect(result.report.status).toBe("passed");
    expect(result.report.results[0]).toEqual(
      expect.objectContaining({ status: "passed", exitCode: 0 })
    );
    expect(existsSync(result.report.artifactPaths.timestampJsonPath)).toBe(true);
    expect(existsSync(result.report.artifactPaths.timestampMarkdownPath)).toBe(true);
    expect(existsSync(result.report.artifactPaths.latestJsonPath)).toBe(true);
    expect(existsSync(result.report.artifactPaths.latestMarkdownPath)).toBe(true);
    expect(logText).toContain("TOKEN=[REDACTED]");
    expect(logText).not.toContain("abc123");
    expect(auditText).toContain("validation.run");
  });

  it("blocks dangerous commands without running them", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({ name: "validation-danger" }),
      "keep.txt": "still here"
    });
    await writeCommands(repoRoot, {
      test: [
        {
          name: "Danger",
          command: "rm -rf keep.txt"
        }
      ]
    });

    const result = await new ValidationService().validate({
      startPath: repoRoot,
      categories: ["test"]
    });

    expect(result.report.status).toBe("blocked");
    expect(result.report.results[0]?.status).toBe("blocked");
    expect(result.report.riskAssessments[0]?.matchedRules).toContain("rm-rf");
    expect(result.report.failureSummary.join("\n")).toContain("Blocked");
    expect(await readFile(path.join(repoRoot, "keep.txt"), "utf8")).toBe("still here");
  });

  it("summarizes failures and generates a fix prompt", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({ name: "validation-failure" })
    });
    await writeCommands(repoRoot, {
      test: [
        {
          name: "Failing test",
          command: "node -e \"console.error('failure'); process.exit(2)\""
        }
      ]
    });

    const result = await new ValidationService().validate({
      startPath: repoRoot,
      categories: ["test"]
    });

    expect(result.report.status).toBe("failed");
    expect(result.report.results[0]).toEqual(
      expect.objectContaining({
        status: "failed",
        exitCode: 2,
        failureClassification: "non-zero-exit"
      })
    );
    expect(result.report.failureSummary.join("\n")).toContain("Failing test");
    expect(result.report.fixPrompt).toContain("Review the validation failures");
  });

  it("supports command timeouts", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({ name: "validation-timeout" })
    });
    await writeCommands(repoRoot, {
      test: [
        {
          name: "Slow test",
          command: 'node -e "setTimeout(() => {}, 1000)"',
          timeoutMs: 25
        }
      ]
    });

    const result = await new ValidationService().validate({
      startPath: repoRoot,
      categories: ["test"]
    });

    expect(result.report.status).toBe("timed-out");
    expect(result.report.results[0]).toEqual(
      expect.objectContaining({
        status: "timed-out",
        failureClassification: "timeout"
      })
    );
  });
});

async function createRepo(files: Record<string, string>): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-validation-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(repoRoot, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, "utf8");
  }

  return repoRoot;
}

async function writeCommands(
  repoRoot: string,
  config: Record<string, unknown>
): Promise<void> {
  const artifactRoot = path.join(repoRoot, ".copilot-architect");
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(
    getArtifactFilePath(repoRoot, "commands"),
    JSON.stringify(config),
    "utf8"
  );
}
