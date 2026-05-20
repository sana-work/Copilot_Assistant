## Project

We are building **Copilot Architect**.

Copilot Architect is an internal developer tool that helps teams use GitHub Copilot, Codex, Claude Code, or other AI coding agents more effectively.

The user should be able to type a high-level task like:

> Add invoice approval workflow based on the current repo.

The tool should then:

1. Analyze the current repo or multi-repo workspace.
2. Detect languages, frameworks, package managers, build systems, and test systems.
3. Build a repo map and local searchable index.
4. Find similar existing features and patterns.
5. Generate a detailed implementation plan.
6. Require human approval.
7. Generate custom Copilot/Codex handoff prompts.
8. Run validation commands.
9. Generate review reports from git diff and validation evidence.
10. Expose repo intelligence through a CLI and MCP server.
11. Generate and maintain custom Copilot agents and instructions.

## Important direction

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

## Distribution model

This is not a commercial product.

The expected use case is:

```bash
git clone <repo>
cd copilot-architect
npm install
npm run build
npm test
npm run cli -- analyze
npm run cli -- index
npm run cli -- plan "Add X feature"
npm run cli -- validate
npm run cli -- review
npm run cli -- mcp
````

The goal is internal team sharing with minimal setup.

## Core architecture

Use a TypeScript monorepo-style structure:

```text
copilot-architect/
├── packages/
│   ├── shared/
│   ├── core/
│   ├── adapters/
│   ├── indexer/
│   ├── planner/
│   ├── validator/
│   ├── reviewer/
│   ├── agents/
│   ├── instructions/
│   ├── mcp-server/
│   ├── cli/
│   ├── vscode-extension/
│   └── web/
├── templates/
│   ├── agents/
│   ├── instructions/
│   └── skills/
├── samples/
├── tests/
├── docs/
└── scripts/
```

## Core rule

Business logic must not live inside UI shells.

The real product logic must live in:

* packages/core
* packages/adapters
* packages/indexer
* packages/planner
* packages/validator
* packages/reviewer
* packages/agents
* packages/instructions
* packages/mcp-server
* packages/cli

UI shells should only call CLI/core/MCP services.

## Do not build initially

Do not build these in MVP:

* Visual Studio VSIX
* WPF UI
* .NET core engine
* Blazor UI
* commercial marketplace packaging
* heavy vector database
* cloud backend
* enterprise installer

These can be future optional wrappers.

## Required MVP features

The MVP must include:

1. TypeScript CLI.
2. Local MCP server.
3. Repo analysis.
4. Language/framework/package-manager detection.
5. Adapter architecture.
6. Local index.
7. Search.
8. Feature planning.
9. Custom command config.
10. Validation runner.
11. Safety policy engine.
12. Audit logs.
13. Custom Copilot agents.
14. Copilot instructions generation.
15. Handoff prompt generation.
16. Review report generation.
17. Multi-repo workspace support.
18. Basic VS Code extension shell.
19. Optional local web UI.
20. Testing and validation reports.

## Language support

Prioritize deep support for:

* JavaScript
* TypeScript
* Angular
* React
* Node.js
* Python
* Java Maven
* Java Gradle

Also include generic fallback support for:

* Go
* Rust
* C/C++
* PHP
* Ruby
* Shell
* SQL
* unknown/custom languages

Do not claim perfect language support.

Use this wording:

> Copilot Architect supports all repositories through a universal adapter system. It provides deep support for common stacks and generic fallback support for unknown/custom repos through indexing, search, config detection, and custom commands.

## Adapter responsibilities

Each adapter should detect:

* language
* framework
* package manager
* source folders
* test folders
* config files
* build commands
* test commands
* lint commands
* format commands
* likely entry points
* common architectural patterns

## Safety rules

Analysis is read-only by default.

Block dangerous commands by default:

* rm -rf
* del /s
* format
* diskpart
* git clean -fdx
* git reset --hard
* chmod -R 777
* sudo rm
* Remove-Item -Recurse

Never log secrets.

Redact likely secrets from logs.

Never write outside the repo/workspace root unless explicitly allowed.

Implementation handoff requires human approval.

## Generated artifacts

All runtime artifacts should be under:

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

## Testing

Use Vitest.

Add tests for:

* adapter detection
* repo discovery
* indexing
* search
* feature planning
* command config
* validation safety
* MCP tools
* agent generation
* instructions generation
* handoff generation
* review reports
* CLI commands
* multi-repo workspaces
* end-to-end sample repos

## Development style

Work phase by phase.

For every phase:

1. Implement code.
2. Add tests.
3. Run tests.
4. Update docs.
5. Summarize changed files.
6. List limitations.
7. Stop before moving to the next phase.

Prefer simple working implementation over complex incomplete architecture.