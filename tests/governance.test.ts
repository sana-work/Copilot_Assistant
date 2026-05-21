import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();

const governanceRules = [
  "Do not jump phases.",
  "Do not add UI before CLI/core works.",
  "Do not hardcode one language.",
  "Do not put business logic in UI shells.",
  "Do not skip safety.",
  "Do not run destructive commands.",
  "Do not overwrite user files without backup.",
  "Do not mark tests passing without running them.",
  "Do not claim support without sample coverage."
] as const;

const requiredWorkflowCommands = [
  "npm install",
  "npm run lint",
  "npm run build",
  "npm test"
] as const;

describe("Phase 25 development governance", () => {
  it("documents all required governance rules", async () => {
    const docs = await readFile(
      path.join(workspaceRoot, "docs", "DEVELOPMENT_EXECUTION_INSTRUCTIONS.md"),
      "utf8"
    );

    for (const rule of governanceRules) {
      expect(docs).toContain(rule);
    }

    expect(docs).toContain("Pull requests must explain how they follow these rules.");
    expect(docs).toContain("Release checks must run the MVP gates");
  });

  it("ships a PR template with phase, architecture, safety, support, and validation guardrails", async () => {
    const templatePath = path.join(
      workspaceRoot,
      ".github",
      "pull_request_template.md"
    );
    const template = await readFile(templatePath, "utf8");

    await expect(access(templatePath)).resolves.toBeUndefined();
    for (const rule of [
      "I did not jump phases.",
      "I did not add new major scope outside `docs/MVP_DEFINITION.md`.",
      "I did not put business logic in UI shells.",
      "I did not run destructive commands.",
      "I did not claim support without sample coverage or tests.",
      "Do not mark tests passing without running them."
    ]) {
      expect(template).toContain(rule);
    }
  });

  it("keeps CI and release-check workflows on the required npm gates", async () => {
    const ci = await readFile(
      path.join(workspaceRoot, ".github", "workflows", "ci.yml"),
      "utf8"
    );
    const releaseCheck = await readFile(
      path.join(workspaceRoot, ".github", "workflows", "release-check.yml"),
      "utf8"
    );

    for (const command of requiredWorkflowCommands) {
      expect(ci).toContain(command);
      expect(releaseCheck).toContain(command);
    }

    expect(releaseCheck).toContain("npm run cli -- version");
    expect(releaseCheck).toContain("npm run cli -- doctor");
    expect(releaseCheck).toContain("npm run package:local");
  });
});
