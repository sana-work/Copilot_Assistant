import path from "node:path";

import {
  CURRENT_SCHEMA_VERSION,
  type CommandRiskAssessment,
  type SafetyPolicy,
  type ValidationCommand
} from "@copilot-architect/shared";

import { PathBoundaryService } from "./path-boundary-service.js";
import { createDefaultSafetyPolicy } from "./safety-policy-service.js";

export class CommandRiskAssessmentService {
  constructor(private readonly pathBoundaryService = new PathBoundaryService()) {}

  assess(
    workspaceRoot: string,
    command: ValidationCommand,
    policy: SafetyPolicy = createDefaultSafetyPolicy()
  ): CommandRiskAssessment {
    const commandText = [command.command, ...command.args].join(" ");
    const reasons: string[] = [];
    const matchedRules: string[] = [];

    for (const pattern of policy.blockedPatterns) {
      const rule = new RegExp(pattern, "i");

      if (rule.test(commandText)) {
        reasons.push(`Command matches blocked pattern: ${pattern}`);
        matchedRules.push(ruleNameForPattern(pattern));
      }
    }

    if (policy.workspaceBoundaryRequired && command.cwd) {
      const boundary = this.pathBoundaryService.checkPath(workspaceRoot, command.cwd);

      if (!boundary.allowed) {
        reasons.push(boundary.reason ?? "Command path is outside the workspace root.");
        matchedRules.push("workspace-boundary");
      }
    }

    if (!isSupportedCommand(command)) {
      reasons.push(
        `Command executable "${command.command}" is not in the safe command set.`
      );
      matchedRules.push("unsupported-command");
    }

    if (isGitHistoryMutation(commandText)) {
      reasons.push("Command modifies git history or deletes git working tree state.");
      matchedRules.push("git-history-warning");
    }

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      command: commandText,
      allowed:
        reasons.length === 0 ||
        policy.allowedPatterns.some((pattern) =>
          new RegExp(pattern, "i").test(commandText)
        ),
      riskLevel: reasons.length === 0 ? "low" : "blocked",
      reasons,
      matchedRules,
      requiresHumanApproval: reasons.length > 0
    };
  }
}

function isGitHistoryMutation(commandText: string): boolean {
  return /\bgit\s+(?:push\s+--force|rebase|reset\s+--hard|clean\s+-)/i.test(
    commandText
  );
}

function ruleNameForPattern(pattern: string): string {
  if (pattern.includes(String.raw`\brm`)) return "rm-rf";
  if (pattern.includes(String.raw`\bdel`)) return "del-s";
  if (pattern.includes("format")) return "format";
  if (pattern.includes("diskpart")) return "diskpart";
  if (pattern.includes("git") && pattern.includes("clean")) return "git-clean-fdx";
  if (pattern.includes("git") && pattern.includes("reset")) return "git-reset-hard";
  if (pattern.includes("chmod")) return "chmod-777";
  if (pattern.includes("sudo")) return "sudo-rm";
  if (pattern.includes("Remove-Item")) return "remove-item-recurse";
  return pattern;
}

function isSupportedCommand(command: ValidationCommand): boolean {
  const executable = path.basename(command.command).toLowerCase();

  if (command.source.startsWith("commands.json")) {
    return true;
  }

  if (supportedExecutables.has(executable)) {
    return true;
  }

  if (executable === "python" || executable === "python3" || executable === "py") {
    if (command.args[0] === "-m") {
      return (
        command.args[1] === "pytest" ||
        command.args[1] === "unittest" ||
        command.args[1] === "mypy" ||
        command.args[1] === "flake8" ||
        command.args[1] === "black" ||
        command.args[1] === "ruff" ||
        command.args[1] === "isort" ||
        command.args[1] === "pylint"
      );
    }
    // Allow setup.py test/build but not setup.py install which may mutate the system
    if (command.args[0] === "setup.py") {
      return command.args[1] === "test" || command.args[1] === "build";
    }
    return false;
  }

  if (executable === "node") {
    // Allow node to run scripts only (not -e exec)
    return command.args.length > 0 && command.args[0] !== "-e" && !command.args.includes("--eval");
  }

  return false;
}

const supportedExecutables = new Set([
  // JavaScript / TypeScript package managers and runtimes
  "npm",
  "npx",
  "pnpm",
  "yarn",
  "bun",
  "deno",
  "node",
  // TypeScript / linting
  "tsc",
  "eslint",
  "prettier",
  "biome",
  // Testing
  "jest",
  "vitest",
  "mocha",
  "jasmine",
  "playwright",
  "cypress",
  // Build tools
  "vite",
  "webpack",
  "rollup",
  "esbuild",
  "turbo",
  "nx",
  // Python
  "pytest",
  "python",
  "python3",
  "py",
  "poetry",
  "pipenv",
  "uv",
  "ruff",
  "mypy",
  "flake8",
  "black",
  // JVM
  "maven",
  "mvn",
  "mvnw",
  "gradle",
  "gradlew",
  // .NET (read-only operations only — actual run is blocked by policy)
  "dotnet",
  // Angular
  "ng",
  // Systems languages
  "cargo",
  "go",
  "rustfmt",
  "clippy"
]);
