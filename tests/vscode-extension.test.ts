import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  COPILOT_ARCHITECT_COMMANDS,
  DASHBOARD_VIEW_ID,
  activate,
  createCliCommandLine,
  createDashboardHtml,
  deactivate,
  type CliRunRequest,
  type CliRunResult,
  type DisposableLike,
  type ExtensionContextLike,
  type McpStarter,
  type VscodeApiLike,
  type WebviewViewProviderLike
} from "../packages/vscode-extension/src/index.js";

describe("VS Code extension shell", () => {
  it("declares activity bar, webview, and workflow commands in the manifest", async () => {
    const manifest = JSON.parse(
      await readFile(
        path.join(process.cwd(), "packages/vscode-extension/package.json"),
        "utf8"
      )
    );
    const contributedCommands = manifest.contributes.commands.map(
      (command: { command: string; title: string }) => command
    );

    expect(manifest.main).toBe("./dist/index.js");
    expect(manifest.contributes.viewsContainers.activitybar[0]).toEqual(
      expect.objectContaining({
        id: "copilotArchitect",
        title: "Copilot Architect",
        icon: "resources/copilot-architect.svg"
      })
    );
    expect(manifest.contributes.views.copilotArchitect[0]).toEqual(
      expect.objectContaining({
        id: DASHBOARD_VIEW_ID,
        name: "Copilot Architect",
        type: "webview"
      })
    );

    for (const command of COPILOT_ARCHITECT_COMMANDS) {
      expect(contributedCommands).toContainEqual(
        expect.objectContaining({
          command: command.id,
          title: command.title
        })
      );
      expect(manifest.activationEvents).toContain(`onCommand:${command.id}`);
    }
  });

  it("activates in a fake extension host and registers commands through CLI/MCP shims", async () => {
    const fake = createFakeVscode();
    // extensionPath = .../ext-root/packages/vscode-extension → resolveExtensionRoot goes two levels up
    const context: ExtensionContextLike = {
      subscriptions: [],
      extensionPath: "/workspace/ext-root/packages/vscode-extension"
    };
    const cliRequests: CliRunRequest[] = [];
    const mcpRequests: CliRunRequest[] = [];
    const runner = {
      run: async (request: CliRunRequest): Promise<CliRunResult> => {
        cliRequests.push(request);
        request.onOutput?.("stdout", "ok");
        return {
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          commandLine: createCliCommandLine(request.args)
        };
      }
    };
    const mcpStarter: McpStarter = {
      start: (request) => {
        mcpRequests.push(request);
        return { dispose: () => undefined };
      }
    };

    const api = activate(context, fake.vscode, { runner, mcpStarter });
    await fake.commands.get("copilotArchitect.analyzeRepo")?.();
    fake.input = "Add invoice approval workflow";
    await fake.commands.get("copilotArchitect.generatePlan")?.();
    await fake.commands.get("copilotArchitect.startMcp")?.();

    expect(fake.viewProviderId).toBe(DASHBOARD_VIEW_ID);
    expect(context.subscriptions.length).toBeGreaterThanOrEqual(
      COPILOT_ARCHITECT_COMMANDS.length
    );
    expect(cliRequests.map((request) => request.args)).toEqual([
      ["analyze", "--path", "/workspace/repo"],
      ["plan", "Add invoice approval workflow", "--path", "/workspace/repo"]
    ]);
    expect(cliRequests[0]?.cwd).toBe("/workspace/ext-root");
    expect(mcpRequests[0]?.args).toEqual(["mcp", "--path", "/workspace/repo"]);
    expect(api.getState().mcpStatus).toBe("running");

    deactivate();
  });

  it("renders the required dashboard sections without reading business artifacts", () => {
    const html = createDashboardHtml({
      workspaceRoot: "/workspace/repo",
      mcpStatus: "stopped",
      lastCommand: "npm run cli -- analyze",
      lastExitCode: 0,
      lastStdout: "analysis complete",
      lastStderr: ""
    });

    expect(html).toContain("Repo summary");
    expect(html).toContain("Languages/frameworks");
    expect(html).toContain("Plans");
    expect(html).toContain("Validation runs");
    expect(html).toContain("Review reports");
    expect(html).toContain("Agent status");
    expect(html).toContain("MCP status");
    expect(html).toContain("command:copilotArchitect.analyzeRepo");
  });
});

function createFakeVscode(): {
  vscode: VscodeApiLike;
  commands: Map<string, () => Promise<unknown> | unknown>;
  input: string | undefined;
  viewProviderId: string | undefined;
} {
  const commands = new Map<string, () => Promise<unknown> | unknown>();
  const fake: {
    vscode: VscodeApiLike;
    commands: Map<string, () => Promise<unknown> | unknown>;
    input: string | undefined;
    viewProviderId: string | undefined;
  } = {
    commands,
    input: undefined,
    viewProviderId: undefined,
    vscode: {
      commands: {
        registerCommand: (command, callback): DisposableLike => {
          commands.set(command, callback);
          return { dispose: () => commands.delete(command) };
        }
      },
      window: {
        createOutputChannel: () => ({
          appendLine: () => undefined,
          show: () => undefined,
          dispose: () => undefined
        }),
        showInformationMessage: () => undefined,
        showErrorMessage: () => undefined,
        showInputBox: async () => fake.input,
        registerWebviewViewProvider: (
          viewId: string,
          provider: WebviewViewProviderLike
        ): DisposableLike => {
          fake.viewProviderId = viewId;
          provider.resolveWebviewView({ webview: { html: "" } });
          return { dispose: () => undefined };
        },
        createWebviewPanel: () => ({
          webview: { html: "" },
          reveal: () => undefined,
          dispose: () => undefined
        }),
        createTerminal: () => ({
          sendText: () => undefined,
          show: () => undefined,
          dispose: () => undefined
        })
      },
      workspace: {
        workspaceFolders: [
          {
            uri: {
              fsPath: "/workspace/repo",
              toString: () => "/workspace/repo"
            },
            name: "repo",
            index: 0
          }
        ]
      },
      ViewColumn: {
        One: 1
      }
    }
  };

  return fake;
}
