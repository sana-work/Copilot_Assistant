import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WEB_HOST = "127.0.0.1";
export const DEFAULT_WEB_PORT = 4318;

export interface WebServerOptions {
  startPath?: string;
  host?: string;
  port?: number;
  runner?: WebCliRunner;
}

export interface WebServerStartResult {
  host: string;
  port: number;
  url: string;
  repoRoot: string;
  close(): Promise<void>;
}

export interface WebCliRequest {
  args: string[];
  cwd: string;
  onOutput?: (stream: "stdout" | "stderr", text: string) => void;
}

export interface WebCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  commandLine: string;
}

export interface WebMcpProcess {
  dispose(): void;
}

export interface WebCliRunner {
  run(request: WebCliRequest): Promise<WebCliResult>;
  startMcp(request: WebCliRequest): WebMcpProcess;
}

interface WebRuntimeState {
  repoRoot: string;
  mcpStatus: "stopped" | "running";
  lastCommand?: string;
  lastExitCode?: number;
  lastStdout?: string;
  lastStderr?: string;
  mcpProcess?: WebMcpProcess;
}

interface ActionPayload {
  action?: string;
  query?: string;
  request?: string;
}

interface ArtifactSnapshot {
  path: string;
  available: boolean;
  data?: unknown;
  entries?: string[];
  error?: string;
}

