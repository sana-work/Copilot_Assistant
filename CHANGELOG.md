# Changelog

## 0.1.0

Initial internal MVP track for Copilot Architect.

### Added

- TypeScript/Node.js-first monorepo with npm workspaces.
- CLI, MCP server, repo discovery, adapters, indexing, search, planning, validation, safety policy, audit logs, handoff prompts, review reports, agents, instructions, VS Code shell, local web shell, multi-repo workspace support, internal controls, advanced local intelligence, and sample repo matrix.
- Internal packaging support with `npm run cli -- version`, `npm run cli -- doctor`, `npm run package:local`, local setup docs, npm link guidance, upgrade guidance, troubleshooting docs, and release artifacts under `dist/release/`.

### Notes

- This is for internal team sharing, not marketplace publishing.
- Copilot Architect supports all repositories through a universal adapter system. It provides deep support for common stacks and generic fallback support for unknown/custom repos through indexing, search, config detection, and custom commands.
