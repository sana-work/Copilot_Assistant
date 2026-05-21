import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { runCli } from "../packages/cli/src/index.js";
import type { SearchResponse } from "../packages/indexer/src/index.js";
import type { UniversalRepoMap } from "../packages/shared/src/index.js";

describe("Phase 26 end-to-end MVP validation", () => {
  it("treats --root as the sample repository boundary", async () => {
    const sampleRoot = path.join(process.cwd(), "samples", "react-app");
    const capture = createCapture();
    const result = await runCli(
      ["analyze", "--root", sampleRoot, "--json"],
      capture.io
    );
    const repoMap = JSON.parse(capture.stdout.join("\n")) as UniversalRepoMap;

    expect(result.exitCode, capture.stderr.join("\n")).toBe(0);
    expect(repoMap.workspaceRoot).toBe(sampleRoot);
    expect(repoMap.repos[0]?.repoRoot).toBe(sampleRoot);
    expect(repoMap.summary.primaryFrameworks).toEqual(
      expect.arrayContaining(["React", "Vite React"])
    );
    expect(repoMap.summary.primaryLanguages).toEqual(
      expect.arrayContaining(["TypeScript"])
    );
  });

  it("creates a missing search index inside the strict --root boundary", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "copilot-phase26-root-"));
    const nestedRepo = path.join(parent, "nested-react-app");
    await mkdir(path.join(parent, ".git"), { recursive: true });
    await mkdir(path.join(nestedRepo, "src"), { recursive: true });
    await writeFile(
      path.join(nestedRepo, "package.json"),
      JSON.stringify({ scripts: { test: "node -e \"console.log('ok')\"" } }),
      "utf8"
    );
    await writeFile(
      path.join(nestedRepo, "src", "component.ts"),
      "export const component = 'strict root';",
      "utf8"
    );

    const capture = createCapture();
    const result = await runCli(
      ["search", "component", "--root", nestedRepo, "--json"],
      capture.io
    );
    const search = JSON.parse(capture.stdout.join("\n")) as SearchResponse;

    expect(result.exitCode, capture.stderr.join("\n")).toBe(0);
    expect(search.repoRoot).toBe(nestedRepo);
    expect(search.results.map((entry) => entry.relativePath)).toContain(
      "src/component.ts"
    );
  });

  it("documents the Phase 26 validation decision and flow evidence", async () => {
    const report = await readFile(
      path.join(process.cwd(), "docs", "PHASE_26_VALIDATION_REPORT.md"),
      "utf8"
    );

    expect(report).toContain("# Phase 26 Validation Report");
    expect(report).toContain("Ready with limitations");
    expect(report).toContain("Flow 1, React repo");
    expect(report).toContain("Flow 6, MCP");
    expect(report).toContain("Flow 9, review");
    expect(report).toContain("Failures Found");
    expect(report).toContain("Fixes Applied");
    expect(report).toContain("No release blockers remain");
  });
});

function createCapture(): {
  stdout: string[];
  stderr: string[];
  io: {
    stdout: (message: string) => void;
    stderr: (message: string) => void;
  };
} {
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
