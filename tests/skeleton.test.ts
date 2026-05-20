import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  REQUIRED_PACKAGE_DIRECTORIES,
  REQUIRED_TEMPLATE_DIRECTORIES
} from "../packages/shared/src/index.js";

const workspaceRoot = process.cwd();

const requiredDocs = [
  "docs/PRODUCT_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/ROADMAP.md",
  "docs/SECURITY_MODEL.md",
  "docs/LANGUAGE_SUPPORT.md",
  "docs/MCP_TOOLS.md",
  "docs/AGENT_WORKFLOWS.md",
  "docs/TESTING_STRATEGY.md",
  "docs/RELEASE_PLAN.md",
  "docs/MVP_DEFINITION.md",
  "docs/DEVELOPMENT_EXECUTION_INSTRUCTIONS.md"
] as const;

const ignoredDirectoryNames = new Set(["node_modules", "dist", "coverage", ".git"]);

function findFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    if (ignoredDirectoryNames.has(entry)) {
      continue;
    }

    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

describe("Phase 0 and Phase 1 skeleton", () => {
  it("contains the required documentation set", () => {
    for (const doc of requiredDocs) {
      expect(existsSync(path.join(workspaceRoot, doc))).toBe(true);
    }
  });

  it("contains the required package and template directories", () => {
    for (const directory of [
      ...REQUIRED_PACKAGE_DIRECTORIES,
      ...REQUIRED_TEMPLATE_DIRECTORIES,
      "samples",
      "tests",
      "docs",
      "scripts"
    ]) {
      expect(existsSync(path.join(workspaceRoot, directory))).toBe(true);
    }
  });

  it("documents TypeScript-first and non-VSIX MVP boundaries", () => {
    const spec = readFileSync(path.join(workspaceRoot, "docs/PRODUCT_SPEC.md"), "utf8");
    const mvp = readFileSync(
      path.join(workspaceRoot, "docs/MVP_DEFINITION.md"),
      "utf8"
    );

    expect(spec).toContain("TypeScript/Node.js-first");
    expect(mvp).toContain("does not include a Visual Studio VSIX");
  });

  it("does not create C# or Visual Studio project files", () => {
    const allFiles = findFiles(workspaceRoot).map((file) =>
      path.relative(workspaceRoot, file)
    );

    expect(allFiles.some((file) => file.endsWith(".csproj"))).toBe(false);
    expect(allFiles.some((file) => file.endsWith(".sln"))).toBe(false);
    expect(allFiles.some((file) => file.endsWith(".vsixmanifest"))).toBe(false);
  });
});
