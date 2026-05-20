import { access, readFile } from "node:fs/promises";
import path from "node:path";

import {
  CURRENT_SCHEMA_VERSION,
  type RepoCommandSet,
  type ValidationCommand,
  ensureArtifactDirectories,
  getArtifactFilePath,
  parseJson,
  writeJsonFile
} from "@copilot-architect/shared";

import {
  COMMAND_CONFIG_CATEGORIES,
  type CommandConfigCategory,
  type CommandConfigDefaults,
  type CommandConfigFile,
  type CommandConfigInitResult,
  type CommandConfigValidationResult,
  type ParsedCommandConfig,
  type ParsedCustomCommand
} from "./models.js";

export interface CommandConfigOptions {
  startPath?: string;
  configPath?: string;
}

export interface CommandConfigInitOptions extends CommandConfigOptions {
  overwrite?: boolean;
}

export interface CommandConfigLoadOptions extends CommandConfigOptions {
  allowMissing?: boolean;
}

export class CommandConfigError extends Error {
  constructor(
    readonly configPath: string,
    readonly errors: string[]
  ) {
    super(`Invalid command config at ${configPath}: ${errors.join("; ")}`);
  }
}

export class CommandConfigService {
  async init(options: CommandConfigInitOptions = {}): Promise<CommandConfigInitResult> {
    const workspaceRoot = resolveWorkspaceRoot(options.startPath);
    const configPath = resolveCommandConfigPath(workspaceRoot, options.configPath);

    await ensureArtifactDirectories(workspaceRoot);

    if ((await pathExists(configPath)) && !options.overwrite) {
      return {
        configPath,
        created: false,
        message: "commands.json already exists; left unchanged."
      };
    }

    await writeJsonFile(configPath, createCommandConfigTemplate());

    return {
      configPath,
      created: true,
      message: "commands.json template created."
    };
  }

  async load(options: CommandConfigLoadOptions = {}): Promise<ParsedCommandConfig> {
    const workspaceRoot = resolveWorkspaceRoot(options.startPath);
    const configPath = resolveCommandConfigPath(workspaceRoot, options.configPath);

    if (!(await pathExists(configPath))) {
      if (options.allowMissing) {
        return parseCommandConfig(createCommandConfigTemplate(), configPath);
      }

      throw new CommandConfigError(configPath, [
        "commands.json was not found. Run `npm run cli -- init` to create it."
      ]);
    }

    let contents: string;

    try {
      contents = await readFile(configPath, "utf8");
    } catch (error) {
      throw new CommandConfigError(configPath, [
        `Could not read commands.json: ${error instanceof Error ? error.message : String(error)}`
      ]);
    }

    try {
      return parseCommandConfig(parseJson<unknown>(contents), configPath);
    } catch (error) {
      if (error instanceof CommandConfigError) {
        throw error;
      }

      throw new CommandConfigError(configPath, [
        `commands.json must be valid JSON: ${error instanceof Error ? error.message : String(error)}`
      ]);
    }
  }

  async validate(
    options: CommandConfigOptions = {}
  ): Promise<CommandConfigValidationResult> {
    const workspaceRoot = resolveWorkspaceRoot(options.startPath);
    const configPath = resolveCommandConfigPath(workspaceRoot, options.configPath);

    try {
      const parsed = await this.load({ ...options, allowMissing: false });
      return {
        ok: true,
        configPath,
        errors: [],
        warnings: parsed.warnings,
        parsed
      };
    } catch (error) {
      if (error instanceof CommandConfigError) {
        return {
          ok: false,
          configPath: error.configPath,
          errors: error.errors,
          warnings: []
        };
      }

      return {
        ok: false,
        configPath,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
  }
}

export function createCommandConfigTemplate(): CommandConfigFile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    defaults: {
      timeoutMs: 120_000,
      retryCount: 0,
      required: false,
      overrideDetected: false
    },
    build: [],
    test: [],
    lint: [],
    format: [],
    validation: []
  };
}

export function parseCommandConfig(
  value: unknown,
  configPath = "commands.json"
): ParsedCommandConfig {
  const errors: string[] = [];

  if (!isRecord(value)) {
    throw new CommandConfigError(configPath, [
      "commands.json must contain a JSON object."
    ]);
  }

  validateTopLevelKeys(value, errors);

  const schemaVersion = optionalString(value.schemaVersion, "schemaVersion", errors);
  const defaults = parseDefaults(value.defaults, errors);
  const commands: ParsedCustomCommand[] = [];

  for (const category of COMMAND_CONFIG_CATEGORIES) {
    commands.push(
      ...parseCategoryCommands(category, value[category], defaults, errors)
    );
  }

  commands.push(...parseLegacyValidationCommands(value.commands, defaults, errors));

  if (errors.length > 0) {
    throw new CommandConfigError(configPath, errors);
  }

  const warnings =
    commands.length === 0 ? ["No custom commands are configured yet."] : [];

  return {
    schemaVersion: schemaVersion ?? CURRENT_SCHEMA_VERSION,
    configPath,
    defaults,
    commands,
    normalized: {
      schemaVersion: schemaVersion ?? CURRENT_SCHEMA_VERSION,
      commands: commands.map((command) => command.command),
      defaults: {
        timeoutMs: defaults.timeoutMs,
        retryCount: defaults.retryCount
      }
    },
    warnings
  };
}

