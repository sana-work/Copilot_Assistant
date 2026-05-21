# Security Model

## Default Posture

Analysis is read-only by default. Copilot Architect should not modify a target repository unless a command explicitly requires it and the user has approved the action.

Telemetry is disabled by default. The MVP is local-first: repo analysis, indexes, plans, handoffs, validation logs, review reports, policy files, and audit logs stay under the local workspace unless a user intentionally moves or shares them.

## Workspace Boundary

Runtime artifacts must be written under `.copilot-architect/` inside the repo or workspace root unless explicitly configured otherwise. The tool must never write outside the repo/workspace root without explicit permission.

## Dangerous Commands

The safety policy blocks dangerous commands by default, including:

- `rm -rf`
- `del /s`
- `format`
- `diskpart`
- `git clean -fdx`
- `git reset --hard`
- `chmod -R 777`
- `sudo rm`
- `Remove-Item -Recurse`

Validation commands are assessed before execution. Blocked commands produce an actionable safety result rather than running.

## Secrets

Logs must not include secrets. The validator, audit logger, and review reporter redact likely secret values such as API keys, tokens, passwords, private keys, connection strings, and authorization headers.

## Human Approval

Implementation handoff requires human approval. Copilot Architect may generate plans and prompts, but it should not claim that implementation has been approved or completed unless the user explicitly approves or executes that work.

## Audit Logs

Audit entries record command intent, safety decisions, timestamps, redacted output summaries, validation outcomes, and artifact paths. Audit logging supports internal traceability without collecting secrets.

## Retention Cleanup

`.copilot-architect/policy.json` controls artifact retention. Cleanup is dry-run by default, only scans configured artifact directories under `.copilot-architect/`, preserves latest aliases, records a redacted audit entry, and deletes eligible files only when run with `--apply`.

## Trust Metadata

Generated policy, agent, and instruction artifacts include trust metadata that identifies Copilot Architect as the generator, records local-only operation, and states whether telemetry is enabled. This metadata is informational for internal review and does not grant execution permission by itself.

## UI Safety

UI shells do not bypass safety policy. VS Code and web shells call the same validator and policy engine used by the CLI and MCP server.
