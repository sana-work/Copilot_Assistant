export interface RollbackGuideInput {
  repoRoot: string;
  head: string;
  branch?: string;
  dirty: boolean;
}

export class RollbackGuideGenerator {
  generate(input: RollbackGuideInput): string {
    return [
      `Repository: ${input.repoRoot}`,
      `Checkpoint commit: ${input.head}`,
      input.branch ? `Branch: ${input.branch}` : "Branch: detached or unknown",
      input.dirty
        ? "Working tree had uncommitted changes when checkpoint was captured."
        : "Working tree was clean when checkpoint was captured.",
      "Rollback guide:",
      `1. Inspect changes with git diff and git status.`,
      `2. To return to the checkpoint commit, ask a human before running git reset --hard ${input.head}.`,
      "3. Preserve any user changes before destructive rollback."
    ].join("\n");
  }
}
