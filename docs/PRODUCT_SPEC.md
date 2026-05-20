# Product Specification

## Vision

Copilot Architect is an internal developer tool that helps teams use GitHub Copilot, Codex, Claude Code, and other AI coding agents more effectively. It turns a high-level engineering request into repo-aware analysis, implementation planning, validation guidance, handoff prompts, and review evidence.

The tool is built for internal team sharing, not commercial distribution. The expected setup is a normal developer workflow:

```bash
npm install
npm run build
npm test
npm run cli -- analyze
npm run cli -- plan "Add invoice approval workflow"
```

## Product Positioning

Copilot Architect is CLI-first and MCP-first. The CLI gives every developer a simple local entry point. The MCP server exposes the same repo intelligence to agent hosts. Optional UI shells, including VS Code and a local web UI, are thin wrappers around CLI, core, or MCP services.

## Technology Direction

The MVP is TypeScript/Node.js-first because the target repositories are mostly Python, Java, JavaScript, TypeScript, Angular, React, Node.js, mixed frontend/backend systems, monorepos, and multi-repo workspaces. Node.js also makes local CLI distribution simple for teams that already work with npm-based tools.

.NET, a Visual Studio VSIX, WPF, Blazor, and enterprise installers are not part of the MVP. They remain possible future wrappers, but the core product logic must not depend on them.

## Core Capabilities

- Repo and workspace analysis.
- Language, framework, package manager, build, test, lint, and format detection.
- Universal adapter system with deep support for common stacks and generic fallback support.
- Local repo map and searchable index.
- Similar feature and pattern discovery.
- Feature planning with impact analysis and validation strategy.
- Human-approved implementation handoff prompts.
- Safe validation command execution.
- Review reports based on git diff and validation evidence.
- Custom Copilot agents and instructions generation.
- Local MCP tools for repo intelligence.
- Multi-repo workspace support.
- Basic VS Code extension shell and optional local web UI later.

## Non-Goals For MVP

- Commercial marketplace packaging.
- Cloud backend.
- Enterprise installer.
- Heavy vector database.
- Visual Studio VSIX.
- .NET core engine.
- Blazor or WPF UI.
- Governance dashboards beyond local reports and audit logs.

## Product Wording

Use this wording for language support:

> Copilot Architect supports all repositories through a universal adapter system. It provides deep support for common stacks and generic fallback support for unknown/custom repos through indexing, search, config detection, and custom commands.
