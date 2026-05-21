import { writeFile } from "node:fs/promises";

import { RepoDiscoveryService, WorkspaceService } from "@copilot-architect/core";
import { IndexingService } from "@copilot-architect/indexer";
import {
  type DetectedCommand,
  type RepoCommandSet,
  writeJsonFile
} from "@copilot-architect/shared";

import { FeaturePlanningService } from "./feature-planning-service.js";
import type {
  WorkspaceImpactResult,
  WorkspaceImpactedRepo,
  WorkspacePlanPreviewResult,
  WorkspacePlanSummary,
  WorkspacePlanningOptions,
  WorkspacePlanningResult,
  WorkspaceRepoValidationPlan
} from "./models.js";

export class WorkspacePlanningService {
  async analyzeImpact(
    options: WorkspacePlanningOptions
  ): Promise<WorkspaceImpactResult> {
    const multiRepo = await this.createMultiRepoSummary(options);

    return {
      request: multiRepo.request,
      workspaceName: multiRepo.workspaceName,
      workspaceRoot: multiRepo.workspaceRoot,
      repos: multiRepo.repos,
      impactedRepos: multiRepo.impactedRepos,
      perRepoValidationPlans: multiRepo.perRepoValidationPlans
    };
  }

  async createPlanPreview(
    options: WorkspacePlanningOptions
  ): Promise<WorkspacePlanPreviewResult> {
    const [preview, multiRepo] = await Promise.all([
      new FeaturePlanningService().createPlanPreview(options),
      this.createMultiRepoSummary(options)
    ]);

    preview.plan.multiRepo = multiRepo;

    return {
      ...preview,
      multiRepo,
      markdown: appendWorkspaceMarkdown(preview.markdown, multiRepo)
    };
  }

  async createPlan(
    options: WorkspacePlanningOptions
  ): Promise<WorkspacePlanningResult> {
    const base = await new FeaturePlanningService().createPlan(options);
    const multiRepo = await this.createMultiRepoSummary(options);
    const markdown = appendWorkspaceMarkdown(base.markdown, multiRepo);

    base.plan.multiRepo = multiRepo;
    await writeJsonFile(base.jsonPath, base.plan);
    await writeJsonFile(base.latestJsonPath, base.plan);
    await writeFile(base.markdownPath, markdown, "utf8");
    await writeFile(base.latestMarkdownPath, markdown, "utf8");

    return {
      ...base,
      markdown,
      multiRepo
    };
  }

  private async createMultiRepoSummary(
    options: WorkspacePlanningOptions
  ): Promise<WorkspacePlanSummary> {
    const workspaceService = new WorkspaceService();
    const workspaceResult = await workspaceService.show({
      startPath: options.startPath
    });
    const workspace = workspaceResult.workspace;
    const repos = workspaceService.resolveRepos(workspace);
    const search = await new IndexingService().searchWorkspace({
      startPath: options.startPath,
      query: options.request,
      limit: options.searchLimit ?? 12
    });
    const impactedRepos = summarizeImpactedRepos(search.combinedResults);
    const perRepoValidationPlans = await createValidationPlans(repos);

    return {
      request: options.request,
      workspaceName: workspace.workspaceName,
      workspaceRoot: workspace.workspaceRoot,
      repos,
      impactedRepos,
      perRepoValidationPlans,
      searchResults: search.combinedResults
    };
  }
}

function summarizeImpactedRepos(
  results: Array<{
    repoName: string;
    repoRole?: string;
    repoRoot: string;
    score: number;
    relativePath: string;
  }>
): WorkspaceImpactedRepo[] {
  const byRepo = new Map<string, WorkspaceImpactedRepo>();

  for (const result of results) {
    const existing =
      byRepo.get(result.repoRoot) ??
      ({
        name: result.repoName,
        role: result.repoRole,
        repoRoot: result.repoRoot,
        resultCount: 0,
        topScore: 0,
        topFiles: []
      } satisfies WorkspaceImpactedRepo);

    existing.resultCount += 1;
    existing.topScore = Math.max(existing.topScore, result.score);

    if (
      !existing.topFiles.includes(result.relativePath) &&
      existing.topFiles.length < 5
    ) {
      existing.topFiles.push(result.relativePath);
    }

    byRepo.set(result.repoRoot, existing);
  }

  return Array.from(byRepo.values()).sort(
    (left, right) =>
      right.topScore - left.topScore ||
      right.resultCount - left.resultCount ||
      left.name.localeCompare(right.name)
  );
}

async function createValidationPlans(
  repos: Array<{ name: string; role?: string; repoRoot: string }>
): Promise<WorkspaceRepoValidationPlan[]> {
  const plans: WorkspaceRepoValidationPlan[] = [];

  for (const repo of repos) {
    const repoMap = await new RepoDiscoveryService().analyze({
      startPath: repo.repoRoot
    });
    const commands = repoMap.repoMap.repos[0]?.commands;

    plans.push({
      repoName: repo.name,
      repoRole: repo.role,
      repoRoot: repo.repoRoot,
      commands: commands ? detectedValidationCommands(commands) : [],
      strategy: `Run detected validation commands for ${repo.name} before review.`
    });
  }

  return plans;
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

function appendWorkspaceMarkdown(
  markdown: string,
  multiRepo: WorkspacePlanSummary
): string {
  return [
    markdown,
    "",
    "## Multi-Repo Workspace",
    "",
    `Workspace: ${multiRepo.workspaceName ?? multiRepo.workspaceRoot}`,
    `Repos: ${multiRepo.repos.length}`,
    "",
    "### Impacted Repos",
    "",
    multiRepo.impactedRepos
      .map(
        (repo) =>
          `- ${repo.name}${repo.role ? ` (${repo.role})` : ""}: ${repo.resultCount} match(es), top files ${repo.topFiles.join(", ") || "none"}`
      )
      .join("\n") || "- No impacted repos found from current indexes.",
    "",
    "### Per-Repo Validation Plans",
    "",
    multiRepo.perRepoValidationPlans
      .map(
        (plan) =>
          `- ${plan.repoName}${plan.repoRole ? ` (${plan.repoRole})` : ""}: ${plan.commands.length} command(s)`
      )
      .join("\n") || "- No validation plans generated."
  ].join("\n");
}
