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

## Sample Repositories

The `samples/` folder should contain small representative repositories for JavaScript, TypeScript, React, Angular, Python, Maven, Gradle, and mixed monorepo cases.

## Validation Evidence

Validation runs produce local logs and summaries under `.copilot-architect/runs/`. Tests should assert that logs are redacted and stored inside the workspace boundary.
