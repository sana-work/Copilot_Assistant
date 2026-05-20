# MCP Tools

## Role

MCP is a first-class integration path. The local MCP server exposes Copilot Architect repo intelligence to agent hosts without forcing those hosts to parse CLI text.

## Technology

The MCP server is implemented in TypeScript and should use the MCP TypeScript SDK when the server package moves beyond the Phase 1 placeholder.

## Planned Tool Families

- Repo analysis tools: read workspace context, repo maps, project maps, architecture summaries, and diagnostics.
- Search tools: query local index, find related files, and find similar feature patterns.
- Planning tools: create feature plans, render Markdown plans, and produce validation strategies.
- Validation tools: inspect command config, assess safety, run allowed validation commands, and summarize evidence.
- Safety tools: evaluate command risk, inspect policy, and explain blocked commands.
- Agent tools: list, generate, validate, install, update, and doctor custom Copilot agents.
- Instruction tools: generate Copilot instructions, AGENTS.md suggestions, and skills.
- Review tools: summarize git diff, compare diff to a plan, identify risks, and produce reviewer prompts.

## Boundary

MCP tools call shared package APIs. They do not contain separate business logic and do not bypass validation safety policy.

## Artifacts

MCP tools read and write the same `.copilot-architect/` artifacts as the CLI. This keeps local evidence portable between tools and agents.
