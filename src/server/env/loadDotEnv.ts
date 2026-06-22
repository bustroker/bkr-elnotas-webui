import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadDotEnv(dotEnvPath = ".env"): void {
  const resolvedPath = path.resolve(dotEnvPath);
  if (!existsSync(resolvedPath)) {
    return;
  }

  const lines = readFileSync(resolvedPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = normalizeValue(trimmed.slice(separatorIndex + 1).trim());
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function normalizeValue(value: string): string {
  const unquoted = stripMatchingQuotes(value);
  return unquoted.replace(/\\n/g, "\n");
}

function stripMatchingQuotes(value: string): string {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
