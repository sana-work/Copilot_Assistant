import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  CURRENT_SCHEMA_VERSION,
  type SafetyPolicy,
  ensureArtifactDirectories,
  getArtifactFilePath,
  parseJson,
  writeJsonFile
} from "@copilot-architect/shared";

import type { SafetyPolicyInitResult, SafetyPolicyValidationResult } from "./models.js";

export class SafetyPolicyService {
  async init(
    startPath = process.cwd(),
    overwrite = false
  ): Promise<SafetyPolicyInitResult> {
    const workspaceRoot = path.resolve(startPath);
    const policyPath = getArtifactFilePath(workspaceRoot, "policy");

    await ensureArtifactDirectories(workspaceRoot);

    if (!overwrite && (await fileExists(policyPath))) {
      return {
        policyPath,
        created: false,
        message: "policy.json already exists; left unchanged."
      };
    }

    await writeJsonFile(policyPath, createDefaultSafetyPolicy());

    return {
      policyPath,
      created: true,
      message: "policy.json template created."
    };
  }

  async load(startPath = process.cwd()): Promise<SafetyPolicy> {
    const workspaceRoot = path.resolve(startPath);
    const policyPath = getArtifactFilePath(workspaceRoot, "policy");

    if (!(await fileExists(policyPath))) {
      return createDefaultSafetyPolicy();
    }

    return parseJson<SafetyPolicy>(await readFile(policyPath, "utf8"));
  }

  async validate(startPath = process.cwd()): Promise<SafetyPolicyValidationResult> {
    const workspaceRoot = path.resolve(startPath);
    const policyPath = getArtifactFilePath(workspaceRoot, "policy");
    const errors: string[] = [];
    const warnings: string[] = [];
    let policy: SafetyPolicy;

    try {
      policy = await this.load(workspaceRoot);
    } catch (error) {
      return {
        ok: false,
        policyPath,
        policy: createDefaultSafetyPolicy(),
        errors: [
          `policy.json must be valid JSON: ${error instanceof Error ? error.message : String(error)}`
        ],
        warnings
      };
    }

    if (!policy.schemaVersion) {
      errors.push("policy.schemaVersion is required.");
    }

    if (!policy.id) {
      errors.push("policy.id is required.");
    }

    if (!Array.isArray(policy.blockedPatterns) || policy.blockedPatterns.length === 0) {
      errors.push("policy.blockedPatterns must contain at least one blocked pattern.");
    }

    if (!Array.isArray(policy.secretRedactionPatterns)) {
      errors.push("policy.secretRedactionPatterns must be an array.");
    }

    for (const pattern of [
      ...(policy.blockedPatterns ?? []),
      ...(policy.allowedPatterns ?? []),
      ...(policy.secretRedactionPatterns ?? [])
    ]) {
      try {
        new RegExp(pattern);
      } catch {
        errors.push(`Invalid regular expression in policy: ${pattern}`);
      }
    }

    if (!policy.requireApprovalForHandoff) {
      warnings.push("Implementation handoff approval is not required by policy.");
    }

    if (!policy.workspaceBoundaryRequired) {
      warnings.push("Workspace boundary checks are disabled by policy.");
    }

    return {
      ok: errors.length === 0,
      policyPath,
      policy,
      errors,
      warnings
    };
  }
}

export function createDefaultSafetyPolicy(): SafetyPolicy {
  const now = new Date().toISOString();

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: now,
    id: "default-safety-policy",
    name: "Default Safety Policy",
    defaultAllow: true,
    blockedPatterns: DEFAULT_BLOCKED_PATTERNS,
    allowedPatterns: [],
    secretRedactionPatterns: DEFAULT_SECRET_REDACTION_PATTERNS,
    requireApprovalForHandoff: true,
    workspaceBoundaryRequired: true
  };
}

export const DEFAULT_BLOCKED_PATTERNS = [
  String.raw`\brm\s+-[^\s]*(?:r[^\s]*f|f[^\s]*r)`,
  String.raw`\bdel\s+\/s\b`,
  String.raw`^(?:format|format\.com)(?:\s|$)`,
  String.raw`\bdiskpart\b`,
  String.raw`\bgit\s+clean\b(?=.*-[^\s]*f)(?=.*-[^\s]*d)(?=.*-[^\s]*x)`,
  String.raw`\bgit\s+reset\s+--hard\b`,
  String.raw`\bchmod\s+-r\s+777\b`,
  String.raw`\bsudo\s+rm\b`,
  String.raw`\bRemove-Item\s+-Recurse\b`
];

export const DEFAULT_SECRET_REDACTION_PATTERNS = [
  String.raw`\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY)[A-Z0-9_]*)=([^\s]+)`,
  String.raw`\bBearer\s+[A-Za-z0-9._~+/=-]+`,
  String.raw`\bgh[pousr]_[A-Za-z0-9_]+`
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}
