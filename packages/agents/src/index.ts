import { existsSync, readdirSync, readFileSync } from "node:fs";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CURRENT_SCHEMA_VERSION,
  type AgentInstallResult,
  type AgentTemplate,
  type DiagnosticReport,
  type SafetyPolicy,
  type TrustMetadata,
  createTrustMetadata,
  getArtifactFilePath,
  readJsonFile,
  writeJsonFile
} from "@copilot-architect/shared";

export interface AgentServiceOptions {
  startPath?: string;
  outputPath?: string;
}

/** Repo facts read from `.copilot-architect/repo-map.json` at install time. */
export interface RepoContextSnippet {
  languages: string[];
  frameworks: string[];
  testCommand?: string;
  buildCommand?: string;
  entryPoints: string[];
  architecturalPatterns: string[];
}

export interface AgentInstallOptions extends AgentServiceOptions {
  dryRun?: boolean;
  force?: boolean;
}

export interface AgentInstallSummary {
  schemaVersion: string;
  generatedAt: string;
  trust: TrustMetadata;
  outputDirectory: string;
  dryRun: boolean;
  force: boolean;
  results: AgentInstallResult[];
  messages: string[];
}

export interface AgentListResult {
  templates: AgentTemplate[];
}

export interface AgentValidationFileResult {
  filePath: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface AgentValidationResult {
  ok: boolean;
  checkedPath: string;
  files: AgentValidationFileResult[];
  messages: string[];
}

interface AgentDefinition {
  id: string;
  fileName: string;
  name: string;
  description: string;
  model: string;
  tools: string[];
  handoffs?: AgentHandoffDefinition[];
  purpose: string;
  instructions: string[];
  handoffGuidance: string[];
  safetyRules: string[];
}

interface AgentHandoffDefinition {
  label: string;
  agent: string;
  prompt: string;
  send?: boolean;
}

interface AgentDoctorOptions {
  startPath?: string;
  outputPath?: string;
  nodeVersion?: string;
}

interface AdminAgentTemplate {
  id: string;
  fileName: string;
  sourcePath: string;
  contents: string;
}

const requiredSectionHeadings = [
  "## Purpose",
  "## Instructions",
  "## Handoff Guidance",
  "## Safety Rules",
  "## Copilot Architect Artifacts"
];

const agentDefinitions: AgentDefinition[] = [
  {
    id: "feature-architect",
    fileName: "FeatureArchitect.agent.md",
    name: "FeatureArchitect",
    description:
      "Analyze the repository, find similar patterns, and produce detailed implementation plans without editing code.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "search/codebase",
      "repo_map",
      "workspace_map",
      "detect_languages",
      "detect_frameworks",
      "detect_test_commands",
      "search_repo",
      "search_across_repos",
      "find_similar_feature",
      "find_impacted_files",
      "analyze_impact",
      "analyze_cross_repo_impact",
      "generate_plan_context",
      "generate_feature_plan",
      "get_safety_policy"
    ],
    handoffs: [
      {
        label: "Start Implementation",
        agent: "FeatureImplementer",
        prompt:
          "Implement the approved plan from .copilot-architect/plans/latest-plan.md. Run validation commands and summarize changed files.",
        send: false
      }
    ],
    purpose:
      "Analyze the repo, find existing patterns similar to the request, and produce a detailed implementation plan. Must not edit any code.",
    instructions: [
      "Step 1 — Call `repo_map` to understand languages, frameworks, entry points, and architectural patterns.",
      "Step 2 — Call `search_repo` with 2–3 keyword variants from the feature request to find related existing code.",
      "Step 3 — Call `find_similar_feature` to check whether the feature is already partly or fully implemented.",
      "Step 4 — Call `analyze_impact` to get a ranked list of likely impacted files before writing the plan.",
      "Step 5 — If this is a multi-repo workspace, call `analyze_cross_repo_impact` to identify cross-repo dependencies.",
      "Step 6 — Call `generate_plan_context` to assemble the full repo + search context, then call `generate_feature_plan` with approved=true.",
      "Step 7 — Present the plan with: overview, likely files with line anchors, risks, test strategy, and validation commands.",
      "Step 8 — Stop and wait for explicit human approval before handing off to FeatureImplementer."
    ],
    handoffGuidance: [
      "The plan must be specific enough that FeatureImplementer can act without guessing: exact file paths, function names, and code snippets.",
      "Point to `.copilot-architect/plans/latest-plan.md` and `.copilot-architect/plans/latest-plan.json`.",
      "If a similar feature already exists, describe it fully before proposing any new code."
    ],
    safetyRules: [
      "Do not edit any application code — planning only.",
      "Do not run mutating commands.",
      "Do not expose secrets found in repository files or logs."
    ]
  },
  {
    id: "feature-implementer",
    fileName: "FeatureImplementer.agent.md",
    name: "FeatureImplementer",
    description:
      "Implement only an approved plan with minimal scoped changes, tests, and validation evidence.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "edit",
      "search/codebase",
      "repo_map",
      "search_repo",
      "find_impacted_files",
      "get_latest_plan",
      "get_validation_commands",
      "get_safety_policy"
    ],
    handoffs: [
      {
        label: "Review Changes",
        agent: "CodeReviewer",
        prompt:
          "Review the git diff against the approved plan and latest validation report.",
        send: false
      }
    ],
    purpose:
      "Implement only an approved plan with minimal, scoped changes, tests, and captured validation evidence.",
    instructions: [
      "Step 1 — Call `get_latest_plan` and read the full plan before touching any file.",
      "Step 2 — Call `search_repo` on the exact files listed in the plan to read their current content.",
      "Step 3 — Make the smallest coherent change that satisfies the plan; do not refactor unrelated code.",
      "Step 4 — Add or update tests near the changed behavior — follow existing test file naming conventions.",
      "Step 5 — Call `get_validation_commands` to find the correct build and test commands for this repo.",
      "Step 6 — Run the validation commands and capture their output as implementation evidence.",
      "Step 7 — Report: changed files, tests added or updated, commands run, and any deviations from the plan."
    ],
    handoffGuidance: [
      "Use `.copilot-architect/handoffs/latest-handoff.md` as the implementation contract — do not deviate from it.",
      "Always report deviations explicitly, even minor ones."
    ],
    safetyRules: [
      "Do not implement scope not in the approved plan.",
      "Do not write files outside the workspace root.",
      "Do not run commands flagged as blocked by `get_safety_policy`."
    ]
  },
  {
    id: "code-reviewer",
    fileName: "CodeReviewer.agent.md",
    name: "CodeReviewer",
    description:
      "Review implementation against the approved plan and validation evidence.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "search/codebase",
      "repo_map",
      "search_repo",
      "get_latest_plan",
      "get_latest_validation",
      "get_latest_review",
      "get_safety_policy"
    ],
    handoffs: [
      {
        label: "Debug Validation Failure",
        agent: "Debugger",
        prompt:
          "Validation failed. Use .copilot-architect/runs/latest-validation.json and related logs to classify the failure and propose the smallest safe fix.",
        send: false
      }
    ],
    purpose:
      "Review the implementation diff against the approved plan. Flag unexpected scope, missing tests, validation failures, security risks, and performance regressions.",
    instructions: [
      "Step 1 — Call `get_latest_plan` and `get_latest_validation` to load the baseline.",
      "Step 2 — Read the git diff (from the handoff or via `search/codebase`) and compare it line-by-line to the plan.",
      "Step 3 — Flag: unexpected scope changes, missing or deleted tests, failing validation commands, security regressions, performance regressions.",
      "Step 4 — For each finding include: file path, line number if available, severity (blocking / advisory), and specific remediation.",
      "Step 5 — Separate blocking findings (must fix before merge) from advisory findings (follow-up tickets).",
      "Step 6 — If validation failed, hand off to Debugger with the exact failing command and output."
    ],
    handoffGuidance: [
      "Generate or update `.copilot-architect/reviews/latest-review.md` with structured findings.",
      "Separate blocking from advisory findings — the handoff must make this distinction explicit."
    ],
    safetyRules: [
      "Do not rewrite the implementation during review — findings only.",
      "Do not approve unexpected scope without explicit human confirmation.",
      "Do not ignore validation failures, even if they appear unrelated."
    ]
  },
  {
    id: "test-planner",
    fileName: "TestPlanner.agent.md",
    name: "TestPlanner",
    description: "Identify the test coverage needed for a feature and attach guidance to the implementation plan.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "search/codebase",
      "repo_map",
      "detect_test_commands",
      "search_repo",
      "find_impacted_files",
      "get_latest_plan",
      "get_validation_commands"
    ],
    purpose: "Identify what test coverage is required for a feature and produce actionable test guidance.",
    instructions: [
      "Step 1 — Call `repo_map` and `detect_test_commands` to understand the test framework and existing patterns.",
      "Step 2 — Call `search_repo` with 'test', 'spec', or '__tests__' plus the feature keywords to find existing test patterns.",
      "Step 3 — Call `find_impacted_files` to identify which behaviours need test coverage.",
      "Step 4 — Map each impacted behaviour to: unit tests, integration tests, end-to-end tests, and regression tests.",
      "Step 5 — Identify gaps: missing test infrastructure, coverage holes, or missing mock fixtures.",
      "Step 6 — Output a test plan: for each test, state the file path, test name, what it validates, and the command to run it."
    ],
    handoffGuidance: [
      "Attach test guidance as a section in the implementation plan or handoff.",
      "Flag missing test infrastructure as a plan risk with a suggested mitigation."
    ],
    safetyRules: [
      "Do not edit code while planning tests — guidance only.",
      "Do not invent test results or claim coverage that hasn't been verified.",
      "Do not recommend unsafe or destructive test commands."
    ]
  },
  {
    id: "debugger",
    fileName: "Debugger.agent.md",
    name: "Debugger",
    description: "Analyze build, test, lint, and format failures and propose the smallest safe fix.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "edit",
      "search/codebase",
      "repo_map",
      "search_repo",
      "get_latest_validation",
      "get_safety_policy"
    ],
    purpose: "Classify build/test/lint failures from validation output and propose the smallest correct fix.",
    instructions: [
      "Step 1 — Call `get_latest_validation` to load the failing run: command, exit code, stdout, stderr.",
      "Step 2 — Classify the failure type: compile error | test assertion | lint rule | missing dependency | environment.",
      "Step 3 — Call `search_repo` on the failing file or symbol to read the relevant source.",
      "Step 4 — Identify root cause before proposing any fix — do not guess.",
      "Step 5 — Propose the smallest change that fixes the root cause without masking the symptom.",
      "Step 6 — State the exact validation command that should pass after the fix is applied."
    ],
    handoffGuidance: [
      "Return a structured fix prompt: failing command + error message + root cause + files to change + fix.",
      "Preserve all evidence paths so the next agent can resume from the same failure state."
    ],
    safetyRules: [
      "Do not mask failures by deleting or skipping tests.",
      "Do not loosen lint rules or type-checking without explicit approval.",
      "Do not run destructive cleanup commands such as `--force` or `--no-verify`."
    ]
  },
  {
    id: "security-reviewer",
    fileName: "SecurityReviewer.agent.md",
    name: "SecurityReviewer",
    description: "Review code changes for authentication, authorization, input validation, and secrets handling.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "search/codebase",
      "repo_map",
      "search_repo",
      "get_latest_plan",
      "get_latest_review",
      "get_safety_policy"
    ],
    purpose: "Review changed code for security regressions: auth, input handling, secrets, logging, and data access.",
    instructions: [
      "Step 1 — Call `search_repo` with 'auth', 'login', 'token', 'secret', 'password', 'permission', 'role' to map security-sensitive areas.",
      "Step 2 — Read the changed files and compare their auth/authz logic to existing patterns.",
      "Step 3 — Check for: SQL/command injection, missing input validation, secrets in logs, hardcoded credentials, broken access control.",
      "Step 4 — Check that new endpoints or functions follow the existing auth middleware chain.",
      "Step 5 — Verify that logs and artifact files do not contain tokens, passwords, or PII.",
      "Step 6 — Rate each finding: Critical (exploitable now) | High (likely exploitable) | Medium (hardening) | Low (informational)."
    ],
    handoffGuidance: [
      "Attach security findings to the review report, rated by severity.",
      "State explicitly when no security-sensitive code paths appear to be changed."
    ],
    safetyRules: [
      "Do not print or log secrets, tokens, or credentials.",
      "Do not suggest weakening authentication, input validation, or audit behaviour.",
      "Do not ignore transitive dependency risks."
    ]
  },
  {
    id: "performance-reviewer",
    fileName: "PerformanceReviewer.agent.md",
    name: "PerformanceReviewer",
    description: "Review code changes for performance regressions in loops, queries, rendering, and caching.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "search/codebase",
      "repo_map",
      "search_repo",
      "get_latest_plan",
      "get_latest_review"
    ],
    purpose: "Identify plausible performance regressions in changed code without speculative rewrites.",
    instructions: [
      "Step 1 — Call `search_repo` with 'loop', 'query', 'fetch', 'cache', 'render', 'batch' to find performance-sensitive patterns near the change.",
      "Step 2 — Read the changed functions and compare algorithmic complexity to existing equivalent code.",
      "Step 3 — Flag: O(n²) loops replacing O(n), N+1 query patterns, missing pagination, synchronous blocking in async paths, large in-memory collections.",
      "Step 4 — For each finding, estimate impact (high/medium/low) and suggest a measurement command or benchmark.",
      "Step 5 — Compare to existing patterns in nearby files — prefer local style over generic advice."
    ],
    handoffGuidance: [
      "Attach performance risks to the review report with impact ratings and suggested measurements.",
      "Avoid speculative claims — every finding must have a concrete code path as evidence."
    ],
    safetyRules: [
      "Do not propose broad rewrites without measured evidence of regression.",
      "Do not trade correctness or security for performance without explicit approval.",
      "Do not ignore failing validation when assessing performance."
    ]
  },
  {
    id: "documentation-writer",
    fileName: "DocumentationWriter.agent.md",
    name: "DocumentationWriter",
    description: "Generate or update README, API docs, inline docstrings, and architecture notes for a feature.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "edit",
      "search/codebase",
      "repo_map",
      "search_repo",
      "find_impacted_files",
      "get_latest_plan"
    ],
    purpose: "Produce accurate, repo-aware documentation for new or changed features following the existing style.",
    instructions: [
      "Step 1 — Call `repo_map` to understand the existing README structure, doc folders, and documentation conventions.",
      "Step 2 — Call `get_latest_plan` to understand what was built or changed.",
      "Step 3 — Call `search_repo` with 'README', 'docs', 'docstring', 'JSDoc', '\"\"\"' to find existing documentation patterns.",
      "Step 4 — Match the existing documentation style: naming conventions, heading levels, code example format.",
      "Step 5 — Update or create: README usage sections, JSDoc / docstring comments on exported symbols, API endpoint docs, architecture decision notes.",
      "Step 6 — Do not document internal implementation details — focus on public API, usage examples, and configuration."
    ],
    handoffGuidance: [
      "List every file that was created or modified with a one-line summary of what changed.",
      "Reference the plan artifact to confirm docs match the implementation."
    ],
    safetyRules: [
      "Do not expose internal secrets, tokens, or credentials in any documentation.",
      "Do not overwrite existing documentation without reading and preserving its intent.",
      "Do not invent API behaviour that is not present in the code."
    ]
  },
  {
    id: "dependency-auditor",
    fileName: "DependencyAuditor.agent.md",
    name: "DependencyAuditor",
    description: "Audit project dependencies for outdated packages, known CVEs, and licensing issues.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "search/codebase",
      "repo_map",
      "detect_package_managers",
      "detect_languages",
      "search_repo",
      "get_validation_commands"
    ],
    purpose: "Identify outdated, vulnerable, or non-permissively licensed dependencies across the project.",
    instructions: [
      "Step 1 — Call `detect_package_managers` and `detect_languages` to identify which manifests to audit.",
      "Step 2 — Call `repo_map` and `search_repo` with 'package.json', 'requirements.txt', 'pom.xml', 'Gemfile', 'go.mod' to find all dependency manifests.",
      "Step 3 — Read each manifest and list direct dependencies with their declared versions.",
      "Step 4 — Flag: (a) known CVEs based on version ranges, (b) packages with no releases in over 2 years, (c) packages with non-permissive licenses (GPL, AGPL, SSPL) when the project is not open-source.",
      "Step 5 — For each flagged dependency suggest: the latest stable version, whether the upgrade is a drop-in replacement, and any breaking-change migration notes.",
      "Step 6 — Produce a prioritised report: Critical (CVE) → Major (breaking upgrade) → Minor (maintenance)."
    ],
    handoffGuidance: [
      "Output a structured table: package | current version | recommended version | reason | breaking changes.",
      "Note which upgrades require code changes vs. version-bump-only changes."
    ],
    safetyRules: [
      "Do not install, update, or remove packages without explicit human approval.",
      "Do not suggest removing security-relevant packages (auth, crypto, validation).",
      "Do not run audit commands that make external network requests without approval."
    ]
  },
  {
    id: "api-design-reviewer",
    fileName: "APIDesignReviewer.agent.md",
    name: "APIDesignReviewer",
    description: "Review REST or GraphQL API design for naming consistency, breaking changes, auth coverage, and contract completeness.",
    model: "gpt-4o",
    tools: [
      "copilotArchitect/*",
      "search/codebase",
      "repo_map",
      "search_repo",
      "find_impacted_files",
      "get_latest_plan",
      "get_safety_policy"
    ],
    purpose: "Review proposed API changes for consistency with existing contracts, correct HTTP semantics, versioning, and security coverage.",
    instructions: [
      "Step 1 — Call `search_repo` with 'router', 'controller', 'route', 'endpoint', 'resolver', 'handler' to map the existing API surface.",
      "Step 2 — Call `get_latest_plan` to understand what API additions or changes are proposed.",
      "Step 3 — Check naming consistency: HTTP verbs (GET=read, POST=create, PUT/PATCH=update, DELETE=remove), URL style (kebab-case vs camelCase), response envelope shape.",
      "Step 4 — Flag breaking changes: removed fields, renamed endpoints, changed status codes, altered request shapes.",
      "Step 5 — Verify that new endpoints follow the existing authentication and authorization middleware chain.",
      "Step 6 — Check that new endpoints have corresponding request validation, error responses (4xx shapes), and documentation."
    ],
    handoffGuidance: [
      "Produce a structured report: breaking changes | naming inconsistencies | missing auth | missing validation | docs gaps.",
      "For each breaking change state the migration path for existing callers."
    ],
    safetyRules: [
      "Do not modify API code during review — findings only.",
      "Do not approve unauthenticated endpoints when existing patterns require authentication.",
      "Do not ignore versioning implications for externally consumed APIs."
    ]
  }
];

