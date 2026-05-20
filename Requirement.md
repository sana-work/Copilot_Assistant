# Phase 0 — Product Docs and Boundaries

```text
Proceed with Phase 0: Product Specification and Boundaries.

Create documentation:

docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/SECURITY_MODEL.md
docs/LANGUAGE_SUPPORT.md
docs/MCP_TOOLS.md
docs/AGENT_WORKFLOWS.md
docs/TESTING_STRATEGY.md
docs/RELEASE_PLAN.md
docs/MVP_DEFINITION.md
docs/DEVELOPMENT_EXECUTION_INSTRUCTIONS.md

The docs must explain:

1. Product vision.
2. Internal team-sharing model.
3. Why TypeScript/Node.js is used.
4. Why .NET/Visual Studio VSIX is not MVP.
5. Supported repo types.
6. Supported languages.
7. CLI-first architecture.
8. MCP-first architecture.
9. Custom Copilot agent integration.
10. Safety policy.
11. Multi-repo support.
12. Minimal dependency strategy.
13. Non-goals.
14. MVP scope.
15. Future optional features.

Acceptance criteria:

1. Docs exist.
2. Docs clearly state this is TypeScript/Node.js-first.
3. Docs clearly state Visual Studio VSIX is not MVP.
4. Docs preserve all major features from the earlier C# plan.
5. Docs explain that UI shells must not contain business logic.
6. Docs explain that custom agents are first-class.
7. Docs explain that MCP is first-class.
```

---

# Phase 1 — Project Skeleton

```text
Proceed with Phase 1: TypeScript Monorepo Skeleton.

Create the project structure:

packages/shared
packages/core
packages/adapters
packages/indexer
packages/planner
packages/validator
packages/reviewer
packages/agents
packages/instructions
packages/mcp-server
packages/cli
packages/vscode-extension
packages/web
templates/agents
templates/instructions
templates/skills
samples
tests
docs
scripts

Create root files:

package.json
tsconfig.json
vitest.config.ts
.eslintrc or eslint.config.js
.prettierrc
.gitignore
README.md
AGENTS.md

Use npm unless pnpm already exists.

Root scripts:

npm run build
npm test
npm run lint
npm run format
npm run cli -- <args>

CLI should support placeholder commands:

init
analyze
index
search
plan
validate
review
handoff
agents
instructions
workspace
mcp
serve
status
doctor

Acceptance criteria:

1. npm install works.
2. npm run build works.
3. npm test works.
4. npm run cli -- --help works.
5. npm run cli -- doctor works.
6. No C#/.NET project is created.
7. No Visual Studio VSIX is created.
8. README has quickstart.
```

---

# Phase 2 — Shared Domain Models

```text
Proceed with Phase 2: Shared Domain Models.

Implement shared TypeScript types in packages/shared.

Create models for:

RepoContext
WorkspaceContext
UniversalRepoMap
RepoMap
ProjectMap
LanguageInfo
FrameworkInfo
PackageManagerInfo
BuildCommand
TestCommand
LintCommand
FormatCommand
ValidationCommand
CodeSymbol
EntryPoint
FeaturePattern
ImpactAnalysis
FeaturePlan
ValidationPlan
ValidationResult
ReviewReport
SafetyPolicy
CommandRiskAssessment
AuditLogEntry
HandoffPrompt
AgentTemplate
AgentInstallResult
InstructionGenerationResult
McpToolResult
WorkspaceConfig
CustomCommandConfig
EnterprisePolicy
DiagnosticReport

Requirements:

1. Types must be serializable to JSON.
2. Add schema version fields where useful.
3. Add helper functions for reading/writing JSON artifacts.
4. Add tests for serialization and artifact paths.
5. Define constants for .copilot-architect folder paths.

Acceptance criteria:

1. TypeScript builds.
2. Vitest tests pass.
3. Shared types are used by at least CLI placeholder output.
4. No business logic leaks into UI packages.
```

---

# Phase 3 — Adapter Architecture

