# Testing Strategy

## Framework

Use Vitest for unit, integration, and end-to-end sample tests.

## Required Coverage Areas

- Adapter detection.
- Repo discovery.
- Indexing.
- Search.
- Feature planning.
- Command config.
- Validation safety.
- MCP tools.
- Agent generation.
- Instructions generation.
- Handoff generation.
- Review reports.
- CLI commands.
- Multi-repo workspaces.
- End-to-end sample repos.

## Test Shapes

- Unit tests validate pure model, detector, parser, policy, and rendering behavior.
- Integration tests run package workflows against sample repositories.
- CLI tests verify command behavior and artifact creation.
- MCP tests exercise the SDK server through in-memory transports without requiring external agent hosts.
- Safety tests prove dangerous commands are blocked and secrets are redacted.
- Indexer tests verify artifact creation, ignored folders, incremental reuse, ranked search, and CLI search output.
- Planner tests verify JSON and Markdown plan artifact creation, repo-map and index usage, optional workspace/custom-command/instruction context, similar-feature search, stack-specific planning, validation command suggestions, CLI `plan` output, and read-only behavior for application files.
- Command config tests verify `commands.json` initialization, categorized command parsing, schema validation errors, override-aware merging, CLI `commands validate`, CLI `commands list`, and planner validation-plan integration.
- Validation engine tests verify safe command execution, dangerous command blocking, timeout handling, redacted logs, JSON/Markdown/log artifact creation, failure summaries, fix prompts, and CLI `validate` flags.
- Safety policy tests verify policy initialization/validation, dangerous command risk assessment, audit log creation, secret redaction, workspace boundary checks, git checkpoint capture, rollback guidance, CLI `policy`, and CLI `audit`.
- MCP server tests verify tool listing, `repo_map`, `search_repo`, approval-gated `generate_feature_plan`, `get_validation_commands`, graceful missing latest artifacts, and read-only impact analysis behavior.
- CLI completion tests verify help for every top-level command, JSON status output, workspace command flows, agents and instructions command families, approval-gated handoff generation, and review artifact creation.
- Agent tests verify the seven required agent templates, `.github/agents/` installation, custom output paths, dry-run behavior, backup-before-overwrite behavior, frontmatter and section validation, CLI JSON output, `agents update`, and doctor guidance for `@FeatureArchitect`, `@FeatureImplementer`, and `@CodeReviewer`.
- Instruction tests verify repo-aware preview content, `.github/copilot-instructions.md` generation, generated timestamp and repo-map metadata, backup-before-overwrite behavior, preservation of user-authored notes, generated skill files, validation failures, CLI JSON output, and CLI validation.
- Handoff tests verify approval gating, required `@FeatureImplementer` prompt format, latest/path plan loading, validation command inclusion, safety rule inclusion, artifact creation, git checkpoint capture where git is available, clipboard skip behavior, and CLI JSON evidence.
- Reviewer tests verify review artifact creation, git diff reading, expected-vs-actual plan comparison, unexpected file findings, missing-test findings, validation failure inclusion, config/dependency/security/breaking-change signals, generated `@CodeReviewer` prompts, and CLI `review --plan latest --validation latest --json` output.
- VS Code extension tests verify manifest activity-bar/webview contributions, required command declarations, fake extension-host activation, command registration, CLI/MCP argument forwarding, dashboard section rendering, and no extension-side business logic execution.
- Web UI tests verify local server startup, local-only HTTP rendering, repo-map and plan artifact display, CLI/MCP delegation for workflow actions, MCP start/stop state, and CLI `serve` help text.
- Workspace tests verify named repo config parsing, add/list/remove behavior, workspace-level repo-map generation, multi-repo indexing, cross-repo search, multi-repo plan impact, per-repo validation plans, and CLI `workspace` JSON output.
- MCP workspace tests verify `workspace_map`, `search_across_repos`, and `analyze_cross_repo_impact` against a multi-repo fixture.

## Sample Repositories

The `samples/` folder should contain small representative repositories for JavaScript, TypeScript, React, Angular, Python, Maven, Gradle, and mixed monorepo cases.

## Validation Evidence

Validation runs produce local logs and summaries under `.copilot-architect/runs/`. Tests should assert that logs are redacted and stored inside the workspace boundary.
