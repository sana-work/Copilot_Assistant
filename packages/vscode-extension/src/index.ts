import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

export const EXTENSION_ID = "copilotArchitect";
export const VIEW_CONTAINER_ID = "copilotArchitect";
export const DASHBOARD_VIEW_ID = "copilotArchitect.dashboard";
export const DASHBOARD_PANEL_TYPE = "copilotArchitect.panel";
export const OUTPUT_CHANNEL_NAME = "Copilot Architect";
export const CHAT_PARTICIPANT_ID = "copilot-architect.architect";

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

export interface ChatRequestLike {
  command?: string;
  prompt: string;
}

export interface ChatResponseStreamLike {
  markdown(value: string): void;
  progress?(value: string): void;
}

export type ChatRequestHandlerLike = (
  request: ChatRequestLike,
  context: unknown,
  stream: ChatResponseStreamLike,
  token: unknown
) => Promise<void> | void;

export interface LanguageModelChatMessageLike {
  role: number;
  content: string | unknown[];
}

export interface LanguageModelResponseLike {
  text: AsyncIterable<string>;
}

export interface LanguageModelLike {
  sendRequest(
    messages: LanguageModelChatMessageLike[],
    options: Record<string, unknown>,
    token: unknown
  ): Promise<LanguageModelResponseLike>;
}