```text
Proceed with Phase 3: Universal Adapter Architecture.

Implement in packages/adapters:

Interfaces:

IAdapter
ILanguageAdapter
IFrameworkDetector
IPackageManagerDetector
IBuildCommandDetector
ITestCommandDetector
ILintCommandDetector
IFormatCommandDetector
IRepoHeuristicsProvider

Core classes:

AdapterRegistry
AdapterDetectionResult
AdapterCapability
AdapterContext
AdapterScore
GenericFallbackResult

Each adapter must support:

name
version
capabilities
canHandle(context)
detect(context)
analyze(context)

AdapterRegistry must:

1. Register adapters.
2. Run all matching adapters.
3. Merge results.
4. Use GenericTextAdapter fallback.
5. Sort results by confidence.
6. Avoid duplicate commands.

Acceptance criteria:

1. Adapter registry works.
2. Multiple adapters can match one repo.
3. Generic fallback always works.
4. Tests prove adapter selection and merge behavior.
```

---

# Phase 4 — Language, Framework, and Toolchain Adapters

```text
Proceed with Phase 4: Implement Adapters.

Implement first-class adapters:

1. JavaScriptTypeScriptAdapter
Detect:
- package.json
- tsconfig.json
- jsconfig.json
- vite.config.*
- next.config.*
- webpack.config.*
- eslint config
- prettier config

Detect package managers:
- npm
- pnpm
- yarn

Detect commands from package.json scripts:
- build
- test
- lint
- format
- typecheck
- e2e

2. ReactAdapter
Detect:
- react dependency
- react-dom dependency
- Vite React plugin
- Next.js dependency
- create-react-app/react-scripts

Detect:
- components
- hooks
- pages/routes where possible
- test files

3. AngularAdapter
Detect:
- angular.json
- @angular/core
- @angular/cli

Detect:
- projects
- apps
- libraries
- components
- services
- modules
- guards
- interceptors
- spec files

Commands:
- ng build
- ng test
- npm run build
- npm test
- npm run lint

4. PythonAdapter
Detect:
- pyproject.toml
- requirements.txt
- setup.py
- setup.cfg
- pytest.ini
- tox.ini
- poetry.lock
- Pipfile

Detect frameworks if possible:
- FastAPI
- Flask
- Django
- pytest
- unittest

Commands:
- pytest
- python -m pytest
- python -m unittest
- poetry run pytest

5. JavaAdapter
Detect:
- pom.xml
- build.gradle
- settings.gradle
- gradlew
- mvnw

Detect frameworks if possible:
- Spring Boot
- JUnit
- Maven
- Gradle

Commands:
- mvn test
- mvn package
- ./mvnw test
- gradle test
- gradle build
- ./gradlew test
- ./gradlew build

6. GenericTextAdapter
Detect:
- any repository

Capabilities:
- file scanning
- docs detection
- config detection
- import/include scanning
- test file pattern detection
- generic source/test folder detection

Optional early adapters:
- GoAdapter
- RustAdapter
- ShellAdapter
- SqlAdapter

Acceptance criteria:

1. Each adapter has tests.
2. React sample is detected.
3. Angular sample is detected.
4. Python sample is detected.
5. Java Maven sample is detected.
6. Java Gradle sample is detected.
7. Generic fallback works.
8. Commands are detected but not executed.
```

---

# Phase 5 — Repo Discovery Engine

```text
Proceed with Phase 5: Repo Discovery Engine.

Implement packages/core RepoDiscoveryService.

It must:

1. Find repo root.
2. Detect Git repo.
3. Detect languages.
4. Detect frameworks.
5. Detect package managers.
6. Detect source folders.
7. Detect test folders.
8. Detect config files.
9. Detect docs.
10. Detect build/test/lint/format commands.
11. Detect monorepo structure.
12. Detect likely architecture style.
13. Merge adapter results into UniversalRepoMap.
14. Write .copilot-architect/repo-map.json.

Update CLI:

npm run cli -- analyze
npm run cli -- analyze --json
npm run cli -- analyze --output .copilot-architect/repo-map.json

Acceptance criteria:

1. analyze works on React repo.
2. analyze works on Angular repo.
3. analyze works on Python repo.
4. analyze works on Java repo.
5. analyze works on polyglot repo.
6. analyze works on unknown repo.
7. repo-map.json is generated.
```

---

# Phase 6 — Local Indexing and Search

