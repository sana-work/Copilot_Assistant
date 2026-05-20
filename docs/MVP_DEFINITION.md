# MVP Definition

## Goal

The MVP proves that a TypeScript/Node.js internal tool can analyze repositories, create repo intelligence artifacts, help plan features, generate agent handoffs, run safe validation, and produce review reports.

## Required MVP Capabilities

- TypeScript CLI.
- Local MCP server.
- Repo analysis.
- Language/framework/package-manager detection.
- Adapter architecture.
- Local index.
- Search.
- Feature planning.
- Custom command config.
- Validation runner.
- Safety policy engine.
- Audit logs.
- Custom Copilot agents.
- Copilot instructions generation.
- Handoff prompt generation.
- Review report generation.
- Multi-repo workspace support.
- Basic VS Code extension shell.
- Optional local web UI.
- Testing and validation reports.

## MVP Boundaries

The MVP is not a .NET product and does not include a Visual Studio VSIX. The core implementation is TypeScript/Node.js. Optional UI shells must not contain business logic.

## Success Criteria

- Developers can run the tool locally with npm.
- The tool understands common stacks and falls back gracefully on unknown repos.
- Plans are actionable and require human approval before implementation handoff.
- Validation is safe by default.
- Custom agents and instructions are generated from repo intelligence.
- Review reports connect diffs, plans, tests, and risk.

## Deferrals

Enterprise governance, cloud storage, semantic vector search, commercial packaging, and Visual Studio-specific wrappers are future optional features.
