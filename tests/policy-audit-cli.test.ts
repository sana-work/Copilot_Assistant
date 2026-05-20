import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../packages/cli/src/index.js";
import { AuditLogService } from "../packages/validator/src/index.js";

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

describe("policy and audit CLI", () => {
  it("initializes and validates policy.json", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-policy-cli-"));
    const initCapture = createCapture();
    const validateCapture = createCapture();
    const showCapture = createCapture();

    const initResult = await runCli(["init", "--path", repoRoot], initCapture.io);
    const validateResult = await runCli(
      ["policy", "validate", "--path", repoRoot],
      validateCapture.io
    );
    const showResult = await runCli(
      ["policy", "show", "--path", repoRoot],
      showCapture.io
    );

    expect(initResult.exitCode).toBe(0);
    expect(validateResult.exitCode).toBe(0);
    expect(showResult.exitCode).toBe(0);
    expect(initCapture.stdout.join("\n")).toContain("policy.json template created");
    expect(validateCapture.stdout.join("\n")).toContain("Status: ok");
    expect(showCapture.stdout.join("\n")).toContain("Default Safety Policy");
  });

  it("lists audit entries", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-audit-cli-"));
    const capture = createCapture();

    await new AuditLogService().record(repoRoot, {
      action: "cli.test",
      actor: "cli",
      summary: "Recorded from test"
    });

    const result = await runCli(["audit", "list", "--path", repoRoot], capture.io);

    expect(result.exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("Entries: 1");
    expect(capture.stdout.join("\n")).toContain("cli.test");
  });
});