```text
Proceed with Phase 6: Local Indexing and Search.

Implement packages/indexer.

Index must include:

- file path
- relative path
- extension
- language guess
- content hash
- modified time
- file size
- text preview
- extracted symbols where possible
- imports/includes where possible
- test file flag
- config file flag
- doc file flag

Storage:

Use SQLite if dependency is simple and reliable.
If SQLite becomes heavy, use JSON index for MVP and design a SQLite adapter for later.

Index location:

.copilot-architect/index/

Ignore:

.git
node_modules
dist
build
coverage
.next
.angular
target
.venv
__pycache__
vendor
.idea
.vscode
.DS_Store

Implement:

1. Full index.
2. Incremental index.
3. Rebuild index.
4. Search.
5. Similar feature search.
6. Index status.

Update CLI:

npm run cli -- index
npm run cli -- index --rebuild
npm run cli -- search "query"
npm run cli -- search "query" --json

Acceptance criteria:

1. index creates artifact files.
2. search returns ranked results.
3. ignored folders are skipped.
4. incremental indexing works.
5. tests cover indexing/search.
```

---

# Phase 7 — Feature Planning Engine

```text
Proceed with Phase 7: Feature Planning Engine.

Implement packages/planner.

FeaturePlanningService input:

- user feature request
- repo-map.json
- index search results
- adapter insights
- workspace config
- custom commands
- generated instructions if available

Output:

.copilot-architect/plans/<timestamp>-plan.json
.copilot-architect/plans/<timestamp>-plan.md
.copilot-architect/plans/latest-plan.json
.copilot-architect/plans/latest-plan.md

Plan must include:

1. Request interpretation.
2. Repo architecture summary.
3. Relevant files.
4. Similar feature candidates.
5. Impacted languages/frameworks.
6. Impacted modules/folders.
7. Likely files to modify.
8. Likely new files.
9. Frontend/UI impact.
10. Backend/API impact.
11. Data/config impact.
12. Security considerations.
13. Performance considerations.
14. Test strategy.
15. Validation commands.
16. Step-by-step implementation plan.
17. Risks.
18. Assumptions.
19. Open questions.
20. Human approval checkpoint.

Stack-specific planning:

For React:
- components
- hooks
- routes
- state management
- API client
- tests

For Angular:
- components
- services
- modules
- guards
- interceptors
- spec files

For Python:
- modules
- packages
- services
- API routes if FastAPI/Flask/Django
- pytest/unittest tests

For Java:
- packages
- controllers
- services
- repositories
- DTOs
- JUnit tests

Update CLI:

npm run cli -- plan "Add invoice approval workflow"
npm run cli -- plan "Add invoice approval workflow" --json

Acceptance criteria:

1. Plan generates Markdown and JSON.
2. Plan uses repo map.
3. Plan uses index/search.
4. Plan includes assumptions.
5. Plan includes validation commands.
6. Plan does not edit application code.
```

---

# Phase 8 — Custom Command Configuration

```text
Proceed with Phase 8: Custom Command Configuration.

Support:

.copilot-architect/commands.json

Example:

{
  "build": [
    {
      "name": "Frontend build",
      "workingDirectory": "frontend",
      "command": "npm run build"
    }
  ],
  "test": [
    {
      "name": "Frontend tests",
      "workingDirectory": "frontend",
      "command": "npm test"
    },
    {
      "name": "Python tests",
      "workingDirectory": "api",
      "command": "pytest"
    },
    {
      "name": "Java tests",
      "workingDirectory": "service",
      "command": "./gradlew test"
    }
  ],
  "lint": [
    {
      "name": "Frontend lint",
      "workingDirectory": "frontend",
      "command": "npm run lint"
    }
  ],
  "format": [
    {
      "name": "Format check",
      "workingDirectory": "frontend",
      "command": "npm run format:check"
    }
  ]
}

Implement:

1. Command config parser.
2. Schema validation.
3. Merge with detected commands.
4. Override behavior.
5. Helpful error messages.
6. commands init template.

Update CLI:

npm run cli -- init
npm run cli -- commands validate
npm run cli -- commands list

Acceptance criteria:

1. commands.json is created by init.
2. custom commands load correctly.
3. invalid config gives helpful errors.
4. custom commands appear in feature plans and validation plans.
```

---

# Phase 9 — Universal Validation Engine

