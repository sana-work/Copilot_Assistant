# Agent Workflows

## First-Class Agents

Custom Copilot agents are first-class product artifacts. Copilot Architect should generate, validate, install, update, and diagnose agent definitions that are grounded in the current repo or workspace.

## Installed Agents

Phase 13 installs these files under `.github/agents/` by default:

- `FeatureArchitect.agent.md`
- `FeatureImplementer.agent.md`
- `CodeReviewer.agent.md`
- `TestPlanner.agent.md`
- `Debugger.agent.md`
- `SecurityReviewer.agent.md`
- `PerformanceReviewer.agent.md`

Each agent includes YAML frontmatter, name, description, model, tools, instructions, handoff guidance, safety rules, and references to `.copilot-architect/` artifacts.

## Commands

```bash
npm run cli -- agents list
npm run cli -- agents install
npm run cli -- agents install --dry-run
npm run cli -- agents install --force
npm run cli -- agents update
npm run cli -- agents validate
npm run cli -- agents doctor
```

Use `--output <dir>` to install to another directory. Use `--output json` or `--json` for structured output.

Existing files are skipped by default. `--force` and `agents update` overwrite generated files only after creating `.bak` backups.

## Primary Workflow Agents

- `@FeatureArchitect` analyzes the repo, finds similar patterns, and produces implementation plans. It must not edit code.
- `@FeatureImplementer` implements only an approved plan and handoff, keeps changes minimal, updates tests, and runs validation.
- `@CodeReviewer` reviews the implementation against the approved plan, validation evidence, and safety expectations.

## Handoff Flow

1. Analyze the repo or workspace.
2. Generate a feature plan.
3. Require human approval.
4. Create a handoff prompt scoped to the approved plan with `npm run cli -- handoff --plan latest --approve`.
5. Include safety policy, expected files, validation commands, git checkpoint evidence, and review checklist.
6. Use `@FeatureImplementer` or another coding agent to implement from the generated handoff artifact.
7. Run validation, then generate review evidence with `npm run cli -- review --plan latest --validation latest`.
8. Use the generated `@CodeReviewer` prompt to inspect the diff against the approved plan and validation report.

## Instructions Flow

Copilot Architect generates `.github/copilot-instructions.md` and skill templates from the same repo intelligence used by the planner. Instruction generation backs up existing files before overwriting them and preserves user-authored content outside the generated block.

```bash
npm run cli -- instructions preview
npm run cli -- instructions generate
npm run cli -- instructions validate
```

Generated instructions include repo architecture summary, detected languages, frameworks, package managers, build/test/lint/format commands, coding conventions, safety rules, planning workflow, approval workflow, validation workflow, and review workflow.

Generated skills:

- `.github/skills/feature-planning/SKILL.md`
- `.github/skills/repo-analysis/SKILL.md`
- `.github/skills/validation/SKILL.md`
- `.github/skills/code-review/SKILL.md`
- `.github/skills/debugging/SKILL.md`

## UI Boundary

Any agent workflow exposed in VS Code or a web UI must call the agents and instructions packages. UI shells must not implement generation logic directly.
