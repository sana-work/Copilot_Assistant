#!/usr/bin/env node

import { pathToFileURL } from "node:url";

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
    "Phase 4 note:",
    "  First-class JavaScript/TypeScript, React, Angular, Python, and Java adapters are available."
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
    id: "phase-4-doctor",
    status: "ok",
    summary: "Phase 4 first-class adapters are ready",
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

  stdout(getPlaceholderText(rawCommand, commandArgs));
  return { exitCode: 0 };
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
    `Phase 2 placeholder registered with shared domain models.${argText}`
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
