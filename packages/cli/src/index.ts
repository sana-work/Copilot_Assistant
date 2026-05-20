#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  CLI_COMMANDS,
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
    "Phase 1 note:",
    "  Commands are registered as placeholders. Business logic lands in later phases."
  ].join("\n");
}

export function getDoctorText(nodeVersion = process.version): string {
  return [
    `${PROJECT_NAME} doctor`,
    "",
    `Node.js: ${nodeVersion}`,
    "Runtime: TypeScript/Node.js-first",
    "Package manager: npm",
    "C#/.NET MVP engine: not present",
    "Visual Studio VSIX MVP: not present",
    "Status: Phase 1 skeleton is ready"
  ].join("\n");
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
    `Phase 1 placeholder registered successfully.${argText}`
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
