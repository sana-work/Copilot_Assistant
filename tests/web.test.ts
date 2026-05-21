import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../packages/cli/src/index.js";
import {
  createWebCliCommandLine,
  startWebServer,
  type WebCliRequest,
  type WebCliResult,
  type WebCliRunner
} from "../packages/web/src/index.js";

describe("local web UI shell", () => {
  it("starts a local UI and displays repo-map and plan artifacts", async () => {
    const repoRoot = await createRepoWithArtifacts();
    const server = await startWebServer({
      startPath: repoRoot,
      port: 0,
      runner: createFakeRunner()
    });

    try {
      const html = await fetchText(server.url);
      const state = await fetchJson(`${server.url}/api/state`);
      const artifacts = asRecord(state.artifacts);
      const repoMap = asRecord(artifacts?.repoMap);
      const latestPlan = asRecord(artifacts?.latestPlan);

      expect(server.host).toBe("127.0.0.1");
      expect(server.url).toContain("http://127.0.0.1:");
      expect(html).toContain("Copilot Architect");
      expect(html).toContain("Repo summary");
      expect(html).toContain("Validation runs");
      expect(repoMap?.available).toBe(true);
      expect(asRecord(repoMap?.data)?.repoCount).toBe(1);
      expect(latestPlan?.available).toBe(true);
      expect(asRecord(latestPlan?.data)?.title).toBe("Invoice approval plan");
    } finally {
      await server.close();
    }
  });

  it("delegates workflow actions to CLI/MCP runners without duplicating logic", async () => {
    const repoRoot = await createRepoWithArtifacts();
    const requests: WebCliRequest[] = [];
    const mcpRequests: WebCliRequest[] = [];
    const server = await startWebServer({
      startPath: repoRoot,
      port: 0,
      runner: createFakeRunner(requests, mcpRequests)
    });

    try {
      await postJson(`${server.url}/api/action`, { action: "analyze" });
      await postJson(`${server.url}/api/action`, {
        action: "search",
        query: "invoice"
      });
      await postJson(`${server.url}/api/action`, {
        action: "plan",
        request: "Add invoice approval workflow"
      });
      await postJson(`${server.url}/api/action`, { action: "review" });
      const startMcp = await postJson(`${server.url}/api/action`, {
        action: "start-mcp"
      });
      const stopMcp = await postJson(`${server.url}/api/action`, {
        action: "stop-mcp"
      });

      expect(requests.map((request) => request.args)).toEqual([
        ["analyze", "--json"],
        ["search", "invoice", "--json"],
        ["plan", "Add invoice approval workflow", "--json"],
        ["review", "--plan", "latest", "--validation", "latest", "--json"]
      ]);
      expect(requests.every((request) => request.cwd === repoRoot)).toBe(true);
      expect(mcpRequests.map((request) => request.args)).toEqual([["mcp"]]);
      expect(startMcp.mcpStatus).toBe("running");
      expect(stopMcp.mcpStatus).toBe("stopped");
    } finally {
      await server.close();
    }
  });

  it("exposes serve command help through the CLI", async () => {
    const stdout: string[] = [];
    const result = await runCli(["serve", "--help"], {
      stdout: (message) => stdout.push(message),
      stderr: () => undefined
    });

    expect(result.exitCode).toBe(0);
    expect(stdout.join("\n")).toContain("npm run cli -- serve");
    expect(stdout.join("\n")).toContain("--port");
    expect(stdout.join("\n")).toContain("--host");
  });
});

async function createRepoWithArtifacts(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-web-"));
  const artifactRoot = path.join(repoRoot, ".copilot-architect");
  const runsRoot = path.join(artifactRoot, "runs");
  const reviewsRoot = path.join(artifactRoot, "reviews");
  const plansRoot = path.join(artifactRoot, "plans");
  const agentsRoot = path.join(repoRoot, ".github", "agents");
  const validationLogPath = path.join(runsRoot, "validation-log.txt");

  await mkdir(plansRoot, { recursive: true });
  await mkdir(runsRoot, { recursive: true });
  await mkdir(reviewsRoot, { recursive: true });
  await mkdir(agentsRoot, { recursive: true });
  await writeFile(
    path.join(artifactRoot, "repo-map.json"),
    JSON.stringify({
      schemaVersion: "0.1.0",
      generatedAt: "2026-05-21T00:00:00.000Z",
      repoCount: 1,
      projectCount: 2,
      languages: ["TypeScript"],
      frameworks: ["React"]
    }),
    "utf8"
  );
  await writeFile(
    path.join(artifactRoot, "workspace.json"),
    JSON.stringify({
      schemaVersion: "0.1.0",
      workspaceRoot: repoRoot,
      repoRoots: [repoRoot],
      artifactRoot
    }),
    "utf8"
  );
  await writeFile(
    path.join(plansRoot, "latest-plan.json"),
    JSON.stringify({
      id: "plan-1",
      title: "Invoice approval plan",
      status: "approved",
      implementationSteps: [{ files: ["src/invoice.ts"] }],
      impactAnalysis: { affectedFiles: ["src/invoice.ts"] }
    }),
    "utf8"
  );
  await writeFile(
    path.join(runsRoot, "latest-validation.json"),
    JSON.stringify({
      id: "validation-1",
      status: "passed",
      results: [{ command: { name: "tests" }, status: "passed" }],
      failureSummary: [],
      artifactPaths: { timestampLogPath: validationLogPath }
    }),
    "utf8"
  );
  await writeFile(validationLogPath, "validation ok", "utf8");
  await writeFile(
    path.join(reviewsRoot, "latest-review.json"),
    JSON.stringify({
      id: "review-1",
      findings: [],
      unexpectedFiles: [],
      missingTests: [],
      risks: []
    }),
    "utf8"
  );
  await writeFile(path.join(agentsRoot, "CodeReviewer.agent.md"), "---\n---\n", "utf8");

  return repoRoot;
}

function createFakeRunner(
  requests: WebCliRequest[] = [],
  mcpRequests: WebCliRequest[] = []
): WebCliRunner {
  return {
    run: async (request): Promise<WebCliResult> => {
      requests.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify({ ok: true }),
        stderr: "",
        commandLine: createWebCliCommandLine(request.args)
      };
    },
    startMcp: (request) => {
      mcpRequests.push(request);
      return { dispose: () => undefined };
    }
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return response.text();
}

async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

async function postJson(
  url: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
