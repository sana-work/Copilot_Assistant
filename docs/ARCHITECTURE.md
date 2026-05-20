# Architecture

## Shape

Copilot Architect uses a TypeScript monorepo-style structure:

```text
packages/
  shared/
  core/
  adapters/
  indexer/
  planner/
  validator/
  reviewer/
  agents/
  instructions/
  mcp-server/
  cli/
  vscode-extension/
  web/
templates/
samples/
tests/
docs/
scripts/
```

## Boundaries

Business logic lives in these packages:

- `packages/shared`
- `packages/core`
- `packages/adapters`
- `packages/indexer`
- `packages/planner`
- `packages/validator`
- `packages/reviewer`
- `packages/agents`
- `packages/instructions`
- `packages/mcp-server`
- `packages/cli`

UI shells must not contain business logic. `packages/vscode-extension` and `packages/web` call CLI, core, or MCP services and render results.

## CLI-First

The CLI is the primary local entry point. It orchestrates package APIs without duplicating detection, planning, validation, review, or generation logic.

Expected commands include:

- `init`
- `analyze`
- `index`
- `search`
- `plan`
- `validate`
- `review`
- `handoff`
- `agents`
- `instructions`
- `workspace`
- `mcp`
- `serve`
- `status`
- `doctor`

## MCP-First

The MCP server exposes repo intelligence tools to local agent hosts. It should use the TypeScript MCP SDK and call the same package APIs as the CLI. MCP is first-class because agent hosts need structured access to repo maps, plans, validation evidence, policy checks, custom instructions, and review reports.

## Adapter System

Adapters detect repository characteristics and provide commands, folders, entry points, and architectural hints. Deep adapters are prioritized for JavaScript, TypeScript, Angular, React, Node.js, Python, Java Maven, and Java Gradle. Generic adapters provide fallback support for unknown or custom repositories.

## Artifacts

All runtime artifacts are stored under `.copilot-architect/`:

```text
.copilot-architect/
  repo-map.json
  workspace.json
  commands.json
  policy.json
  index/
  plans/
  handoffs/
  runs/
  reviews/
  audit/
  diagnostics/
```

Shared artifact constants and JSON helpers live in `packages/shared`. All packages should use these helpers instead of hard-coding artifact paths.

## Shared Domain Models

`packages/shared` owns serializable TypeScript interfaces for repo context, workspace context, repo maps, commands, feature plans, validation results, review reports, safety policy, audit logs, handoff prompts, agent templates, instruction generation, MCP tool results, workspace config, enterprise policy, and diagnostics.

Top-level artifacts include `schemaVersion` fields so future migrations can be handled explicitly.

## Dependency Strategy

The MVP uses a minimal dependency strategy: TypeScript, Node.js, npm, Vitest, and focused packages only when they remove meaningful implementation risk. The local index starts with JSON or SQLite rather than a heavy vector database.