export class AgentService {
  list(): AgentListResult {
    return { templates: agentDefinitions.map(toTemplate) };
  }

  async install(options: AgentInstallOptions = {}): Promise<AgentInstallSummary> {
    return this.writeAgents(options);
  }

  async update(options: AgentInstallOptions = {}): Promise<AgentInstallSummary> {
    return this.writeAgents({ ...options, force: true });
  }

  async validate(options: AgentServiceOptions = {}): Promise<AgentValidationResult> {
    const checkedPath = resolveOutputDirectory(options);
    const files = await findAgentFiles(checkedPath);

    if (files.length === 0) {
      return {
        ok: false,
        checkedPath,
        files: [],
        messages: ["No agent files found. Run agents install first."]
      };
    }

    const results = await Promise.all(
      files.map(async (filePath) => validateAgentFile(filePath))
    );

    return {
      ok: results.every((result) => result.ok),
      checkedPath,
      files: results,
      messages: [
        `Checked ${results.length} agent file(s).`,
        `${results.filter((result) => result.ok).length} valid, ${results.filter((result) => !result.ok).length} invalid.`
      ]
    };
  }

  doctor(input: string | AgentDoctorOptions = {}): DiagnosticReport {
    const options: AgentDoctorOptions =
      typeof input === "string" ? { nodeVersion: input } : input;
    const nodeVersion = options.nodeVersion ?? process.version;
    const outputDirectory = resolveOutputDirectory(options);
    const agentReadiness = inspectAgentDirectory(outputDirectory);
    const mcpReadiness = inspectMcpConfig(resolveStartPath(options.startPath));
    const status =
      agentReadiness.status === "error" || mcpReadiness.status === "error"
        ? "error"
        : agentReadiness.status === "warning" || mcpReadiness.status === "warning"
          ? "warning"
          : "ok";

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      id: "agents-doctor",
      status,
      summary:
        "Use @FeatureArchitect for planning, @FeatureImplementer for approved implementation, @CodeReviewer for review, and @Debugger when validation fails.",
      environment: {
        nodeVersion,
        packageManager: "npm",
        platform: process.platform
      },
      checks: [
        {
          name: "@FeatureArchitect",
          status: "ok",
          message:
            "Ask for repo analysis and implementation plans. This agent must not edit code."
        },
        {
          name: "@FeatureImplementer",
          status: "ok",
          message: "Use only after plan approval and handoff generation."
        },
        {
          name: "@CodeReviewer",
          status: "ok",
          message: "Use after implementation and validation evidence are available."
        },
        {
          name: "@Debugger",
          status: "ok",
          message:
            "Use when latest validation failed and a focused fix prompt is needed."
        },
        {
          name: "agent-files",
          status: agentReadiness.status,
          message: agentReadiness.message
        },
        {
          name: "mcp-config",
          status: mcpReadiness.status,
          message: mcpReadiness.message
        },
        {
          name: "mcp-command",
          status: "ok",
          message:
            "Start the local MCP server with `npm run cli -- mcp`; configure Copilot Chat with `.vscode/mcp.json`."
        }
      ],
      artifactRoot: ".github/agents"
    };
  }

  private async writeAgents(
    options: AgentInstallOptions
  ): Promise<AgentInstallSummary> {
    const repoRoot = resolveStartPath(options.startPath);
    const outputDirectory = resolveOutputDirectory(options);
    const results: AgentInstallResult[] = [];
    const repoContext = await loadRepoContext(repoRoot);

    if (!options.dryRun) {
      await mkdir(outputDirectory, { recursive: true });
    }

    for (const definition of agentDefinitions) {
      const installPath = path.join(outputDirectory, definition.fileName);
      const exists = await pathExists(installPath);
      const messages: string[] = [];

      if (options.dryRun) {
        results.push(
          createInstallResult(definition, {
            status:
              exists && !options.force ? "skipped" : exists ? "updated" : "installed",
            installPath,
            messages: [
              `Dry run: ${exists ? "would update" : "would install"} ${definition.fileName}.`
            ]
          })
        );
        continue;
      }

      if (exists && !options.force) {
        results.push(
          createInstallResult(definition, {
            status: "skipped",
            installPath,
            messages: [
              `${definition.fileName} already exists. Re-run with --force or agents update to overwrite with backup.`
            ]
          })
        );
        continue;
      }

      const backupPath = exists ? await backupFile(installPath) : undefined;

      if (backupPath) {
        messages.push(`Backed up existing file to ${backupPath}.`);
      }

      const contents = renderAgent(definition, repoContext);
      const validation = validateAgentText(installPath, contents);

      if (!validation.ok) {
        results.push(
          createInstallResult(definition, {
            status: "failed",
            installPath,
            backupPath,
            messages: validation.errors
          })
        );
        continue;
      }

      await writeFile(installPath, contents, "utf8");
      messages.push(`${exists ? "Updated" : "Installed"} ${definition.fileName}.`);
      results.push(
        createInstallResult(definition, {
          status: exists ? "updated" : "installed",
          installPath,
          backupPath,
          messages
        })
      );
    }

    const adminTemplates = await loadAdminAgentTemplates(repoRoot);

    for (const template of adminTemplates) {
      results.push(await writeAdminAgentTemplate(outputDirectory, template, options));
    }

    const summary: AgentInstallSummary = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      trust: createTrustMetadata({
        artifactKind: "agent-install-summary",
        source: outputDirectory
      }),
      outputDirectory,
      dryRun: options.dryRun ?? false,
      force: options.force ?? false,
      results,
      messages: [
        `${results.length} agent template(s) processed.`,
        "Use agents validate to verify generated frontmatter and required sections."
      ]
    };

    if (!options.dryRun) {
      await writeJsonFile(path.join(outputDirectory, "install-result.json"), summary);
    }

    return summary;
  }
}

