import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ARTIFACT_DIRECTORY,
  CURRENT_SCHEMA_VERSION,
  type DiagnosticReport,
  type FeaturePlan,
  getArtifactDirectoryPath,
  getArtifactFilePath,
  getArtifactRoot,
  parseJson,
  readJsonArtifact,
  stringifyJson,
  writeJsonArtifact
} from "../packages/shared/src/index.js";

describe("shared domain models", () => {
  it("serializes a feature plan to plain JSON", () => {
    const plan: FeaturePlan = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: "2026-05-20T00:00:00.000Z",
      id: "plan-1",
      title: "Add invoice approval workflow",
      task: "Add invoice approval workflow based on the current repo.",
      status: "draft",
      repoRoot: "/workspace/app",
      summary: "Add approval states, validation, and tests.",
      assumptions: ["Existing invoice module owns persistence."],
      implementationSteps: [
        {
          id: "step-1",
          title: "Find invoice patterns",
          details: "Use the index to locate existing invoice features.",
          files: ["src/invoices/index.ts"],
          dependsOn: []
        }
      ],
      impactAnalysis: {
        summary: "Touches invoice domain and API tests.",
        affectedProjects: ["api"],
        affectedFiles: ["src/invoices/index.ts"],
        affectedCommands: ["npm test"],
        risks: [
          {
            severity: "medium",
            title: "Approval status migration",
            details: "Existing invoices may need a default status.",
            mitigation: "Add a backwards-compatible default."
          }
        ],
        testGaps: ["No approval workflow tests exist yet."]
      },
      validationPlan: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        strategy: "Run focused tests first, then full suite.",
        requiredEvidence: ["Unit test output", "Review report"],
        commands: [
          {
            kind: "validation",
            name: "test",
            command: "npm",
            args: ["test"],
            confidence: "high",
            source: "package.json",
            required: true,
            timeoutMs: 120000,
            retryCount: 0
          }
        ]
      },
      requiresHumanApproval: true
    };

    expect(parseJson<FeaturePlan>(stringifyJson(plan))).toEqual(plan);
  });

  it("builds stable artifact paths under .copilot-architect", () => {
    const workspaceRoot = path.resolve("/tmp/example-workspace");

    expect(getArtifactRoot(workspaceRoot)).toBe(
      path.join(workspaceRoot, ARTIFACT_DIRECTORY)
    );
    expect(getArtifactFilePath(workspaceRoot, "repoMap")).toBe(
      path.join(workspaceRoot, ARTIFACT_DIRECTORY, "repo-map.json")
    );
    expect(getArtifactDirectoryPath(workspaceRoot, "diagnostics")).toBe(
      path.join(workspaceRoot, ARTIFACT_DIRECTORY, "diagnostics")
    );
  });

  it("writes and reads JSON artifacts", async () => {
    const workspaceRoot = await mkdtemp(
      path.join(tmpdir(), "copilot-architect-shared-")
    );
    const report: DiagnosticReport = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: "2026-05-20T00:00:00.000Z",
      id: "diagnostic-1",
      status: "ok",
      summary: "Shared model serialization works.",
      environment: {
        nodeVersion: "v20.11.0",
        packageManager: "npm",
        platform: "test"
      },
      checks: [
        {
          name: "json",
          status: "ok",
          message: "Round trip completed."
        }
      ],
      artifactRoot: ARTIFACT_DIRECTORY
    };

    await writeJsonArtifact(workspaceRoot, "workspace", report);

    expect(existsSync(getArtifactFilePath(workspaceRoot, "workspace"))).toBe(true);
    await expect(
      readJsonArtifact<DiagnosticReport>(workspaceRoot, "workspace")
    ).resolves.toEqual(report);
  });
});
