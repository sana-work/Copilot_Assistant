## Project

We are building **Copilot Architect**.

Copilot Architect is an internal developer tool that helps teams use GitHub Copilot, Codex, Claude Code, or other AI coding agents more effectively.

The user should be able to type a high-level task like:

> Add invoice approval workflow based on the current repo.

The tool then:

1. Analyzes the current repo or multi-repo workspace.
2. Detects languages, frameworks, package managers, build systems, and test systems.
3. Builds a repo map and local searchable index.
4. Finds similar existing features and patterns.
5. Generates a detailed implementation plan.
6. Requires human approval.
7. Generates custom Copilot/Codex handoff prompts.
8. Runs safe validation commands.
9. Generates review reports from git diff and validation evidence.
10. Exposes repo intelligence through a CLI and local MCP server.
11. Generates and maintains custom Copilot agents and workspace instructions.

## Quick Start (Current State)

```bash
git clone <repo>
cd copilot-architect
scripts/setup.sh              # install, build, test, verify
npm run cli -- demo           # end-to-end demo: analyze → index → search → diagnostics
```

Full workflow:

```bash
npm run cli -- init
npm run cli -- analyze
npm run cli -- index
npm run cli -- plan "Add X feature"
npm run cli -- agents install
npm run cli -- instructions generate
npm run cli -- mcp config
npm run cli -- handoff --plan latest --approve
npm run cli -- validate
npm run cli -- review
npm run cli -- mcp
```

## Important Direction

This project must be **TypeScript/Node.js-first**.

Do not implement the MVP in C#/.NET.

Do not assume target repos are C#/.NET.

Most target repositories are:

- Python
- Java
- JavaScript
- TypeScript
- Angular
- React
- Node.js
- mixed frontend/backend repos
- monorepos

## Distribution Model

This is not a commercial product.

The goal is internal team sharing with minimal setup via `git clone`, `npm install`, `npm run build`, and `npm run cli -- doctor`.

Internal sharing options:

1. Git clone + `scripts/setup.sh`
2. `npm link --workspace @copilot-architect/cli` for a global command
3. `npm run package:local` to build a tarball for teammates

## Core Architecture

Use a TypeScript monorepo-style structure:

```text
copilot-architect/
├── packages/
│   ├── shared/          domain models, constants, artifact helpers
│   ├── core/            repo discovery, workspace service, advanced analysis
│   ├── adapters/        language/framework/toolchain adapters
│   ├── indexer/         file indexing and keyword search
│   ├── planner/         feature planning, handoff, workspace planning
│   ├── validator/       validation engine, safety policy, audit, risk assessment
│   ├── reviewer/        review report generation
│   ├── agents/          Copilot agent template generation
│   ├── instructions/    Copilot instructions and skill generation
│   ├── mcp-server/      MCP server and 20 tools
│   ├── cli/             CLI entry point and command routing
│   ├── vscode-extension VS Code extension shell (thin)
│   └── web/             optional local web UI shell (thin)
├── templates/
│   ├── agents/
│   ├── instructions/
│   └── skills/
├── samples/             representative repos (React, Angular, Python, Java, Go, polyglot)
├── tests/               integration and e2e tests (147 tests)
├── docs/                product documentation
└── scripts/             setup and packaging scripts
```

## Core Rule

Business logic must not live inside UI shells.

All real product logic must live in:

- packages/core
- packages/adapters
- packages/indexer
- packages/planner
- packages/validator
- packages/reviewer
- packages/agents
- packages/instructions
- packages/mcp-server
- packages/cli

UI shells (`vscode-extension`, `web`) must only call CLI/core/MCP services.

## Do Not Build in MVP

- Visual Studio VSIX
- WPF / Blazor UI
- .NET core engine
- Commercial marketplace packaging
- Heavy vector database or cloud backend
- Enterprise installer

These can be future optional wrappers.

## Required MVP Features (All Implemented)

