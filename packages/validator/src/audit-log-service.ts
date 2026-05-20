import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CURRENT_SCHEMA_VERSION,
  type AuditLogEntry,
  type JsonObject,
  getArtifactDirectoryPath
} from "@copilot-architect/shared";

import type { AuditListResult } from "./models.js";
import { SecretRedactionService } from "./secret-redaction-service.js";

export class AuditLogService {
  constructor(private readonly redactionService = new SecretRedactionService()) {}

  async record(
    workspaceRoot: string,
    input: {
      action: string;
      actor: AuditLogEntry["actor"];
      target?: string;
      summary: string;
      metadata?: JsonObject;
    }
  ): Promise<AuditLogEntry> {
    const auditPath = getAuditLogPath(workspaceRoot);
    const redactedSummary = this.redactionService.redact(input.summary);
    const redactedMetadata = this.redactionService.redact(
      JSON.stringify(input.metadata ?? {})
    );
    const entry: AuditLogEntry = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: input.action,
      actor: input.actor,
      target: input.target,
      summary: redactedSummary.text,
      metadata: JSON.parse(redactedMetadata.text) as JsonObject,
      redactionsApplied: [
        ...new Set([
          ...redactedSummary.redactionsApplied,
          ...redactedMetadata.redactionsApplied
        ])
      ]
    };

    await mkdir(path.dirname(auditPath), { recursive: true });
    await writeFile(auditPath, `${JSON.stringify(entry)}\n`, {
      encoding: "utf8",
      flag: "a"
    });

    return entry;
  }

  async list(workspaceRoot: string, limit = 50): Promise<AuditListResult> {
    const auditPath = getAuditLogPath(workspaceRoot);

    try {
      const text = await readFile(auditPath, "utf8");
      const entries = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as AuditLogEntry)
        .slice(-limit);

      return { auditPath, entries };
    } catch {
      return { auditPath, entries: [] };
    }
  }
}

export function getAuditLogPath(workspaceRoot: string): string {
  return path.join(getArtifactDirectoryPath(workspaceRoot, "audit"), "audit.jsonl");
}
