import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseNoteMarkdown } from "../notes/NoteMarkdown.js";
import type { Note } from "../notes/Note.js";
import type { RemoteMarkdownFile } from "../github/GitHubNotesGateway.js";
import { ResultError } from "../shared/ResultError.js";
import { emptySyncMetadata, type SyncMetadata } from "./SyncMetadata.js";

export class WorkingCopyRepository {
  private readonly rootFolder: string;
  private readonly notesFolder: string;
  private readonly syncFilePath: string;

  public constructor(rootFolder: string, notesFolder: string) {
    this.rootFolder = path.resolve(rootFolder);
    this.notesFolder = notesFolder;
    this.syncFilePath = path.join(this.rootFolder, ".sync.json");
  }

  public async replaceAll(remoteFiles: readonly RemoteMarkdownFile[]): Promise<void> {
    const localFailedNotes = (await this.listNotes().catch(() => [])).filter((note) => note.saveFailed);
    const previousMetadata = await this.readSyncMetadata();
    await rm(this.notesRoot(), { recursive: true, force: true });
    await mkdir(this.notesRoot(), { recursive: true });

    const metadata = emptySyncMetadata();
    for (const file of remoteFiles) {
      await this.writeMarkdownFile(file.path, file.content);
      metadata.files[this.idFromPath(file.path)] = {
        path: file.path,
        sha: file.sha
      };
    }

    for (const note of localFailedNotes) {
      await this.writeMarkdownFile(note.path, note.markdown);
      metadata.files[note.id] = {
        path: note.path,
        sha: previousMetadata.files[note.id]?.sha ?? null
      };
    }

    await this.writeSyncMetadata(metadata);
  }

  public async listNotes(): Promise<readonly Note[]> {
    const metadata = await this.readSyncMetadata();
    const notes = await Promise.all(
      Object.values(metadata.files).map(async (entry) => {
        const markdown = await this.readMarkdownFile(entry.path);
        return parseNoteMarkdown(entry.path, markdown);
      })
    );

    return notes;
  }

  public async getNote(id: string): Promise<Note> {
    const metadata = await this.readSyncMetadata();
    const entry = metadata.files[id];
    if (entry === undefined) {
      throw new ResultError("note_not_found", `Note '${id}' was not found.`, 404);
    }

    return parseNoteMarkdown(entry.path, await this.readMarkdownFile(entry.path));
  }

  public async getFileSha(id: string): Promise<string | null> {
    const metadata = await this.readSyncMetadata();
    const entry = metadata.files[id];
    if (entry === undefined) {
      throw new ResultError("note_not_found", `Note '${id}' was not found.`, 404);
    }

    return entry.sha;
  }

  public async writeRemoteFile(file: RemoteMarkdownFile): Promise<void> {
    const metadata = await this.readSyncMetadata();
    await this.writeMarkdownFile(file.path, file.content);
    metadata.files[this.idFromPath(file.path)] = {
      path: file.path,
      sha: file.sha
    };
    await this.writeSyncMetadata(metadata);
  }

  public async writeLocalNote(note: Note): Promise<void> {
    const metadata = await this.readSyncMetadata();
    await this.writeMarkdownFile(note.path, note.markdown);
    const id = this.idFromPath(note.path);
    metadata.files[id] = {
      path: note.path,
      sha: metadata.files[id]?.sha ?? null
    };
    await this.writeSyncMetadata(metadata);
  }

  public async updateFileSha(id: string, sha: string): Promise<void> {
    const metadata = await this.readSyncMetadata();
    const entry = metadata.files[id];
    if (entry === undefined) {
      return;
    }

    metadata.files[id] = {
      ...entry,
      sha
    };
    await this.writeSyncMetadata(metadata);
  }

  public async removeNote(id: string): Promise<void> {
    const metadata = await this.readSyncMetadata();
    const entry = metadata.files[id];
    if (entry !== undefined) {
      await rm(this.localPathFor(entry.path), { force: true });
      delete metadata.files[id];
      await this.writeSyncMetadata(metadata);
    }
  }

  public async clear(): Promise<void> {
    await rm(this.rootFolder, { recursive: true, force: true });
  }

  private async writeMarkdownFile(remotePath: string, content: string): Promise<void> {
    const localPath = this.localPathFor(remotePath);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, content, "utf8");
  }

  private async readMarkdownFile(remotePath: string): Promise<string> {
    return readFile(this.localPathFor(remotePath), "utf8");
  }

  private async readSyncMetadata(): Promise<SyncMetadata> {
    const content = await readFile(this.syncFilePath, "utf8").catch(() => null);
    if (content === null) {
      return emptySyncMetadata();
    }

    return JSON.parse(content) as SyncMetadata;
  }

  private async writeSyncMetadata(metadata: SyncMetadata): Promise<void> {
    await mkdir(this.rootFolder, { recursive: true });
    await writeFile(this.syncFilePath, JSON.stringify(metadata, null, 2), "utf8");
  }

  private localPathFor(remotePath: string): string {
    const relativePath = remotePath.startsWith(`${this.notesFolder}/`)
      ? remotePath.slice(this.notesFolder.length + 1)
      : remotePath;
    return path.join(this.notesRoot(), relativePath);
  }

  private notesRoot(): string {
    return path.join(this.rootFolder, this.notesFolder);
  }

  private idFromPath(remotePath: string): string {
    return remotePath.split("/").at(-1)?.replace(/\.md$/i, "") ?? remotePath;
  }
}
