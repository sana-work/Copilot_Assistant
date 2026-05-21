import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AgentService } from "../packages/agents/src/index.js";

describe("AgentService", () => {
  it("lists the required custom Copilot agents", () => {
    const templates = new AgentService().list().templates;

    expect(templates.map((template) => template.name)).toEqual([
      "FeatureArchitect",
      "FeatureImplementer",
      "CodeReviewer",
      "TestPlanner",
      "Debugger",
      "SecurityReviewer",
      "PerformanceReviewer"
    ]);
  });

  it("installs and validates agent files under .github/agents", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-agents-install-"));
    const service = new AgentService();

    const install = await service.install({ startPath: repoRoot });
    const validation = await service.validate({ startPath: repoRoot });
    const featureArchitectPath = path.join(
      repoRoot,
      ".github/agents/FeatureArchitect.agent.md"
    );
    const featureArchitect = await readFile(featureArchitectPath, "utf8");

    expect(install.results).toHaveLength(7);
    expect(install.results.every((result) => result.status === "installed")).toBe(true);
    expect(validation.ok).toBe(true);
    expect(featureArchitect).toContain("---\nname: FeatureArchitect");
    expect(featureArchitect).toContain("copilotArchitect/*");
    expect(featureArchitect).toContain("handoffs:");
    expect(featureArchitect).toContain("agent: FeatureImplementer");
    expect(featureArchitect).toContain("## Safety Rules");
    expect(featureArchitect).toContain(".copilot-architect/plans/latest-plan.md");
  });

  it("supports dry-run without writing files", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-agents-dry-run-"));

    const install = await new AgentService().install({
      startPath: repoRoot,
      dryRun: true
    });

    expect(install.dryRun).toBe(true);
    await expect(
      access(path.join(repoRoot, ".github/agents/FeatureArchitect.agent.md"))
    ).rejects.toThrow();
  });

  it("backs up existing files when force overwrites", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-agents-backup-"));
    const agentDir = path.join(repoRoot, ".github/agents");
    const agentPath = path.join(agentDir, "FeatureArchitect.agent.md");

    await mkdir(agentDir, { recursive: true });
    await writeFile(agentPath, "old content", "utf8");

    const install = await new AgentService().install({
      startPath: repoRoot,
      force: true
    });
    const featureArchitect = install.results.find(
      (result) => result.agentId === "feature-architect"
    );

    expect(featureArchitect?.status).toBe("updated");
    expect(featureArchitect?.backupPath).toBeDefined();
    await access(featureArchitect?.backupPath ?? "");
    expect(await readFile(agentPath, "utf8")).toContain("name: FeatureArchitect");
  });

  it("validation catches malformed agent files", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-agents-invalid-"));
    const agentDir = path.join(repoRoot, ".github/agents");

    await mkdir(agentDir, { recursive: true });
    await writeFile(path.join(agentDir, "Broken.agent.md"), "not frontmatter", "utf8");

    const validation = await new AgentService().validate({ startPath: repoRoot });

    expect(validation.ok).toBe(false);
    expect(validation.files[0]?.errors).toEqual(
      expect.arrayContaining(["Missing YAML frontmatter block."])
    );
  });

  it("doctor explains the main agent entry points", () => {
    const report = new AgentService().doctor("v20.11.0");

    expect(report.summary).toContain("@FeatureArchitect");
    expect(report.summary).toContain("@FeatureImplementer");
    expect(report.summary).toContain("@CodeReviewer");
    expect(report.summary).toContain("@Debugger");
    expect(report.checks.map((check) => check.name)).toContain("mcp-config");
  });
});
