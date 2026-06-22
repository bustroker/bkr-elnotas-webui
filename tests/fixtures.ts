import type { AppConfig } from "../src/server/config/AppConfig.js";
import type { AppSecrets } from "../src/server/env/AppSecrets.js";

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    github: {
      owner: "owner",
      repo: "repo",
      branch: "main"
    },
    notesFolder: "notes",
    trashFolder: "trash",
    trashSizeLimit: 2,
    localWorkingCopyFolder: "./data/test-working-copy",
    allowedGitHubUsernames: ["alice"],
    ...overrides
  };
}

export function testSecrets(): AppSecrets {
  return {
    githubAppId: "1",
    githubAppClientId: "client-id",
    githubAppClientSecret: "client-secret",
    githubAppPrivateKey: "private-key",
    sessionSecret: "test-session-secret"
  };
}