export interface VscodeApiLike {
  commands: {
    registerCommand(
      command: string,
      callback: (...args: unknown[]) => unknown
    ): DisposableLike;
    executeCommand?(command: string, ...args: unknown[]): Promise<unknown>;
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
    showOpenDialog?(options: {
      canSelectFolders?: boolean;
      canSelectFiles?: boolean;
      openLabel?: string;
      title?: string;
    }): Promise<UriLike[] | undefined>;
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
  chat?: {
    createChatParticipant(id: string, handler: ChatRequestHandlerLike): DisposableLike;
  };
  lm?: {
    selectChatModels(selector?: { vendor?: string; family?: string }): Promise<LanguageModelLike[]>;
  };
  LanguageModelChatMessage?: {
    User(content: string): LanguageModelChatMessageLike;
    Assistant(content: string): LanguageModelChatMessageLike;
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
  const extensionRoot = resolveExtensionRoot(context);
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
      const mcpArgs = [...command.cliArgs, "--path", workspaceRoot];
      outputChannel.appendLine(`$ ${createCliCommandLine(mcpArgs)}`);
      activeMcpProcess = mcpStarter.start({
        args: mcpArgs,
        cwd: extensionRoot,
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

    outputChannel.show(true);

    // Workspace-aware overrides: when workspace.json exists, route analyze and index
    // to per-repo workspace commands instead of treating the root as a single project.
    if (command.id === "copilotArchitect.analyzeRepo") {
      const repoRoots = await getRegisteredRepoRoots(workspaceRoot);
      if (repoRoots.length > 0) {
        outputChannel.appendLine(`[workspace mode] analyzing ${repoRoots.length} registered repo(s)…`);
        let passed = 0;
        for (const repoRoot of repoRoots) {
          const repoArgs = ["analyze", "--path", repoRoot];
          outputChannel.appendLine(`$ ${createCliCommandLine(repoArgs)}`);
          const r = await runner.run({
            args: repoArgs,
            cwd: extensionRoot,
            onOutput: (stream, text) => outputChannel.appendLine(`[${stream}] ${text}`)
          });
          if (r.exitCode === 0) passed++;
        }
        state.lastCommand = `analyze (workspace, ${repoRoots.length} repos)`;
        state.lastExitCode = passed === repoRoots.length ? 0 : 1;
        dashboard.refresh();
        vscode.window.showInformationMessage(
          `Analyze complete: ${passed}/${repoRoots.length} repos analyzed.`
        );
        return undefined;
      }
    }

    if (command.id === "copilotArchitect.buildIndex") {
      const repoRoots = await getRegisteredRepoRoots(workspaceRoot);
      if (repoRoots.length > 0) {
        const wsArgs = ["workspace", "index", "--path", workspaceRoot];
        outputChannel.appendLine(`[workspace mode] $ ${createCliCommandLine(wsArgs)}`);
        const r = await runner.run({
          args: wsArgs,
          cwd: extensionRoot,
          onOutput: (stream, text) => outputChannel.appendLine(`[${stream}] ${text}`)
        });
        state.lastCommand = createCliCommandLine(wsArgs);
        state.lastExitCode = r.exitCode;
        dashboard.refresh();
        if (r.exitCode === 0) {
          vscode.window.showInformationMessage(
            `Index built across ${repoRoots.length} registered repos.`
          );
        } else {
          vscode.window.showErrorMessage("Workspace index failed. See output.");
        }
        return r;
      }
    }

    if (command.id === "copilotArchitect.generatePlan") {
      const repoRoots = await getRegisteredRepoRoots(workspaceRoot);
      if (repoRoots.length > 0) {
        // workspace plan produces a cross-repo plan; feature request is args[1]
        const wsArgs = ["workspace", "plan", ...args.slice(1), "--path", workspaceRoot];
        outputChannel.appendLine(`[workspace mode] $ ${createCliCommandLine(wsArgs)}`);
        const r = await runner.run({
          args: wsArgs,
          cwd: extensionRoot,
          onOutput: (stream, text) => outputChannel.appendLine(`[${stream}] ${text}`)
        });
        state.lastCommand = createCliCommandLine(wsArgs);
        state.lastExitCode = r.exitCode;
        dashboard.refresh();
        if (r.exitCode === 0) {
          vscode.window.showInformationMessage(
            `Workspace plan generated across ${repoRoots.length} repos.`
          );
        } else {
          vscode.window.showErrorMessage("Workspace plan failed. See output.");
        }
        return r;
      }
    }

    if (command.id === "copilotArchitect.validate") {
      const repoRoots = await getRegisteredRepoRoots(workspaceRoot);
      if (repoRoots.length > 0) {
        outputChannel.appendLine(`[workspace mode] validating ${repoRoots.length} repo(s)…`);
        let passed = 0;
        for (const repoRoot of repoRoots) {
          const repoArgs = ["validate", "--path", repoRoot];
          outputChannel.appendLine(`$ ${createCliCommandLine(repoArgs)}`);
          const r = await runner.run({
            args: repoArgs,
            cwd: extensionRoot,
            onOutput: (stream, text) => outputChannel.appendLine(`[${stream}] ${text}`)
          });
          if (r.exitCode === 0) passed++;
        }
        state.lastCommand = `validate (workspace, ${repoRoots.length} repos)`;
        state.lastExitCode = passed === repoRoots.length ? 0 : 1;
        dashboard.refresh();
        if (passed === repoRoots.length) {
          vscode.window.showInformationMessage(
            `Validation passed: all ${repoRoots.length} repos.`
          );
        } else {
          vscode.window.showErrorMessage(
            `Validation: ${passed}/${repoRoots.length} repos passed. See output for details.`
          );
        }
        return undefined;
      }
    }

    if (command.id === "copilotArchitect.review") {
      const repoRoots = await getRegisteredRepoRoots(workspaceRoot);
      if (repoRoots.length > 0) {
        outputChannel.appendLine(`[workspace mode] reviewing ${repoRoots.length} repo(s)…`);
        let passed = 0;
        for (const repoRoot of repoRoots) {
          const repoArgs = ["review", "--plan", "latest", "--validation", "latest", "--path", repoRoot];
          outputChannel.appendLine(`$ ${createCliCommandLine(repoArgs)}`);
          const r = await runner.run({
            args: repoArgs,
            cwd: extensionRoot,
            onOutput: (stream, text) => outputChannel.appendLine(`[${stream}] ${text}`)
          });
          if (r.exitCode === 0) passed++;
        }
        state.lastCommand = `review (workspace, ${repoRoots.length} repos)`;
        state.lastExitCode = passed > 0 ? 0 : 1;
        dashboard.refresh();
        vscode.window.showInformationMessage(
          `Review complete: ${passed}/${repoRoots.length} repos reviewed. See .copilot-architect/reviews/ in each repo.`
        );
        return undefined;
      }
    }

    // Single-repo (default) path
    const argsWithPath = [...args, "--path", workspaceRoot];
    const commandLine = createCliCommandLine(argsWithPath);
    outputChannel.appendLine(`$ ${commandLine}`);

    const result = await runner.run({
      args: argsWithPath,
      cwd: extensionRoot,
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
    ),
    vscode.commands.registerCommand("copilotArchitect.openRepoInNewWindow", async () => {
      const uris = await vscode.window.showOpenDialog?.({
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: "Open Repo",
        title: "Select a repository folder to open in a new window"
      });
      if (!uris || uris.length === 0) return;
      await vscode.commands.executeCommand?.("vscode.openFolder", uris[0], {
        forceNewWindow: true
      });
    }),
    vscode.commands.registerCommand("copilotArchitect.setupMcp", async () => {
      outputChannel.appendLine("$ npm run cli -- mcp config --path " + workspaceRoot);
      outputChannel.show(true);
      const result = await runner.run({
        args: ["mcp", "config", "--path", workspaceRoot],
        cwd: extensionRoot,
        onOutput: (_s, t) => outputChannel.appendLine(t)
      });
      if (result.exitCode === 0) {
        const action = await (vscode.window.showInformationMessage as (msg: string, ...items: string[]) => Promise<string | undefined>)(
          "MCP server configured. Reload the window to activate Copilot Architect tools.",
          "Reload Window"
        );
        if (action === "Reload Window") {
          await vscode.commands.executeCommand?.("workbench.action.reloadWindow");
        }
      } else {
        vscode.window.showErrorMessage("MCP config failed. Check the Output channel for details.");
      }
    }),
    vscode.commands.registerCommand("copilotArchitect.workspaceScan", async () => {
      // Ask the user which folder contains the sub-repos (e.g. repos/, services/, etc.)
      const uris = await vscode.window.showOpenDialog?.({
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: "Select Repos Folder",
        title: "Select the folder whose immediate sub-directories are your repositories"
      });
      const reposDir = uris?.[0]?.fsPath;
      if (!reposDir) return;

      let subDirs: string[];
      try {
        const entries = await readdir(reposDir, { withFileTypes: true });
        subDirs = entries
          .filter((e) => e.isDirectory() && !e.name.startsWith("."))
          .map((e) => path.join(reposDir, e.name));
      } catch (err) {
        vscode.window.showErrorMessage(
          `Could not read folder: ${err instanceof Error ? err.message : String(err)}`
        );
        return;
      }

      if (subDirs.length === 0) {
        vscode.window.showInformationMessage("No sub-directories found in the selected folder.");
        return;
      }

      outputChannel.appendLine(`[workspace scan] ${subDirs.length} repo(s) found in ${reposDir}`);
      outputChannel.show(true);

      // 1. Initialize workspace at the workspace root
      await runner.run({
        args: ["workspace", "init", "--path", workspaceRoot],
        cwd: extensionRoot,
        onOutput: (_s, t) => outputChannel.appendLine(t)
      });

      // 2. Register each sub-directory as a named repo
      let registered = 0;
      for (const subDir of subDirs) {
        const repoName = path.basename(subDir);
        const result = await runner.run({
          args: ["workspace", "add", "--path", workspaceRoot, "--repo", subDir, "--name", repoName],
          cwd: extensionRoot,
          onOutput: (_s, t) => outputChannel.appendLine(t)
        });
        if (result.exitCode === 0) {
          registered++;
          outputChannel.appendLine(`✓ registered: ${repoName}`);
        } else {
          outputChannel.appendLine(`✗ failed:     ${repoName}`);
        }
      }

      if (registered === 0) {
        vscode.window.showErrorMessage("No repos could be registered. Check the Output channel for details.");
        return;
      }

      // 3. Analyze each registered repo so repo-map.json is created in every sub-repo folder
      outputChannel.appendLine(`\n[workspace scan] analyzing ${registered} repo(s)…`);
      vscode.window.showInformationMessage(`Registered ${registered} repos — analyzing each one, please wait…`);
      for (const subDir of subDirs.slice(0, registered)) {
        const repoName = path.basename(subDir);
        outputChannel.appendLine(`  → analyze: ${repoName}`);
        await runner.run({
          args: ["analyze", "--path", subDir],
          cwd: extensionRoot,
          onOutput: (_s, t) => outputChannel.appendLine(t)
        });
      }

      // 4. Build a combined workspace index (creates index.json in every sub-repo folder)
      outputChannel.appendLine(`\n[workspace scan] building workspace index…`);
      await runner.run({
        args: ["workspace", "index", "--path", workspaceRoot],
        cwd: extensionRoot,
        onOutput: (_s, t) => outputChannel.appendLine(t)
      });

      state.lastCommand = `workspace scan + index (${registered} repos)`;
      state.lastExitCode = 0;
      dashboard.refresh();
      vscode.window.showInformationMessage(
        `Done! ${registered} repos analyzed and indexed. Use @architect /search or /plan to work across all repos.`
      );
    })
  );

  if (vscode.chat) {
    const chatHandler: ChatRequestHandlerLike = async (request, _context, stream, token) => {
      if (request.command === "help" || (!request.command && !request.prompt.trim())) {
        stream.markdown(getChatHelpText());
        return;
      }

      const args = resolveChatCommandArgs(request.command, request.prompt.trim());
      if (!args) {
        stream.markdown(
          `Unknown command \`/${request.command}\`. Use \`/help\` to see available commands.`
        );
        return;
      }

      // args[0] is the actual CLI command regardless of whether the user used a slash command
      const cliCommand = args[0];

      // Workspace-aware arg resolution: workspace plan uses the workspace root and all repos
      const chatRepoRoots = await getRegisteredRepoRoots(workspaceRoot);
      let runArgs: string[];
      if (chatRepoRoots.length > 0 && cliCommand === "plan") {
        runArgs = ["workspace", "plan", ...args.slice(1), "--path", workspaceRoot];
      } else {
        runArgs = [...args, "--path", workspaceRoot];
      }

      stream.progress?.(getChatProgressMessage(cliCommand));

      const result = await runner.run({ args: runArgs, cwd: extensionRoot });

      if (result.exitCode !== 0) {
        const errText = (result.stderr || result.stdout).trim();
        stream.markdown(
          `**Command failed** (exit ${result.exitCode})\n\n\`\`\`\n${errText.slice(0, 2000)}\n\`\`\``
        );
        return;
      }

      // Prefer the written markdown artifact over raw stdout
      let content = result.stdout;
      const artifactPath = getChatArtifactPath(cliCommand, workspaceRoot);
      if (artifactPath) {
        try {
          content = await readFile(artifactPath, "utf8");
        } catch { /* no artifact yet — use stdout */ }
      }

      // Try LM for every command
      if (vscode.lm) {
        stream.progress?.("Getting AI-powered insights…");
        const repoCtx = cliCommand === "plan" ? await buildRepoContext(workspaceRoot) : "";
        const lmPrompt = buildCommandLmPrompt(cliCommand, request.prompt.trim(), content, repoCtx);
        if (lmPrompt) {
          const streamed = await streamLmResponse(vscode, lmPrompt, stream, token);
          if (streamed) {
            const hint = getChatFollowUpHint(cliCommand);
            if (hint) stream.markdown(hint);
            return;
          }
        }
      } else if (cliCommand === "plan") {
        stream.markdown(
          "> ℹ️ **GitHub Copilot language model not available.** Install GitHub Copilot Chat and sign in for AI-powered answers. Showing static analysis:\n\n"
        );
      }

      // Fallback: show clean formatted output
      if (artifactPath) {
        const fallback = cliCommand === "plan" ? extractPlanSummary(content) : content.slice(0, 10000);
        stream.markdown(fallback);
      } else {
        stream.markdown(formatCliOutputAsMarkdown(content));
      }
      const hint = getChatFollowUpHint(cliCommand);
      if (hint) stream.markdown(hint);
    };

    context.subscriptions.push(vscode.chat.createChatParticipant(CHAT_PARTICIPANT_ID, chatHandler));
  }

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
      const [exe, cliArgs] = resolveNpmSpawn(["run", "cli", "--", ...request.args]);
      const child = spawn(exe, cliArgs, {
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
    const [exe, cliArgs] = resolveNpmSpawn(["run", "cli", "--", ...request.args]);
    const child = spawn(exe, cliArgs, {
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
    `<div class="actions"><a href="command:copilotArchitect.openRepoInNewWindow">Open Repo in New Window</a> <a href="command:copilotArchitect.workspaceScan">Scan &amp; Register Sub-repos</a> <a href="command:copilotArchitect.setupMcp">Setup MCP Server</a>${COPILOT_ARCHITECT_COMMANDS.map(renderCommandLink).join("")}</div>`,
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

function resolveExtensionRoot(context: ExtensionContextLike): string {
  // extensionPath = .../Copilot_Assistant/packages/vscode-extension
  // monorepo root = .../Copilot_Assistant (two levels up)
  const extensionPath = context.extensionPath ?? context.extensionUri?.fsPath;
  if (extensionPath) {
    return path.resolve(extensionPath, "..", "..");
  }
  return process.cwd();
}

function getNpmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

// On Windows, npm.cmd cannot be spawned with shell:false (EINVAL).
// Route through cmd.exe /c so the .cmd file is executed correctly.
function resolveNpmSpawn(args: string[]): [string, string[]] {
  if (process.platform === "win32") {
    return ["cmd.exe", ["/c", "npm.cmd", ...args]];
  }
  return ["npm", args];
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


export function resolveChatCommandArgs(
  command: string | undefined,
  prompt: string
): string[] | undefined {
  switch (command) {
    case "analyze":
      return ["analyze"];
    case "index":
      return ["index"];
    case "plan":
      return prompt ? ["plan", prompt] : undefined;
    case "validate":
      return ["validate"];
    case "review":
      return ["review", "--plan", "latest", "--validation", "latest"];
    case "search":
      return prompt ? ["search", prompt] : undefined;
    case "diagnostics":
      return ["diagnostics"];
    case "agents":
      return ["agents", "install"];
    case "instructions":
      return ["instructions", "generate"];
    default:
      return prompt ? ["plan", prompt] : undefined;
  }
}

function getChatProgressMessage(command: string): string {
  const messages: Record<string, string> = {
    analyze: "Analyzing repository…",
    index: "Building file index…",
    plan: "Generating feature plan…",
    validate: "Running validation commands…",
    review: "Generating code review…",
    search: "Searching repository…",
    diagnostics: "Running diagnostics…",
    agents: "Installing agent templates…",
    instructions: "Generating Copilot instructions…"
  };
  return messages[command] ?? "Running Copilot Architect…";
}

function getChatArtifactPath(command: string, workspaceRoot: string): string | undefined {
  const base = path.join(workspaceRoot, ".copilot-architect");
  switch (command) {
    case "plan":
      return path.join(base, "plans", "latest-plan.md");
    case "validate":
      return path.join(base, "runs", "latest-validation.md");
    case "review":
      return path.join(base, "reviews", "latest-review.md");
    default:
      return undefined;
  }
}

function getChatFollowUpHint(command: string): string | undefined {
  switch (command) {
    case "analyze":
      return "\n\n---\n**Next steps:** Run `/index` to build a searchable file index, then `/plan <feature>` to generate an implementation plan.";
    case "index":
      return "\n\n---\n**Next steps:** Use `/search <query>` to find relevant files, or `/plan <feature>` to generate a plan.";
    case "plan":
      return "\n\n---\n**Next steps:** Run `/validate` to check build and tests, then ask `@FeatureImplementer` to implement the plan.";
    case "validate":
      return "\n\n---\n**Next steps:** Run `/review` to generate a review report, or ask `@Debugger` to diagnose any failures.";
    case "review":
      return "\n\n---\n**Next steps:** Share the review with `@CodeReviewer` for deeper analysis, or address the findings and re-run `/validate`.";
    case "instructions":
      return "\n\n---\n**Next steps:** Run `/agents` to install custom Copilot agent templates that use these instructions.";
    default:
      return undefined;
  }
}

// Returns the absolute paths of all repos registered in workspace.json.
// Returns [] when no workspace.json exists (single-repo mode).
async function getRegisteredRepoRoots(workspaceRoot: string): Promise<string[]> {
  try {
    const wsPath = path.join(workspaceRoot, ".copilot-architect", "workspace.json");
    const ws = JSON.parse(await readFile(wsPath, "utf8")) as {
      repos?: Array<{ path?: string }>;
    };
    const repos = ws.repos ?? [];
    return repos
      .filter((r) => r.path && r.path !== ".")
      .map((r) => path.resolve(workspaceRoot, r.path as string));
  } catch {
    return [];
  }
}

async function buildRepoContext(workspaceRoot: string): Promise<string> {
  const lines: string[] = [];

  try {
    const mapPath = path.join(workspaceRoot, ".copilot-architect", "repo-map.json");
    const map = JSON.parse(await readFile(mapPath, "utf8"));
    const repo = map.repos?.[0];
    if (repo) {
      const langs = (repo.languages as Array<{ name: string }>)?.map((l) => l.name).join(", ");
      const fws = (repo.frameworks as Array<{ name: string }>)?.map((f) => f.name).join(", ");
      const testCmd = (repo.commands?.test as Array<{ command: string }>)?.[0]?.command;
      const entry = (repo.entryPoints as Array<{ filePath: string }>)?.[0]?.filePath;
      if (langs) lines.push(`Languages: ${langs}`);
      if (fws) lines.push(`Frameworks: ${fws}`);
      if (entry) lines.push(`Entry point: ${entry}`);
      if (testCmd) lines.push(`Test command: ${testCmd}`);
    }
  } catch { /* no repo-map yet */ }

  try {
    const indexPath = path.join(workspaceRoot, ".copilot-architect", "index", "index.json");
    const idx = JSON.parse(await readFile(indexPath, "utf8"));
    const docs = (idx.documents as Array<{
      relativePath: string;
      symbols: Array<{ name: string; kind: string }>;
      extension: string;
      fileSizeBytes: number;
      isConfigFile: boolean;
      isDocFile: boolean;
    }>) ?? [];

    const SOURCE_EXTS = new Set([".py", ".ts", ".js", ".tsx", ".jsx", ".java", ".go", ".rb", ".cs"]);
    const sourceDocs = docs
      .filter(
        (d) =>
          !d.isConfigFile &&
          !d.isDocFile &&
          d.fileSizeBytes > 0 &&
          SOURCE_EXTS.has(d.extension)
      )
      .slice(0, 25);

    if (sourceDocs.length) {
      lines.push("\nSource files:");
      for (const doc of sourceDocs) {
        const syms = doc.symbols
          ?.slice(0, 5)
          .map((s) => s.name)
          .join(", ");
        lines.push(`- ${doc.relativePath}${syms ? ` [${syms}]` : ""}`);
      }
    }
  } catch { /* no index yet */ }

  return lines.join("\n");
}

function buildCommandLmPrompt(
  command: string,
  userRequest: string,
  content: string,
  repoContext: string
): string | undefined {
  const body = content.trim().slice(0, 8000);
  const repoSection = repoContext ? `\nRepository context:\n${repoContext}\n` : "";

  switch (command) {
    case "plan": {
      const summary = extractPlanSummary(content);
      return [
        "You are Copilot Architect, a coding assistant with access to the developer's repository analysis.",
        "Answer specifically about THIS codebase using the actual file names, function names, and patterns provided.",
        "Be concise and practical. Show a short code snippet when it helps. No generic advice.",
        repoSection,
        `Static analysis:\n${summary}`,
        "",
        `Developer's request: "${userRequest}"`,
        "",
        "Provide a specific implementation guide:",
        "1. Which exact file(s) to modify and what to change",
        "2. New dependencies to install (if any)",
        "3. A short code snippet showing the key change",
        "4. One command to verify it works"
      ].join("\n");
    }

    case "analyze":
      return [
        "You are Copilot Architect. The developer just ran repo analysis.",
        "Summarize concisely: main language/framework, key entry points, and 2-3 actionable observations.",
        "Under 200 words. Use the actual names found in the output.",
        "",
        `Analysis output:\n${body}`
      ].join("\n");

    case "index":
      return [
        "You are Copilot Architect. The developer just built a searchable file index for their repo.",
        "Confirm what was indexed. Suggest 3 useful `/search` queries they could run next.",
        "Keep it short and practical.",
        "",
        `Index output:\n${body}`
      ].join("\n");

    case "validate":
      return [
        "You are Copilot Architect. The developer just ran validation (build, tests, lint).",
        "If everything passed: confirm briefly and note any warnings.",
        "If something failed: identify the failure and give specific fix steps with the relevant error lines.",
        "Be direct — no fluff.",
        "",
        `Validation results:\n${body}`
      ].join("\n");

    case "review":
      return [
        "You are Copilot Architect. The developer just ran a code review on their latest git diff.",
        "Summarize the most important findings: bugs, security issues, missing tests, code quality.",
        "Give 3-5 specific, actionable recommendations referencing actual file names and lines where available.",
        "",
        `Review report:\n${body}`
      ].join("\n");

    case "search":
      return [
        "You are Copilot Architect. The developer searched their repo index.",
        "Explain what was found and how it relates to their query. Group related results. Use bullet points.",
        "",
        `Search query: "${userRequest}"`,
        "",
        `Search results:\n${body}`
      ].join("\n");

    case "diagnostics":
      return [
        "You are Copilot Architect. The developer ran repo diagnostics.",
        "Highlight warnings, missing configs, or issues. Give specific recommendations to improve readiness.",
        "If everything is fine, say so briefly.",
        "",
        `Diagnostics output:\n${body}`
      ].join("\n");

    case "agents":
      return [
        "You are Copilot Architect. Custom Copilot agent templates were just installed.",
        "List what agents were created and what each does. Give one example of invoking each in Copilot Chat.",
        "Be brief.",
        "",
        `Agents install output:\n${body}`
      ].join("\n");

    case "instructions":
      return [
        "You are Copilot Architect. A `.github/copilot-instructions.md` file was just generated.",
        "In 3-4 bullet points, summarize what instructions were written and how they improve Copilot assistance.",
        "",
        `Instructions output:\n${body}`
      ].join("\n");

    default:
      return undefined;
  }
}

async function streamLmResponse(
  vscode: VscodeApiLike,
  prompt: string,
  stream: ChatResponseStreamLike,
  token: unknown
): Promise<boolean> {
  if (!vscode.lm) return false;

  try {
    // Try progressively broader selectors — different VS Code versions expose models differently
    let models: LanguageModelLike[] = [];
    for (const selector of [
      { vendor: "copilot", family: "gpt-4o" },
      { vendor: "copilot", family: "claude-sonnet-4-5" },
      { vendor: "copilot" },
      {}
    ]) {
      models = await vscode.lm.selectChatModels(selector);
      if (models.length) break;
    }

    if (!models.length) {
      stream.markdown(
        "_No Copilot language model found. Make sure GitHub Copilot Chat is installed and you are signed in, then reload the window._\n\n"
      );
      return false;
    }

    const model = models[0];

    // VS Code 1.92+ has static .User() factory; earlier versions use constructor with role enum
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LmMsg = (vscode as any).LanguageModelChatMessage;
    let message: LanguageModelChatMessageLike;
    if (typeof LmMsg?.User === "function") {
      message = LmMsg.User(prompt) as LanguageModelChatMessageLike;
    } else if (typeof LmMsg === "function") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roleUser = (vscode as any).LanguageModelChatMessageRole?.User ?? 1;
      message = new LmMsg(roleUser, prompt) as LanguageModelChatMessageLike;
    } else {
      message = { role: 1, content: prompt };
    }

    const lmResponse = await model.sendRequest([message], {}, token);

    let hasContent = false;
    for await (const chunk of lmResponse.text) {
      stream.markdown(chunk);
      hasContent = true;
    }
    return hasContent;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stream.markdown(`\n> ⚠️ **Copilot LM error:** ${msg}\n\n`);
    return false;
  }
}

export function extractPlanSummary(markdown: string): string {
  const titleMatch = /^#\s+(.+)$/m.exec(markdown);
  const title = titleMatch?.[1] ?? "Implementation Plan";

  // Parse ## sections into a map
  const sectionMap: Record<string, string> = {};
  for (const chunk of markdown.split(/\n(?=## )/)) {
    const m = /^## (.+)\n([\s\S]*)/.exec(chunk);
    if (m) sectionMap[m[1].trim()] = m[2].trim();
  }

  const lines: string[] = [`# ${title}`, ""];

  const files = sectionMap["Likely Files To Modify"];
  if (files) {
    lines.push("## Files to modify", files, "");
  }

  const steps = sectionMap["Step-by-Step Implementation Plan"];
  if (steps) {
    lines.push("## Implementation steps", steps, "");
  }

  const cmds = sectionMap["Validation Commands"];
  if (cmds) {
    lines.push("## Run to validate", cmds, "");
  }

  const risks = sectionMap["Risks"];
  if (risks) {
    const riskItems = risks
      .split(/\n(?=-)/)
      .map((r) => r.replace(/\s*Mitigation:[\s\S]*/, "").trim())
      .filter((r) => r.startsWith("-"));
    if (riskItems.length) {
      lines.push("## Risks", riskItems.join("\n"), "");
    }
  }

  const questions = sectionMap["Open Questions"];
  if (questions) {
    lines.push("## Open questions", questions, "");
  }

  return lines.join("\n").trim();
}

// Lines that are internal CLI noise the user doesn't need to see
const NOISE_PATTERNS = [
  /^Copilot Architect:/,                 // CLI banner
  /^\s*>\s*(copilot-architect|node)/,    // npm/node invocation lines
  /\/(Users|home|tmp)\//,               // absolute file paths
  /^Plan (JSON|Markdown):/,             // artifact path echoes
  /^Latest (JSON|Markdown):/,
  /^Validation (JSON|Markdown|Logs):/,
  /^Review (JSON|Markdown):/,
  /^Status:\s*draft/,                    // internal draft status
];

export function formatCliOutputAsMarkdown(stdout: string): string {
  const lines = stdout.trim().split("\n");
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      out.push("");
      continue;
    }

    // Drop internal noise lines
    if (NOISE_PATTERNS.some((p) => p.test(trimmed))) {
      continue;
    }

    // Already a markdown list item — keep as-is
    if (/^\s*[-*]\s/.test(line)) {
      out.push(trimmed);
      continue;
    }

    // "Key: value" line — bold the key
    const colonMatch = /^([A-Za-z][A-Za-z0-9 ]{0,30}):\s(.+)$/.exec(trimmed);
    if (colonMatch) {
      out.push(`**${colonMatch[1]}:** ${colonMatch[2]}`);
      continue;
    }

    out.push(trimmed);
  }

  // Collapse consecutive blank lines and strip leading/trailing blanks
  const collapsed: string[] = [];
  for (const line of out) {
    if (!line && collapsed.length && !collapsed[collapsed.length - 1]) continue;
    collapsed.push(line);
  }
  while (collapsed.length && !collapsed[0]) collapsed.shift();
  while (collapsed.length && !collapsed[collapsed.length - 1]) collapsed.pop();

  return collapsed.join("\n");
}

export function getChatHelpText(): string {
  return [
    "## Copilot Architect",
    "",
    "Use `@architect` with a slash command in Copilot Chat:",
    "",
    "| Command | What it does |",
    "|---|---|",
    "| `/analyze` | Detect languages, frameworks, and entry points |",
    "| `/index` | Build a searchable local file index |",
    "| `/plan <feature>` | Generate a feature implementation plan |",
    "| `/validate` | Run build, test, lint, and format commands |",
    "| `/review` | Review the latest git diff against the approved plan |",
    "| `/search <query>` | Search the repo index |",
    "| `/diagnostics` | Report repo readiness and analysis signals |",
    "| `/agents` | Install custom Copilot agent templates |",
    "| `/instructions` | Generate `.github/copilot-instructions.md` |",
    "",
    "**Example:** `@architect /plan add user authentication`",
    "",
    "You can also skip the slash command — any plain prompt is treated as a plan request:",
    "",
    "`@architect add a payment webhook handler`"
  ].join("\n");
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