```text
Proceed with Phase 9: Universal Validation Engine.

Implement packages/validator.

ValidationService must:

1. Build validation plan.
2. Load detected commands.
3. Load custom commands.
4. Run safe commands only.
5. Support timeouts.
6. Support retries where safe.
7. Stream output.
8. Save logs.
9. Redact secrets.
10. Summarize failures.
11. Generate fix prompt.
12. Generate validation report.

Support commands for:

npm
pnpm
yarn
pytest
python -m pytest
python -m unittest
poetry
maven
gradle
gradlew
ng
vite
jest
vitest
eslint
prettier
custom commands

Artifacts:

.copilot-architect/runs/<timestamp>-validation.json
.copilot-architect/runs/<timestamp>-validation.md
.copilot-architect/runs/<timestamp>-logs.txt
.copilot-architect/runs/latest-validation.json
.copilot-architect/runs/latest-validation.md

Update CLI:

npm run cli -- validate
npm run cli -- validate --build
npm run cli -- validate --test
npm run cli -- validate --lint
npm run cli -- validate --format

Acceptance criteria:

1. Safe commands run.
2. Dangerous commands are blocked.
3. Logs are saved.
4. Reports are saved.
5. Failures are summarized.
6. Fix prompt is generated.
```

---

# Phase 10 — Safety Policy and Audit

```text
Proceed with Phase 10: Safety Policy and Audit.

Implement:

SafetyPolicyService
CommandRiskAssessmentService
AuditLogService
SecretRedactionService
PathBoundaryService
GitCheckpointService
RollbackGuideGenerator

Default policy:

1. Analysis is read-only.
2. Implementation handoff requires approval.
3. Dangerous commands blocked.
4. No writes outside repo/workspace root.
5. No secrets in logs.
6. Audit all mutating actions.
7. Git checkpoint before implementation handoff.
8. Warn before commands that modify git history.

Block commands:

rm -rf
del /s
format
diskpart
git clean -fdx
git reset --hard
chmod -R 777
sudo rm
Remove-Item -Recurse

Support:

.copilot-architect/policy.json

Update CLI:

npm run cli -- policy show
npm run cli -- policy validate
npm run cli -- audit list
npm run cli -- doctor

Acceptance criteria:

1. Dangerous commands blocked in tests.
2. Audit logs are created.
3. Secret redaction works.
4. Path boundary checks work.
5. Git checkpoint works where git exists.
```

---

# Phase 11 — MCP Server

```text
Proceed with Phase 11: Local MCP Server.

Implement packages/mcp-server using the TypeScript MCP SDK.

Command:

npm run cli -- mcp

Expose tools:

1. repo_map
2. workspace_map
3. detect_languages
4. detect_frameworks
5. detect_package_managers
6. detect_build_commands
7. detect_test_commands
8. search_repo
9. search_across_repos
10. find_similar_feature
11. find_impacted_files
12. analyze_impact
13. generate_plan_context
14. generate_feature_plan
15. get_validation_commands
16. get_safety_policy
17. get_latest_plan
18. get_latest_validation
19. get_latest_review
20. agent_status

Rules:

1. MCP tools are read-only by default.
2. Mutating tools require explicit approval.
3. Tools call existing packages.
4. Do not duplicate logic.
5. Return structured JSON.
6. Log safely.
7. Handle missing artifacts gracefully.

Acceptance criteria:

1. MCP server starts.
2. Tool list works.
3. repo_map works.
4. search_repo works.
5. generate_feature_plan works.
6. get_validation_commands works.
7. tests cover MCP tools.
```

---

# Phase 12 — CLI Completion

```text
Proceed with Phase 12: Complete CLI.

Implement CLI commands:

init
analyze
index
search
plan
validate
review
handoff
agents install
agents list
agents validate
agents doctor
instructions generate
instructions preview
instructions validate
workspace init
workspace show
workspace add
workspace index
workspace search
workspace impact
workspace plan
workspace validate-plan
commands list
commands validate
policy show
policy validate
audit list
mcp
serve
status
doctor

CLI requirements:

1. Good help text.
2. JSON output option.
3. Human-readable output by default.
4. Exit codes.
5. Error messages.
6. Cross-platform path handling.
7. No IDE required.

Acceptance criteria:

1. CLI works on Mac/Windows/Linux.
2. Every command has help.
3. Core commands have tests.
4. No command duplicates business logic.
```

---

# Phase 13 — Custom Copilot Agents

