# MCP Tools

## Role

MCP is a first-class integration path. The local MCP server exposes Copilot Architect repo intelligence to agent hosts without forcing those hosts to parse CLI text.

## Technology

The MCP server is implemented in TypeScript with the MCP TypeScript SDK. Start it with:

```bash
npm run cli -- mcp
```

## Phase 11 Tools

- `repo_map`
- `workspace_map`
- `detect_languages`
- `detect_frameworks`
- `detect_package_managers`
- `detect_build_commands`
- `detect_test_commands`
- `search_repo`
- `search_across_repos`
- `find_similar_feature`
- `find_impacted_files`
- `analyze_impact`
- `generate_plan_context`
- `generate_feature_plan`
- `get_validation_commands`
- `get_safety_policy`
- `get_latest_plan`
- `get_latest_validation`
- `get_latest_review`
- `agent_status`

## Boundary

MCP tools call shared package APIs. They do not contain separate business logic and do not bypass validation safety policy.

Tools return structured JSON. Missing latest artifacts return a structured `missing` response instead of throwing opaque file errors.

Read-only tools are the default. `generate_feature_plan` writes plan artifacts and requires an explicit `approved=true` argument.

## Artifacts

MCP tools read and write the same `.copilot-architect/` artifacts as the CLI. This keeps local evidence portable between tools and agents.
