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

  if (executable === "python") {
    return (
      command.args[0] === "-m" &&
      (command.args[1] === "pytest" || command.args[1] === "unittest")
    );
  }

  return false;
}

const supportedExecutables = new Set([
  "npm",
  "pnpm",
  "yarn",
  "pytest",
  "python",
  "poetry",
  "maven",
  "mvn",
  "mvnw",
  "gradle",
  "gradlew",
  "ng",
  "vite",
  "jest",
  "vitest",
  "eslint",
  "prettier"
]);