```text
Proceed with Phase 13: Custom Copilot Agents.

Treat custom agents as a first-class integration.

Implement packages/agents.

Generate agent files under:

.github/agents/

Also support configurable output path.

Required agents:

1. FeatureArchitect.agent.md
Purpose:
Analyze the repo, understand the request, find similar patterns, and produce detailed implementation plans.
Must not edit code.

2. FeatureImplementer.agent.md
Purpose:
Implement only an approved plan.
Must keep changes minimal, update tests, and run validation.

3. CodeReviewer.agent.md
Purpose:
Review implementation against approved plan.
Must flag unexpected changes, missing tests, validation failures, security risks, and performance risks.

4. TestPlanner.agent.md
Purpose:
Identify test coverage needed for a feature.

5. Debugger.agent.md
Purpose:
Analyze build/test/lint failures and propose fixes.

6. SecurityReviewer.agent.md
Purpose:
Review code changes for security issues.

7. PerformanceReviewer.agent.md
Purpose:
Review potential performance risks.

Each agent must include:

- frontmatter
- name
- description
- model field if supported
- tools list if supported
- instructions
- handoff guidance
- safety rules
- references to .copilot-architect artifacts

CLI commands:

agents install
agents list
agents validate
agents update
agents doctor

Install behavior:

1. Create .github/agents if missing.
2. Backup existing files before overwrite.
3. Support --dry-run.
4. Support --force.
5. Support --output json.
6. Validate frontmatter.
7. Validate required sections.

Acceptance criteria:

1. Agents install correctly.
2. Existing files are backed up.
3. Validation catches bad agent files.
4. agents doctor explains how to use @FeatureArchitect, @FeatureImplementer, and @CodeReviewer.
5. README documents the agent workflow.
```

---

# Phase 14 — Custom Instructions and Skills

```text
Proceed with Phase 14: Custom Instructions and Skills.

Implement packages/instructions.

Generate:

.github/copilot-instructions.md

Generate optional skills:

.github/skills/feature-planning/SKILL.md
.github/skills/repo-analysis/SKILL.md
.github/skills/validation/SKILL.md
.github/skills/code-review/SKILL.md
.github/skills/debugging/SKILL.md

Instructions must include:

1. Repo architecture summary.
2. Detected languages.
3. Frameworks.
4. Package managers.
5. Build commands.
6. Test commands.
7. Lint/format commands.
8. Coding conventions if detected.
9. Safety rules.
10. Planning workflow.
11. Approval workflow.
12. Validation workflow.
13. Review workflow.

Behavior:

1. Preview before writing.
2. Backup existing files.
3. Preserve user-authored sections where possible.
4. Include generated timestamp and source repo-map version.

CLI:

instructions preview
instructions generate
instructions validate

Acceptance criteria:

1. Instructions generate from repo analysis.
2. Existing instructions are backed up.
3. Skills are generated.
4. Validation works.
```

---

# Phase 15 — Implementation Handoff

```text
Proceed with Phase 15: Implementation Handoff.

Implement packages/planner or packages/core HandoffService.

Input:

- approved plan
- repo map
- validation commands
- safety policy

Output:

.copilot-architect/handoffs/<timestamp>-handoff.md
.copilot-architect/handoffs/latest-handoff.md

Handoff prompt must work with:

- GitHub Copilot
- Copilot custom agents
- Codex
- Claude Code
- other coding agents

Prompt format:

@FeatureImplementer

Implement the approved plan below.

Rules:
1. Follow the plan exactly unless blocked.
2. Keep changes minimal.
3. Reuse existing patterns.
4. Do not introduce new dependencies unless necessary.
5. Update tests.
6. Run validation commands.
7. Summarize changed files.
8. Stop and ask if risky architecture decisions are required.

Approved plan:
[PLAN]

Validation commands:
[COMMANDS]

Safety rules:
[SAFETY]

Requirements:

1. Require explicit approval flag.
2. Create git checkpoint if possible.
3. Save handoff artifact.
4. Copy to clipboard where supported.
5. Never directly edit target repo code in MVP.

CLI:

handoff --plan latest --approve
handoff --plan <path> --approve

Acceptance criteria:

1. Handoff is generated.
2. Git checkpoint created where possible.
3. No handoff without approval.
4. Handoff references latest plan and validation commands.
```

---

# Phase 16 — Review Workflow

