#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { RepoDiscoveryService } from "@copilot-architect/core";
import {
  IndexingService,
  type IndexResult,
  type SearchResponse
} from "@copilot-architect/indexer";
import {
  FeaturePlanningService,
  type FeaturePlanningResult
} from "@copilot-architect/planner";
import {
  CommandConfigService,
  type ParsedCommandConfig,
  type CommandConfigInitResult,
  type CommandConfigValidationResult
} from "@copilot-architect/validator";
import {
  ARTIFACT_DIRECTORY,
  CLI_COMMANDS,
  CURRENT_SCHEMA_VERSION,
  type DiagnosticReport,
  type CliCommandName,
  PROJECT_NAME
} from "@copilot-architect/shared";

export interface CliIo {
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

export interface CliResult {
  exitCode: number;
}

const commandDescriptions = {
  init: "Initialize local .copilot-architect artifacts.",
  analyze: "Analyze the current repo or workspace.",
  index: "Build the local searchable index.",
  search: "Search the local repo index.",
  plan: "Generate a feature implementation plan.",
  commands: "Manage custom validation command configuration.",
  validate: "Run safe validation commands.",
  review: "Generate a review report from diff and validation evidence.",
  handoff: "Generate an implementation handoff prompt.",
  agents: "Manage custom Copilot agent templates and installs.",
  instructions: "Generate Copilot instructions and AGENTS.md suggestions.",
  workspace: "Inspect or manage multi-repo workspace context.",
  mcp: "Start the local MCP server.",
  serve: "Start the optional local web UI shell.",
  status: "Show local Copilot Architect status.",
  doctor: "Run environment and project checks."
} satisfies Record<CliCommandName, string>;

export function getHelpText(): string {
  const commandLines = CLI_COMMANDS.map(
    (command) => `  ${command.padEnd(14)} ${commandDescriptions[command]}`
  );

  return [
    `${PROJECT_NAME}`,
    "",
    "Usage:",
    "  npm run cli -- <command> [args]",
    "",
    "Commands:",
    ...commandLines,
    "",
    "Phase 8 note:",
    "  Custom command configuration is available."
  ].join("\n");
}

export function getDoctorText(nodeVersion = process.version): string {
  const report = getDoctorReport(nodeVersion);
  const checkLines = report.checks.map(
    (check) => `- ${check.name}: ${check.status} - ${check.message}`
  );

  return [
    `${PROJECT_NAME} doctor`,
    "",
    `Schema: ${report.schemaVersion}`,
    `Node.js: ${report.environment.nodeVersion}`,
    "Runtime: TypeScript/Node.js-first",
    `Package manager: ${report.environment.packageManager}`,
    `Artifact root: ${report.artifactRoot}`,
    `Status: ${report.summary}`,
    "",
    "Checks:",
    ...checkLines
  ].join("\n");
}

export function getDoctorReport(nodeVersion = process.version): DiagnosticReport {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    id: "phase-8-doctor",
    status: "ok",
    summary: "Phase 8 custom command configuration is ready",
    environment: {
      nodeVersion,
      packageManager: "npm",
      platform: process.platform
    },
    checks: [
      {
        name: "runtime",
        status: "ok",
        message: "TypeScript/Node.js-first"
      },
      {
        name: "dotnet-engine",
        status: "ok",
        message: "C#/.NET MVP engine is not present"
      },
      {
        name: "visual-studio-vsix",
        status: "ok",
        message: "Visual Studio VSIX MVP is not present"
      }
    ],
    artifactRoot: ARTIFACT_DIRECTORY
  };
}

