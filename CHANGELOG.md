# Changelog

## 0.1.1 — 2026-05-21

### Added

- **`demo` command** — `npm run cli -- demo [--path <repo>] [--json]`. Runs a 4-step end-to-end demonstration (analyze → index → search → diagnostics) and prints actionable next steps. Phase 27 requirement.
- **Expanded secret redaction** in `SecretRedactionService` and `SafetyPolicyService` default patterns:
  - AWS access key IDs (`AKIA…`, `ASIA…`, `AROA…`)
  - AWS secret access keys
  - GCP API keys (`AIza…`)
  - Stripe secret, publishable, and restricted keys
  - PEM private key blocks (`-----BEGIN … PRIVATE KEY-----`)
  - JWT tokens (three-part base64url)
  - Database connection strings (postgres, mysql, mongodb, redis, mssql)
  - npm auth tokens
  - Slack tokens (`xoxb-`, `xoxp-`, etc.)
  - Extended env-var keywords: `AUTH_KEY`, `PRIVATE_KEY`, `CLIENT_SECRET`, `SIGNING_KEY`, `ENCRYPTION_KEY`
- **Extended safe executable set** in `CommandRiskAssessmentService`:
  - New runtimes: `bun`, `deno`, `npx`, `node`
  - TypeScript/lint: `tsc`, `biome`
  - Build tools: `webpack`, `rollup`, `esbuild`, `turbo`, `nx`
  - Test runners: `mocha`, `jasmine`, `playwright`, `cypress`
  - Python ecosystem: `python3`, `py`, `pipenv`, `uv`, `ruff`, `mypy`, `flake8`, `black`
  - Systems languages: `cargo`, `go`, `rustfmt`, `clippy`
  - `.NET` (read-only operations): `dotnet`
  - `python setup.py test|build` allowed
  - `python -m mypy|flake8|black|ruff|pylint|isort` allowed
- **Real Node.js version check in `doctor`** — now reports `status: "error"` with an upgrade link when the runtime is below Node.js 20.11, instead of always returning `"ok"`.
- **`demo` quick-start hint** in main help text (`Quick start: npm run cli -- demo`).
- **6 new tests** covering: demo end-to-end, node version check (pass/fail), expanded secret redaction patterns, and extended safe executables.

### Fixed

- Agent model `gpt-5.2` (fictional) → `gpt-4o` across all 7 agent definitions (`FeatureArchitect`, `FeatureImplementer`, `CodeReviewer`, `TestPlanner`, `Debugger`, `SecurityReviewer`, `PerformanceReviewer`).
- Duplicate assertion removed from `tests/cli.test.ts`.

### Tests

- All **147 tests pass** (141 pre-existing + 6 new).

---

## 0.1.0 — Initial internal MVP

TypeScript/Node.js-first monorepo covering all MVP phases:

- CLI with 22 commands across analyze, index, search, plan, validate, review, handoff, agents, instructions, workspace, MCP, policy, audit, cleanup, diagnostics, status, doctor, version, serve, and more.
- Adapter-based repo discovery for JavaScript/TypeScript, React, Angular, Python, Java Maven, Java Gradle, and generic fallback.
- Local JSON index with full, incremental, and rebuild modes.
- Feature planning engine with impact analysis, risk scoring, and plan quality scoring.
- Universal validation engine with safety policy, command risk assessment, secret redaction, audit logging, git checkpoints, and rollback guides.
- Review report generation from git diff, approved plan, and validation evidence.
- 7 custom Copilot agent templates (`gpt-4o` model).
- Copilot instructions and skill template generation.
- Local MCP server with 20 tools.
- Multi-repo workspace support.
- VS Code extension shell.
- Optional local web UI.
- Advanced intelligence: architecture detection, route/API detection, test relationship mapping, risk scoring, repo readiness diagnostics.
- Internal packaging: `npm run package:local`, setup scripts, docs, npm link support.
- CI workflow and governance artifacts.
- 8 sample repos covering React, Angular, Python, Java Maven, Java Gradle, Node API, polyglot, and generic repos.
