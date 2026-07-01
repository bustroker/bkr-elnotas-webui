import { readFile } from "node:fs/promises";
import path from "node:path";
import { ConfigError } from "./ConfigError.js";
import type { AppConfig } from "./AppConfig.js";

export async function loadConfig(configFilePath: string): Promise<AppConfig> {
  const resolvedPath = path.resolve(configFilePath);
  const fileContent = await readFile(resolvedPath, "utf8").catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Failed to read config file '${resolvedPath}': ${message}`);
  });

  const parsed = parseJson(fileContent, resolvedPath);
  return validateConfig(parsed);
}

function parseJson(fileContent: string, resolvedPath: string): unknown {
  try {
    return JSON.parse(fileContent) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Failed to parse config file '${resolvedPath}': ${message}`);
  }
}

function validateConfig(value: unknown): AppConfig {
  const root = requireRecord(value, "config");
  const notesGitHubRepository = requireRecord(root.notesGitHubRepository, "notesGitHubRepository");

  return {
    notesGitHubRepository: {
      account: requireNonEmptyString(notesGitHubRepository.account, "notesGitHubRepository.account"),
      repo: requireNonEmptyString(notesGitHubRepository.repo, "notesGitHubRepository.repo"),
      branch: requireNonEmptyString(notesGitHubRepository.branch, "notesGitHubRepository.branch")
    },
    notesFolder: requireRelativeFolder(root.notesFolder, "notesFolder"),
    trashFolder: requireRelativeFolder(root.trashFolder, "trashFolder"),
    trashSizeLimit: requirePositiveInteger(root.trashSizeLimit, "trashSizeLimit"),
    localWorkingCopyFolder: requireNonEmptyString(root.localWorkingCopyFolder, "localWorkingCopyFolder"),
    allowedGitHubUsernames: requireStringList(root.allowedGitHubUsernames, "allowedGitHubUsernames"),
    keepAlive: requireKeepAliveConfig(root.keepAlive)
  };
}

function requireKeepAliveConfig(value: unknown) {
  const keepAlive = requireRecord(value, "keepAlive");
  const enabled = requireBoolean(keepAlive.enabled, "keepAlive.enabled");

  return {
    enabled,
    url: enabled ? requireHttpUrl(keepAlive.url, "keepAlive.url") : optionalString(keepAlive.url),
    intervalMinutes: enabled
      ? requirePositiveInteger(keepAlive.intervalMinutes, "keepAlive.intervalMinutes")
      : optionalPositiveInteger(keepAlive.intervalMinutes, "keepAlive.intervalMinutes")
  };
}

function requireRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ConfigError(`Config field '${fieldName}' must be an object.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ConfigError(`Config field '${fieldName}' must be a non-empty string.`);
  }

  return value.trim();
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new ConfigError(`Config field '${fieldName}' must be a boolean.`);
  }

  return value;
}

function requireHttpUrl(value: unknown, fieldName: string): string {
  const url = requireNonEmptyString(value, fieldName);
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new ConfigError(`Config field '${fieldName}' must be an HTTP URL.`);
  }

  return url;
}

function requireRelativeFolder(value: unknown, fieldName: string): string {
  const folder = requireNonEmptyString(value, fieldName);
  if (path.isAbsolute(folder) || folder.includes("..") || folder.includes("\\") || folder.startsWith("/")) {
    throw new ConfigError(`Config field '${fieldName}' must be a simple relative folder path.`);
  }

  return folder.replace(/^\.?\//, "").replace(/\/$/, "");
}

function requirePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ConfigError(`Config field '${fieldName}' must be a positive integer.`);
  }

  return value;
}

function optionalPositiveInteger(value: unknown, fieldName: string): number {
  if (value === undefined) {
    return 1;
  }

  return requirePositiveInteger(value, fieldName);
}

function requireStringList(value: unknown, fieldName: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConfigError(`Config field '${fieldName}' must be a non-empty string array.`);
  }

  return value.map((item, index) => requireNonEmptyString(item, `${fieldName}[${index}]`));
}