function toTemplate(definition: AgentDefinition): AgentTemplate {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    trust: createTrustMetadata({
      artifactKind: "agent-template",
      source: definition.fileName
    }),
    id: definition.id,
    name: definition.name,
    description: definition.description,
    target: "copilot",
    instructionsMarkdown: renderAgent(definition),
    tools: definition.tools,
    metadata: {
      fileName: definition.fileName,
      model: definition.model
    }
  };
}

function createInstallResult(
  definition: AgentDefinition,
  input: {
    status: AgentInstallResult["status"];
    installPath: string;
    backupPath?: string;
    messages: string[];
  }
): AgentInstallResult {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    trust: createTrustMetadata({
      artifactKind: "agent-install-result",
      source: input.installPath
    }),
    agentId: definition.id,
    status: input.status,
    installPath: input.installPath,
    backupPath: input.backupPath,
    messages: input.messages
  };
}

function renderAgent(
  definition: AgentDefinition,
  repoContext?: RepoContextSnippet
): string {
  const trust = createTrustMetadata({
    artifactKind: "copilot-agent",
    source: definition.fileName
  });

  const repoContextLines: string[] = [];
  if (repoContext) {
    repoContextLines.push(
      "## Repo Context",
      "",
      "This section is auto-generated from `.copilot-architect/repo-map.json` at install time.",
      "",
      ...(repoContext.languages.length > 0
        ? [`- **Languages:** ${repoContext.languages.join(", ")}`]
        : []),
      ...(repoContext.frameworks.length > 0
        ? [`- **Frameworks:** ${repoContext.frameworks.join(", ")}`]
        : []),
      ...(repoContext.testCommand ? [`- **Test command:** \`${repoContext.testCommand}\``] : []),
      ...(repoContext.buildCommand ? [`- **Build command:** \`${repoContext.buildCommand}\``] : []),
      ...(repoContext.entryPoints.length > 0
        ? [`- **Entry points:** ${repoContext.entryPoints.join(", ")}`]
        : []),
      ...(repoContext.architecturalPatterns.length > 0
        ? [`- **Architecture:** ${repoContext.architecturalPatterns.join(", ")}`]
        : []),
      ""
    );
  }

  return [
    "---",
    `name: ${definition.name}`,
    `description: ${definition.description}`,
    `model: ${definition.model}`,
    "tools:",
    ...definition.tools.map((tool) => `  - ${tool}`),
    ...(definition.handoffs?.length
      ? [
          "handoffs:",
          ...definition.handoffs.flatMap((handoff) => [
            `  - label: ${handoff.label}`,
            `    agent: ${handoff.agent}`,
            `    prompt: ${JSON.stringify(handoff.prompt)}`,
            `    send: ${handoff.send === true ? "true" : "false"}`
          ])
        ]
      : []),
    "---",
    "",
    `# ${definition.name}`,
    "",
    "## Purpose",
    "",
    definition.purpose,
    "",
    ...repoContextLines,
    "## Instructions",
    "",
    ...definition.instructions.map((instruction) => `- ${instruction}`),
    "",
    "## Handoff Guidance",
    "",
    ...definition.handoffGuidance.map((guidance) => `- ${guidance}`),
    "",
    "## Copilot Chat Prompts",
    "",
    ...chatPromptExamples(definition).map((prompt) => `- ${prompt}`),
    "",
    "## Safety Rules",
    "",
    ...definition.safetyRules.map((rule) => `- ${rule}`),
    "",
    "## Trust Metadata",
    "",
    `- Generated by: ${trust.generatedBy}`,
    `- Policy: ${trust.policyId}`,
    `- Local only: ${trust.localOnly ? "yes" : "no"}`,
    `- Telemetry enabled: ${trust.telemetryEnabled ? "yes" : "no"}`,
    "",
    "## Copilot Architect Artifacts",
    "",
    "- `.copilot-architect/repo-map.json`",
    "- `.copilot-architect/workspace.json`",
    "- `.copilot-architect/index/`",
    "- `.copilot-architect/plans/latest-plan.md`",
    "- `.copilot-architect/handoffs/latest-handoff.md`",
    "- `.copilot-architect/runs/latest-validation.json`",
    "- `.copilot-architect/reviews/latest-review.md`"
  ].join("\n");
}

