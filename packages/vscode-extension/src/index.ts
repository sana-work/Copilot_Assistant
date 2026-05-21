import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";

export const EXTENSION_ID = "copilotArchitect";
export const VIEW_CONTAINER_ID = "copilotArchitect";
export const DASHBOARD_VIEW_ID = "copilotArchitect.dashboard";
export const DASHBOARD_PANEL_TYPE = "copilotArchitect.panel";
export const OUTPUT_CHANNEL_NAME = "Copilot Architect";

export interface CopilotArchitectCommand {
  id: string;
  title: string;
  cliArgs: string[];
  prompt?: {
    title: string;
    prompt: string;
    placeHolder: string;
  };
  startsMcp?: boolean;
}

export const COPILOT_ARCHITECT_COMMANDS: CopilotArchitectCommand[] = [
  {
    id: "copilotArchitect.analyzeRepo",
    title: "Copilot Architect: Analyze Repo",
    cliArgs: ["analyze"]
  },
  {
    id: "copilotArchitect.buildIndex",
    title: "Copilot Architect: Build Index",
    cliArgs: ["index"]
  },
  {
    id: "copilotArchitect.generatePlan",
    title: "Copilot Architect: Generate Plan",
    cliArgs: ["plan"],
    prompt: {
      title: "Copilot Architect",
      prompt: "Feature request",
      placeHolder: "Add invoice approval workflow"
    }
  },
  {
    id: "copilotArchitect.validate",
    title: "Copilot Architect: Validate",
    cliArgs: ["validate"]
  },
  {
    id: "copilotArchitect.review",
    title: "Copilot Architect: Review",
    cliArgs: ["review", "--plan", "latest", "--validation", "latest"]
  },
  {
    id: "copilotArchitect.startMcp",
    title: "Copilot Architect: Start MCP",
    cliArgs: ["mcp"],
    startsMcp: true
  },
  {
    id: "copilotArchitect.installAgents",
    title: "Copilot Architect: Install Agents",
    cliArgs: ["agents", "install"]
  },
  {
    id: "copilotArchitect.generateInstructions",
    title: "Copilot Architect: Generate Instructions",
    cliArgs: ["instructions", "generate"]
  }
];

export interface DisposableLike {
  dispose(): void;
}

export interface ExtensionContextLike {
  subscriptions: DisposableLike[];
  extensionUri?: UriLike;
  extensionPath?: string;
}

export interface UriLike {
  fsPath?: string;
  toString(): string;
}

export interface WorkspaceFolderLike {
  uri: UriLike;
  name: string;
  index: number;
}

export interface OutputChannelLike extends DisposableLike {
  appendLine(message: string): void;
  show(preserveFocus?: boolean): void;
}

export interface WebviewLike {
  html: string;
  options?: {
    enableCommandUris?: boolean;
    enableScripts?: boolean;
  };
}

export interface WebviewViewLike {
  webview: WebviewLike;
}

export interface WebviewPanelLike extends DisposableLike {
  webview: WebviewLike;
  reveal(): void;
}

export interface WebviewViewProviderLike {
  resolveWebviewView(webviewView: WebviewViewLike): void;
}

export interface TerminalLike extends DisposableLike {
  sendText(text: string): void;
  show(preserveFocus?: boolean): void;
}

export interface VscodeApiLike {
  commands: {
    registerCommand(
      command: string,
      callback: (...args: unknown[]) => unknown
    ): DisposableLike;
  };
  window: {
    createOutputChannel(name: string): OutputChannelLike;
    showInformationMessage(message: string): unknown;
    showErrorMessage(message: string): unknown;
    showInputBox?(options: {
      title?: string;
      prompt?: string;
      placeHolder?: string;
    }): Promise<string | undefined>;
    registerWebviewViewProvider?(
      viewId: string,
      provider: WebviewViewProviderLike
    ): DisposableLike;
    createWebviewPanel?(
      viewType: string,
      title: string,
      showOptions: number | { viewColumn?: number },
      options: { enableCommandUris?: boolean; enableScripts?: boolean }
    ): WebviewPanelLike;
    createTerminal?(options: { name: string; cwd?: string }): TerminalLike;
  };
  workspace: {
    workspaceFolders?: WorkspaceFolderLike[];
  };
  ViewColumn?: {
    One: number;
  };
}

export interface CliRunRequest {
  args: string[];
  cwd: string;
  onOutput?: (stream: "stdout" | "stderr", text: string) => void;
}

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  commandLine: string;
}

export interface CliRunner {
  run(request: CliRunRequest): Promise<CliRunResult>;
}

export interface McpStarter {
  start(request: CliRunRequest): DisposableLike;
}

export interface ExtensionDependencies {
  runner?: CliRunner;
  mcpStarter?: McpStarter;
}

export interface ExtensionState {
  workspaceRoot: string;
  mcpStatus: "stopped" | "starting" | "running";
  lastCommand?: string;
  lastExitCode?: number;
  lastStdout?: string;
  lastStderr?: string;
}

