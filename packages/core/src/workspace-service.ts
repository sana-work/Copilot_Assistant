import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  CURRENT_SCHEMA_VERSION,
  type ArchitectureSummary,
  type RepoMap,
  type UniversalRepoMap,
  type WorkspaceConfig,
  type WorkspaceRepoConfig,
  getArtifactFilePath,
  readJsonFile,
  writeJsonFile
} from "@copilot-architect/shared";

import { RepoDiscoveryService } from "./repo-discovery.js";

export interface WorkspaceServiceOptions {
  startPath?: string;
  workspaceName?: string;
}

export interface WorkspaceAddOptions extends WorkspaceServiceOptions {
  name?: string;
  repoPath: string;
  role?: string;
}

export interface WorkspaceRemoveOptions extends WorkspaceServiceOptions {
  nameOrPath: string;
}

export interface WorkspaceServiceResult {
  workspace: WorkspaceConfig;
  workspacePath: string;
  created: boolean;
}

export interface WorkspaceRepoDescriptor extends WorkspaceRepoConfig {
  repoRoot: string;
}

export interface WorkspaceMapResult {
  workspace: WorkspaceConfig;
  workspacePath: string;
  repoMap: UniversalRepoMap;
  repoMapPath: string;
  repos: WorkspaceRepoDescriptor[];
}

export class WorkspaceService {
  async init(options: WorkspaceServiceOptions = {}): Promise<WorkspaceServiceResult> {
    const workspaceRoot = resolveStartPath(options.startPath);
    const workspacePath = getArtifactFilePath(workspaceRoot, "workspace");
    const existing = await tryReadWorkspace(workspacePath);
    const workspace = normalizeWorkspaceConfig(
      existing ?? createDefaultWorkspace(workspaceRoot, options.workspaceName),
      workspaceRoot
    );

    if (options.workspaceName) {
      workspace.workspaceName = options.workspaceName;
    }

    await mkdir(workspace.artifactRoot, { recursive: true });
    await writeJsonFile(workspacePath, workspace);

    return {
      workspace,
      workspacePath,
      created: !existing
    };
  }

  async show(options: WorkspaceServiceOptions = {}): Promise<WorkspaceServiceResult> {
    const workspaceRoot = resolveStartPath(options.startPath);
    const workspacePath = getArtifactFilePath(workspaceRoot, "workspace");
    const workspace = await tryReadWorkspace(workspacePath);

    if (workspace) {
      return {
        workspace: normalizeWorkspaceConfig(workspace, workspaceRoot),
        workspacePath,
        created: false
      };
    }

    return this.init({
      startPath: workspaceRoot,
      workspaceName: options.workspaceName
    });
  }

  async list(options: WorkspaceServiceOptions = {}): Promise<WorkspaceServiceResult> {
    return this.show(options);
  }

  async add(options: WorkspaceAddOptions): Promise<WorkspaceServiceResult> {
    const current = await this.show({ startPath: options.startPath });
    const repoRoot = path.resolve(current.workspace.workspaceRoot, options.repoPath);
    const repo: WorkspaceRepoConfig = {
      name: options.name?.trim() || path.basename(repoRoot),
      path: toStoredRepoPath(
        current.workspace.workspaceRoot,
        repoRoot,
        options.repoPath
      ),
      role: options.role?.trim() || undefined
    };
    const existingRepos = this.resolveRepos(current.workspace).filter(
      (existingRepo) =>
        existingRepo.name !== repo.name && existingRepo.repoRoot !== repoRoot
    );
    const repos = [...existingRepos.map(stripResolvedRepo), repo];
    const workspace = normalizeWorkspaceConfig(
      {
        ...current.workspace,
        repos
      },
      current.workspace.workspaceRoot
    );

    await writeJsonFile(current.workspacePath, workspace);

    return {
      workspace,
      workspacePath: current.workspacePath,
      created: false
    };
  }

  async remove(options: WorkspaceRemoveOptions): Promise<WorkspaceServiceResult> {
    const current = await this.show({ startPath: options.startPath });
    const normalizedTarget = options.nameOrPath.trim();
    const targetRoot = path.resolve(current.workspace.workspaceRoot, normalizedTarget);
    const remaining = this.resolveRepos(current.workspace).filter(
      (repo) => repo.name !== normalizedTarget && repo.repoRoot !== targetRoot
    );

    if (remaining.length === this.resolveRepos(current.workspace).length) {
      throw new Error(`Workspace repo not found: ${normalizedTarget}`);
    }

    const workspace = normalizeWorkspaceConfig(
      {
        ...current.workspace,
        repos: remaining.map(stripResolvedRepo)
      },
      current.workspace.workspaceRoot
    );

    await writeJsonFile(current.workspacePath, workspace);

    return {
      workspace,
      workspacePath: current.workspacePath,
      created: false
    };
  }

  resolveRepos(workspace: WorkspaceConfig): WorkspaceRepoDescriptor[] {
    return workspaceRepos(workspace);
  }

  async createWorkspaceMap(
    options: WorkspaceServiceOptions = {}
  ): Promise<WorkspaceMapResult> {
    const { workspace, workspacePath } = await this.show(options);
    const repos = this.resolveRepos(workspace);
    const repoMaps: RepoMap[] = [];

    for (const repo of repos) {
      const analyzed = await new RepoDiscoveryService().analyze({
        startPath: repo.repoRoot
      });
      const repoMap = analyzed.repoMap.repos[0];

      if (repoMap) {
        repoMaps.push({
          ...repoMap,
          displayName: repo.name
        });
      }
    }

    const repoMap: UniversalRepoMap = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      workspaceRoot: workspace.workspaceRoot,
      repos: repoMaps,
      summary: summarizeWorkspace(repoMaps)
    };
    const repoMapPath = getArtifactFilePath(workspace.workspaceRoot, "repoMap");