1. TypeScript CLI with 23 commands including `demo`.
2. Local MCP server with 20 tools.
3. Repo analysis and discovery.
4. Language/framework/package-manager detection (adapter-based).
5. Adapter architecture with registry, confidence scoring, and generic fallback.
6. Local JSON index with full, incremental, and rebuild modes.
7. Keyword search with scoring.
8. Feature planning engine with impact analysis and risk scoring.
9. Custom command config (`.copilot-architect/commands.json`).
10. Safe validation runner with timeouts, retries, and streaming.
11. Safety policy engine with blocked patterns and approval gates.
12. Audit logs (append-only `.copilot-architect/audit/audit.jsonl`).
13. Secret redaction (AWS, GCP, Stripe, JWT, PEM, DB connection strings, etc.).
14. Custom Copilot agents (`gpt-4o` model) installed under `.github/agents/`.
15. Copilot instructions generation with skill templates.
16. Handoff prompt generation (requires `--approve`).
17. Review report generation from git diff and validation evidence.
18. Multi-repo workspace support.
19. Basic VS Code extension shell.
20. Optional local web UI shell.
21. Advanced intelligence: architecture detection, route/API detection, test relationships, risk scoring.
22. Internal setup docs, packaging scripts, npm link support.

## Language and Toolchain Support

### Deep adapter support

- JavaScript / TypeScript (npm, pnpm, yarn, bun, deno)
- Angular
- React
- Node.js
- Python (pytest, poetry, uv, ruff, mypy, flake8, black)
- Java Maven
- Java Gradle

### Extended validation allowlist

`bun`, `deno`, `npx`, `tsc`, `biome`, `cargo`, `go`, `rustfmt`, `clippy`, `dotnet`, `mocha`, `jasmine`, `playwright`, `cypress`, `webpack`, `esbuild`, `turbo`, `nx`, `python3`, `py`, `pipenv`, `uv`, and more.

### Generic fallback

All repos get file scanning, docs detection, config detection, import scanning, test pattern detection, and custom commands through `GenericTextAdapter`.

## Adapter Responsibilities

Each adapter must detect:

- language and version hints
- framework
- package manager
- source folders
- test folders
- config files
- build, test, lint, format commands
- likely entry points
- common architectural patterns

## Safety Rules

Analysis is **read-only by default**.

Block dangerous commands by default (see `DEFAULT_BLOCKED_PATTERNS` in `packages/validator/src/safety-policy-service.ts`):

- `rm -rf`, `del /s`, `format`, `diskpart`
- `git clean -fdx`, `git reset --hard`
- `chmod -R 777`, `sudo rm`, `Remove-Item -Recurse`

Redact secrets from all logs and reports (see `SecretRedactionService`):

- Env-var assignments with `TOKEN`, `SECRET`, `PASSWORD`, `API_KEY`, `ACCESS_KEY`, `PRIVATE_KEY`, etc.
- AWS, GCP, Stripe, JWT, PEM, database connection strings, npm tokens, Slack tokens, Bearer headers, GitHub tokens.

Never write outside the repo/workspace root without explicit permission.

Implementation handoff always requires `--approve`.

## Generated Artifacts

All runtime artifacts live under:

```text
.copilot-architect/
├── repo-map.json
├── workspace.json
├── commands.json
├── policy.json
├── index/
├── plans/
├── handoffs/
├── runs/
├── reviews/
├── audit/
└── diagnostics/
```

GitHub Copilot integration artifacts:

```text
.github/
├── agents/          *.agent.md (7 templates, gpt-4o)
├── copilot-instructions.md
├── prompts/         *.prompt.md
└── skills/          SKILL.md files
.vscode/
└── mcp.json
```

## Testing

Use Vitest. All 147 tests must pass before merging.

Cover:

- adapter detection (all supported stacks)
- repo discovery (single and multi-repo)
- indexing (full, incremental, rebuild)
- search (scoring and filtering)
- feature planning (JSON + Markdown output)
- custom command config (parse, validate, merge)
- validation safety (blocked commands, safe execution)
- MCP tools (all 20 tools)
- agent generation (7 templates, validation)
- instructions generation and validation
- handoff generation (approval gating, git checkpoint)
- review reports (diff, risk detection, missing tests)
- CLI commands (help, JSON output, exit codes)
- multi-repo workspaces
- end-to-end sample repos
- demo command
- secret redaction patterns
- node version check in doctor

```bash
npm test                      # run all tests
npm run cli -- demo           # end-to-end smoke test
npm run cli -- doctor         # environment check
```

## Development Style

Work phase by phase.

For every phase:

1. Implement code.
2. Add tests.
3. Run tests (`npm test`).
4. Update docs.
5. Run `npm run build` and confirm zero TypeScript errors.
6. Summarize changed files.
7. List limitations.
8. Stop before moving to the next phase.
