import path from "node:path";

import type { PathBoundaryResult } from "./models.js";

export class PathBoundaryService {
  checkPath(workspaceRoot: string, targetPath: string): PathBoundaryResult {
    const resolvedRoot = path.resolve(workspaceRoot);
    const resolvedTarget = path.resolve(resolvedRoot, targetPath);
    const relative = path.relative(resolvedRoot, resolvedTarget);
    const allowed =
      relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));

    return {
      path: resolvedTarget,
      allowed,
      reason: allowed ? undefined : "Path is outside the workspace root."
    };
  }
}