export function mergeValidationCommands(
  detectedCommands: ValidationCommand[],
  customCommands: ParsedCustomCommand[]
): ValidationCommand[] {
  const overrideKeys = new Set(
    customCommands
      .filter((customCommand) => customCommand.overrideDetected)
      .flatMap((customCommand) => commandKeys(customCommand.command))
  );
  const merged = [
    ...customCommands.map((customCommand) => customCommand.command),
    ...detectedCommands.filter(
      (command) => !commandKeys(command).some((key) => overrideKeys.has(key))
    )
  ];

  return uniqueValidationCommands(merged);
}

export function mergeCustomCommandsWithDetected(
  detectedCommands: RepoCommandSet,
  customCommands: ParsedCustomCommand[]
): ValidationCommand[] {
  const detectedValidationCommands = [
    ...detectedCommands.test,
    ...detectedCommands.build,
    ...detectedCommands.lint,
    ...detectedCommands.format,
    ...detectedCommands.validation
  ].map((command, index) => ({
    kind: "validation" as const,
    name: command.name || `validation-${index + 1}`,
    command: command.command,
    args: command.args,
    cwd: command.cwd,
    description: command.description,
    confidence: command.confidence,
    source: command.source,
    required: index < 3
  }));

  return mergeValidationCommands(detectedValidationCommands, customCommands);
}

function parseDefaults(value: unknown, errors: string[]): CommandConfigDefaults {
  const defaults: CommandConfigDefaults = {
    timeoutMs: 120_000,
    retryCount: 0,
    required: false,
    overrideDetected: false
  };

  if (value === undefined) {
    return defaults;
  }

  if (!isRecord(value)) {
    errors.push("defaults must be an object when provided.");
    return defaults;
  }

  if (value.timeoutMs !== undefined) {
    defaults.timeoutMs = positiveNumber(value.timeoutMs, "defaults.timeoutMs", errors);
  }

  if (value.retryCount !== undefined) {
    defaults.retryCount = nonNegativeNumber(
      value.retryCount,
      "defaults.retryCount",
      errors
    );
  }

  if (value.required !== undefined) {
    defaults.required = booleanValue(value.required, "defaults.required", errors);
  }

  if (value.overrideDetected !== undefined) {
    defaults.overrideDetected = booleanValue(
      value.overrideDetected,
      "defaults.overrideDetected",
      errors
    );
  }

  return defaults;
}

function parseCategoryCommands(
  category: CommandConfigCategory,
  value: unknown,
  defaults: CommandConfigDefaults,
  errors: string[]
): ParsedCustomCommand[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push(`${category} must be an array when provided.`);
    return [];
  }

  return value.flatMap((entry, index) =>
    parseCategoryCommand(category, entry, index, defaults, errors)
  );
}

function parseCategoryCommand(
  category: CommandConfigCategory,
  value: unknown,
  index: number,
  defaults: CommandConfigDefaults,
  errors: string[]
): ParsedCustomCommand[] {
  const prefix = `${category}[${index}]`;

  if (!isRecord(value)) {
    errors.push(`${prefix} must be an object.`);
    return [];
  }

  const name = requiredString(value.name, `${prefix}.name`, errors);
  const commandText = requiredString(value.command, `${prefix}.command`, errors);
  const workingDirectory = optionalString(
    value.workingDirectory,
    `${prefix}.workingDirectory`,
    errors
  );
  const description = optionalString(
    value.description,
    `${prefix}.description`,
    errors
  );
  const timeoutMs =
    value.timeoutMs === undefined
      ? defaults.timeoutMs
      : positiveNumber(value.timeoutMs, `${prefix}.timeoutMs`, errors);
  const retryCount =
    value.retryCount === undefined
      ? defaults.retryCount
      : nonNegativeNumber(value.retryCount, `${prefix}.retryCount`, errors);
  const required =
    value.required === undefined
      ? defaults.required
      : booleanValue(value.required, `${prefix}.required`, errors);
  const overrideDetected =
    value.overrideDetected === undefined
      ? defaults.overrideDetected
      : booleanValue(value.overrideDetected, `${prefix}.overrideDetected`, errors);

  if (!name || !commandText) {
    return [];
  }

  const parts = splitCommandLine(commandText, `${prefix}.command`, errors);

  if (parts.length === 0) {
    return [];
  }

  return [
    {
      category,
      rawCommand: commandText,
      overrideDetected,
      command: {
        kind: "validation",
        name,
        command: parts[0] ?? "",
        args: parts.slice(1),
        cwd: workingDirectory,
        description,
        confidence: "high",
        source: `commands.json:${category}`,
        required,
        timeoutMs,
        retryCount
      }
    }
  ];
}

