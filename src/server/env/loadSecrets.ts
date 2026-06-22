import { ConfigError } from "../config/ConfigError.js";
import type { AppSecrets } from "./AppSecrets.js";

export function loadSecrets(env: NodeJS.ProcessEnv): AppSecrets {
  return {
    githubAppId: requireEnv(env, "GITHUB_APP_ID"),
    githubAppClientId: requireEnv(env, "GITHUB_APP_CLIENT_ID"),
    githubAppClientSecret: requireEnv(env, "GITHUB_APP_CLIENT_SECRET"),
    githubAppPrivateKey: requireEnv(env, "GITHUB_APP_PRIVATE_KEY"),
    sessionSecret: requireEnv(env, "SESSION_SECRET")
  };
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new ConfigError(`Missing required environment variable '${name}'.`);
  }

  return value;
}