export async function runCli(
  args = process.argv.slice(2),
  io: CliIo = {}
): Promise<CliResult> {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;
  const [rawCommand, ...commandArgs] = args;

  if (!rawCommand || rawCommand === "--help" || rawCommand === "-h") {
    stdout(getHelpText());
    return { exitCode: 0 };
  }

  if (!isCliCommand(rawCommand)) {
    stderr(`Unknown command: ${rawCommand}`);
    stdout(getHelpText());
    return { exitCode: 1 };
  }

  if (rawCommand === "doctor") {
    stdout(getDoctorText());
    return { exitCode: 0 };
  }

  if (rawCommand === "init") {
    try {
      const options = parseInitArgs(commandArgs);
      const result = await new CommandConfigService().init(options);
      stdout(getInitSummaryText(result));
      return { exitCode: 0 };
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return { exitCode: 1 };
    }
  }

  if (rawCommand === "commands") {
    try {
      const options = parseCommandsArgs(commandArgs);
      const service = new CommandConfigService();

      if (options.subcommand === "validate") {
        const result = await service.validate({ startPath: options.startPath });
        stdout(
          options.json
            ? JSON.stringify(result, null, 2)
            : getCommandsValidateText(result)
        );
        return { exitCode: result.ok ? 0 : 1 };
      }

      const parsed = await service.load({
        startPath: options.startPath,
        allowMissing: true
      });
      stdout(
        options.json
          ? JSON.stringify(parsed.normalized, null, 2)
          : getCommandsListText(parsed)
      );
      return { exitCode: 0 };
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return { exitCode: 1 };
    }
  }

  if (rawCommand === "analyze") {
    try {
      const options = parseAnalyzeArgs(commandArgs);
      const result = await new RepoDiscoveryService().analyze({
        startPath: options.startPath,
        outputPath: options.outputPath
      });

      stdout(
        options.json
          ? JSON.stringify(result.repoMap, null, 2)
          : getAnalyzeSummaryText(result.repoMapPath, result.repoMap.summary)
      );

      return { exitCode: 0 };
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return { exitCode: 1 };
    }
  }

  if (rawCommand === "index") {
    try {
      const options = parseIndexArgs(commandArgs);
      const result = await new IndexingService().index(options);
      stdout(getIndexSummaryText(result));
      return { exitCode: 0 };
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return { exitCode: 1 };
    }
  }

  if (rawCommand === "search") {
    try {
      const options = parseSearchArgs(commandArgs);
      const result = await new IndexingService().search(options);
      stdout(options.json ? JSON.stringify(result, null, 2) : getSearchText(result));
      return { exitCode: 0 };
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return { exitCode: 1 };
    }
  }

  if (rawCommand === "plan") {
    try {
      const options = parsePlanArgs(commandArgs);
      const result = await new FeaturePlanningService().createPlan(options);
      stdout(
        options.json ? JSON.stringify(result.plan, null, 2) : getPlanSummaryText(result)
      );
      return { exitCode: 0 };
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return { exitCode: 1 };
    }
  }

  stdout(getPlaceholderText(rawCommand, commandArgs));
  return { exitCode: 0 };
}

interface AnalyzeCliOptions {
  startPath?: string;
  outputPath?: string;
  json: boolean;
}

interface InitCliOptions {
  startPath?: string;
  overwrite?: boolean;
}

function parseInitArgs(args: string[]): InitCliOptions {
  const options: InitCliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }

    if (arg === "--path") {
      const startPath = args[index + 1];

      if (!startPath) {
        throw new Error("Missing value for --path");
      }

      options.startPath = startPath;
      index += 1;
      continue;
    }

    throw new Error(`Unknown init argument: ${arg}`);
  }

  return options;
}

interface CommandsCliOptions {
  subcommand: "validate" | "list";
  startPath?: string;
  json: boolean;
}

function parseCommandsArgs(args: string[]): CommandsCliOptions {
  const [subcommand, ...rest] = args;

  if (subcommand !== "validate" && subcommand !== "list") {
    throw new Error("Expected commands subcommand: validate or list");
  }

  const options: CommandsCliOptions = {
    subcommand,
    json: false
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--path") {
      const startPath = rest[index + 1];

      if (!startPath) {
        throw new Error("Missing value for --path");
      }

      options.startPath = startPath;
      index += 1;
      continue;
    }

    throw new Error(`Unknown commands argument: ${arg}`);
  }

  return options;
}

function parseAnalyzeArgs(args: string[]): AnalyzeCliOptions {
  const options: AnalyzeCliOptions = {
    json: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--output") {
      const outputPath = args[index + 1];

      if (!outputPath) {
        throw new Error("Missing value for --output");
      }

      options.outputPath = outputPath;
      index += 1;
      continue;
    }

    if (!arg.startsWith("-") && !options.startPath) {
      options.startPath = arg;
      continue;
    }

    throw new Error(`Unknown analyze argument: ${arg}`);
  }

  return options;
}

function getAnalyzeSummaryText(
  repoMapPath: string,
  summary: {
    summary: string;
    repoCount: number;
    projectCount: number;
    primaryLanguages: string[];
    primaryFrameworks: string[];
  }
): string {
  return [
    `${PROJECT_NAME}: analyze`,
    "",
    summary.summary,
    `Repos: ${summary.repoCount}`,
    `Projects: ${summary.projectCount}`,
    `Languages: ${summary.primaryLanguages.join(", ") || "unknown"}`,
    `Frameworks: ${summary.primaryFrameworks.join(", ") || "unknown"}`,
    `Repo map: ${repoMapPath}`
  ].join("\n");
}

function getInitSummaryText(result: CommandConfigInitResult): string {
  return [
    `${PROJECT_NAME}: init`,
    "",
    result.message,
    `Commands config: ${result.configPath}`,
    `Created: ${result.created ? "yes" : "no"}`
  ].join("\n");
}

function getCommandsValidateText(result: CommandConfigValidationResult): string {
  const lines = [
    `${PROJECT_NAME}: commands validate`,
    "",
    `Config: ${result.configPath}`,
    `Status: ${result.ok ? "ok" : "error"}`
  ];

  if (result.errors.length > 0) {
    lines.push("", "Errors:", ...result.errors.map((error) => `- ${error}`));
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:", ...result.warnings.map((warning) => `- ${warning}`));
  }

  if (result.parsed) {
    lines.push(`Commands: ${result.parsed.commands.length}`);
  }

  return lines.join("\n");
}

