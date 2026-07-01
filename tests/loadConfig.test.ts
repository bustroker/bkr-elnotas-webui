import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/server/config/loadConfig.js";

describe("loadConfig", () => {
  it("loads valid application config", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "elnotas-config-"));
    const filePath = path.join(folder, "app.json");
    await writeFile(
      filePath,
      JSON.stringify({
        notesGitHubRepository: { account: "owner", repo: "repo", branch: "main" },
        notesFolder: "notes",
        trashFolder: "trash",
        trashSizeLimit: 10,
        localWorkingCopyFolder: "./data/working-copy",
        allowedGitHubUsernames: ["alice"],
        keepAlive: {
          enabled: true,
          url: "https://example.com/api/health",
          intervalMinutes: 5
        }
      }),
      "utf8"
    );

    await expect(loadConfig(filePath)).resolves.toMatchObject({
      notesGitHubRepository: { account: "owner", repo: "repo", branch: "main" },
      notesFolder: "notes",
      trashFolder: "trash",
      trashSizeLimit: 10,
      keepAlive: {
        enabled: true,
        url: "https://example.com/api/health",
        intervalMinutes: 5
      }
    });
  });

  it("allows disabled keep-alive without a URL", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "elnotas-config-"));
    const filePath = path.join(folder, "app.json");
    await writeFile(
      filePath,
      JSON.stringify({
        notesGitHubRepository: { account: "owner", repo: "repo", branch: "main" },
        notesFolder: "notes",
        trashFolder: "trash",
        trashSizeLimit: 10,
        localWorkingCopyFolder: "./data/working-copy",
        allowedGitHubUsernames: ["alice"],
        keepAlive: {
          enabled: false,
          url: "",
          intervalMinutes: 5
        }
      }),
      "utf8"
    );

    await expect(loadConfig(filePath)).resolves.toMatchObject({
      keepAlive: {
        enabled: false,
        url: "",
        intervalMinutes: 5
      }
    });
  });

  it("rejects enabled keep-alive without an HTTP URL", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "elnotas-config-"));
    const filePath = path.join(folder, "app.json");
    await writeFile(
      filePath,
      JSON.stringify({
        notesGitHubRepository: { account: "owner", repo: "repo", branch: "main" },
        notesFolder: "notes",
        trashFolder: "trash",
        trashSizeLimit: 10,
        localWorkingCopyFolder: "./data/working-copy",
        allowedGitHubUsernames: ["alice"],
        keepAlive: {
          enabled: true,
          url: "",
          intervalMinutes: 5
        }
      }),
      "utf8"
    );

    await expect(loadConfig(filePath)).rejects.toThrow("keepAlive.url");
  });

  it("rejects enabled keep-alive with an invalid interval", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "elnotas-config-"));
    const filePath = path.join(folder, "app.json");
    await writeFile(
      filePath,
      JSON.stringify({
        notesGitHubRepository: { account: "owner", repo: "repo", branch: "main" },
        notesFolder: "notes",
        trashFolder: "trash",
        trashSizeLimit: 10,
        localWorkingCopyFolder: "./data/working-copy",
        allowedGitHubUsernames: ["alice"],
        keepAlive: {
          enabled: true,
          url: "https://example.com/api/health",
          intervalMinutes: 0
        }
      }),
      "utf8"
    );

    await expect(loadConfig(filePath)).rejects.toThrow("keepAlive.intervalMinutes");
  });

  it("rejects missing configured values", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "elnotas-config-"));
    const filePath = path.join(folder, "app.json");
    await writeFile(
      filePath,
      JSON.stringify({ notesGitHubRepository: { account: "", repo: "repo", branch: "main" } }),
      "utf8"
    );

    await expect(loadConfig(filePath)).rejects.toThrow("notesGitHubRepository.account");
  });
});