export async function startWebServer(
  options: WebServerOptions = {}
): Promise<WebServerStartResult> {
  const host = options.host ?? DEFAULT_WEB_HOST;
  const requestedPort = options.port ?? DEFAULT_WEB_PORT;
  const repoRoot = path.resolve(options.startPath ?? process.cwd());
  const runner = options.runner ?? new NodeWebCliRunner();
  const state: WebRuntimeState = {
    repoRoot,
    mcpStatus: "stopped"
  };
  const server = createServer((request, response) => {
    void handleRequest(request, response, state, runner);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : requestedPort;

  return {
    host,
    port,
    repoRoot,
    url: `http://${host}:${port}`,
    close: async () => {
      state.mcpProcess?.dispose();
      state.mcpStatus = "stopped";
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

export function createWebCliCommandLine(args: string[]): string {
  return ["npm", "run", "cli", "--", ...args.map(quoteCliArg)].join(" ");
}

export class NodeWebCliRunner implements WebCliRunner {
  async run(request: WebCliRequest): Promise<WebCliResult> {
    return new Promise((resolve) => {
      const child = spawn(getNpmExecutable(), ["run", "cli", "--", ...request.args], {
        cwd: request.cwd,
        shell: false,
        env: { ...process.env, FORCE_COLOR: "0" }
      });
      const commandLine = createWebCliCommandLine(request.args);
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        request.onOutput?.("stdout", text.trimEnd());
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        request.onOutput?.("stderr", text.trimEnd());
      });

      child.on("error", (error) => {
        stderr += error.message;
        resolve({
          exitCode: 1,
          stdout,
          stderr,
          commandLine
        });
      });

      child.on("close", (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
          commandLine
        });
      });
    });
  }

  startMcp(request: WebCliRequest): WebMcpProcess {
    const child = spawn(getNpmExecutable(), ["run", "cli", "--", ...request.args], {
      cwd: request.cwd,
      shell: false,
      env: { ...process.env, FORCE_COLOR: "0" }
    });

    attachProcessOutput(child, request);

    return {
      dispose: () => {
        if (!child.killed) {
          child.kill();
        }
      }
    };
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: WebRuntimeState,
  runner: WebCliRunner
): Promise<void> {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { error: "Copilot Architect web UI is local-only." });
    return;
  }

  const requestUrl = new URL(request.url ?? "/", "http://localhost");

  try {
    if (
      request.method === "GET" &&
      (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html")
    ) {
      sendHtml(response, 200, createWebAppHtml());
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/state") {
      sendJson(response, 200, await createUiState(state));
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/validation-log") {
      sendJson(response, 200, await readLatestValidationLog(state.repoRoot));
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/action") {
      const payload = await readJsonBody<ActionPayload>(request);
      sendJson(response, 200, await runAction(payload, state, runner));
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function runAction(
  payload: ActionPayload,
  state: WebRuntimeState,
  runner: WebCliRunner
): Promise<unknown> {
  if (payload.action === "start-mcp") {
    state.mcpProcess?.dispose();
    state.mcpProcess = runner.startMcp({
      args: ["mcp"],
      cwd: state.repoRoot
    });
    state.mcpStatus = "running";
    state.lastCommand = createWebCliCommandLine(["mcp"]);
    state.lastExitCode = undefined;
    state.lastStdout = "MCP server started.";
    state.lastStderr = "";

    return createUiState(state);
  }

  if (payload.action === "stop-mcp") {
    state.mcpProcess?.dispose();
    state.mcpProcess = undefined;
    state.mcpStatus = "stopped";
    state.lastCommand = "stop MCP";
    state.lastExitCode = 0;
    state.lastStdout = "MCP server stopped.";
    state.lastStderr = "";

    return createUiState(state);
  }

  const args = resolveActionArgs(payload);
  const result = await runner.run({
    args,
    cwd: state.repoRoot
  });

  state.lastCommand = result.commandLine;
  state.lastExitCode = result.exitCode;
  state.lastStdout = result.stdout.trim().slice(-4000);
  state.lastStderr = result.stderr.trim().slice(-4000);

  return {
    result,
    state: await createUiState(state)
  };
}

function resolveActionArgs(payload: ActionPayload): string[] {
  switch (payload.action) {
    case "analyze":
      return ["analyze", "--json"];
    case "index":
      return ["index", "--json"];
    case "search":
      return ["search", requirePayloadValue(payload.query, "query"), "--json"];
    case "plan":
      return ["plan", requirePayloadValue(payload.request, "request"), "--json"];
    case "validate":
      return ["validate", "--json"];
    case "review":
      return ["review", "--plan", "latest", "--validation", "latest", "--json"];
    case "workspace-init":
      return ["workspace", "init", "--json"];
    case "workspace-show":
      return ["workspace", "show", "--json"];
    case "install-agents":
      return ["agents", "install", "--json"];
    case "generate-instructions":
      return ["instructions", "generate", "--json"];
    default:
      throw new Error(`Unknown web action: ${payload.action ?? "missing"}`);
  }
}

async function createUiState(state: WebRuntimeState): Promise<unknown> {
  const artifactRoot = path.join(state.repoRoot, ".copilot-architect");
  const repoMapPath = path.join(artifactRoot, "repo-map.json");
  const workspacePath = path.join(artifactRoot, "workspace.json");
  const plansRoot = path.join(artifactRoot, "plans");
  const runsRoot = path.join(artifactRoot, "runs");
  const reviewsRoot = path.join(artifactRoot, "reviews");
  const agentsRoot = path.join(state.repoRoot, ".github", "agents");

  return {
    repoRoot: state.repoRoot,
    mcpStatus: state.mcpStatus,
    lastCommand: state.lastCommand,
    lastExitCode: state.lastExitCode,
    lastStdout: state.lastStdout,
    lastStderr: state.lastStderr,
    artifacts: {
      repoMap: await readJsonSnapshot(repoMapPath),
      workspace: await readJsonSnapshot(workspacePath),
      latestPlan: await readJsonSnapshot(path.join(plansRoot, "latest-plan.json")),
      plans: await readDirectorySnapshot(plansRoot),
      latestValidation: await readJsonSnapshot(
        path.join(runsRoot, "latest-validation.json")
      ),
      validationRuns: await readDirectorySnapshot(runsRoot),
      latestReview: await readJsonSnapshot(
        path.join(reviewsRoot, "latest-review.json")
      ),
      reviews: await readDirectorySnapshot(reviewsRoot),
      agents: await readDirectorySnapshot(agentsRoot)
    }
  };
}

async function readJsonSnapshot(filePath: string): Promise<ArtifactSnapshot> {
  try {
    return {
      path: filePath,
      available: true,
      data: JSON.parse(await readFile(filePath, "utf8")) as unknown
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function readDirectorySnapshot(directoryPath: string): Promise<ArtifactSnapshot> {
  try {
    const entries = (await readdir(directoryPath))
      .filter((entry) => !entry.startsWith("."))
      .sort((left, right) => left.localeCompare(right));

    return {
      path: directoryPath,
      available: true,
      entries
    };
  } catch (error) {
    return {
      path: directoryPath,
      available: false,
      entries: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function readLatestValidationLog(repoRoot: string): Promise<unknown> {
  const validation = await readJsonSnapshot(
    path.join(repoRoot, ".copilot-architect", "runs", "latest-validation.json")
  );
  const record = asRecord(validation.data);
  const artifactPaths = asRecord(record?.artifactPaths);
  const logPath =
    typeof artifactPaths?.timestampLogPath === "string"
      ? artifactPaths.timestampLogPath
      : undefined;

  if (!logPath) {
    return {
      available: false,
      text: "",
      error: "No validation log path found."
    };
  }

  try {
    return {
      available: true,
      path: logPath,
      text: await readFile(logPath, "utf8")
    };
  } catch (error) {
    return {
      available: false,
      path: logPath,
      text: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function createWebAppHtml(): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Copilot Architect</title>",
    "<style>",
    createWebAppCss(),
    "</style>",
    "</head>",
    "<body>",
    '<main class="app-shell">',
    '<header class="topbar">',
    '<div class="brand"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6.5 12 2l8 4.5v11L12 22l-8-4.5v-11Z"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/></svg><span>Copilot Architect</span></div>',
    '<div class="status"><span id="repo-root">Loading</span><span id="mcp-status">MCP stopped</span></div>',
    "</header>",
    '<section class="command-bar" aria-label="Workflow commands">',
    button("analyze", "Analyze"),
    button("index", "Index"),
    '<label class="inline-field"><span>Search</span><input id="search-query" type="search" placeholder="invoice"></label>',
    button("search", "Search"),
    '<label class="inline-field wide"><span>Plan</span><input id="plan-request" type="text" placeholder="Add invoice approval workflow"></label>',
    button("plan", "Plan"),
    button("validate", "Validate"),
    button("review", "Review"),
    button("workspace-init", "Workspace Init"),
    button("workspace-show", "Workspace Show"),
    button("install-agents", "Agents"),
    button("generate-instructions", "Instructions"),
    button("start-mcp", "Start MCP"),
    button("stop-mcp", "Stop MCP"),
    "</section>",
    '<section class="workspace-grid" aria-label="Copilot Architect dashboard">',
    panel("repo-summary", "Repo summary"),
    panel("languages", "Languages/frameworks"),
    panel("plans", "Plans"),
    panel("validation", "Validation runs"),
    panel("reviews", "Review reports"),
    panel("workspace", "Workspace config"),
    panel("agents", "Agent status"),
    panel("mcp", "MCP status"),
    "</section>",
    '<section class="output-pane">',
    '<div class="output-header"><h2>Output</h2><button class="ghost" id="refresh">Refresh</button></div>',
    '<pre id="output">Ready.</pre>',
    "</section>",
    "</main>",
    "<script>",
    createWebAppScript(),
    "</script>",
    "</body>",
    "</html>"
  ].join("");
}

function createWebAppCss(): string {
  return [
    ':root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    "body{margin:0;background:#f5f7fb;color:#1d2433;}@media(prefers-color-scheme:dark){body{background:#141821;color:#eef2f7;}}",
    ".app-shell{min-height:100vh;display:grid;grid-template-rows:auto auto 1fr auto;}",
    ".topbar{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:14px 18px;border-bottom:1px solid #d8dee9;background:#fff;}@media(prefers-color-scheme:dark){.topbar{background:#191f2b;border-color:#2d3544;}}",
    ".brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;}.brand svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}",
    ".status{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;font-size:12px;color:#526071;}.status span{border:1px solid #d8dee9;border-radius:999px;padding:4px 8px;background:#f8fafc;}@media(prefers-color-scheme:dark){.status{color:#aab6c8}.status span{background:#111620;border-color:#2d3544;}}",
    ".command-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:end;padding:12px 18px;border-bottom:1px solid #d8dee9;background:#eef2f7;}@media(prefers-color-scheme:dark){.command-bar{background:#111620;border-color:#2d3544;}}",
    "button{height:32px;border:1px solid #b8c2d2;background:#fff;color:#162033;border-radius:6px;padding:0 10px;font-weight:600;cursor:pointer;}button:hover{border-color:#3b73d9;}button:disabled{opacity:.55;cursor:wait}.ghost{height:28px;background:transparent;}@media(prefers-color-scheme:dark){button{background:#1c2533;color:#eef2f7;border-color:#3a4658;}}",
    ".inline-field{display:grid;gap:3px;font-size:11px;font-weight:700;color:#526071;}.inline-field input{width:150px;height:32px;border:1px solid #b8c2d2;border-radius:6px;padding:0 8px;background:#fff;color:#162033;}.inline-field.wide input{width:min(360px,58vw);}@media(prefers-color-scheme:dark){.inline-field{color:#aab6c8}.inline-field input{background:#1c2533;color:#eef2f7;border-color:#3a4658;}}",
    ".workspace-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;padding:16px 18px;align-content:start;}",
    ".panel{border:1px solid #d8dee9;border-radius:8px;background:#fff;min-height:138px;overflow:hidden;}@media(prefers-color-scheme:dark){.panel{background:#191f2b;border-color:#2d3544;}}",
    ".panel h2{font-size:13px;margin:0;padding:10px 12px;border-bottom:1px solid #e6ebf2;background:#f8fafc;}@media(prefers-color-scheme:dark){.panel h2{background:#111620;border-color:#2d3544;}}",
    ".panel .body{padding:10px 12px;font-size:12px;line-height:1.45;color:#39475a;overflow-wrap:anywhere;}@media(prefers-color-scheme:dark){.panel .body{color:#c2ccda;}}",
    ".metric{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #edf1f7;padding:5px 0;}.metric:last-child{border-bottom:0}.muted{color:#6b778a}.ok{color:#237a46}.warn{color:#a86600}.bad{color:#b3261e}",
    ".output-pane{margin:0 18px 18px;border:1px solid #d8dee9;border-radius:8px;background:#101722;color:#dbe7ff;overflow:hidden;}.output-header{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-bottom:1px solid #2d3544;}.output-header h2{font-size:13px;margin:0;}pre{margin:0;padding:12px;min-height:120px;max-height:300px;overflow:auto;white-space:pre-wrap;font-size:12px;line-height:1.45;}",
    "@media(max-width:720px){.topbar{align-items:flex-start;flex-direction:column}.status{justify-content:flex-start}.command-bar{align-items:stretch}.inline-field,.inline-field input,.inline-field.wide input,button{width:100%;}.workspace-grid{grid-template-columns:1fr;padding:12px;}.output-pane{margin:0 12px 12px;}}"
  ].join("");
}

function createWebAppScript(): string {
  return `
const panels = {
  repo: document.querySelector("#repo-summary .body"),
  languages: document.querySelector("#languages .body"),
  plans: document.querySelector("#plans .body"),
  validation: document.querySelector("#validation .body"),
  reviews: document.querySelector("#reviews .body"),
  workspace: document.querySelector("#workspace .body"),
  agents: document.querySelector("#agents .body"),
  mcp: document.querySelector("#mcp .body")
};
const output = document.querySelector("#output");
const repoRoot = document.querySelector("#repo-root");
const mcpStatus = document.querySelector("#mcp-status");

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runAction(button.dataset.action, button));
});
document.querySelector("#refresh").addEventListener("click", refresh);

function html(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

async function refresh() {
  const response = await fetch("/api/state");
  renderState(await response.json());
}

async function runAction(action, button) {
  const payload = { action };
  if (action === "search") payload.query = document.querySelector("#search-query").value.trim();
  if (action === "plan") payload.request = document.querySelector("#plan-request").value.trim();
  button.disabled = true;
  output.textContent = "Running " + action + "...";
  try {
    const response = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    renderState(data.state ?? data);
    output.textContent = data.result ? formatResult(data.result) : JSON.stringify(data, null, 2);
  } catch (error) {
    output.textContent = String(error);
  } finally {
    button.disabled = false;
  }
}

function renderState(state) {
  repoRoot.textContent = state.repoRoot;
  mcpStatus.textContent = "MCP " + state.mcpStatus;
  const artifacts = state.artifacts ?? {};
  panels.repo.innerHTML = renderRepoMap(artifacts.repoMap);
  panels.languages.innerHTML = renderLanguages(artifacts.repoMap);
  panels.plans.innerHTML = renderPlan(artifacts.latestPlan, artifacts.plans);
  panels.validation.innerHTML = renderValidation(artifacts.latestValidation, artifacts.validationRuns);
  panels.reviews.innerHTML = renderReview(artifacts.latestReview, artifacts.reviews);
  panels.workspace.innerHTML = renderWorkspace(artifacts.workspace);
  panels.agents.innerHTML = renderEntries(artifacts.agents, ".github/agents");
  panels.mcp.innerHTML = '<div class="metric"><span>Status</span><strong>' + html(state.mcpStatus) + '</strong></div>';
  if (state.lastCommand) {
    output.textContent = [state.lastCommand, "exit: " + (state.lastExitCode ?? "n/a"), state.lastStdout ?? "", state.lastStderr ?? ""].filter(Boolean).join("\\n\\n");
  }
}

function renderRepoMap(snapshot) {
  const data = snapshot?.data;
  if (!snapshot?.available) return missing(snapshot, "Run Analyze");
  return [
    metric("Repos", data.repoCount ?? data.repositories?.length ?? 1),
    metric("Projects", data.projectCount ?? data.projects?.length ?? "n/a"),
    metric("Generated", data.generatedAt ?? "n/a")
  ].join("");
}

function renderLanguages(snapshot) {
  const data = snapshot?.data;
  if (!snapshot?.available) return missing(snapshot, "Run Analyze");
  const languages = data.languages ?? data.primaryLanguages ?? data.architectureSummary?.primaryLanguages ?? [];
  const frameworks = data.frameworks ?? data.primaryFrameworks ?? data.architectureSummary?.primaryFrameworks ?? [];
  return metric("Languages", list(languages)) + metric("Frameworks", list(frameworks));
}

function renderPlan(snapshot, entries) {
  const data = snapshot?.data;
  if (!snapshot?.available) return renderEntries(entries, "plans");
  return [
    metric("Latest", data.title ?? data.id ?? "latest"),
    metric("Status", data.status ?? "n/a"),
    metric("Steps", data.implementationSteps?.length ?? 0),
    metric("Files", data.impactAnalysis?.affectedFiles?.length ?? 0)
  ].join("");
}

function renderValidation(snapshot, entries) {
  const data = snapshot?.data;
  if (!snapshot?.available) return renderEntries(entries, "validation runs");
  const statusClass = data.status === "passed" ? "ok" : data.status ? "bad" : "";
  return [
    metric("Status", '<span class="' + statusClass + '">' + html(data.status ?? "n/a") + "</span>"),
    metric("Commands", data.results?.length ?? 0),
    metric("Failures", data.failureSummary?.length ?? 0)
  ].join("");
}

function renderReview(snapshot, entries) {
  const data = snapshot?.data;
  if (!snapshot?.available) return renderEntries(entries, "reviews");
  return [
    metric("Findings", data.findings?.length ?? 0),
    metric("Unexpected", data.unexpectedFiles?.length ?? 0),
    metric("Missing tests", data.missingTests?.length ?? 0),
    metric("Risks", data.risks?.length ?? 0)
  ].join("");
}

function renderWorkspace(snapshot) {
  const data = snapshot?.data;
  if (!snapshot?.available) return missing(snapshot, "Workspace Init");
  return metric("Repos", data.repoRoots?.length ?? 0) + metric("Artifact root", data.artifactRoot ?? "n/a");
}

function renderEntries(snapshot, label) {
  if (!snapshot?.available) return missing(snapshot, label);
  const entries = snapshot.entries ?? [];
  return entries.length ? entries.slice(-6).map((entry) => '<div class="metric"><span>' + html(entry) + '</span></div>').join("") : '<span class="muted">No entries.</span>';
}

function missing(snapshot, label) {
  return '<span class="muted">' + html(label) + '</span><br><span class="muted">' + html(snapshot?.path ?? "") + '</span>';
}

function metric(label, value) {
  return '<div class="metric"><span>' + html(label) + '</span><strong>' + value + '</strong></div>';
}

function list(values) {
  return Array.isArray(values) && values.length ? html(values.join(", ")) : "n/a";
}

function formatResult(result) {
  return [result.commandLine, "exit: " + result.exitCode, result.stdout, result.stderr].filter(Boolean).join("\\n\\n");
}

refresh();
`;
}

function button(action: string, label: string): string {
  return `<button type="button" data-action="${action}">${label}</button>`;
}

function panel(id: string, title: string): string {
  return `<article class="panel" id="${id}"><h2>${title}</h2><div class="body"><span class="muted">Loading</span></div></article>`;
}

function sendHtml(response: ServerResponse, statusCode: number, html: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(html);
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > 1024 * 1024) {
      throw new Error("Request body is too large.");
    }

    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  return (text ? JSON.parse(text) : {}) as T;
}

function isLocalRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress;
  return (
    !address ||
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function requirePayloadValue(value: string | undefined, name: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`Missing required ${name}.`);
  }

  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function attachProcessOutput(
  child: ChildProcessWithoutNullStreams,
  request: WebCliRequest
): void {
  child.stdout.on("data", (chunk: Buffer) => {
    request.onOutput?.("stdout", chunk.toString().trimEnd());
  });
  child.stderr.on("data", (chunk: Buffer) => {
    request.onOutput?.("stderr", chunk.toString().trimEnd());
  });
}

function getNpmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function quoteCliArg(value: string): string {
  if (/^[A-Za-z0-9._:/=+-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}
