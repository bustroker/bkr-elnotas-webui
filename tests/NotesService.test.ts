import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { GitHubFileChange, GitHubNotesGateway, RemoteMarkdownFile } from "../src/server/github/GitHubNotesGateway.js";
import { EditSessionStore } from "../src/server/notes/EditSessionStore.js";
import { NotesService } from "../src/server/notes/NotesService.js";
import type { Clock } from "../src/server/shared/Clock.js";
import { WorkingCopyRepository } from "../src/server/working-copy/WorkingCopyRepository.js";
import { testConfig } from "./fixtures.js";

class FixedClock implements Clock {
  public now(): Date {
    return new Date("2026-06-22T10:30:00.000Z");
  }
}

class MemoryGateway implements GitHubNotesGateway {
  public readonly files = new Map<string, RemoteMarkdownFile>();

  public async validateRepositorySetup(): Promise<void> {}

  public async listMarkdownFiles(folder: string): Promise<readonly RemoteMarkdownFile[]> {
    return [...this.files.values()].filter((file) => file.path.startsWith(`${folder}/`) && file.path.endsWith(".md"));
  }

  public async readMarkdownFile(filePath: string): Promise<RemoteMarkdownFile> {
    const file = this.files.get(filePath);
    if (file === undefined) {
      throw new Error("missing file");
    }

    return file;
  }

  public async commitChanges(_message: string, changes: readonly GitHubFileChange[]): Promise<void> {
    for (const change of changes) {
      if (change.type === "delete") {
        this.files.delete(change.path);
      } else {
        const current = this.files.get(change.path);
        this.files.set(change.path, {
          path: change.path,
          content: change.content,
          sha: `${current?.sha ?? "sha"}-next`
        });
      }
    }
  }
}

describe("NotesService", () => {
  it("creates conflict copy and marks original when edit SHA is stale", async () => {
    const config = testConfig({ localWorkingCopyFolder: await mkdtemp(path.join(tmpdir(), "elnotas-notes-")) });
    const gateway = new MemoryGateway();
    gateway.files.set("notes/original.md", {
      path: "notes/original.md",
      sha: "sha-1",
      content: noteMarkdown("Original", "Initial")
    });
    const service = new NotesService({
      config,
      gateway,
      workingCopy: new WorkingCopyRepository(config.localWorkingCopyFolder, config.notesFolder),
      clock: new FixedClock(),
      editSessions: new EditSessionStore()
    });

    await service.reloadActiveNotes();
    const edit = await service.startEditSession("original");
    gateway.files.set("notes/original.md", {
      path: "notes/original.md",
      sha: "sha-2",
      content: noteMarkdown("Original", "Remote changed")
    });
    const result = await service.updateNote("original", {
      editSessionId: edit.editSessionId,
      markdown: noteMarkdown("Original", "Local changed")
    });

    expect(result.conflict?.originalNoteId).toBe("original");
    expect([...gateway.files.keys()].some((key) => key.includes("-conflict-"))).toBe(true);
    expect(gateway.files.get("notes/original.md")?.content).toContain("conflict: true");
    expect(gateway.files.get("notes/original.md")?.content).toContain("Remote changed");
  });

  it("enforces trash size limit by deleting the oldest trash file", async () => {
    const config = testConfig({ localWorkingCopyFolder: await mkdtemp(path.join(tmpdir(), "elnotas-notes-")) });
    const gateway = new MemoryGateway();
    gateway.files.set("notes/current.md", {
      path: "notes/current.md",
      sha: "sha-current",
      content: noteMarkdown("Current", "Body")
    });
    gateway.files.set("trash/20260101-000000-old.md", {
      path: "trash/20260101-000000-old.md",
      sha: "sha-old",
      content: noteMarkdown("Old", "Body")
    });
    gateway.files.set("trash/20260201-000000-newer.md", {
      path: "trash/20260201-000000-newer.md",
      sha: "sha-newer",
      content: noteMarkdown("Newer", "Body")
    });
    const service = new NotesService({
      config,
      gateway,
      workingCopy: new WorkingCopyRepository(config.localWorkingCopyFolder, config.notesFolder),
      clock: new FixedClock(),
      editSessions: new EditSessionStore()
    });

    await service.reloadActiveNotes();
    await service.sendToTrash("current");

    expect(gateway.files.has("trash/20260101-000000-old.md")).toBe(false);
    expect([...gateway.files.keys()].filter((key) => key.startsWith("trash/"))).toHaveLength(2);
  });

  it("resets local access by clearing the working copy and forcing a future reload", async () => {
    const config = testConfig({ localWorkingCopyFolder: await mkdtemp(path.join(tmpdir(), "elnotas-notes-")) });
    const gateway = new MemoryGateway();
    gateway.files.set("notes/current.md", {
      path: "notes/current.md",
      sha: "sha-current",
      content: noteMarkdown("Current", "Body")
    });
    const service = new NotesService({
      config,
      gateway,
      workingCopy: new WorkingCopyRepository(config.localWorkingCopyFolder, config.notesFolder),
      clock: new FixedClock(),
      editSessions: new EditSessionStore()
    });

    await service.reloadActiveNotes();
    expect(await service.listNotes()).toHaveLength(1);

    gateway.files.clear();
    await service.resetLocalAccess();

    expect(await service.listNotes()).toHaveLength(0);
  });
});

function noteMarkdown(title: string, body: string): string {
  return `---
title: "${title}"
date: 2026-06-22T10:00:00.000Z
updated: 2026-06-22T10:00:00.000Z
tags:
  - test
---

${body}
`;
}
