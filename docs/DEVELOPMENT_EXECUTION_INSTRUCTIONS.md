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