export interface ActivatedExtensionApi {
  runWorkflowCommand(commandId: string): Promise<CliRunResult | undefined>;
  refreshDashboard(): void;
  getState(): ExtensionState;
}

let activeMcpProcess: DisposableLike | undefined;

export function activate(
  context: ExtensionContextLike,
  vscode: VscodeApiLike = loadVscodeApi(),
  dependencies: ExtensionDependencies = {}
): ActivatedExtensionApi {
  const workspaceRoot = getWorkspaceRoot(vscode);
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const state: ExtensionState = {
    workspaceRoot,
    mcpStatus: "stopped"
  };
  const runner = dependencies.runner ?? new NodeCliRunner();
  const mcpStarter = dependencies.mcpStarter ?? new TerminalMcpStarter(vscode);
  const dashboard = new DashboardController(vscode, state);

  context.subscriptions.push(outputChannel);

  if (vscode.window.registerWebviewViewProvider) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(DASHBOARD_VIEW_ID, dashboard)
    );
  }

  const runWorkflowCommand = async (
    commandId: string
  ): Promise<CliRunResult | undefined> => {
    const command = COPILOT_ARCHITECT_COMMANDS.find((item) => item.id === commandId);

    if (!command) {
      throw new Error(`Unknown Copilot Architect command: ${commandId}`);
    }

    if (command.startsMcp) {
      activeMcpProcess?.dispose();
      state.mcpStatus = "starting";
      outputChannel.appendLine(`$ ${createCliCommandLine(command.cliArgs)}`);
      activeMcpProcess = mcpStarter.start({
        args: command.cliArgs,
        cwd: workspaceRoot,
        onOutput: (stream, text) => outputChannel.appendLine(`[${stream}] ${text}`)
      });
      state.mcpStatus = "running";
      state.lastCommand = createCliCommandLine(command.cliArgs);
      dashboard.refresh();
      vscode.window.showInformationMessage("Copilot Architect MCP server started.");
      return undefined;
    }

    const args = await resolveCommandArgs(command, vscode);

    if (!args) {
      return undefined;
    }

    const commandLine = createCliCommandLine(args);
    outputChannel.appendLine(`$ ${commandLine}`);
    outputChannel.show(true);

    const result = await runner.run({
      args,
      cwd: workspaceRoot,
      onOutput: (stream, text) => outputChannel.appendLine(`[${stream}] ${text}`)
    });

    state.lastCommand = commandLine;
    state.lastExitCode = result.exitCode;
    state.lastStdout = trimForDashboard(result.stdout);
    state.lastStderr = trimForDashboard(result.stderr);
    dashboard.refresh();

    if (result.exitCode === 0) {
      vscode.window.showInformationMessage(`${command.title} completed.`);
    } else {
      vscode.window.showErrorMessage(`${command.title} failed. See output.`);
    }

    return result;
  };

  for (const command of COPILOT_ARCHITECT_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command.id, () => runWorkflowCommand(command.id))
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("copilotArchitect.openDashboard", () =>
      dashboard.openPanel()
    ),
    vscode.commands.registerCommand("copilotArchitect.refreshDashboard", () =>
      dashboard.refresh()
    )
  );

  dashboard.refresh();

  return {
    runWorkflowCommand,
    refreshDashboard: () => dashboard.refresh(),
    getState: () => ({ ...state })
  };
}

export function deactivate(): void {
  activeMcpProcess?.dispose();
  activeMcpProcess = undefined;
}

