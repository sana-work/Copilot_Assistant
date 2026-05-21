# Copilot Architect

Copilot Architect is a TypeScript/Node.js-first internal team tool for making coding agents more repo-aware. It helps teams analyze repositories, detect stacks, build local repo intelligence, plan features, generate handoff prompts, run safe validation, create custom Copilot agents and instructions, and produce review reports.

## Quickstart

```bash
scripts/setup.sh
```

Manual equivalent:

```bash
npm install
npm run build
npm test
npm run cli -- version
npm run cli -- --help
npm run cli -- doctor
npm run package:local
```

Expected later workflow:

```bash
npm run cli -- init
npm run cli -- commands validate
npm run cli -- commands list
npm run cli -- analyze
npm run cli -- index
npm run cli -- diagnostics
npm run cli -- search "invoice"
npm run cli -- plan "Add invoice approval workflow"
npm run cli -- agents install
npm run cli -- instructions generate
npm run cli -- handoff --plan latest --approve
npm run cli -- validate
npm run cli -- review
npm run cli -- status
npm run cli -- cleanup --dry-run
npm run cli -- mcp config
npm run cli -- mcp
```

## GitHub Copilot Chat

Copilot Architect supports GitHub Copilot Chat by generating supported repository customizations and a local MCP server configuration. It does not modify Copilot internals.

This uses GitHub/VS Code supported customization files: repository instructions in `.github/copilot-instructions.md`, workspace agents in `.github/agents/`, workspace prompts in `.github/prompts/`, and workspace MCP configuration in `.vscode/mcp.json`.

Generate the repo-local Chat artifacts:

```bash
npm run cli -- agents install
npm run cli -- instructions generate
npm run cli -- mcp config
npm run cli -- agents doctor
```

This creates:

- `.github/agents/*.agent.md` custom agents for `@FeatureArchitect`, `@FeatureImplementer`, `@CodeReviewer`, `@Debugger`, and supporting reviewers.
- `.github/copilot-instructions.md` repository custom instructions.
- `.github/prompts/*.prompt.md` reusable Chat prompts for planning, implementation, review, and debugging.
- `.vscode/mcp.json` with a local `copilotArchitect` stdio MCP server entry.

### Connect Copilot Chat To Copilot Architect MCP

1. Open the target repository in VS Code.
2. Run `npm run cli -- mcp config` from the Copilot Architect checkout or package.
3. Open Command Palette and run `MCP: List Servers`.
4. Start the `copilotArchitect` server.
5. Open GitHub Copilot Chat, switch to Agent mode, and enable the Copilot Architect tools when prompted.

You can also start the server directly for MCP hosts that launch commands themselves:

```bash
npm run cli -- mcp --path /path/to/target-repo
```

Related official docs: [repository custom instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions), [VS Code custom agents](https://github.com/microsoft/vscode-docs/blob/main/docs/copilot/customization/custom-agents.md), [VS Code prompt files](https://code.visualstudio.com/docs/copilot/customization/prompt-files), and [MCP configuration](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration).

### Example Copilot Chat Prompts

Planning:

```text
@FeatureArchitect Add [feature] based on this repo.
Use Copilot Architect repo map, index, MCP tools, and latest generated plan.
Do not modify code yet. First create a detailed implementation plan.
```

After approval:

```text
@FeatureImplementer Implement the approved plan from .copilot-architect/plans/latest-plan.md.
Run validation commands and summarize changed files.
```

After implementation:

```text
@CodeReviewer Review the git diff against the approved plan and latest validation report.
```

If validation failed:

```text
@Debugger Validation failed. Use .copilot-architect/runs/latest-validation.json and related logs to classify the failure and propose the smallest safe fix.
```

## MVP Direction

Copilot Architect supports all repositories through a universal adapter system. It provides deep support for common stacks and generic fallback support for unknown/custom repos through indexing, search, config detection, and custom commands.

The target stacks are Python, Java, JavaScript, TypeScript, Angular, React, Node.js, mixed frontend/backend repos, monorepos, and multi-repo enterprise systems.

## Architecture

Business logic belongs in the core packages under `packages/`. UI shells such as `packages/vscode-extension` and `packages/web` are optional thin shells that call CLI, core, or MCP services.

Runtime artifacts will live under `.copilot-architect/`.

## Current Phase

Phase 26 proves the end-to-end MVP flows across representative sample repos and records the readiness decision in `docs/PHASE_26_VALIDATION_REPORT.md`.

```bash
npm run format
npm run lint
npm run build
npm test
```

The locked MVP scope is documented in `docs/MVP_DEFINITION.md`. Development rules live in `docs/DEVELOPMENT_EXECUTION_INSTRUCTIONS.md`, pull requests use `.github/pull_request_template.md`, release checks run through `.github/workflows/release-check.yml`, and Phase 26 validation evidence lives in `docs/PHASE_26_VALIDATION_REPORT.md`.
