# Development Execution Instructions

## Working Model

Work phase by phase. For every phase:

1. Implement code.
2. Add tests.
3. Run tests.
4. Update docs.
5. Summarize changed files.
6. List limitations.
7. Stop before moving to the next phase.

## Project Direction

This project is TypeScript/Node.js-first. Do not implement the MVP in C#/.NET. Do not create a Visual Studio VSIX for the MVP. Do not assume target repositories are C#/.NET.

## Architecture Rules

- Keep business logic in core packages.
- Keep `packages/vscode-extension` and `packages/web` as thin shells.
- Keep shared serializable models, schema constants, artifact paths, and JSON helpers in `packages/shared`.
- Keep adapter contracts, registry behavior, and generic fallback support in `packages/adapters`.
- Keep concrete stack detection in `packages/adapters`; repo scanning and orchestration belong to later core/indexer phases.
- Keep repo discovery orchestration and repo-map artifact writing in `packages/core`; the CLI should call it rather than duplicating scan logic.
- Keep local indexing, search ranking, incremental index behavior, and similar-feature search in `packages/indexer`.
- Keep feature planning, impact summaries, validation strategy generation, and Markdown/JSON plan rendering in `packages/planner`.
- Keep custom command config parsing, validation, templates, and merge behavior in `packages/validator`.
- The CLI `plan` command must call planner services and must not edit application code; it may only write `.copilot-architect/` artifacts.
- The CLI `init` and `commands` commands must call validator services and must not execute configured commands in Phase 8.
- Prefer simple working implementations over complex incomplete architecture.
- Use npm unless the repository already uses pnpm.
- Use Vitest for tests.
- Store runtime artifacts under `.copilot-architect/`.

## Safety Rules

- Analysis is read-only by default.
- Block dangerous commands by default.
- Redact secrets from logs.
- Never write outside the repo/workspace root unless explicitly allowed.
- Require human approval for implementation handoff.

## Documentation Rules

When adding capabilities, update the relevant docs in `docs/` and keep README quickstart commands current.