export class NodeCliRunner implements CliRunner {
  async run(request: CliRunRequest): Promise<CliRunResult> {
    return new Promise((resolve) => {
      const child = spawn(getNpmExecutable(), ["run", "cli", "--", ...request.args], {
        cwd: request.cwd,
        shell: false,
        env: { ...process.env, FORCE_COLOR: "0" }
      });
      const commandLine = createCliCommandLine(request.args);
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
}

export class TerminalMcpStarter implements McpStarter {
  constructor(private readonly vscode: VscodeApiLike) {}

  start(request: CliRunRequest): DisposableLike {
    if (this.vscode.window.createTerminal) {
      const terminal = this.vscode.window.createTerminal({
        name: "Copilot Architect MCP",
        cwd: request.cwd
      });
      terminal.sendText(createCliCommandLine(request.args));
      terminal.show(true);
      return terminal;
    }

    return new NodeMcpStarter().start(request);
  }
}

export class NodeMcpStarter implements McpStarter {
  start(request: CliRunRequest): DisposableLike {
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

class DashboardController implements WebviewViewProviderLike {
  private view: WebviewViewLike | undefined;
  private panel: WebviewPanelLike | undefined;

  constructor(
    private readonly vscode: VscodeApiLike,
    private readonly state: ExtensionState
  ) {}

  resolveWebviewView(webviewView: WebviewViewLike): void {
    this.view = webviewView;
    this.configureWebview(webviewView.webview);
    this.refresh();
  }

  openPanel(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    if (!this.vscode.window.createWebviewPanel) {
      this.vscode.window.showInformationMessage(
        "Copilot Architect dashboard is available in the activity bar."
      );
      return;
    }

    this.panel = this.vscode.window.createWebviewPanel(
      DASHBOARD_PANEL_TYPE,
      "Copilot Architect",
      this.vscode.ViewColumn?.One ?? 1,
      { enableCommandUris: true, enableScripts: false }
    );
    this.configureWebview(this.panel.webview);
    this.refresh();
  }

  refresh(): void {
    const html = createDashboardHtml(this.state);

    if (this.view) {
      this.configureWebview(this.view.webview);
      this.view.webview.html = html;
    }

    if (this.panel) {
      this.configureWebview(this.panel.webview);
      this.panel.webview.html = html;
    }
  }

  private configureWebview(webview: WebviewLike): void {
    webview.options = {
      enableCommandUris: true,
      enableScripts: false
    };
  }
}

export function createDashboardHtml(state: ExtensionState): string {
  const sections = [
    {
      title: "Repo summary",
      body: escapeHtml(state.workspaceRoot)
    },
    {
      title: "Languages/frameworks",
      body: "From repo analysis artifacts"
    },
    {
      title: "Plans",
      body: ".copilot-architect/plans/latest-plan.json"
    },
    {
      title: "Validation runs",
      body: ".copilot-architect/runs/latest-validation.json"
    },
    {
      title: "Review reports",
      body: ".copilot-architect/reviews/latest-review.json"
    },
    {
      title: "Agent status",
      body: ".github/agents"
    },
    {
      title: "MCP status",
      body: state.mcpStatus
    }
  ];

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Copilot Architect</title>",
    "<style>",
    "body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0;padding:16px;}",
    "h1{font-size:20px;font-weight:600;margin:0 0 12px;}",
    ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;}",
    "section{border:1px solid var(--vscode-panel-border);border-radius:6px;padding:10px;background:var(--vscode-sideBar-background);min-height:74px;}",
    "h2{font-size:13px;font-weight:600;margin:0 0 8px;}",
    "p{font-size:12px;line-height:1.4;margin:0;color:var(--vscode-descriptionForeground);overflow-wrap:anywhere;}",
    ".actions{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;}",
    "a{font-size:12px;color:var(--vscode-textLink-foreground);text-decoration:none;}",
    "pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;border:1px solid var(--vscode-panel-border);border-radius:6px;padding:10px;}",
    "</style>",
    "</head>",
    "<body>",
    "<h1>Copilot Architect</h1>",
    `<div class="actions">${COPILOT_ARCHITECT_COMMANDS.map(renderCommandLink).join("")}</div>`,
    '<div class="grid">',
    ...sections.map(
      (section) => `<section><h2>${section.title}</h2><p>${section.body}</p></section>`
    ),
    "</div>",
    '<section style="margin-top:10px">',
    "<h2>Last command</h2>",
    `<p>${escapeHtml(state.lastCommand ?? "None")}</p>`,
    `<p>Exit code: ${state.lastExitCode ?? "n/a"}</p>`,
    state.lastStdout ? `<pre>${escapeHtml(state.lastStdout)}</pre>` : "",
    state.lastStderr ? `<pre>${escapeHtml(state.lastStderr)}</pre>` : "",
    "</section>",
    "</body>",
    "</html>"
  ].join("");
}

export function createCliCommandLine(args: string[]): string {
  return ["npm", "run", "cli", "--", ...args.map(quoteCliArg)].join(" ");
}

function loadVscodeApi(): VscodeApiLike {
  const require = createRequire(import.meta.url);
  return require("vscode") as VscodeApiLike;
}

async function resolveCommandArgs(
  command: CopilotArchitectCommand,
  vscode: VscodeApiLike
): Promise<string[] | undefined> {
  if (!command.prompt) {
    return command.cliArgs;
  }

  const value = await vscode.window.showInputBox?.({
    title: command.prompt.title,
    prompt: command.prompt.prompt,
    placeHolder: command.prompt.placeHolder
  });
  const request = value?.trim();

  return request ? [...command.cliArgs, request] : undefined;
}

function getWorkspaceRoot(vscode: VscodeApiLike): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
}

function getNpmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function attachProcessOutput(
  child: ChildProcessWithoutNullStreams,
  request: CliRunRequest
): void {
  child.stdout.on("data", (chunk: Buffer) => {
    request.onOutput?.("stdout", chunk.toString().trimEnd());
  });
  child.stderr.on("data", (chunk: Buffer) => {
    request.onOutput?.("stderr", chunk.toString().trimEnd());
  });
}

function quoteCliArg(value: string): string {
  if (/^[A-Za-z0-9._:/=+-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function trimForDashboard(value: string): string {
  return value.trim().slice(-2000);
}

function renderCommandLink(command: CopilotArchitectCommand): string {
  return `<a href="command:${command.id}">${escapeHtml(command.title.replace("Copilot Architect: ", ""))}</a>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
