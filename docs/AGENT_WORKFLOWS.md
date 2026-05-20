# Agent Workflows

## First-Class Agents

Custom Copilot agents are first-class product artifacts. Copilot Architect should generate, validate, install, update, and diagnose agent definitions that are grounded in the current repo or workspace.

## Planned Workflows

- Generate custom agents from repo analysis.
- Install agents into the appropriate local agent location.
- Validate required metadata and instructions.
- Doctor existing agents and report missing or stale fields.
- Update generated agents while preserving user-owned edits where possible.
- Generate handoff prompts for Copilot, Codex, Claude Code, or other coding agents.

## Handoff Flow

1. Analyze the repo or workspace.
2. Generate a feature plan.
3. Require human approval.
4. Create a handoff prompt scoped to the approved plan.
5. Include safety policy, expected files, validation commands, and review checklist.

## Instructions Flow

Copilot Architect generates `copilot-instructions.md`, AGENTS.md suggestions, and skill templates from the same repo intelligence used by the planner. Instruction generation must back up existing files before overwriting them.

## UI Boundary

Any agent workflow exposed in VS Code or a web UI must call the agents and instructions packages. UI shells must not implement generation logic directly.
