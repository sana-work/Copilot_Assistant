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

## Governance Rules

These rules are mandatory for MVP development:

1. Do not jump phases.
2. Do not add UI before CLI/core works.
3. Do not hardcode one language.
4. Do not put business logic in UI shells.
5. Do not skip safety.
6. Do not run destructive commands.
7. Do not overwrite user files without backup.
8. Do not mark tests passing without running them.
9. Do not claim support without sample coverage.

Pull requests must explain how they follow these rules. Release checks must run the MVP gates before an internal release artifact is shared.

## Project Direction

This project is TypeScript/Node.js-first. Do not implement the MVP in C#/.NET. Do not create a Visual Studio VSIX for the MVP. Do not assume target repositories are C#/.NET.

## Architecture Rules

- Keep business logic in core packages.
- Treat `docs/MVP_DEFINITION.md` as the Phase 24 scope lock. Do not add new major product scope until the MVP gates in that document stay green.
- Keep `packages/vscode-extension` and `packages/web` as thin shells.
- Keep shared serializable models, schema constants, artifact paths, and JSON helpers in `packages/shared`.
- Keep adapter contracts, registry behavior, and generic fallback support in `packages/adapters`.
- Keep concrete stack detection in `packages/adapters`; repo scanning and orchestration belong to later core/indexer phases.
- Keep repo discovery orchestration and repo-map artifact writing in `packages/core`; the CLI should call it rather than duplicating scan logic.
- Keep advanced architecture, dependency, route/API, test relationship, risk score, and readiness diagnostics behavior in `packages/core`.
- Keep local indexing, search ranking, incremental index behavior, and similar-feature search in `packages/indexer`.
- Keep feature planning, advanced-analysis enrichment, impact summaries, validation strategy generation, plan quality scoring, and Markdown/JSON plan rendering in `packages/planner`.
- Keep custom command config parsing, validation, templates, and merge behavior in `packages/validator`.
- Keep validation plan building, safe command execution, timeout/retry behavior, log redaction, report rendering, and fix prompt generation in `packages/validator`.
- Keep safety policy, command risk assessment, audit logging, redaction, path boundary, git checkpoint, rollback guide, and artifact cleanup services in `packages/validator`.
- Keep MCP server registration, transport startup, and tool orchestration in `packages/mcp-server`; MCP tools must call package services instead of duplicating repo analysis, indexing, planning, validation, or safety logic.
- Keep workspace command behavior in `packages/core`, handoff behavior in `packages/planner`, review behavior in `packages/reviewer`, agent behavior in `packages/agents`, and instruction behavior in `packages/instructions`.
- Keep custom Copilot agent templates, admin-configured template installation, frontmatter validation, trust metadata, install/update/backup behavior, and doctor guidance in `packages/agents`.
- Keep custom Copilot instructions and skills generation, preview, validation, trust metadata, backup, and user-section preservation behavior in `packages/instructions`.
- Keep implementation handoff prompt rendering, approval enforcement, git checkpoint capture, safety-policy inclusion, validation-command inclusion, and clipboard attempts in `packages/planner`.
- The CLI `plan` command must call planner services and must not edit application code; it may only write `.copilot-architect/` artifacts.
- The CLI `init`, `commands`, `validate`, `policy`, `audit`, and `cleanup` commands must call validator services and must not duplicate validator logic.
- The CLI `mcp` command must call `packages/mcp-server` and remain a thin stdio startup shell.
- CLI commands, including `diagnostics`, must provide help, consistent errors, human-readable output by default, JSON output where practical, and non-zero exit codes for failed validation/configuration.
- Prefer simple working implementations over complex incomplete architecture.
- Use npm unless the repository already uses pnpm.
- Use Vitest for tests.
- Store runtime artifacts under `.copilot-architect/`.
- Keep sample repos under `samples/` small, dependency-light, and representative of real manifests/source/tests.
- Mutating sample matrix tests should copy samples into temporary workspaces instead of writing generated files into tracked fixtures.

## Safety Rules

- Analysis is read-only by default.
- MCP tools are read-only by default; tools that write plan or handoff artifacts require explicit approval flags.
- Block dangerous commands by default.
- Redact secrets from logs.
- Never write outside the repo/workspace root unless explicitly allowed.
- Require human approval for implementation handoff.
- Handoff generation must write only `.copilot-architect/handoffs/` artifacts and must never edit target repo code.

## Documentation Rules

When adding capabilities, update the relevant docs in `docs/` and keep README quickstart commands current.

## Pull Request Rules

- Fill out `.github/pull_request_template.md`.
- List commands actually run.
- Call out any skipped checks and why.
- Include sample coverage or test evidence before claiming language, framework, workflow, or Copilot Chat support.
- Confirm user-authored files were not overwritten without a backup.
