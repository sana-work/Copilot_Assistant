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
- MCP tests exercise tool handlers without requiring external agent hosts.
- Safety tests prove dangerous commands are blocked and secrets are redacted.

## Sample Repositories

The `samples/` folder should contain small representative repositories for JavaScript, TypeScript, React, Angular, Python, Maven, Gradle, and mixed monorepo cases.

## Validation Evidence

Validation runs produce local logs and summaries under `.copilot-architect/runs/`. Tests should assert that logs are redacted and stored inside the workspace boundary.