function getCommandsListText(config: ParsedCommandConfig): string {
  const lines = [
    `${PROJECT_NAME}: commands list`,
    "",
    `Config: ${config.configPath}`,
    `Commands: ${config.commands.length}`
  ];

  if (config.warnings.length > 0) {
    lines.push("", "Warnings:", ...config.warnings.map((warning) => `- ${warning}`));
  }

  for (const customCommand of config.commands) {
    const command = customCommand.command;
    const cwd = command.cwd ? ` [cwd: ${command.cwd}]` : "";
    const override = customCommand.overrideDetected ? " override" : "";

    lines.push(
      "",
      `${customCommand.category}: ${command.name}${cwd}${override}`,
      `  ${[command.command, ...command.args].join(" ")}`
    );
  }

  return lines.join("\n");
}

interface IndexCliOptions {
  startPath?: string;
  rebuild?: boolean;
}

function parseIndexArgs(args: string[]): IndexCliOptions {
  const options: IndexCliOptions = {};

  for (const arg of args) {
    if (arg === "--rebuild") {
      options.rebuild = true;
      continue;
    }

    if (!arg.startsWith("-") && !options.startPath) {
      options.startPath = arg;
      continue;
    }

    throw new Error(`Unknown index argument: ${arg}`);
  }

  return options;
}

interface SearchCliOptions {
  startPath?: string;
  query: string;
  json: boolean;
  limit?: number;
}

function parseSearchArgs(args: string[]): SearchCliOptions {
  const queryParts: string[] = [];
  const options: SearchCliOptions = {
    query: "",
    json: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--limit") {
      const limit = Number(args[index + 1]);

      if (!Number.isFinite(limit) || limit <= 0) {
        throw new Error("Missing or invalid value for --limit");
      }

      options.limit = limit;
      index += 1;
      continue;
    }

    if (arg === "--path") {
      const startPath = args[index + 1];

      if (!startPath) {
        throw new Error("Missing value for --path");
      }

      options.startPath = startPath;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown search argument: ${arg}`);
    }

    queryParts.push(arg);
  }

  options.query = queryParts.join(" ").trim();

  if (!options.query) {
    throw new Error("Missing search query");
  }

  return options;
}

function getIndexSummaryText(result: IndexResult): string {
  return [
    `${PROJECT_NAME}: index`,
    "",
    `Mode: ${result.mode}`,
    `Documents: ${result.index.stats.documentCount}`,
    `Tests: ${result.index.stats.testFileCount}`,
    `Configs: ${result.index.stats.configFileCount}`,
    `Docs: ${result.index.stats.docFileCount}`,
    `Index: ${result.indexPath}`,
    `Status: ${result.statusPath}`
  ].join("\n");
}

function getSearchText(response: SearchResponse): string {
  const lines = [
    `${PROJECT_NAME}: search`,
    "",
    `Query: ${response.query}`,
    `Results: ${response.results.length}`
  ];

  for (const result of response.results) {
    lines.push(
      "",
      `${result.relativePath} (${result.languageGuess}, score ${result.score})`,
      `Matched: ${result.matchedFields.join(", ")}`
    );
  }

  return lines.join("\n");
}

interface PlanCliOptions {
  request: string;
  startPath?: string;
  json: boolean;
}

function parsePlanArgs(args: string[]): PlanCliOptions {
  const requestParts: string[] = [];
  const options: PlanCliOptions = {
    request: "",
    json: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--path") {
      const startPath = args[index + 1];

      if (!startPath) {
        throw new Error("Missing value for --path");
      }

      options.startPath = startPath;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown plan argument: ${arg}`);
    }

    requestParts.push(arg);
  }

  options.request = requestParts.join(" ").trim();

  if (!options.request) {
    throw new Error("Missing feature request");
  }

  return options;
}

function getPlanSummaryText(result: FeaturePlanningResult): string {
  return [
    `${PROJECT_NAME}: plan`,
    "",
    result.plan.title,
    `Status: ${result.plan.status}`,
    `Relevant files: ${result.plan.relevantFiles.length}`,
    `Validation commands: ${result.plan.validationPlan.commands.length}`,
    `Requires approval: ${result.plan.requiresHumanApproval ? "yes" : "no"}`,
    `Plan JSON: ${result.jsonPath}`,
    `Plan Markdown: ${result.markdownPath}`,
    `Latest JSON: ${result.latestJsonPath}`,
    `Latest Markdown: ${result.latestMarkdownPath}`
  ].join("\n");
}

function isCliCommand(value: string): value is CliCommandName {
  return CLI_COMMANDS.includes(value as CliCommandName);
}

function getPlaceholderText(command: CliCommandName, args: string[]): string {
  const argText = args.length > 0 ? ` Args: ${args.join(" ")}` : "";
  return [
    `${PROJECT_NAME}: ${command}`,
    "",
    `${commandDescriptions[command]}`,
    "",
    `Phase 7 placeholder registered. ${argText}`.trimEnd()
  ].join("\n");
}

function isDirectRun(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint ? import.meta.url === pathToFileURL(entryPoint).href : false;
}

if (isDirectRun()) {
  const result = await runCli();
  process.exitCode = result.exitCode;
}