```text
Proceed with Phase 16: Review Workflow.

Implement packages/reviewer.

ReviewService must:

1. Read git diff.
2. Load approved plan.
3. Load validation report if available.
4. Compare changed files to expected files.
5. Flag unexpected files.
6. Identify missing tests.
7. Identify config changes.
8. Identify dependency changes.
9. Identify potential security risks.
10. Identify possible breaking changes.
11. Generate review report.
12. Generate CodeReviewer prompt.

Artifacts:

.copilot-architect/reviews/<timestamp>-review.json
.copilot-architect/reviews/<timestamp>-review.md
.copilot-architect/reviews/latest-review.json
.copilot-architect/reviews/latest-review.md

CLI:

review
review --plan latest
review --validation latest

Acceptance criteria:

1. Review report generated.
2. Unexpected changes flagged.
3. Missing tests flagged.
4. Validation failures included.
5. CodeReviewer prompt generated.
```

---

# Phase 17 — VS Code Extension Shell

```text
Proceed with Phase 17: VS Code Extension Shell.

Implement packages/vscode-extension.

Use TypeScript.

This is a thin shell only.

Features:

1. Activity bar icon.
2. Webview panel named Copilot Architect.
3. Commands:
   - Copilot Architect: Analyze Repo
   - Copilot Architect: Build Index
   - Copilot Architect: Generate Plan
   - Copilot Architect: Validate
   - Copilot Architect: Review
   - Copilot Architect: Start MCP
   - Copilot Architect: Install Agents
   - Copilot Architect: Generate Instructions
4. Calls CLI/MCP.
5. Does not duplicate business logic.
6. Works on Mac, Windows, Linux.

Webview sections:

- Repo summary
- Languages/frameworks
- Plans
- Validation runs
- Review reports
- Agent status
- MCP status

Acceptance criteria:

1. Extension builds.
2. Extension host launches.
3. Commands call CLI/MCP.
4. No business logic duplicated.
5. Basic smoke tests exist.
```

---

# Phase 18 — Optional Local Web UI

```text
Proceed with Phase 18: Optional Local Web UI.

Implement packages/web only if core CLI/MCP functionality is stable.

Command:

npm run cli -- serve

Features:

1. Local browser UI.
2. Analyze repo.
3. Build index.
4. Search repo.
5. Generate plan.
6. View plans.
7. Run validation.
8. View validation logs.
9. Generate review.
10. Manage workspace config.
11. Install agents.
12. Start/stop MCP server.

Rules:

1. Local-only.
2. No cloud backend.
3. Calls CLI/core/MCP.
4. No business logic duplicated.

Acceptance criteria:

1. serve starts local UI.
2. UI works on Mac/Windows/Linux.
3. UI can display repo-map and plans.
```

---

# Phase 19 — Multi-Repo Workspace Support

```text
Proceed with Phase 19: Multi-Repo Workspace Support.

Support:

.copilot-architect/workspace.json

Example:

{
  "workspaceName": "Customer Platform",
  "repos": [
    {
      "name": "customer-api",
      "path": "../customer-api",
      "role": "backend"
    },
    {
      "name": "customer-web",
      "path": "../customer-web",
      "role": "frontend"
    },
    {
      "name": "billing-service",
      "path": "../billing-service",
      "role": "downstream service"
    }
  ]
}

Implement:

1. Workspace config parser.
2. Add/list/remove repos.
3. Index multiple repos.
4. Search across repos.
5. Analyze cross-repo impact.
6. Generate multi-repo plans.
7. Generate per-repo validation plans.
8. Workspace-level repo-map.

CLI:

workspace init
workspace show
workspace add <name> <path> --role <role>
workspace index
workspace search "query"
workspace impact "feature request"
workspace plan "feature request"
workspace validate-plan

MCP tools:

workspace_map
search_across_repos
analyze_cross_repo_impact

Acceptance criteria:

1. workspace.json loads.
2. multiple repos indexed.
3. cross-repo search works.
4. plan identifies impacted repos.
```

---

# Phase 20 — Enterprise/Internal Team Controls

```text
Proceed with Phase 20: Internal Team Controls.

This is not commercial distribution, but it should work well for teams.

Implement:

1. .copilot-architect/policy.json
2. command allowlist/blocklist
3. required approval gates
4. telemetry disabled by default
5. local-first operation
6. configurable artifact retention
7. secret redaction
8. admin-configurable agent templates
9. internal setup scripts
10. trust metadata for generated files

Create scripts:

scripts/setup.sh
scripts/setup.ps1
scripts/check-env.sh
scripts/check-env.ps1

CLI:

doctor
status
policy show
policy validate
audit list
cleanup

Acceptance criteria:

1. team member can clone and run setup.
2. policy is respected.
3. logs redact secrets.
4. retention cleanup works.
5. doctor gives useful setup guidance.
```

