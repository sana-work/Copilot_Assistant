import type { CustomCommandConfig, ValidationCommand } from "@copilot-architect/shared";

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
