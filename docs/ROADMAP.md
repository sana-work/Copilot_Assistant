# Roadmap

## Phase 0 - Product Docs And Boundaries

Document the product vision, TypeScript/Node.js direction, MVP boundaries, security model, MCP role, agent workflows, testing strategy, and release plan.

## Phase 1 - TypeScript Monorepo Skeleton

Create the npm workspace, package folders, placeholder CLI commands, TypeScript config, Vitest config, lint/format config, quickstart README, and initial tests.

## Phase 2 - Shared Domain Models

Add serializable shared models for repository context, workspace context, repo maps, plans, validation results, review reports, safety policies, audit logs, handoff prompts, agents, instructions, MCP results, and diagnostics.

Status: implemented as the shared Phase 2 model surface with JSON and artifact helpers.

## Phase 3 - Adapter Architecture

Implement adapter interfaces, registry, scoring, merging, capabilities, and generic fallback behavior.

Status: implemented with registry selection, confidence sorting, result merging, command de-duplication, and generic text fallback.

## Phase 4 - Language And Toolchain Adapters

Add first-class JavaScript/TypeScript, Angular, React, Node.js, Python, Maven, and Gradle adapters. Add generic fallback adapters for other languages.

Status: implemented for JavaScript/TypeScript, React, Angular, Python, Java Maven, and Java Gradle, with enhanced generic text fallback.

## Phase 5 - Repo Discovery And Analysis

Build repo discovery, multi-repo workspace discovery, artifact generation, and architecture summaries.

Status: implemented as `RepoDiscoveryService` with CLI `analyze`, `--json`, and `--output` support for single-repo analysis and monorepo/project-root inference.

## Phase 6 - Indexing And Search

Implement local scanning, ignore rules, JSON or SQLite index storage, text search, and similar feature search.

Status: implemented as JSON index storage with full indexing, incremental indexing, rebuild, status, ranked search, and similar feature search.

## Phase 7 - Planning

Generate feature plans, impact summaries, validation strategy, Markdown output, and JSON plan artifacts.

Status: implemented as `FeaturePlanningService` with CLI `plan` and `--json` support, repo-map and index integration, optional workspace/custom-command/instruction context, similar-feature candidates, stack-specific planning, validation command suggestions, Markdown/JSON artifacts, and human approval checkpoints.

## Phase 8 - Custom Command Configuration

Implement `.copilot-architect/commands.json`, command config parsing, schema validation, detected/custom command merging, override behavior, helpful errors, and CLI support for `init`, `commands validate`, and `commands list`.

Status: implemented as `CommandConfigService` with categorized command parsing, template initialization, helpful validation errors, override-aware merge behavior, CLI commands, and planner integration.

## Phase 9 - Universal Validation Engine

Run safe commands only, support timeouts and retries, stream output, save logs and reports, redact secrets, summarize failures, and generate fix prompts.

Status: implemented as `ValidationService` with detected/custom command planning, category filters, dangerous-command blocking, safe command execution, timeout/retry support, redacted logs, JSON/Markdown reports, latest artifacts, failure summaries, fix prompts, and CLI `validate` flags.

## Phase 10 - Safety Policy And Audit

Implement the safety policy engine, command risk assessment, audit logging, secret redaction, workspace boundary checks, and approval gates.

Status: implemented as safety policy, command risk assessment, audit logging, secret redaction, path boundary, git checkpoint, and rollback guide services with CLI `policy show`, `policy validate`, and `audit list` support.

## Phase 11 - Local MCP Server

Implement the local MCP server and expose repo intelligence, search, planning, validation, and safety tools.

Status: implemented with `packages/mcp-server`, the TypeScript MCP SDK, stdio startup through `npm run cli -- mcp`, structured JSON responses, read-only repo/search/impact/policy/latest-artifact tools, and approval-gated `generate_feature_plan`.

## Phase 12 - CLI Completion

Complete the CLI command surface, help text, JSON output, exit codes, and command coverage across init, analyze, index, search, plan, validate, review, handoff, agents, instructions, workspace, commands, policy, audit, mcp, serve, status, and doctor.

## Phase 13 - Custom Copilot Agents

Generate custom Copilot agents, Copilot instructions, AGENTS.md suggestions, skill templates, backup-before-overwrite behavior, and doctor/update commands.

## Phase 14 - Review Reports

Generate review reports from git diff, validation evidence, plan-vs-diff comparison, risk analysis, missing-test detection, and reviewer prompts.

## Later Optional Features

- VS Code extension shell.
- Local React web UI.
- Enterprise policy packs.
- Cloud sync.
- Commercial packaging.
- Visual Studio VSIX.
- .NET wrapper.
- Heavier semantic indexing.