---

# Phase 21 — Advanced Intelligence Additions

```text
Proceed with Phase 21: Advanced Intelligence Additions.

Add advanced but still local-first features.

Implement:

1. Architecture pattern detection:
   - React app
   - Angular app
   - Node API
   - Python service
   - Java Spring service
   - monorepo
   - library/package
   - CLI app

2. Dependency change detection:
   - package.json
   - requirements.txt
   - pyproject.toml
   - pom.xml
   - build.gradle

3. Route/API detection:
   - Express routes
   - FastAPI routes
   - Flask routes
   - Django urls
   - Spring controllers
   - Angular routes
   - React/Next routes

4. Test relationship detection:
   - component to spec/test
   - service to unit test
   - API route to integration test

5. Risk scoring:
   - low/medium/high
   - security risk
   - data migration risk
   - dependency risk
   - multi-repo impact risk
   - missing-test risk

6. Plan quality scoring:
   - enough context?
   - impacted files identified?
   - validation commands found?
   - assumptions too broad?

7. Diagnostics:
   - missing package managers
   - missing build scripts
   - missing tests
   - missing repo-map
   - stale index

Acceptance criteria:

1. Advanced analysis appears in plans.
2. Risk scores are included.
3. Diagnostics command reports repo readiness.
4. Tests cover at least React, Angular, Python, and Java samples.
```

---

# Phase 22 — Testing Matrix and Sample Repos

```text
Proceed with Phase 22: Testing Matrix and Sample Repos.

Create sample repos:

samples/react-app
samples/angular-app
samples/python-service
samples/java-maven-service
samples/java-gradle-service
samples/node-api
samples/polyglot-monorepo
samples/generic-repo

Add tests for:

1. Adapter detection.
2. Repo discovery.
3. Indexing.
4. Search.
5. Feature planning.
6. Validation command detection.
7. Safety command blocking.
8. MCP tools.
9. Agent installer.
10. Instructions generator.
11. Handoff generator.
12. Review generator.
13. Workspace support.
14. CLI commands.
15. End-to-end flow.

End-to-end flow:

analyze → index → search → plan → agents install → instructions generate → handoff → validate → review

Acceptance criteria:

1. npm test passes.
2. sample repos prove language support.
3. e2e test covers MVP flow.
4. CI workflow runs tests.
```

---

# Phase 23 — Packaging for Internal Sharing

```text
Proceed with Phase 23: Packaging for Internal Sharing.

This is not commercial distribution.

Optimize for internal team repo sharing.

Implement:

1. setup scripts
2. build scripts
3. local install instructions
4. npm link instructions
5. optional package tarball
6. internal release artifacts
7. version command
8. changelog
9. troubleshooting guide

Do not prioritize marketplace publishing.

Root scripts:

npm run build
npm test
npm run lint
npm run cli -- doctor
npm run package:local

Docs:

docs/INSTALLATION.md
docs/INTERNAL_TEAM_SETUP.md
docs/TROUBLESHOOTING.md
docs/UPGRADE_GUIDE.md

Acceptance criteria:

1. New team member setup is documented.
2. Local package can be built.
3. CLI version works.
4. doctor verifies environment.
```

---

# Phase 24 — MVP Definition and Lock

```text
Proceed with Phase 24: MVP Definition and Lock.

Create docs/MVP_DEFINITION.md or update it.

MVP includes:

1. TypeScript CLI.
2. Repo discovery.
3. JS/TS adapter.
4. React adapter.
5. Angular adapter.
6. Python adapter.
7. Java adapter.
8. Generic adapter.
9. Local indexing.
10. Search.
11. Feature planning.
12. Custom command config.
13. Validation engine.
14. Safety policy.
15. MCP server.
16. Custom Copilot agents.
17. Copilot instructions.
18. Handoff prompts.
19. Review reports.
20. Multi-repo workspace basics.
21. Basic VS Code extension shell.
22. Internal setup docs.

MVP does not include:

1. Full autonomous code editing inside this tool.
2. Commercial distribution.
3. Visual Studio VSIX.
4. Cloud sync.
5. Team dashboard.
6. Heavy vector database.
7. Perfect support for every framework.
8. PR automation.

Acceptance criteria:

1. MVP boundary is documented.
2. Tests prove MVP path.
3. No new scope added until MVP is stable.
```

