import type {
  AuditLogEntry,
  CommandRiskAssessment,
  CustomCommandConfig,
  SafetyPolicy,
  ValidationCommand,
  ValidationResult,
  ValidationStatus
} from "@copilot-architect/shared";

export const COMMAND_CONFIG_CATEGORIES = [
  "build",
  "test",
  "lint",
  "format",
  "validation"
] as const;

export type CommandConfigCategory = (typeof COMMAND_CONFIG_CATEGORIES)[number];

export interface CommandConfigEntry {
  name: string;
  command: string;
  workingDirectory?: string;
  description?: string;
  timeoutMs?: number;
  retryCount?: number;
  required?: boolean;
  overrideDetected?: boolean;
}

export interface CommandConfigDefaults {
  timeoutMs: number;
  retryCount: number;
  required: boolean;
  overrideDetected: boolean;
}

export interface CommandConfigFile {
  schemaVersion?: string;
  defaults?: Partial<CommandConfigDefaults>;
  build?: CommandConfigEntry[];
  test?: CommandConfigEntry[];
  lint?: CommandConfigEntry[];
  format?: CommandConfigEntry[];
  validation?: CommandConfigEntry[];
  commands?: ValidationCommand[];
}

export interface ParsedCustomCommand {
  category: CommandConfigCategory;
  rawCommand: string;
  overrideDetected: boolean;
  command: ValidationCommand;
}

export interface ParsedCommandConfig {
  schemaVersion: string;
  configPath: string;
  defaults: CommandConfigDefaults;
  commands: ParsedCustomCommand[];
  normalized: CustomCommandConfig;
  warnings: string[];
}

export interface CommandConfigValidationResult {
  ok: boolean;
  configPath: string;
  errors: string[];
  warnings: string[];
  parsed?: ParsedCommandConfig;
}

export interface CommandConfigInitResult {
  configPath: string;
  created: boolean;
  message: string;
}

export interface ValidationServiceOptions {
  startPath?: string;
  categories?: CommandConfigCategory[];
  timeoutMs?: number;
  json?: boolean;
  onOutput?: (event: ValidationOutputEvent) => void;
}

export interface ValidationOutputEvent {
  commandName: string;
  stream: "stdout" | "stderr" | "system";
  text: string;
}

export interface ValidationCommandCandidate {
  category: CommandConfigCategory;
  source: "detected" | "custom";
  command: ValidationCommand;
}

export interface ValidationRunArtifactPaths {
  timestampJsonPath: string;
  timestampMarkdownPath: string;
  timestampLogPath: string;
  latestJsonPath: string;
  latestMarkdownPath: string;
}

export interface ValidationReportArtifact {
  schemaVersion: string;
  generatedAt: string;
  id: string;
  repoRoot: string;
  status: ValidationStatus;
  summary: string;
  selectedCategories: CommandConfigCategory[];
  plannedCommands: ValidationCommandCandidate[];
  results: ValidationResult[];
  riskAssessments: CommandRiskAssessment[];
  failureSummary: string[];
  fixPrompt: string;
  artifactPaths: ValidationRunArtifactPaths;
}

export interface ValidationRunResult {
  repoRoot: string;
  report: ValidationReportArtifact;
  markdown: string;
  logText: string;
}

export interface SafetyPolicyValidationResult {
  ok: boolean;
  policyPath: string;
  policy: SafetyPolicy;
  errors: string[];
  warnings: string[];
}

export interface SafetyPolicyInitResult {
  policyPath: string;
  created: boolean;
  message: string;
}

export interface RedactionResult {
  text: string;
  redactionsApplied: string[];
}

export interface PathBoundaryResult {
  path: string;
  allowed: boolean;
  reason?: string;
}

export interface GitCheckpointResult {
  repoRoot: string;
  gitAvailable: boolean;
  created: boolean;
  head?: string;
  branch?: string;
  dirty: boolean;
  checkpointPath?: string;
  rollbackGuide?: string;
  message: string;
}

export interface AuditListResult {
  auditPath: string;
  entries: AuditLogEntry[];
}
