import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  AuditLogService,
  CommandRiskAssessmentService,
  GitCheckpointService,
  PathBoundaryService,
  SafetyPolicyService,
  SecretRedactionService
} from "../packages/validator/src/index.js";
import { getArtifactFilePath } from "../packages/shared/src/index.js";

const execFileAsync = promisify(execFile);

describe("Safety policy and audit services", () => {
  it("initializes and validates the default safety policy", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-policy-"));
    const service = new SafetyPolicyService();
    const init = await service.init(repoRoot);
    const validation = await service.validate(repoRoot);

    expect(init.created).toBe(true);
    expect(validation.ok).toBe(true);
    expect(validation.policy.blockedPatterns.length).toBeGreaterThan(0);
    expect(validation.policy.requireApprovalForHandoff).toBe(true);
  });

  it("reports invalid policy regex patterns", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-policy-bad-"));
    await mkdir(path.join(repoRoot, ".copilot-architect"), { recursive: true });
    await writeFile(
      getArtifactFilePath(repoRoot, "policy"),
      JSON.stringify({
        schemaVersion: "0.1.0",
        generatedAt: new Date().toISOString(),
        id: "bad",
        name: "Bad",
        defaultAllow: true,
        blockedPatterns: ["["],
        allowedPatterns: [],
        secretRedactionPatterns: [],
        requireApprovalForHandoff: true,
        workspaceBoundaryRequired: true
      }),
      "utf8"
    );

    const validation = await new SafetyPolicyService().validate(repoRoot);

    expect(validation.ok).toBe(false);
    expect(validation.errors.join("\n")).toContain("Invalid regular expression");
  });

  it("redacts secrets and records audit entries", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-audit-"));
    const redaction = new SecretRedactionService().redact(
      "TOKEN=abc Bearer secret ghp_123456"
    );
    const audit = new AuditLogService();
    const entry = await audit.record(repoRoot, {
      action: "test.action",
      actor: "cli",
      summary: "TOKEN=abc",
      metadata: { token: "Bearer secret" }
    });
    const listed = await audit.list(repoRoot);
    const auditText = await readFile(listed.auditPath, "utf8");

    expect(redaction.text).toContain("TOKEN=[REDACTED]");
    expect(redaction.text).toContain("Bearer [REDACTED]");
    expect(redaction.text).toContain("[REDACTED_GITHUB_TOKEN]");
    expect(entry.redactionsApplied.length).toBeGreaterThan(0);
    expect(listed.entries).toHaveLength(1);
    expect(auditText).not.toContain("Bearer secret");
  });

  it("checks workspace path boundaries and command risk", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-boundary-"));
    const boundary = new PathBoundaryService();
    const policy = await new SafetyPolicyService().load(repoRoot);
    const assessment = new CommandRiskAssessmentService().assess(
      repoRoot,
      {
        kind: "validation",
        name: "danger",
        command: "rm",
        args: ["-rf", "tmp"],
        cwd: "../outside",
        confidence: "high",
        source: "commands.json",
        required: true
      },
      policy
    );

    expect(boundary.checkPath(repoRoot, "src").allowed).toBe(true);
    expect(boundary.checkPath(repoRoot, "../outside").allowed).toBe(false);
    expect(assessment.allowed).toBe(false);
    expect(assessment.matchedRules).toContain("workspace-boundary");
  });

  it("captures a git checkpoint when git is available", async () => {
    if (!(await gitAvailable())) {
      return;
    }

    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-git-"));
    await execFileAsync("git", ["init"], { cwd: repoRoot });
    await writeFile(path.join(repoRoot, "README.md"), "# checkpoint\n", "utf8");
    await execFileAsync("git", ["add", "README.md"], { cwd: repoRoot });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Copilot Architect",
        "-c",
        "user.email=copilot-architect@example.test",
        "commit",
        "-m",
        "initial"
      ],
      { cwd: repoRoot }
    );

    const checkpoint = await new GitCheckpointService().createCheckpoint(repoRoot);

    expect(checkpoint.gitAvailable).toBe(true);
    expect(checkpoint.created).toBe(true);
    expect(checkpoint.head).toMatch(/[a-f0-9]{40}/);
    expect(checkpoint.rollbackGuide).toContain("Rollback guide");
  }, 20_000);
});

async function gitAvailable(): Promise<boolean> {
  try {
    await execFileAsync("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
}