---

# Phase 25 — Governance and Execution Rules

```text
Proceed with Phase 25: Development Governance.

Create:

docs/DEVELOPMENT_EXECUTION_INSTRUCTIONS.md
.github/pull_request_template.md
.github/workflows/ci.yml
.github/workflows/release-check.yml

Rules:

1. Do not jump phases.
2. Do not add UI before CLI/core works.
3. Do not hardcode one language.
4. Do not put business logic in UI shells.
5. Do not skip safety.
6. Do not run destructive commands.
7. Do not overwrite user files without backup.
8. Do not mark tests passing without running them.
9. Do not claim support without sample coverage.

CI must run:

npm install
npm run build
npm test
npm run lint if available

Acceptance criteria:

1. Governance docs exist.
2. PR template exists.
3. CI workflow exists.
4. Tests validate governance artifacts where practical.
```

---

# Phase 26 — End-to-End MVP Validation

```text
Proceed with Phase 26: End-to-End MVP Validation.

Do not add major new features.

Prove the product works.

Create:

docs/PHASE_26_VALIDATION_REPORT.md

Run flows:

Flow 1: React repo

npm run cli -- analyze --root samples/react-app
npm run cli -- index --root samples/react-app
npm run cli -- search "component" --root samples/react-app
npm run cli -- plan "Add audit banner component" --root samples/react-app
npm run cli -- validate --root samples/react-app

Flow 2: Angular repo

analyze
index
plan
validate

Flow 3: Python repo

analyze
index
plan
validate

Flow 4: Java repo

analyze
index
plan
validate

Flow 5: Polyglot repo

analyze
index
search
plan
workspace impact

Flow 6: MCP

start MCP server
list tools
call repo_map
call search_repo
call generate_feature_plan
call get_validation_commands

Flow 7: Agents and instructions

agents install
agents validate
instructions generate
verify backup behavior

Flow 8: Safety

try dangerous command in test
verify block
verify audit log
verify secret redaction

Flow 9: Review

create sample diff
run review
verify unexpected changes/missing tests are flagged

Report:

1. exact commands run
2. pass/fail per flow
3. failures found
4. fixes applied
5. known limitations
6. release blockers
7. MVP readiness decision:
   - Ready
   - Ready with limitations
   - Not ready

Acceptance criteria:

1. Validation report exists.
2. npm test passes.
3. MVP flows work.
4. No .NET/VSIX dependency added.
5. Internal team setup remains simple.
```

---

# Phase 27 — Developer Experience Polish

```text
Proceed with Phase 27: Developer Experience Polish.

Improve internal usability.

Tasks:

1. Improve CLI help.
2. Improve error messages.
3. Add examples to README.
4. Add one-command demo.
5. Add troubleshooting guide.
6. Add setup verification.
7. Add clearer doctor output.
8. Add latest artifact shortcuts.
9. Add JSON/human output consistency.
10. Add clean command for generated artifacts.

CLI examples:

npm run cli -- demo
npm run cli -- doctor
npm run cli -- status
npm run cli -- cleanup

Acceptance criteria:

1. New user can follow README without help.
2. doctor identifies missing dependencies.
3. common errors have actionable messages.
```

---

# Phase 28 — Dogfood on Itself

```text
Proceed with Phase 28: Dogfood Copilot Architect on its own repository.

Use this repo as the target repo.

Run:

npm run cli -- analyze
npm run cli -- index
npm run cli -- plan "Add adapter health diagnostics"
npm run cli -- agents install
npm run cli -- instructions generate
npm run cli -- handoff --plan latest --approve
npm run cli -- validate
npm run cli -- review

Create:

docs/DOGFOOD_REPORT.md

Report:

1. what worked
2. what failed
3. what was confusing
4. what needs improvement
5. whether the generated plan was useful
6. whether validation was accurate
7. whether review found useful issues

Acceptance criteria:

1. Dogfood report exists.
2. Issues found are converted into follow-up tasks.
3. Tool proves useful on itself.
```

---