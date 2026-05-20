import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createCopilotArchitectMcpServer,
  listCopilotArchitectMcpToolNames
} from "../packages/mcp-server/src/index.js";

const clients: Client[] = [];
const servers: Array<{ close(): Promise<void> }> = [];

describe("Copilot Architect MCP server", () => {
  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()));
    await Promise.all(servers.map((server) => server.close()));
    clients.length = 0;
    servers.length = 0;
  });

  it("lists all required MCP tools", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
      "src/invoice.ts": "export const invoice = true;"
    });
    const { client } = await createConnectedServer(repoRoot);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining(listCopilotArchitectMcpToolNames()));
    expect(names).toEqual(
      expect.arrayContaining([
        "repo_map",
        "search_repo",
        "generate_feature_plan",
        "get_validation_commands"
      ])
    );
  });

  it("supports repo_map, search_repo, generate_feature_plan, and validation commands", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({
        scripts: {
          build: "tsc -b",
          test: "vitest run"
        }
      }),
      "src/invoices/invoice-service.ts":
        "export function approveInvoice() { return 'approved invoice'; }",
      "src/invoices/invoice-service.test.ts":
        "test('approved invoice', () => expect(true).toBe(true));"
    });
    const { client } = await createConnectedServer(repoRoot);

    const repoMap = await callJsonTool(client, "repo_map", { path: repoRoot });
    const search = await callJsonTool(client, "search_repo", {
      path: repoRoot,
      query: "invoice",
      limit: 5
    });
    const plan = await callJsonTool(client, "generate_feature_plan", {
      path: repoRoot,
      request: "Add invoice approval workflow",
      approved: true
    });
    const validationCommands = await callJsonTool(client, "get_validation_commands", {
      path: repoRoot
    });

    expect(repoMap.ok).toBe(true);
    expect(repoMap.data.summary.summary).toContain("Detected");
    expect(
      search.data.results.map((result: { relativePath: string }) => result.relativePath)
    ).toContain("src/invoices/invoice-service.ts");
    expect(plan.data.plan.task).toBe("Add invoice approval workflow");
    expect(validationCommands.data.commands.length).toBeGreaterThan(0);
  });

  it("handles missing latest artifacts gracefully", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({ name: "missing-artifacts" })
    });
    const { client } = await createConnectedServer(repoRoot);

    const latest = await callJsonTool(client, "get_latest_review", {
      path: repoRoot
    });

    expect(latest.ok).toBe(true);
    expect(latest.data.missing).toBe(true);
  });

  it("keeps analyze_impact from writing plan artifacts", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
      "src/invoices/invoice-service.ts":
        "export function invoiceStatus() { return 'pending'; }"
    });
    const { client } = await createConnectedServer(repoRoot);

    const impact = await callJsonTool(client, "analyze_impact", {
      path: repoRoot,
      request: "Add invoice approval workflow"
    });
    const latestPlan = await callJsonTool(client, "get_latest_plan", {
      path: repoRoot
    });

    expect(impact.ok).toBe(true);
    expect(impact.data.impactAnalysis.summary).toContain("Likely impact");
    expect(latestPlan.data.missing).toBe(true);
  });

  it("requires approval before generating feature plan artifacts", async () => {
    const repoRoot = await createRepo({
      "package.json": JSON.stringify({ name: "approval-required" }),
      "src/invoice.ts": "export const invoice = 'draft';"
    });
    const { client } = await createConnectedServer(repoRoot);

    const result = await callJsonTool(client, "generate_feature_plan", {
      path: repoRoot,
      request: "Add invoice approval workflow"
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("requires approved=true");
  });
});

async function createConnectedServer(repoRoot: string) {
  const server = createCopilotArchitectMcpServer({ startPath: repoRoot });
  const client = new Client({ name: "mcp-test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  servers.push(server);
  clients.push(client);
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { server, client };
}

async function callJsonTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<{
  ok: boolean;
  data?: unknown;
  error?: string;
}> {
  const result = await client.callTool({ name, arguments: args });
  const first = result.content[0];

  if (!first || first.type !== "text") {
    throw new Error(`Tool ${name} did not return text content`);
  }

  return JSON.parse(first.text);
}

async function createRepo(files: Record<string, string>): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "copilot-mcp-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(repoRoot, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, "utf8");
  }

  return repoRoot;
}
