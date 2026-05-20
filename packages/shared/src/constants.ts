export const PROJECT_NAME = "Copilot Architect";

export const ARTIFACT_DIRECTORY = ".copilot-architect";

export const CLI_COMMANDS = [
  "init",
  "analyze",
  "index",
  "search",
  "plan",
  "validate",
  "review",
  "handoff",
  "agents",
  "instructions",
  "workspace",
  "mcp",
  "serve",
  "status",
  "doctor"
] as const;

export type CliCommandName = (typeof CLI_COMMANDS)[number];

export const REQUIRED_PACKAGE_DIRECTORIES = [
  "packages/shared",
  "packages/core",
  "packages/adapters",
  "packages/indexer",
  "packages/planner",
  "packages/validator",
  "packages/reviewer",
  "packages/agents",
  "packages/instructions",
  "packages/mcp-server",
  "packages/cli",
  "packages/vscode-extension",
  "packages/web"
] as const;

export const REQUIRED_TEMPLATE_DIRECTORIES = [
  "templates/agents",
  "templates/instructions",
  "templates/skills"
] as const;
