import { describe, expect, it } from "vitest";

import { CLI_COMMANDS } from "../packages/shared/src/index.js";
import {
  getDoctorReport,
  getDoctorText,
  getHelpText,
  getVersionReport,
  getVersionText,
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

  it("help text includes demo quick-start hint", () => {
    const help = getHelpText();
    expect(help).toContain("demo");
    expect(help).toContain("Quick start:");
  });

  it("runs the doctor command", async () => {
    const capture = createCapture();
    const result = await runCli(["doctor"], capture.io);

    expect(result.exitCode).toBe(0);
    expect(capture.stderr).toEqual([]);
    expect(capture.stdout.join("\n")).toContain("TypeScript/Node.js-first");
  });

  it("doctor reports error for unsupported node version", () => {
    const report = getDoctorReport("v18.0.0");
    expect(report.status).toBe("error");
    const nodeCheck = report.checks.find((c) => c.name === "node-version");
    expect(nodeCheck?.status).toBe("error");
    expect(nodeCheck?.message).toContain("Upgrade");
  });

  it("doctor reports ok for supported node version", () => {
    const report = getDoctorReport("v20.11.0");
    expect(report.status).toBe("ok");
    const nodeCheck = report.checks.find((c) => c.name === "node-version");
    expect(nodeCheck?.status).toBe("ok");
  });

  it("runs the version command", async () => {
    const capture = createCapture();
    const result = await runCli(["version", "--json"], capture.io);
    const report = JSON.parse(capture.stdout.join("\n"));

    expect(result.exitCode).toBe(0);
    expect(capture.stderr).toEqual([]);
    expect(report.name).toBe("copilot-architect");
    expect(report.version).toBe("0.1.0");
    expect(report.distribution).toBe("internal");
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
    expect(getDoctorText("v20.11.0")).toContain("npm run package:local");
  });

  it("exports stable version text for command-line use", () => {
    expect(getVersionText("v20.11.0")).toContain("Copilot Architect 0.1.0");
    expect(getVersionText("v20.11.0")).toContain("Distribution: internal");
    expect(getVersionReport("v20.11.0").packageManager).toBe("npm");
  });

  it("uses the shared diagnostic report model for doctor output", () => {
    const report = getDoctorReport("v20.11.0");

    expect(report.schemaVersion).toBe("0.1.0");
    expect(report.environment.packageManager).toBe("npm");
    expect(report.checks.map((check) => check.name)).toContain("visual-studio-vsix");
  });

  it("runs the demo command end-to-end", async () => {
    const capture = createCapture();
    const result = await runCli(["demo"], capture.io);

    expect(result.exitCode).toBe(0);
    const output = capture.stdout.join("\n");
    expect(output).toContain("demo");
    expect(output).toContain("Next steps:");
  });
});
