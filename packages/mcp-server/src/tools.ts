import path from "node:path";

import { RepoDiscoveryService } from "@copilot-architect/core";
import { IndexingService } from "@copilot-architect/indexer";
import { FeaturePlanningService } from "@copilot-architect/planner";
import {
  type DetectedCommand,
  type RepoCommandSet,
  type UniversalRepoMap,
  getArtifactFilePath,
  readJsonFile
} from "@copilot-architect/shared";
import {
  CommandConfigService,
  SafetyPolicyService,
  mergeCustomCommandsWithDetected
} from "@copilot-architect/validator";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { CopilotArchitectMcpServerOptions } from "./server.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface CopilotArchitectMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodType>;
  readOnly: boolean;
  handler: ToolHandler;
}

export function registerCopilotArchitectTools(
  server: McpServer,
  options: CopilotArchitectMcpServerOptions = {}
): CopilotArchitectMcpToolDefinition[] {
  const tools = createCopilotArchitectTools(options);

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.readOnly
        }
      },
      async (args) => {
        try {
          return toToolResult(await tool.handler(args as Record<string, unknown>));
        } catch (error) {
          return toToolResult({
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    );
  }

  return tools;
}

export function createCopilotArchitectTools(
  options: CopilotArchitectMcpServerOptions = {}
): CopilotArchitectMcpToolDefinition[] {
  return [
    tool(
      "repo_map",
      "Read or generate the current repo map.",
      commonSchema,
      true,
      async (args) => ensureRepoMap(resolveStartPath(args, options))
    ),
    tool(
      "workspace_map",
      "Read workspace context or summarize the current repo map.",
      commonSchema,
      true,
      async (args) => getWorkspaceMap(resolveStartPath(args, options))
    ),
    tool(
      "detect_languages",
      "List detected languages.",
      commonSchema,
      true,
      async (args) => {
        const repoMap = await ensureRepoMap(resolveStartPath(args, options));
        return repoMap.repos.flatMap((repo) => repo.languages);
      }
    ),
    tool(
      "detect_frameworks",
      "List detected frameworks.",
      commonSchema,
      true,
      async (args) => {
        const repoMap = await ensureRepoMap(resolveStartPath(args, options));
        return repoMap.repos.flatMap((repo) => repo.frameworks);
      }
    ),
    tool(
      "detect_package_managers",
      "List detected package managers.",
      commonSchema,
      true,
      async (args) => {
        const repoMap = await ensureRepoMap(resolveStartPath(args, options));
        return repoMap.repos.flatMap((repo) => repo.packageManagers);
      }
    ),
    tool(
      "detect_build_commands",
      "List detected build commands.",
      commonSchema,
      true,
      async (args) => {
        const repoMap = await ensureRepoMap(resolveStartPath(args, options));
        return repoMap.repos.flatMap((repo) => repo.commands.build);
      }
    ),
    tool(
      "detect_test_commands",
      "List detected test commands.",
      commonSchema,
      true,
      async (args) => {
        const repoMap = await ensureRepoMap(resolveStartPath(args, options));
        return repoMap.repos.flatMap((repo) => repo.commands.test);
      }
    ),
    tool(
      "search_repo",
      "Search the current repo index.",
      searchSchema,
      true,
      async (args) =>
        new IndexingService().search({
          startPath: resolveStartPath(args, options),
          query: stringArg(args, "query"),
          limit: numberArg(args, "limit", 20)
        })
    ),
    tool(
      "search_across_repos",
      "Search across the current workspace repos.",
      searchSchema,
      true,
      async (args) =>
        new IndexingService().search({
          startPath: resolveStartPath(args, options),
          query: stringArg(args, "query"),
          limit: numberArg(args, "limit", 20)
        })
    ),
    tool(
      "find_similar_feature",
      "Find similar feature candidates in the local index.",
      searchSchema,
      true,
      async (args) =>
        new IndexingService().findSimilarFeatures({
          startPath: resolveStartPath(args, options),
          query: stringArg(args, "query"),
          limit: numberArg(args, "limit", 12)
        })
    ),
    tool(
      "find_impacted_files",
      "Find likely impacted files for a request.",
      requestSchema,
      true,
      async (args) => {
        const response = await new IndexingService().findSimilarFeatures({
          startPath: resolveStartPath(args, options),
          query: stringArg(args, "request"),
          limit: numberArg(args, "limit", 12)
        });
        return response.results.map((result) => ({
          filePath: result.relativePath,
          score: result.score,
          matchedFields: result.matchedFields
        }));
      }
    ),
    tool(
      "analyze_impact",
      "Generate impact context for a request without implementation.",
      requestSchema,
      true,
      async (args) => {
        const plan = await new FeaturePlanningService().createPlanPreview({
          startPath: resolveStartPath(args, options),
          request: stringArg(args, "request"),
          searchLimit: numberArg(args, "limit", 12)
        });
        return {
          impactAnalysis: plan.plan.impactAnalysis,
          impactedLanguages: plan.plan.impactedLanguages,
          impactedFrameworks: plan.plan.impactedFrameworks,
          impactedModules: plan.plan.impactedModules,
          likelyFilesToModify: plan.plan.likelyFilesToModify,
          likelyNewFiles: plan.plan.likelyNewFiles
        };
      }
    ),
    tool(
      "generate_plan_context",
      "Generate repo/search context for a feature plan.",
      requestSchema,
      true,
      async (args) => {
        const startPath = resolveStartPath(args, options);
        const repoMap = await ensureRepoMap(startPath);
        const search = await new IndexingService().findSimilarFeatures({
          startPath,
          query: stringArg(args, "request"),
          limit: numberArg(args, "limit", 12)
        });
        return { repoMap, search };
      }
    ),
    tool(
      "generate_feature_plan",
      "Generate a feature plan artifact. Requires approved=true.",
      approvedRequestSchema,
      false,
      async (args) => {
        if (args.approved !== true) {
          return {
            ok: false,
            error: "generate_feature_plan writes artifacts and requires approved=true."
          };
        }

        return new FeaturePlanningService().createPlan({
          startPath: resolveStartPath(args, options),
          request: stringArg(args, "request"),
          searchLimit: numberArg(args, "limit", 12)
        });
      }
    ),
    tool(
      "get_validation_commands",
      "Get merged detected and custom validation commands.",
      commonSchema,
      true,
      async (args) => getValidationCommands(resolveStartPath(args, options))
    ),
    tool(
      "get_safety_policy",
      "Read the active safety policy.",
      commonSchema,
      true,
      async (args) => new SafetyPolicyService().load(resolveStartPath(args, options))
    ),
    tool(
      "get_latest_plan",
      "Read the latest generated plan artifact.",
      commonSchema,
      true,
      async (args) =>
        readOptionalArtifact(resolveStartPath(args, options), "plans/latest-plan.json")
    ),
    tool(
      "get_latest_validation",
      "Read the latest validation report artifact.",
      commonSchema,
      true,
      async (args) =>
        readOptionalArtifact(
          resolveStartPath(args, options),
          "runs/latest-validation.json"
        )
    ),
    tool(
      "get_latest_review",
      "Read the latest review report artifact when available.",
      commonSchema,
      true,
      async (args) =>
        readOptionalArtifact(
          resolveStartPath(args, options),
          "reviews/latest-review.json"
        )
    ),
    tool(
      "agent_status",
      "Report agent package status.",
      commonSchema,
      true,
      async () => ({
        status: "not-implemented",
        message: "Agent generation is planned for a later phase."
      })
    )
  ];
}

export function listCopilotArchitectMcpToolNames(): string[] {
  return createCopilotArchitectTools().map((toolDefinition) => toolDefinition.name);
}

function tool(
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodType>,
  readOnly: boolean,
  handler: ToolHandler
): CopilotArchitectMcpToolDefinition {
  return { name, description, inputSchema, readOnly, handler };
}

async function ensureRepoMap(startPath: string): Promise<UniversalRepoMap> {
  return (await new RepoDiscoveryService().analyze({ startPath })).repoMap;
}

async function getWorkspaceMap(startPath: string): Promise<unknown> {
  const repoMap = await ensureRepoMap(startPath);
  const workspacePath = getArtifactFilePath(repoMap.workspaceRoot, "workspace");
  const workspace = await tryReadJson(workspacePath);

  return (
    workspace ?? {
      workspaceRoot: repoMap.workspaceRoot,
      repos: repoMap.repos.map((repo) => ({
        repoRoot: repo.repoRoot,
        displayName: repo.displayName,
        projects: repo.projects.map((project) => project.name)
      })),
      summary: repoMap.summary
    }
  );
}

async function getValidationCommands(startPath: string): Promise<unknown> {
  const repoMap = await ensureRepoMap(startPath);
  const repo = repoMap.repos[0];

  if (!repo) {
    return {
      commands: [],
      diagnostics: ["Repo map does not contain any repositories."]
    };
  }

  const customConfig = await new CommandConfigService().load({
    startPath: repoMap.workspaceRoot,
    allowMissing: true
  });

  return {
    commands: mergeCustomCommandsWithDetected(repo.commands, customConfig.commands),
    detected: detectedValidationCommands(repo.commands),
    custom: customConfig.commands.map((customCommand) => customCommand.command)
  };
}

function detectedValidationCommands(commands: RepoCommandSet): DetectedCommand[] {
  return [
    ...commands.test,
    ...commands.build,
    ...commands.lint,
    ...commands.format,
    ...commands.validation
  ];
}

async function readOptionalArtifact(
  startPath: string,
  relativeArtifactPath: string
): Promise<unknown> {
  const repoMap = await ensureRepoMap(startPath);
  const artifactPath = path.join(
    repoMap.workspaceRoot,
    ".copilot-architect",
    relativeArtifactPath
  );
  const value = await tryReadJson(artifactPath);

  return (
    value ?? {
      missing: true,
      artifactPath,
      message: "Artifact does not exist yet."
    }
  );
}

async function tryReadJson(filePath: string): Promise<unknown | undefined> {
  try {
    return await readJsonFile<unknown>(filePath);
  } catch {
    return undefined;
  }
}

function toToolResult(data: unknown): CallToolResult {
  const isFailure = isToolFailure(data);

  return {
    isError: isFailure || undefined,
    content: [
      {
        type: "text",
        text: `${JSON.stringify(isFailure ? data : { ok: true, data }, null, 2)}\n`
      }
    ]
  };
}

function isToolFailure(data: unknown): data is { ok: false; error: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "ok" in data &&
    (data as { ok: unknown }).ok === false &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  );
}

function resolveStartPath(
  args: Record<string, unknown>,
  options: CopilotArchitectMcpServerOptions
): string {
  return path.resolve(
    typeof args.path === "string" ? args.path : (options.startPath ?? process.cwd())
  );
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function numberArg(
  args: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const value = args[key];

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback;
}

const commonSchema = {
  path: z.string().optional()
};

const searchSchema = {
  ...commonSchema,
  query: z.string(),
  limit: z.number().positive().optional()
};

const requestSchema = {
  ...commonSchema,
  request: z.string(),
  limit: z.number().positive().optional()
};

const approvedRequestSchema = {
  ...requestSchema,
  approved: z.boolean().optional()
};
