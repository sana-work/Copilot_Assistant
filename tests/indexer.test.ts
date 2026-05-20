import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { IndexingService, type LocalIndex } from "../packages/indexer/src/index.js";
import { runCli } from "../packages/cli/src/index.js";
import { getArtifactDirectoryPath } from "../packages/shared/src/index.js";

describe("IndexingService", () => {
  it("creates JSON index artifacts with required file metadata", async () => {
    const repoRoot = await createRepo({
      ".git/HEAD": "ref: refs/heads/main",
      "src/invoices/approval.ts":
        "import { Invoice } from './model';\nexport function approveInvoice() { return true; }\n",
      "tests/invoices/approval.test.ts": "test('approval', () => {})",
      "README.md": "# Invoice workflow",
      "package.json": JSON.stringify({ scripts: { test: "vitest run" } })
    });

    const result = await new IndexingService().index({ startPath: repoRoot });
    const document = result.index.documents.find(
      (candidate) => candidate.relativePath === "src/invoices/approval.ts"
    );

    expect(result.mode).toBe("full");
    expect(existsSync(result.indexPath)).toBe(true);
    expect(existsSync(result.statusPath)).toBe(true);
    expect(document).toEqual(
      expect.objectContaining({
        relativePath: "src/invoices/approval.ts",
        extension: ".ts",
        languageGuess: "TypeScript",
        isTestFile: false,
        isConfigFile: false,
        isDocFile: false
      })
    );
    expect(document?.contentHash).toHaveLength(64);
    expect(document?.imports).toContain("./model");
    expect(document?.symbols.map((symbol) => symbol.name)).toContain("approveInvoice");
    expect(result.index.stats.testFileCount).toBe(1);
    expect(result.index.stats.docFileCount).toBe(1);
    expect(result.index.stats.configFileCount).toBe(1);
  });

  it("returns ranked search results", async () => {
    const repoRoot = await createRepo({
      "src/invoiceApproval.ts":
        "export function approveInvoice() { return 'invoice approval'; }",
      "src/customer.ts": "export function customer() { return 'invoice'; }",
      "README.md": "invoice approval overview"
    });
    const service = new IndexingService();

    await service.index({ startPath: repoRoot });
    const response = await service.search({
      startPath: repoRoot,
      query: "invoice approval"
    });

    expect(response.results.length).toBeGreaterThanOrEqual(2);
    expect(response.results[0]?.relativePath).toBe("src/invoiceApproval.ts");
    expect(response.results[0]?.matchedFields).toEqual(
      expect.arrayContaining(["path", "preview", "symbols"])
    );
  });

  it("skips ignored folders", async () => {
    const repoRoot = await createRepo({
      "src/app.ts": "export function app() {}",
      "node_modules/pkg/index.js": "export const ignored = true;",
      "dist/bundle.js": "export const ignored = true;",
      ".venv/lib/site-packages/pkg.py": "ignored = True"
    });

    const result = await new IndexingService().index({ startPath: repoRoot });
    const paths = result.index.documents.map((document) => document.relativePath);

    expect(paths).toContain("src/app.ts");
    expect(paths).not.toContain("node_modules/pkg/index.js");
    expect(paths).not.toContain("dist/bundle.js");
    expect(paths).not.toContain(".venv/lib/site-packages/pkg.py");
  });

  it("reuses unchanged documents during incremental indexing", async () => {
    const repoRoot = await createRepo({
      "src/stable.ts": "export function stable() { return true; }",
      "src/change.ts": "export function changeMe() { return 1; }"
    });
    const service = new IndexingService();
    const first = await service.index({ startPath: repoRoot });
    const stableBefore = requireDocument(first.index, "src/stable.ts");
    const changeBefore = requireDocument(first.index, "src/change.ts");

    await writeFile(
      path.join(repoRoot, "src/change.ts"),
      "export function changeMe() { return 2; }",
      "utf8"
    );

    const second = await service.index({ startPath: repoRoot });
    const stableAfter = requireDocument(second.index, "src/stable.ts");
    const changeAfter = requireDocument(second.index, "src/change.ts");

    expect(second.mode).toBe("incremental");
    expect(stableAfter.indexedAt).toBe(stableBefore.indexedAt);
    expect(changeAfter.contentHash).not.toBe(changeBefore.contentHash);
    expect(changeAfter.indexedAt).not.toBe(changeBefore.indexedAt);
  });

  it("supports rebuild, status, similar feature search, and CLI search JSON", async () => {
    const repoRoot = await createRepo({
      "src/features/invoiceApproval.ts":
        "export class InvoiceApprovalWorkflow {}\nexport function approveInvoice() {}",
      "tests/features/invoiceApproval.test.ts": "test('invoice approval', () => {})"
    });
    const service = new IndexingService();
    const rebuilt = await service.index({ startPath: repoRoot, rebuild: true });
    const status = await service.status(repoRoot);
    const similar = await service.findSimilarFeatures({
      startPath: repoRoot,
      query: "invoice approval"
    });
    const stdout: string[] = [];
    const cliResult = await runCli(
      ["search", "invoice approval", "--json", "--path", repoRoot],
      {
        stdout: (message) => stdout.push(message),
        stderr: () => undefined
      }
    );

    expect(rebuilt.mode).toBe("rebuild");
    expect(status.exists).toBe(true);
    expect(status.documentCount).toBe(2);
    expect(similar.results[0]?.relativePath).toBe("src/features/invoiceApproval.ts");
    expect(cliResult.exitCode).toBe(0);
    expect(JSON.parse(stdout.join("\n")).results[0].relativePath).toBe(
      "src/features/invoiceApproval.ts"
    );
  });

  it("supports CLI index --rebuild", async () => {
    const repoRoot = await createRepo({
      "src/index.ts": "export function main() {}"
    });
    const stdout: string[] = [];
    const stderr: string[] = [];

    const result = await runCli(["index", repoRoot, "--rebuild"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message)
    });

    expect(result.exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("\n")).toContain("Mode: rebuild");
    expect(
      existsSync(path.join(getArtifactDirectoryPath(repoRoot, "index"), "index.json"))
    ).toBe(true);
  });
});

function requireDocument(index: LocalIndex, relativePath: string) {
  const document = index.documents.find(
    (candidate) => candidate.relativePath === relativePath
  );

  if (!document) {
    throw new Error(`Missing document ${relativePath}`);
  }

  return document;
}

async function createRepo(files: Record<string, string>): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-architect-index-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(repoRoot, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, "utf8");
  }

  return repoRoot;
}
