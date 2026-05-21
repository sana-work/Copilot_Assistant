import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CURRENT_SCHEMA_VERSION,
  type AgentInstallResult,
  type AgentTemplate,
  type DiagnosticReport,
  writeJsonFile
} from "@copilot-architect/shared";

export interface AgentServiceOptions {
  startPath?: string;
  outputPath?: string;
}

export interface AgentInstallOptions extends AgentServiceOptions {
  dryRun?: boolean;
  force?: boolean;
}

export interface AgentInstallSummary {
  schemaVersion: string;
  generatedAt: string;
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
  purpose: string;
  instructions: string[];
  handoffGuidance: string[];
  safetyRules: string[];
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
    model: "gpt-5.2",
    tools: [
      "repo_map",
      "workspace_map",
      "search_repo",
      "find_similar_feature",
      "generate_plan_context"
    ],
    purpose:
      "Analyze the repo, understand the request, find similar patterns, and produce detailed implementation plans. Must not edit code.",
    instructions: [
      "Start by reading repo-map, workspace, index, and plan artifacts when available.",
      "Use local search to identify similar feature patterns before proposing changes.",
      "Produce an implementation plan with likely files, risks, test strategy, and validation commands.",
      "Stop for human approval before any implementation handoff."
    ],
    handoffGuidance: [
      "Write plans that a FeatureImplementer can follow without guessing.",
      "Point to `.copilot-architect/plans/latest-plan.json` and `.copilot-architect/plans/latest-plan.md` when a plan is generated."
    ],
    safetyRules: [
      "Do not edit application code.",
      "Do not run mutating commands.",
      "Do not expose secrets from repository files or logs."
    ]
  },
  {
    id: "feature-implementer",
    fileName: "FeatureImplementer.agent.md",
    name: "FeatureImplementer",
    description:
      "Implement only an approved plan with minimal scoped changes, tests, and validation evidence.",
    model: "gpt-5.2",
    tools: [
      "repo_map",
      "search_repo",
      "get_latest_plan",
      "get_validation_commands",
      "get_safety_policy"
    ],
    purpose:
      "Implement only an approved plan. Must keep changes minimal, update tests, and run validation.",
    instructions: [
      "Read the approved plan and handoff before editing.",
      "Make the smallest coherent change that satisfies the plan.",
      "Update or add tests near the changed behavior.",
      "Run requested validation commands and capture evidence."
    ],
    handoffGuidance: [
      "Use `.copilot-architect/handoffs/latest-handoff.md` as the implementation contract.",
      "Report changed files, tests added, commands run, and any deviations from the plan."
    ],
    safetyRules: [
      "Do not implement unapproved scope.",
      "Do not write outside the workspace root.",
      "Do not run blocked or destructive commands."
    ]
  },
  {
    id: "code-reviewer",
    fileName: "CodeReviewer.agent.md",
    name: "CodeReviewer",
    description:
      "Review implementation against the approved plan and validation evidence.",
    model: "gpt-5.2",
    tools: [
      "get_latest_plan",
      "get_latest_validation",
      "get_latest_review",
      "repo_map"
    ],
    purpose:
      "Review implementation against approved plan. Must flag unexpected changes, missing tests, validation failures, security risks, and performance risks.",
    instructions: [
      "Compare the git diff to the approved plan and handoff.",
      "Prioritize bugs, behavioral regressions, missing tests, safety issues, and validation failures.",
      "Keep findings actionable with file paths and concise rationale."
    ],
    handoffGuidance: [
      "Generate or reference `.copilot-architect/reviews/latest-review.md`.",
      "Separate blocking findings from follow-up observations."
    ],
    safetyRules: [
      "Do not rewrite the implementation during review.",
      "Do not ignore validation failures.",
      "Do not approve unexpected scope without explicit human confirmation."
    ]
  },
  {
    id: "test-planner",
    fileName: "TestPlanner.agent.md",
    name: "TestPlanner",
    description: "Identify the test coverage needed for a feature.",
    model: "gpt-5.2",
    tools: [
      "repo_map",
      "search_repo",
      "find_impacted_files",
      "get_validation_commands"
    ],
    purpose: "Identify test coverage needed for a feature.",
    instructions: [
      "Map the requested behavior to existing test patterns.",
      "Identify unit, integration, end-to-end, and regression tests where relevant.",
      "Recommend validation commands that provide useful evidence."
    ],
    handoffGuidance: [
      "Attach test guidance to the implementation plan or handoff.",
      "Call out missing test infrastructure as a plan risk."
    ],
    safetyRules: [
      "Do not edit code while planning tests.",
      "Do not invent validation evidence.",
      "Do not recommend unsafe commands."
    ]
  },
  {
    id: "debugger",
    fileName: "Debugger.agent.md",
    name: "Debugger",
    description: "Analyze build, test, lint, and format failures and propose fixes.",
    model: "gpt-5.2",
    tools: ["get_latest_validation", "search_repo", "repo_map", "get_safety_policy"],
    purpose: "Analyze build/test/lint failures and propose fixes.",
    instructions: [
      "Start from `.copilot-architect/runs/latest-validation.json` and related logs.",
      "Classify failures before proposing code changes.",
      "Suggest the smallest fix and the validation command that should pass afterward."
    ],
    handoffGuidance: [
      "Return a concise fix prompt with failing command, likely root cause, and files to inspect.",
      "Preserve evidence paths so another agent can continue from the same failure."
    ],
    safetyRules: [
      "Do not mask failures by deleting tests.",
      "Do not loosen validation without approval.",
      "Do not run destructive cleanup commands."
    ]
  },
  {
    id: "security-reviewer",
    fileName: "SecurityReviewer.agent.md",
    name: "SecurityReviewer",
    description: "Review code changes for security issues.",
    model: "gpt-5.2",
    tools: ["repo_map", "get_latest_plan", "get_latest_review", "search_repo"],
    purpose: "Review code changes for security issues.",
    instructions: [
      "Inspect changed authentication, authorization, input handling, secrets, logging, and data access behavior.",
      "Flag security regressions with impact and mitigation.",
      "Check that logs and artifacts do not expose secrets."
    ],
    handoffGuidance: [
      "Attach security findings to the review report.",
      "State when no security-sensitive files or flows appear to be changed."
    ],
    safetyRules: [
      "Do not print secrets.",
      "Do not suggest weakening auth, validation, or audit behavior.",
      "Do not ignore dependency or configuration risk."
    ]
  },
  {
    id: "performance-reviewer",
    fileName: "PerformanceReviewer.agent.md",
    name: "PerformanceReviewer",
    description: "Review potential performance risks in code changes.",
    model: "gpt-5.2",
    tools: ["repo_map", "get_latest_plan", "get_latest_review", "search_repo"],
    purpose: "Review potential performance risks.",
    instructions: [
      "Look for changed loops, queries, network calls, rendering paths, caching, and large file operations.",
      "Compare changes to existing patterns in nearby code.",
      "Recommend focused measurement or validation where risk is plausible."
    ],
    handoffGuidance: [
      "Attach performance risks and suggested measurements to the review report.",
      "Avoid speculative performance claims without a concrete code path."
    ],
    safetyRules: [
      "Do not propose broad rewrites without evidence.",
      "Do not trade correctness or security for speed without approval.",
      "Do not ignore validation failures."
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

  doctor(nodeVersion = process.version): DiagnosticReport {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      id: "agents-doctor",
      status: "ok",
      summary:
        "Use @FeatureArchitect for planning, @FeatureImplementer for approved implementation, and @CodeReviewer for review.",
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
          name: "agent-files",
          status: "ok",
          message: "Install with `npm run cli -- agents install`."
        }
      ],
      artifactRoot: ".github/agents"
    };
  }

  private async writeAgents(
    options: AgentInstallOptions
  ): Promise<AgentInstallSummary> {
    const outputDirectory = resolveOutputDirectory(options);
    const results: AgentInstallResult[] = [];

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

      const contents = renderAgent(definition);
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

    const summary: AgentInstallSummary = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
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
    agentId: definition.id,
    status: input.status,
    installPath: input.installPath,
    backupPath: input.backupPath,
    messages: input.messages
  };
}

function renderAgent(definition: AgentDefinition): string {
  return [
    "---",
    `name: ${definition.name}`,
    `description: ${definition.description}`,
    `model: ${definition.model}`,
    "tools:",
    ...definition.tools.map((tool) => `  - ${tool}`),
    "---",
    "",
    `# ${definition.name}`,
    "",
    "## Purpose",
    "",
    definition.purpose,
    "",
    "## Instructions",
    "",
    ...definition.instructions.map((instruction) => `- ${instruction}`),
    "",
    "## Handoff Guidance",
    "",
    ...definition.handoffGuidance.map((guidance) => `- ${guidance}`),
    "",
    "## Safety Rules",
    "",
    ...definition.safetyRules.map((rule) => `- ${rule}`),
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
  const repoRoot = path.resolve(options.startPath ?? process.cwd());

  if (options.outputPath) {
    return path.isAbsolute(options.outputPath)
      ? options.outputPath
      : path.resolve(repoRoot, options.outputPath);
  }

  return path.join(repoRoot, ".github", "agents");
}

function timestampId(): string {
  return new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
}
