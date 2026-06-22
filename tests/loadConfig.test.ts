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
        github: { owner: "owner", repo: "repo", branch: "main" },
        notesFolder: "notes",
        trashFolder: "trash",
        trashSizeLimit: 10,
        localWorkingCopyFolder: "./data/working-copy",
        allowedGitHubUsernames: ["alice"]
      }),
      "utf8"
    );

    await expect(loadConfig(filePath)).resolves.toMatchObject({
      github: { owner: "owner", repo: "repo", branch: "main" },
      notesFolder: "notes",
      trashFolder: "trash",
      trashSizeLimit: 10
    });
  });

  it("rejects missing configured values", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "elnotas-config-"));
    const filePath = path.join(folder, "app.json");
    await writeFile(filePath, JSON.stringify({ github: { owner: "", repo: "repo", branch: "main" } }), "utf8");

    await expect(loadConfig(filePath)).rejects.toThrow("github.owner");
  });
});
