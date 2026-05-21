import { access, readFile } from "node:fs/promises";
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

describe("Phase 23 internal packaging", () => {
  it("ships local packaging scripts and internal setup docs", async () => {
    const root = process.cwd();

    await expect(
      access(path.join(root, "scripts", "package-local.mjs"))
    ).resolves.toBeUndefined();
    await expect(access(path.join(root, ".npmignore"))).resolves.toBeUndefined();
    await expect(
      access(path.join(root, "docs", "INSTALLATION.md"))
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(root, "docs", "INTERNAL_TEAM_SETUP.md"))
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(root, "docs", "TROUBLESHOOTING.md"))
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(root, "docs", "UPGRADE_GUIDE.md"))
    ).resolves.toBeUndefined();
    await expect(access(path.join(root, "CHANGELOG.md"))).resolves.toBeUndefined();

    const packageJson = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8")
    );
    expect(packageJson.scripts["package:local"]).toBe("node scripts/package-local.mjs");
  });

  it("documents clone, npm link, tarball, troubleshooting, and upgrade workflows", async () => {
    const root = process.cwd();
    const installation = await readFile(
      path.join(root, "docs", "INSTALLATION.md"),
      "utf8"
    );
    const teamSetup = await readFile(
      path.join(root, "docs", "INTERNAL_TEAM_SETUP.md"),
      "utf8"
    );
    const troubleshooting = await readFile(
      path.join(root, "docs", "TROUBLESHOOTING.md"),
      "utf8"
    );
    const upgrade = await readFile(path.join(root, "docs", "UPGRADE_GUIDE.md"), "utf8");

    expect(installation).toContain("npm run package:local");
    expect(installation).toContain("npm link");
    expect(teamSetup).toContain("New Team Member Setup");
    expect(troubleshooting).toContain("npm run cli -- doctor");
    expect(upgrade).toContain("npm run cli -- version");
  });

  it("reports version and packaging readiness through CLI commands", async () => {
    const versionCapture = createCapture();
    const doctorCapture = createCapture();

    expect((await runCli(["version"], versionCapture.io)).exitCode).toBe(0);
    expect((await runCli(["doctor", "--json"], doctorCapture.io)).exitCode).toBe(0);

    const doctor = JSON.parse(doctorCapture.stdout.join("\n"));

    expect(versionCapture.stdout.join("\n")).toContain("Copilot Architect 0.1.0");
    expect(doctor.summary).toContain("packaging");
    expect(doctor.checks.map((check: { name: string }) => check.name)).toContain(
      "local-package"
    );
  });
});
