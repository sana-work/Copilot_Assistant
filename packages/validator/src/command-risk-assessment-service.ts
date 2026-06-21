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

    // Hard concerns can NEVER be waived by an allowlist entry: a destructive
    // command or one pointed outside the workspace is always blocked.
    const hard: Concern[] = [];
    // Soft concerns require human approval but may be waived by an explicit
    // allowedPatterns match (e.g. a team intentionally permits a custom tool).
    const soft: Concern[] = [];

    for (const pattern of policy.blockedPatterns) {
      if (new RegExp(pattern, "i").test(commandText)) {
        hard.push({
          rule: ruleNameForPattern(pattern),
          reason: `Command matches blocked pattern: ${pattern}`
        });
      }
    }

    if (policy.workspaceBoundaryRequired && command.cwd) {
      const boundary = this.pathBoundaryService.checkPath(workspaceRoot, command.cwd);

      if (!boundary.allowed) {
        hard.push({
          rule: "workspace-boundary",
          reason: boundary.reason ?? "Command path is outside the workspace root."
        });
      }
    }

    const support = classifyCommandSupport(command);

    if (support === "unsupported") {
      soft.push({
        rule: "unsupported-command",
        reason: `Command executable "${command.command}" is not in the safe command set.`
      });
    } else if (support === "custom-unverified") {
      soft.push({
        rule: "custom-command-unverified",
        reason: `Custom command "${commandText}" runs an executable outside the safe set; review it before running.`
      });
    }

    if (isGitHistoryMutation(commandText)) {
      soft.push({
        rule: "git-history-warning",
        reason: "Command modifies git history or deletes git working tree state."
      });
    }

    // An allowlist match only waives SOFT concerns. Hard blocks and workspace
    // boundary violations stand regardless, closing the previous foot-gun where
    // one allowedPatterns entry could re-enable `rm -rf` or an out-of-tree path.
    const explicitlyAllowed =
      soft.length > 0 &&
      policy.allowedPatterns.some((pattern) =>
        new RegExp(pattern, "i").test(commandText)
      );
    const effectiveSoft = explicitlyAllowed ? [] : soft;
    const concerns = [...hard, ...effectiveSoft];
    const blocked = hard.length > 0;

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      command: commandText,
      // Runs without human approval only when nothing remains after waiving.
      allowed: concerns.length === 0,
      riskLevel: blocked ? "blocked" : effectiveSoft.length > 0 ? "medium" : "low",
      reasons: concerns.map((concern) => concern.reason),
      matchedRules: concerns.map((concern) => concern.rule),
      requiresHumanApproval: concerns.length > 0
    };
  }
}

interface Concern {
  rule: string;
  reason: string;
}

type CommandSupport = "supported" | "unsupported" | "custom-unverified";

function isGitHistoryMutation(commandText: string): boolean {
  return /\bgit\s+(?:push\s+(?:--force(?:-with-lease)?|-[fF]\b)|rebase|reset\s+--hard|clean\s+-)/i.test(
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

function classifyCommandSupport(command: ValidationCommand): CommandSupport {
  // A custom command declared in commands.json is no longer blanket-trusted.
  // Known-safe executables still pass; anything else is surfaced as
  // "custom-unverified" so it requires human approval instead of running silently.
  const isCustom = command.source.startsWith("commands.json");
  const fallback: CommandSupport = isCustom ? "custom-unverified" : "unsupported";
  const executable = path.basename(command.command).toLowerCase();

  if (supportedExecutables.has(executable)) {
    return "supported";
  }

  if (executable === "python" || executable === "python3" || executable === "py") {
    if (command.args[0] === "-m") {
      return [
        "pytest",
        "unittest",
        "mypy",
        "flake8",
        "black",
        "ruff",
        "isort",
        "pylint"
      ].includes(command.args[1] ?? "")
        ? "supported"
        : fallback;
    }
    // Allow setup.py test/build but not setup.py install which may mutate the system
    if (command.args[0] === "setup.py") {
      return command.args[1] === "test" || command.args[1] === "build"
        ? "supported"
        : fallback;
    }
    return fallback;
  }

  if (executable === "node") {
    // Allow node to run scripts only (not -e exec)
    return command.args.length > 0 &&
      command.args[0] !== "-e" &&
      !command.args.includes("--eval")
      ? "supported"
      : fallback;
  }

  return fallback;
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
