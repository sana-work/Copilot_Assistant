import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { getArtifactDirectoryPath, writeJsonFile } from "@copilot-architect/shared";

import type { GitCheckpointResult } from "./models.js";
import { RollbackGuideGenerator } from "./rollback-guide-generator.js";

const execFileAsync = promisify(execFile);

export class GitCheckpointService {
  constructor(private readonly rollbackGuideGenerator = new RollbackGuideGenerator()) {}

  async createCheckpoint(repoRoot: string): Promise<GitCheckpointResult> {
    const root = path.resolve(repoRoot);

    try {
      await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
    } catch {
      return {
        repoRoot: root,
        gitAvailable: false,
        created: false,
        dirty: false,
        message: "Git repository was not detected; checkpoint skipped."
      };
    }

    const head = (
      await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })
    ).stdout.trim();
    const branch = (
      await execFileAsync("git", ["branch", "--show-current"], { cwd: root })
    ).stdout.trim();
    const status = (
      await execFileAsync("git", ["status", "--short"], { cwd: root })
    ).stdout.trim();
    const rollbackGuide = this.rollbackGuideGenerator.generate({
      repoRoot: root,
      head,
      branch,
      dirty: status.length > 0
    });
    const checkpointPath = path.join(
      getArtifactDirectoryPath(root, "diagnostics"),
      `${new Date().toISOString().replace(/[:.]/g, "-")}-git-checkpoint.json`
    );

    await mkdir(path.dirname(checkpointPath), { recursive: true });
    await writeJsonFile(checkpointPath, {
      repoRoot: root,
      head,
      branch,
      dirty: status.length > 0,
      status,
      rollbackGuide
    });

    return {
      repoRoot: root,
      gitAvailable: true,
      created: true,
      head,
      branch,
      dirty: status.length > 0,
      checkpointPath,
      rollbackGuide,
      message: "Git checkpoint captured."
    };
  }
}
