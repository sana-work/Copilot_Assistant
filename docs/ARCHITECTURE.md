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

The MCP server exposes repo intelligence tools to local agent hosts. It uses the TypeScript MCP SDK, connects over stdio through `npm run cli -- mcp`, and calls the same package APIs as the CLI. MCP is first-class because agent hosts need structured access to repo maps, plans, validation evidence, policy checks, custom instructions, and review reports.

## Adapter System

Adapters detect repository characteristics and provide commands, folders, entry points, and architectural hints. Deep adapters are prioritized for JavaScript, TypeScript, Angular, React, Node.js, Python, Java Maven, and Java Gradle. Generic adapters provide fallback support for unknown or custom repositories.

Phase 3 defines the adapter contract in `packages/adapters`:

- `IAdapter` is the base interface for every adapter.
- Specialized interfaces cover languages, frameworks, package managers, build commands, test commands, lint commands, format commands, and repo heuristics.
- `AdapterRegistry` registers adapters, runs all matching adapters, sorts detection results by confidence, merges results, and de-duplicates commands.
- `GenericTextAdapter` is the fallback adapter when no specialized adapter matches.

Adapter outputs stay serializable and use shared models from `packages/shared`.

Phase 4 adds first-class adapters for:

- JavaScript and TypeScript package/config/script detection.
- React framework and file-pattern detection.
- Angular workspace, project, command, and file-pattern detection.
- Python config, framework, package tooling, and test command detection.
- Java Maven/Gradle framework, package tooling, and build/test command detection.

The generic text adapter remains the fallback for unknown or custom repositories.

## Repo Discovery

`packages/core` owns repo discovery orchestration. `RepoDiscoveryService` finds the effective repo root, detects Git presence, scans repository files with common dependency/build folders ignored, builds adapter context, runs the default adapter registry, infers documentation files and project roots, creates a `UniversalRepoMap`, and writes `.copilot-architect/repo-map.json`.

The CLI `analyze` command calls this service. It does not duplicate discovery logic.

## Local Index

`packages/indexer` owns local indexing and search. The MVP uses a JSON index at `.copilot-architect/index/index.json` with a status artifact at `.copilot-architect/index/status.json`.

Indexed documents include relative path, extension, language guess, content hash, modified time, file size, text preview, extracted symbols, imports/includes, and test/config/doc flags. The indexer skips common dependency, build, cache, and IDE folders.

The CLI `index` and `search` commands call `IndexingService`; they do not implement indexing logic directly.

## Feature Planning

`packages/planner` owns feature plan generation. `FeaturePlanningService` reads or creates `.copilot-architect/repo-map.json`, reads optional workspace/custom command context, detects available instruction files, refreshes the local index, runs similar-feature search, and renders deterministic JSON and Markdown plan artifacts under `.copilot-architect/plans/`.

Plan artifacts include request interpretation, repo architecture summary, planning context, relevant files, similar feature candidates, impacted stacks and modules, likely files to modify, likely new files, frontend/backend/data/config/security/performance impacts, test strategy, validation commands, implementation steps, risks, assumptions, open questions, and a human approval checkpoint.

The CLI `plan` command calls `FeaturePlanningService`; it does not duplicate planning logic. Planning is read-only for application code and only writes Copilot Architect artifacts.

## Custom Command Configuration

`packages/validator` owns custom command configuration for `.copilot-architect/commands.json`. `CommandConfigService` creates the template during `init`, parses categorized `build`, `test`, `lint`, `format`, and `validation` entries, validates schema errors with actionable messages, normalizes command strings into structured validation commands, and merges custom commands ahead of detected commands.

The CLI `init`, `commands validate`, and `commands list` commands call `CommandConfigService`.

## Validation Engine

`packages/validator` also owns Phase 9 validation execution. `ValidationService` builds a validation plan from repo-discovered commands and custom command config, filters by requested category, assesses command risk, runs allowed commands without a shell, supports timeouts and retries, streams redacted output, and writes validation artifacts under `.copilot-architect/runs/`.

Validation artifacts include timestamped and latest JSON/Markdown reports plus timestamped logs. Reports summarize passed/failed/blocked/timed-out commands, include command risk assessments, capture failure summaries, and generate a fix prompt for failed validation.

The CLI `validate`, `validate --build`, `validate --test`, `validate --lint`, and `validate --format` commands call `ValidationService`.

## Safety Policy And Audit

`packages/validator` owns Phase 10 safety services. `SafetyPolicyService` loads or creates `.copilot-architect/policy.json`, `CommandRiskAssessmentService` blocks dangerous commands and warns on git history mutations, `PathBoundaryService` prevents workspace escapes, `SecretRedactionService` redacts likely secrets, `AuditLogService` writes JSONL audit entries under `.copilot-architect/audit/`, `GitCheckpointService` captures current git state, and `RollbackGuideGenerator` creates human-readable rollback guidance.

The CLI `policy show`, `policy validate`, and `audit list` commands call these services. Validation execution uses the same policy, risk, redaction, and audit services.

## Local MCP Server

`packages/mcp-server` owns the Phase 11 MCP integration. `createCopilotArchitectMcpServer` registers tools on an MCP SDK server, while `startMcpServer` attaches stdio transport for local agent hosts. The CLI `mcp` command is a thin shell around this package.

The server exposes `repo_map`, `workspace_map`, language/framework/package-manager/command detection tools, repo and workspace search, similar feature lookup, impact/context generation, approval-gated feature plan generation, validation command lookup, safety policy lookup, latest plan/validation/review artifact readers, and `agent_status`.

Tools return structured JSON in MCP text content and call `packages/core`, `packages/indexer`, `packages/planner`, and `packages/validator` rather than duplicating business logic. Read-only tools do not write plan artifacts; `generate_feature_plan` requires `approved=true` before it writes `.copilot-architect/plans/` artifacts.

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
