import { describe, expect, it } from "vitest";

import { CLI_COMMANDS } from "../packages/shared/src/index.js";
import {
  getDoctorReport,
  getDoctorText,
  getHelpText,
  runCli
} from "../packages/cli/src/index.js";

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

describe("CLI", () => {
  it("lists every required command in help", () => {
    const help = getHelpText();

    for (const command of CLI_COMMANDS) {
      expect(help).toContain(command);
    }
  });

  it("runs the doctor command", async () => {
    const capture = createCapture();
    const result = await runCli(["doctor"], capture.io);

    expect(result.exitCode).toBe(0);
    expect(capture.stderr).toEqual([]);
    expect(capture.stdout.join("\n")).toContain("TypeScript/Node.js-first");
    expect(capture.stdout.join("\n")).toContain(
      "Phase 15 implementation handoff is ready"
    );
  });

  it("prints help for --help", async () => {
    const capture = createCapture();
    const result = await runCli(["--help"], capture.io);

    expect(result.exitCode).toBe(0);
    expect(capture.stdout.join("\n")).toContain("Usage:");
  });

  it("returns a non-zero result for unknown commands", async () => {
    const capture = createCapture();
    const result = await runCli(["unknown"], capture.io);

    expect(result.exitCode).toBe(1);
    expect(capture.stderr.join("\n")).toContain("Unknown command: unknown");
  });

  it("exports stable doctor text for command-line use", () => {
    expect(getDoctorText("v20.11.0")).toContain("Node.js: v20.11.0");
  });

  it("uses the shared diagnostic report model for doctor output", () => {
    const report = getDoctorReport("v20.11.0");

    expect(report.schemaVersion).toBe("0.1.0");
    expect(report.environment.packageManager).toBe("npm");
    expect(report.checks.map((check) => check.name)).toContain("visual-studio-vsix");
  });
});
