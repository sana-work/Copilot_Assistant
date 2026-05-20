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

## Phase 6 - Indexing And Search

Implement local scanning, ignore rules, JSON or SQLite index storage, text search, and similar feature search.

## Phase 7 - Planning

Generate feature plans, impact summaries, validation strategy, Markdown output, and JSON plan artifacts.

## Phase 8 - Validation And Safety

Implement custom command config, safety policy checks, safe execution, timeouts, retries, validation logs, failure classification, and fix prompts.

## Phase 9 - Agents And Instructions

Generate custom Copilot agents, Copilot instructions, AGENTS.md suggestions, skill templates, backup-before-overwrite behavior, and doctor/update commands.

## Phase 10 - Review Reports

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
