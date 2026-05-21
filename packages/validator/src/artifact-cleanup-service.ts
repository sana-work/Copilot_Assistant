import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import {
  ARTIFACT_DIRECTORY_NAMES,
  CURRENT_SCHEMA_VERSION,
  getArtifactFilePath,
  getArtifactRoot,
  type ArtifactRetentionPolicy
} from "@copilot-architect/shared";

import { AuditLogService } from "./audit-log-service.js";
import type {
  ArtifactCleanupCandidate,
  ArtifactCleanupOptions,
  ArtifactCleanupResult
} from "./models.js";
import { SafetyPolicyService } from "./safety-policy-service.js";

interface ArtifactFile {
  artifactDirectory: string;
  path: string;
  mtimeMs: number;
  sizeBytes: number;
}

const dayMs = 24 * 60 * 60 * 1000;
const latestArtifactPattern = /^latest-/;
const artifactDirectoryNames = new Set<string>(Object.values(ARTIFACT_DIRECTORY_NAMES));

export class ArtifactCleanupService {
  constructor(
    private readonly safetyPolicyService = new SafetyPolicyService(),
    private readonly auditLogService = new AuditLogService()
  ) {}

  async cleanup(options: ArtifactCleanupOptions = {}): Promise<ArtifactCleanupResult> {
    const workspaceRoot = path.resolve(options.startPath ?? process.cwd());
    const artifactRoot = getArtifactRoot(workspaceRoot);
    const policyPath = getArtifactFilePath(workspaceRoot, "policy");
    const policy = await this.safetyPolicyService.load(workspaceRoot);
    const retention = normalizeRetention(policy.artifactRetention);
    const dryRun = options.dryRun ?? retention.dryRunDefault;
    const maxAgeDays = options.maxAgeDays ?? retention.maxAgeDays;
    const maxRuns = options.maxRuns ?? retention.maxRuns;
    const directories = retention.directories.filter((directory) =>
      artifactDirectoryNames.has(directory)
    );
    const errors: string[] = [];

    for (const directory of retention.directories) {
      if (!artifactDirectoryNames.has(directory)) {
        errors.push(`Ignoring unknown retention directory: ${directory}`);
      }
    }

    if (!retention.enabled) {
      const disabledResult = createCleanupResult({
        workspaceRoot,
        artifactRoot,
        policyPath,
        dryRun,
        retentionEnabled: false,
        maxAgeDays,
        maxRuns,
        directories,
        scannedFiles: 0,
        keptFiles: 0,
        candidates: [],
        deleted: [],
        errors,
        summary: "Artifact retention cleanup is disabled by policy."
      });
      await this.recordAudit(workspaceRoot, disabledResult);
      return disabledResult;
    }

    const files = await collectArtifactFiles(artifactRoot, directories, errors);
    const candidatesByPath = new Map<string, ArtifactCleanupCandidate>();
    const now = Date.now();

    for (const file of files) {
      const ageDays = (now - file.mtimeMs) / dayMs;

      if (ageDays > maxAgeDays) {
        candidatesByPath.set(file.path, createCandidate(file, "age", ageDays));
      }
    }

    for (const directory of directories) {
      const filesInDirectory = files
        .filter((file) => file.artifactDirectory === directory)
        .sort((left, right) => right.mtimeMs - left.mtimeMs);

      for (const file of filesInDirectory.slice(maxRuns)) {
        if (!candidatesByPath.has(file.path)) {
          candidatesByPath.set(
            file.path,
            createCandidate(file, "count", (now - file.mtimeMs) / dayMs)
          );
        }
      }
    }

    const candidates = [...candidatesByPath.values()].sort((left, right) =>
      left.path.localeCompare(right.path)
    );
    const deleted: ArtifactCleanupCandidate[] = [];

    if (!dryRun) {
      for (const candidate of candidates) {
        try {
          await unlink(candidate.path);
          candidate.deleted = true;
          deleted.push(candidate);
        } catch (error) {
          errors.push(
            `Failed to delete ${candidate.path}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    const result = createCleanupResult({
      workspaceRoot,
      artifactRoot,
      policyPath,
      dryRun,
      retentionEnabled: true,
      maxAgeDays,
      maxRuns,
      directories,
      scannedFiles: files.length,
      keptFiles: files.length - candidates.length,
      candidates,
      deleted,
      errors,
      summary: dryRun
        ? `Dry run found ${candidates.length} artifact(s) eligible for cleanup.`
        : `Deleted ${deleted.length} artifact(s); ${errors.length} error(s).`
    });

    await this.recordAudit(workspaceRoot, result);
    return result;
  }

  private async recordAudit(
    workspaceRoot: string,
    result: ArtifactCleanupResult
  ): Promise<void> {
    await this.auditLogService.record(workspaceRoot, {
      action: "cleanup.run",
      actor: "cli",
      target: result.artifactRoot,
      summary: result.summary,
      metadata: {
        dryRun: result.dryRun,
        retentionEnabled: result.retentionEnabled,
        candidates: result.candidates.length,
        deleted: result.deleted.length,
        errors: result.errors.length,
        directories: result.directories
      }
    });
  }
}

function normalizeRetention(
  retention: ArtifactRetentionPolicy | undefined
): ArtifactRetentionPolicy {
  return {
    enabled: retention?.enabled ?? true,
    maxAgeDays: retention?.maxAgeDays ?? 30,
    maxRuns: retention?.maxRuns ?? 50,
    directories: retention?.directories?.filter(
      (directory) => typeof directory === "string"
    ) ?? ["plans", "handoffs", "runs", "reviews", "diagnostics"],
    dryRunDefault: retention?.dryRunDefault ?? true
  };
}

async function collectArtifactFiles(
  artifactRoot: string,
  directories: string[],
  errors: string[]
): Promise<ArtifactFile[]> {
  const files: ArtifactFile[] = [];

  for (const directory of directories) {
    const directoryPath = path.resolve(artifactRoot, directory);

    if (!isWithin(directoryPath, artifactRoot)) {
      errors.push(`Skipping retention directory outside artifact root: ${directory}`);
      continue;
    }

    files.push(...(await collectDirectoryFiles(directory, directoryPath, errors)));
  }

  return files;
}

async function collectDirectoryFiles(
  artifactDirectory: string,
  directoryPath: string,
  errors: string[]
): Promise<ArtifactFile[]> {
  let entries;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: ArtifactFile[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(
        ...(await collectDirectoryFiles(artifactDirectory, entryPath, errors))
      );
      continue;
    }

    if (!entry.isFile() || isProtectedArtifact(entry.name)) {
      continue;
    }

    try {
      const stats = await stat(entryPath);
      files.push({
        artifactDirectory,
        path: entryPath,
        mtimeMs: stats.mtimeMs,
        sizeBytes: stats.size
      });
    } catch (error) {
      errors.push(
        `Failed to inspect ${entryPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return files;
}

function createCandidate(
  file: ArtifactFile,
  reason: ArtifactCleanupCandidate["reason"],
  ageDays: number
): ArtifactCleanupCandidate {
  return {
    artifactDirectory: file.artifactDirectory,
    path: file.path,
    reason,
    mtime: new Date(file.mtimeMs).toISOString(),
    ageDays: Number(ageDays.toFixed(2)),
    sizeBytes: file.sizeBytes,
    deleted: false
  };
}

function createCleanupResult(
  input: Omit<ArtifactCleanupResult, "schemaVersion" | "generatedAt">
): ArtifactCleanupResult {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...input
  };
}

function isProtectedArtifact(fileName: string): boolean {
  return latestArtifactPattern.test(fileName) || fileName === ".gitkeep";
}

function isWithin(childPath: string, rootPath: string): boolean {
  const relative = path.relative(path.resolve(rootPath), path.resolve(childPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