    await mkdir(workspace.artifactRoot, { recursive: true });
    await writeJsonFile(repoMapPath, repoMap);

    return {
      workspace,
      workspacePath,
      repoMap,
      repoMapPath,
      repos
    };
  }
}

async function tryReadWorkspace(
  filePath: string
): Promise<WorkspaceConfig | undefined> {
  try {
    return await readJsonFile<WorkspaceConfig>(filePath);
  } catch {
    return undefined;
  }
}

function createDefaultWorkspace(
  workspaceRoot: string,
  workspaceName?: string
): WorkspaceConfig {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workspaceName: workspaceName ?? path.basename(workspaceRoot),
    workspaceRoot,
    repos: [
      {
        name: path.basename(workspaceRoot),
        path: ".",
        role: "workspace root"
      }
    ],
    repoRoots: [workspaceRoot],
    artifactRoot: path.join(workspaceRoot, ".copilot-architect")
  };
}

function normalizeWorkspaceConfig(
  workspace: WorkspaceConfig,
  fallbackRoot: string
): WorkspaceConfig {
  const workspaceRoot = path.resolve(workspace.workspaceRoot ?? fallbackRoot);
  const artifactRoot =
    workspace.artifactRoot ?? path.join(workspaceRoot, ".copilot-architect");
  const repoRoots = workspace.repoRoots ?? [];
  const repos =
    workspace.repos && workspace.repos.length > 0
      ? normalizeRepos(workspace.repos, workspaceRoot)
      : normalizeRepos(
          (repoRoots.length > 0 ? repoRoots : [workspaceRoot]).map((repoRoot) => ({
            name: path.basename(repoRoot),
            path: toStoredRepoPath(workspaceRoot, path.resolve(repoRoot), repoRoot)
          })),
          workspaceRoot
        );
  const normalizedRepoRoots = repos.map((repo) =>
    path.resolve(workspaceRoot, repo.path)
  );

  return {
    ...workspace,
    schemaVersion: workspace.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    workspaceName: workspace.workspaceName ?? path.basename(workspaceRoot),
    workspaceRoot,
    artifactRoot,
    repos,
    repoRoots: normalizedRepoRoots
  };
}

function normalizeRepos(
  repos: WorkspaceRepoConfig[],
  workspaceRoot: string
): WorkspaceRepoConfig[] {
  const seenNames = new Set<string>();
  const seenRoots = new Set<string>();
  const normalized: WorkspaceRepoConfig[] = [];

  for (const repo of repos) {
    const repoRoot = path.resolve(workspaceRoot, repo.path);

    if (seenRoots.has(repoRoot)) {
      continue;
    }

    const name = uniqueRepoName(
      repo.name?.trim() || path.basename(repoRoot),
      seenNames
    );
    seenNames.add(name);
    seenRoots.add(repoRoot);
    normalized.push({
      name,
      path: normalizePathSeparators(repo.path || "."),
      role: repo.role?.trim() || undefined
    });
  }

  return normalized;
}

function workspaceRepos(workspace: WorkspaceConfig): WorkspaceRepoDescriptor[] {
  const normalized = normalizeWorkspaceConfig(workspace, workspace.workspaceRoot);

  return (normalized.repos ?? []).map((repo) => ({
    ...repo,
    repoRoot: path.resolve(normalized.workspaceRoot, repo.path)
  }));
}

function stripResolvedRepo(repo: WorkspaceRepoDescriptor): WorkspaceRepoConfig {
  return {
    name: repo.name,
    path: repo.path,
    role: repo.role
  };
}

function summarizeWorkspace(repoMaps: RepoMap[]): ArchitectureSummary {
  const languages = uniqueValues(
    repoMaps.flatMap((repo) => repo.languages.map((language) => language.name))
  );
  const frameworks = uniqueValues(
    repoMaps.flatMap((repo) => repo.frameworks.map((framework) => framework.name))
  );
  const projectCount = repoMaps.reduce((sum, repo) => sum + repo.projects.length, 0);

  return {
    summary:
      repoMaps.length > 1
        ? `Detected ${repoMaps.length} repositories with ${projectCount} project(s).`
        : `Detected ${repoMaps.length} repository with ${projectCount} project(s).`,
    primaryLanguages: languages,
    primaryFrameworks: frameworks,
    projectCount,
    repoCount: repoMaps.length
  };
}

function uniqueRepoName(name: string, seenNames: Set<string>): string {
  if (!seenNames.has(name)) {
    return name;
  }

  let suffix = 2;
  let candidate = `${name}-${suffix}`;

  while (seenNames.has(candidate)) {
    suffix += 1;
    candidate = `${name}-${suffix}`;
  }

  return candidate;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function toStoredRepoPath(
  workspaceRoot: string,
  repoRoot: string,
  requestedPath: string
): string {
  if (!path.isAbsolute(requestedPath)) {
    return normalizePathSeparators(requestedPath || ".");
  }

  const relative = path.relative(workspaceRoot, repoRoot);
  return normalizePathSeparators(relative || ".");
}

function normalizePathSeparators(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function resolveStartPath(startPath?: string): string {
  return path.resolve(startPath ?? process.cwd());
}
