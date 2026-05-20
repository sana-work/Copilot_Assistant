import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  ARTIFACT_DIRECTORY,
  ARTIFACT_DIRECTORY_NAMES,
  ARTIFACT_FILE_NAMES
} from "./constants.js";
import { readJsonFile, writeJsonFile } from "./json.js";

export type ArtifactFileKey = keyof typeof ARTIFACT_FILE_NAMES;

export type ArtifactDirectoryKey = keyof typeof ARTIFACT_DIRECTORY_NAMES;

export function getArtifactRoot(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, ARTIFACT_DIRECTORY);
}

export function getArtifactFilePath(
  workspaceRoot: string,
  key: ArtifactFileKey
): string {
  return path.join(getArtifactRoot(workspaceRoot), ARTIFACT_FILE_NAMES[key]);
}

export function getArtifactDirectoryPath(
  workspaceRoot: string,
  key: ArtifactDirectoryKey
): string {
  return path.join(getArtifactRoot(workspaceRoot), ARTIFACT_DIRECTORY_NAMES[key]);
}

export async function ensureArtifactDirectories(workspaceRoot: string): Promise<void> {
  await mkdir(getArtifactRoot(workspaceRoot), { recursive: true });

  await Promise.all(
    Object.keys(ARTIFACT_DIRECTORY_NAMES).map((key) =>
      mkdir(getArtifactDirectoryPath(workspaceRoot, key as ArtifactDirectoryKey), {
        recursive: true
      })
    )
  );
}

export async function readJsonArtifact<T>(
  workspaceRoot: string,
  key: ArtifactFileKey
): Promise<T> {
  return readJsonFile<T>(getArtifactFilePath(workspaceRoot, key));
}

export async function writeJsonArtifact<T>(
  workspaceRoot: string,
  key: ArtifactFileKey,
  value: T
): Promise<void> {
  await writeJsonFile(getArtifactFilePath(workspaceRoot, key), value);
}