function parseLegacyValidationCommands(
  value: unknown,
  defaults: CommandConfigDefaults,
  errors: string[]
): ParsedCustomCommand[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push("commands must be an array when provided.");
    return [];
  }

  return value.flatMap((entry, index) => {
    const prefix = `commands[${index}]`;

    if (!isRecord(entry)) {
      errors.push(`${prefix} must be an object.`);
      return [];
    }

    const name = requiredString(entry.name, `${prefix}.name`, errors);
    const command = requiredString(entry.command, `${prefix}.command`, errors);
    const args = entry.args;

    if (args !== undefined && !isStringArray(args)) {
      errors.push(`${prefix}.args must be an array of strings when provided.`);
      return [];
    }

    if (!name || !command) {
      return [];
    }

    return [
      {
        category: "validation" as const,
        rawCommand: [command, ...(args ?? [])].join(" "),
        overrideDetected: booleanValue(
          entry.overrideDetected ?? defaults.overrideDetected,
          `${prefix}.overrideDetected`,
          errors
        ),
        command: {
          kind: "validation",
          name,
          command,
          args: args ?? [],
          cwd: optionalString(entry.cwd, `${prefix}.cwd`, errors),
          description: optionalString(
            entry.description,
            `${prefix}.description`,
            errors
          ),
          confidence: "high",
          source:
            optionalString(entry.source, `${prefix}.source`, errors) ?? "commands.json",
          required:
            entry.required === undefined
              ? defaults.required
              : booleanValue(entry.required, `${prefix}.required`, errors),
          timeoutMs:
            entry.timeoutMs === undefined
              ? defaults.timeoutMs
              : positiveNumber(entry.timeoutMs, `${prefix}.timeoutMs`, errors),
          retryCount:
            entry.retryCount === undefined
              ? defaults.retryCount
              : nonNegativeNumber(entry.retryCount, `${prefix}.retryCount`, errors)
        }
      }
    ];
  });
}

function splitCommandLine(
  commandText: string,
  fieldName: string,
  errors: string[]
): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;
  let escaping = false;

  for (const character of commandText) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = undefined;
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (escaping) {
    current += "\\";
  }

  if (quote) {
    errors.push(`${fieldName} has an unterminated quoted string.`);
    return [];
  }

  if (current) {
    tokens.push(current);
  }

  if (tokens.length === 0) {
    errors.push(`${fieldName} must contain at least one command token.`);
  }

  return tokens;
}

function validateTopLevelKeys(value: Record<string, unknown>, errors: string[]): void {
  const allowedKeys = new Set([
    "schemaVersion",
    "defaults",
    "commands",
    ...COMMAND_CONFIG_CATEGORIES
  ]);

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown top-level property "${key}" in commands.json.`);
    }
  }
}

function commandKeys(command: ValidationCommand): string[] {
  return [
    `name:${command.name}`,
    `command:${[command.command, ...command.args].join(" ")}`
  ];
}

function uniqueValidationCommands(commands: ValidationCommand[]): ValidationCommand[] {
  const seen = new Set<string>();
  const result: ValidationCommand[] = [];

  for (const command of commands) {
    const key = `command:${[command.command, ...command.args].join(" ")}`;

    if (!seen.has(key)) {
      seen.add(key);
      result.push(command);
    }
  }

  return result;
}

function requiredString(
  value: unknown,
  fieldName: string,
  errors: string[]
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${fieldName} must be a non-empty string.`);
    return undefined;
  }

  return value;
}

function optionalString(
  value: unknown,
  fieldName: string,
  errors: string[]
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${fieldName} must be a non-empty string when provided.`);
    return undefined;
  }

  return value;
}

function positiveNumber(value: unknown, fieldName: string, errors: string[]): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    errors.push(`${fieldName} must be a positive number.`);
    return 1;
  }

  return value;
}

function nonNegativeNumber(
  value: unknown,
  fieldName: string,
  errors: string[]
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    errors.push(`${fieldName} must be a non-negative number.`);
    return 0;
  }

  return value;
}

function booleanValue(value: unknown, fieldName: string, errors: string[]): boolean {
  if (typeof value !== "boolean") {
    errors.push(`${fieldName} must be a boolean.`);
    return false;
  }

  return value;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveWorkspaceRoot(startPath: string | undefined): string {
  return path.resolve(startPath ?? process.cwd());
}

function resolveCommandConfigPath(
  workspaceRoot: string,
  configPath: string | undefined
): string {
  if (!configPath) {
    return getArtifactFilePath(workspaceRoot, "commands");
  }

  return path.isAbsolute(configPath)
    ? configPath
    : path.resolve(workspaceRoot, configPath);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