async function findAgentFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".agent.md"))
      .map((entry) => path.join(directory, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function validateAgentFile(filePath: string): Promise<AgentValidationFileResult> {
  try {
    return validateAgentText(filePath, await readFile(filePath, "utf8"));
  } catch (error) {
    return {
      filePath,
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

function validateAgentText(filePath: string, text: string): AgentValidationFileResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const frontmatter = parseFrontmatter(text);

  if (!frontmatter) {
    errors.push("Missing YAML frontmatter block.");
  } else {
    for (const key of ["name", "description", "model", "tools"]) {
      if (!frontmatter.includes(`${key}:`)) {
        errors.push(`Frontmatter missing ${key}.`);
      }
    }
  }

  for (const heading of requiredSectionHeadings) {
    if (!text.includes(heading)) {
      errors.push(`Missing required section ${heading}.`);
    }
  }

  if (!text.includes(".copilot-architect/")) {
    errors.push("Missing references to .copilot-architect artifacts.");
  }

  if (
    path.basename(filePath) === "FeatureArchitect.agent.md" &&
    !text.includes("agent: FeatureImplementer")
  ) {
    errors.push("FeatureArchitect must hand off to FeatureImplementer.");
  }

  if (
    path.basename(filePath) === "FeatureImplementer.agent.md" &&
    !text.includes("agent: CodeReviewer")
  ) {
    errors.push("FeatureImplementer must hand off to CodeReviewer.");
  }

  if (
    path.basename(filePath) === "CodeReviewer.agent.md" &&
    !text.includes("agent: Debugger")
  ) {
    errors.push("CodeReviewer must hand off to Debugger for validation failures.");
  }

  if (!text.includes("## Trust Metadata")) {
    warnings.push("Agent file should include trust metadata for generated content.");
  }

  if (!path.basename(filePath).endsWith(".agent.md")) {
    warnings.push("Agent file should use the .agent.md suffix.");
  }

  return {
    filePath,
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function parseFrontmatter(text: string): string | undefined {
  if (!text.startsWith("---\n")) {
    return undefined;
  }

  const endIndex = text.indexOf("\n---", 4);
  return endIndex === -1 ? undefined : text.slice(4, endIndex);
}

function chatPromptExamples(definition: AgentDefinition): string[] {
  const examples: Record<string, string> = {
    FeatureArchitect:
      "@FeatureArchitect I want to add [describe feature]. Call repo_map and find_similar_feature first, then produce a detailed implementation plan with impacted files and test strategy. Do not modify any code yet.",
    FeatureImplementer:
      "@FeatureImplementer Implement the approved plan from .copilot-architect/plans/latest-plan.md. Call get_latest_plan, make the minimal scoped change, add tests, then run get_validation_commands and capture evidence.",
    CodeReviewer:
      "@CodeReviewer Review the implementation diff against the approved plan. Call get_latest_plan and get_latest_validation, then report blocking findings and advisory findings separately.",
    TestPlanner:
      "@TestPlanner Plan test coverage for [feature]. Call detect_test_commands and find_impacted_files, then produce a test plan with file paths, test names, and the command to run each test.",
    Debugger:
      "@Debugger The last validation run failed. Call get_latest_validation to load the failing output, classify the failure, find the root cause with search_repo, and propose the smallest fix.",
    SecurityReviewer:
      "@SecurityReviewer Review the recent changes for security regressions. Call search_repo with auth-related keywords, then rate each finding as Critical / High / Medium / Low.",
    PerformanceReviewer:
      "@PerformanceReviewer Review the recent changes for performance regressions. Call search_repo with loop and query keywords, then rate each finding by impact and suggest a benchmark.",
    DocumentationWriter:
      "@DocumentationWriter Update the documentation for [feature]. Call repo_map and get_latest_plan, match the existing docs style, then update the README and add JSDoc comments to any new exported symbols.",
    DependencyAuditor:
      "@DependencyAuditor Audit project dependencies. Call detect_package_managers, find all manifests, and produce a prioritised table: package | current version | recommended version | reason | breaking changes.",
    APIDesignReviewer:
      "@APIDesignReviewer Review the proposed API changes. Call search_repo to map the existing API surface, compare it to get_latest_plan, and report breaking changes, naming inconsistencies, and missing auth coverage."
  };

  const example = examples[definition.name];
  return example ? [`\`${example}\``] : [`\`@${definition.name} Use Copilot Architect MCP tools for this repo-aware workflow.\``];
}

function inspectAgentDirectory(directory: string): {
  status: "ok" | "warning" | "error";
  message: string;
} {
  try {
    const files = readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".agent.md"))
      .map((fileName) => path.join(directory, fileName));

    if (files.length === 0) {
      return {
        status: "warning",
        message: "No .agent.md files found. Run `npm run cli -- agents install`."
      };
    }

    const invalid = files
      .map((filePath) => validateAgentText(filePath, readFileSync(filePath, "utf8")))
      .filter((result) => !result.ok);

    if (invalid.length > 0) {
      return {
        status: "error",
        message: `${invalid.length} invalid agent file(s) found under ${directory}.`
      };
    }

    return {
      status: "ok",
      message: `Found ${files.length} valid Copilot agent file(s) under ${directory}.`
    };
  } catch {
    return {
      status: "warning",
      message: "Agent directory is missing. Run `npm run cli -- agents install`."
    };
  }
}

function inspectMcpConfig(repoRoot: string): {
  status: "ok" | "warning" | "error";
  message: string;
} {
  const configPath = path.join(repoRoot, ".vscode", "mcp.json");

  if (!existsSync(configPath)) {
    return {
      status: "warning",
      message:
        "Copilot Chat MCP config is missing. Run `npm run cli -- mcp config --path <repo>`."
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      servers?: Record<string, { type?: string; command?: string; args?: string[] }>;
    };
    const server = parsed.servers?.copilotArchitect;

    if (!server) {
      return {
        status: "warning",
        message: "MCP config exists but does not include the copilotArchitect server."
      };
    }

    if (server.type !== "stdio" || !server.command || !Array.isArray(server.args)) {
      return {
        status: "error",
        message:
          "copilotArchitect MCP server config must use stdio with command and args."
      };
    }

    return {
      status: "ok",
      message: "Copilot Chat MCP config includes a copilotArchitect stdio server."
    };
  } catch (error) {
    return {
      status: "error",
      message: `Unable to parse .vscode/mcp.json: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function backupFile(filePath: string): Promise<string> {
  const backupPath = `${filePath}.${timestampId()}.bak`;
  await writeFile(backupPath, await readFile(filePath, "utf8"), "utf8");
  return backupPath;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveOutputDirectory(options: AgentServiceOptions): string {
  const repoRoot = resolveStartPath(options.startPath);

  if (options.outputPath) {
    return path.isAbsolute(options.outputPath)
      ? options.outputPath
      : path.resolve(repoRoot, options.outputPath);
  }

  return path.join(repoRoot, ".github", "agents");
}

function resolveStartPath(startPath?: string): string {
  return path.resolve(startPath ?? process.cwd());
}

async function loadAdminAgentTemplates(
  repoRoot: string
): Promise<AdminAgentTemplate[]> {
  const policy = await tryReadPolicy(repoRoot);
  const templatePaths = policy?.adminAgentTemplatePaths ?? [
    "templates/agents",
    ".copilot-architect/agent-templates"
  ];
  const templates: AdminAgentTemplate[] = [];

  for (const templatePath of templatePaths) {
    const directoryPath = path.isAbsolute(templatePath)
      ? templatePath
      : path.resolve(repoRoot, templatePath);
    const files = await findAgentFiles(directoryPath);

    for (const filePath of files) {
      templates.push({
        id: `admin-${path.basename(filePath, ".agent.md")}`,
        fileName: path.basename(filePath),
        sourcePath: filePath,
        contents: await readFile(filePath, "utf8")
      });
    }
  }

  return templates;
}

async function loadRepoContext(
  repoRoot: string
): Promise<RepoContextSnippet | undefined> {
  try {
    const raw = await readJsonFile<Record<string, unknown>>(
      path.join(repoRoot, ".copilot-architect", "repo-map.json")
    );

    const asStrings = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

    const asString = (v: unknown): string | undefined =>
      typeof v === "string" && v.length > 0 ? v : undefined;

    const testCommands = asStrings(raw["testCommands"]);
    const buildCommands = asStrings(raw["buildCommands"]);

    return {
      languages: asStrings(raw["languages"]),
      frameworks: asStrings(raw["frameworks"]),
      testCommand: testCommands[0] ?? asString(raw["testCommand"]),
      buildCommand: buildCommands[0] ?? asString(raw["buildCommand"]),
      entryPoints: asStrings(raw["entryPoints"]),
      architecturalPatterns: asStrings(raw["architecturalPatterns"])
    };
  } catch {
    return undefined;
  }
}

async function tryReadPolicy(repoRoot: string): Promise<SafetyPolicy | undefined> {
  try {
    return await readJsonFile<SafetyPolicy>(getArtifactFilePath(repoRoot, "policy"));
  } catch {
    return undefined;
  }
}

async function writeAdminAgentTemplate(
  outputDirectory: string,
  template: AdminAgentTemplate,
  options: AgentInstallOptions
): Promise<AgentInstallResult> {
  const installPath = path.join(outputDirectory, template.fileName);
  const exists = await pathExists(installPath);

  if (options.dryRun) {
    return createAdminInstallResult(template, {
      status: exists && !options.force ? "skipped" : exists ? "updated" : "installed",
      installPath,
      messages: [
        `Dry run: ${exists ? "would update" : "would install"} admin template ${template.fileName}.`
      ]
    });
  }

  if (exists && !options.force) {
    return createAdminInstallResult(template, {
      status: "skipped",
      installPath,
      messages: [
        `${template.fileName} already exists. Re-run with --force or agents update to overwrite with backup.`
      ]
    });
  }

  const backupPath = exists ? await backupFile(installPath) : undefined;
  const validation = validateAgentText(installPath, template.contents);

  if (!validation.ok) {
    return createAdminInstallResult(template, {
      status: "failed",
      installPath,
      backupPath,
      messages: validation.errors
    });
  }

  await writeFile(installPath, template.contents, "utf8");

  return createAdminInstallResult(template, {
    status: exists ? "updated" : "installed",
    installPath,
    backupPath,
    messages: [
      `${exists ? "Updated" : "Installed"} admin template ${template.fileName} from ${template.sourcePath}.`
    ]
  });
}

function createAdminInstallResult(
  template: AdminAgentTemplate,
  input: {
    status: AgentInstallResult["status"];
    installPath: string;
    backupPath?: string;
    messages: string[];
  }
): AgentInstallResult {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    trust: createTrustMetadata({
      artifactKind: "admin-agent-install-result",
      source: template.sourcePath
    }),
    agentId: template.id,
    status: input.status,
    installPath: input.installPath,
    backupPath: input.backupPath,
    messages: input.messages
  };
}

function timestampId(): string {
  return new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
}
