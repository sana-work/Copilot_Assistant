import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return parseJson<T>(await readFile(filePath, "utf8"));
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stringifyJson(value), "utf8");
}
