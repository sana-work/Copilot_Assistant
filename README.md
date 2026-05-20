# Copilot Architect

Copilot Architect is a TypeScript/Node.js-first internal team tool for making coding agents more repo-aware. It helps teams analyze repositories, detect stacks, build local repo intelligence, plan features, generate handoff prompts, run safe validation, create custom Copilot agents and instructions, and produce review reports.

This is not a commercial product. The MVP is not implemented in C#/.NET and does not include a Visual Studio VSIX.

## Quickstart

```bash
npm install
npm run build
npm test
npm run cli -- --help
npm run cli -- doctor
```

Expected later workflow:

```bash
npm run cli -- init
npm run cli -- analyze
npm run cli -- index
npm run cli -- search "invoice"
npm run cli -- plan "Add invoice approval workflow"
npm run cli -- agents install
npm run cli -- instructions generate
npm run cli -- handoff --plan latest
npm run cli -- validate
npm run cli -- review
npm run cli -- mcp
```

## MVP Direction

Copilot Architect supports all repositories through a universal adapter system. It provides deep support for common stacks and generic fallback support for unknown/custom repos through indexing, search, config detection, and custom commands.

The target stacks are Python, Java, JavaScript, TypeScript, Angular, React, Node.js, mixed frontend/backend repos, monorepos, and multi-repo enterprise systems.

## Architecture

Business logic belongs in the core packages under `packages/`. UI shells such as `packages/vscode-extension` and `packages/web` are optional thin shells that call CLI, core, or MCP services.

Runtime artifacts will live under `.copilot-architect/`.

## Current Phase

Phase 2 adds shared serializable domain models, schema version constants, `.copilot-architect/` artifact path helpers, JSON read/write helpers, and tests. Repo analysis, adapters, indexing, planning, validation, agents, MCP tools, and review logic are implemented in later phases.
