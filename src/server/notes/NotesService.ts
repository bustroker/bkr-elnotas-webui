import path from "node:path";
import type { AppConfig } from "../config/AppConfig.js";
import type { GitHubFileChange, GitHubNotesGateway, RemoteMarkdownFile } from "../github/GitHubNotesGateway.js";
import { WorkingCopyRepository } from "../working-copy/WorkingCopyRepository.js";
import type { Clock } from "../shared/Clock.js";
import { ResultError } from "../shared/ResultError.js";
import type { Note, NoteSummary } from "./Note.js";
import { toNoteSummary } from "./Note.js";
import { createNoteMarkdown, parseNoteMarkdown, updateMarkdownMetadata } from "./NoteMarkdown.js";
import { slugify, timestampSlug } from "./slugify.js";
import { sortNotes } from "./sortNotes.js";
import { EditSessionStore } from "./EditSessionStore.js";
import type { ConflictResult, CreateNoteRequest, NoteMutationResult, PinNoteRequest, UpdateNoteRequest } from "./NoteRequests.js";

export type NotesSyncStatus = "synced" | "sync_failed";

export interface NotesListResult {
  readonly notes: readonly NoteSummary[];
  readonly syncStatus: NotesSyncStatus;
}

export class NotesService {
  private readonly config: AppConfig;
  private readonly gateway: GitHubNotesGateway;
  private readonly workingCopy: WorkingCopyRepository;
  private readonly clock: Clock;
  private readonly editSessions: EditSessionStore;
  private loaded = false;
  private lastSyncStatus: NotesSyncStatus = "synced";

  public constructor(input: {
    readonly config: AppConfig;
    readonly gateway: GitHubNotesGateway;
    readonly workingCopy: WorkingCopyRepository;
    readonly clock: Clock;
    readonly editSessions: EditSessionStore;
  }) {
    this.config = input.config;
    this.gateway = input.gateway;
    this.workingCopy = input.workingCopy;
    this.clock = input.clock;
    this.editSessions = input.editSessions;
  }

  public async loadActiveNotes(): Promise<NotesListResult> {
    const syncStatus = await this.ensureLoaded();
    return {
      notes: await this.listLocalNoteSummaries(),
      syncStatus
    };
  }

  public async reloadActiveNotes(): Promise<NotesListResult> {
    const syncStatus = await this.syncFromGitHub();
    return {
      notes: await this.listLocalNoteSummaries(),
      syncStatus
    };
  }

  public async listNotes(): Promise<readonly NoteSummary[]> {
    await this.ensureLoaded();
    return this.listLocalNoteSummaries();
  }

  public async getNote(id: string): Promise<Note> {
    await this.ensureLoaded();
    return this.workingCopy.getNote(id);
  }

  public async createNote(request: CreateNoteRequest): Promise<NoteMutationResult> {
    await this.ensureLoaded();
    const nowIso = this.clock.now().toISOString();
    const fileName = request.fileName ?? `${timestampSlug(this.clock.now())}-${slugify(request.title)}.md`;
    const filePath = this.activePath(fileName);
    const markdown = createNoteMarkdown({
      title: request.title,
      body: request.body,
      tags: request.tags,
      nowIso
    });

    try {
      await this.gateway.commitChanges(`Add note: ${request.title}`, [{ type: "write", path: filePath, content: markdown }]);
      await this.reloadActiveNotes();
    } catch (error) {
      const failedMarkdown = this.markSaveFailed(markdown);
      await this.workingCopy.writeLocalNote(parseNoteMarkdown(filePath, failedMarkdown));
      console.error(`Failed to create note '${request.title}' in GitHub.`, error);
      return { noteId: fileName.replace(/\.md$/i, ""), saveFailed: true };
    }

    return { noteId: fileName.replace(/\.md$/i, "") };
  }

  public async startEditSession(id: string): Promise<{ readonly note: Note; readonly editSessionId: string }> {
    await this.ensureLoaded();
    const note = await this.workingCopy.getNote(id);
    if (note.saveFailed || note.deleteFailed) {
      const editSession = this.editSessions.create({
        noteId: note.id,
        path: note.path,
        sha: await this.workingCopy.getFileSha(note.id)
      });

      return {
        note,
        editSessionId: editSession.id
      };
    }

    const remoteFile = await this.gateway.readMarkdownFile(note.path);
    await this.workingCopy.writeRemoteFile(remoteFile);
    const refreshedNote = parseNoteMarkdown(remoteFile.path, remoteFile.content);
    const editSession = this.editSessions.create({
      noteId: refreshedNote.id,
      path: refreshedNote.path,
      sha: remoteFile.sha
    });

    return {
      note: refreshedNote,
      editSessionId: editSession.id
    };
  }

  public async updateNote(id: string, request: UpdateNoteRequest): Promise<NoteMutationResult> {
    const editSession = this.editSessions.consume(request.editSessionId);
    if (editSession === null || editSession.noteId !== id) {
      throw new ResultError("invalid_edit_session", "The edit session is missing or invalid. Close the note, reopen it, and save again.", 409);
    }

    if (editSession.sha !== null) {
      const currentRemoteFile = await this.gateway.readMarkdownFile(editSession.path);
      if (currentRemoteFile.sha !== editSession.sha) {
        const conflict = await this.createConflictCopy(editSession.path, currentRemoteFile, request.markdown);
        await this.reloadActiveNotes();
        return { conflict };
      }
    }

    const updatedMarkdown = updateMarkdownMetadata(request.markdown, (metadata) => ({
      ...metadata,
      updated: this.clock.now().toISOString(),
      conflict: undefined,
      saveFailed: undefined,
      deleteFailed: undefined
    }));
    const note = parseNoteMarkdown(editSession.path, updatedMarkdown);

    try {
      await this.gateway.commitChanges(`Update note: ${note.title}`, [
        {
          type: "write",
          path: editSession.path,
          content: updatedMarkdown
        }
      ]);
      await this.reloadActiveNotes();
    } catch (error) {
      const failedMarkdown = this.markSaveFailed(updatedMarkdown);
      await this.workingCopy.writeLocalNote(parseNoteMarkdown(editSession.path, failedMarkdown));
      console.error(`Failed to update note '${id}' in GitHub.`, error);
      return { noteId: id, saveFailed: true };
    }

    return { noteId: id };
  }

  public async pinNote(id: string, request: PinNoteRequest): Promise<NoteMutationResult> {
    await this.ensureLoaded();
    const note = await this.workingCopy.getNote(id);
    const markdown = updateMarkdownMetadata(note.markdown, (metadata) => ({
      ...metadata,
      updated: this.clock.now().toISOString(),
      pinned: request.pinned ? true : undefined
    }));
    const updatedNote = parseNoteMarkdown(note.path, markdown);

    await this.workingCopy.writeLocalNote(updatedNote);
    void this.commitPinChangeInBackground(id, request.pinned, updatedNote);

    return { noteId: id };
  }

  public async sendToTrash(id: string): Promise<NoteMutationResult> {
    await this.ensureLoaded();
    const note = await this.workingCopy.getNote(id);

    try {
      const currentRemoteFile = note.saveFailed ? null : await this.gateway.readMarkdownFile(note.path);
      if (currentRemoteFile === null) {
        await this.workingCopy.removeNote(id);
        return { noteId: id };
      }

      const trashFileName = await this.availableFileNameInFolder(this.config.trashFolder, note.fileName);
      const trashPath = this.trashPath(trashFileName);
      const trashMarkdown = updateMarkdownMetadata(currentRemoteFile.content, (metadata) => ({
        ...metadata,
        deleted: this.clock.now().toISOString()
      }));
      const changes: GitHubFileChange[] = [
        { type: "write", path: trashPath, content: trashMarkdown },
        { type: "delete", path: note.path }
      ];
      const trashFiles = await this.gateway.listMarkdownFiles(this.config.trashFolder);
      if (trashFiles.length >= this.config.trashSizeLimit) {
        const oldestFiles = this.sortTrashFilesByDeletedDateAsc(trashFiles);
        const deleteCount = trashFiles.length - this.config.trashSizeLimit + 1;
        for (const file of oldestFiles.slice(0, deleteCount)) {
          changes.push({ type: "delete", path: file.path });
        }
      }

      await this.gateway.commitChanges(`Move note to trash: ${note.title}`, changes);
      await this.reloadActiveNotes();
    } catch (error) {
      const failedMarkdown = this.markDeleteFailed(note.markdown);
      await this.workingCopy.writeLocalNote(parseNoteMarkdown(note.path, failedMarkdown));
      console.error(`Failed to move note '${id}' to trash in GitHub.`, error);
      return { noteId: id, deleteFailed: true };
    }

    return { noteId: id };
  }

  public async listTrash(): Promise<readonly NoteSummary[]> {
    const files = await this.gateway.listMarkdownFiles(this.config.trashFolder);
    return this.sortTrashFilesByDeletedDateDesc(files).map((file) => toNoteSummary(parseNoteMarkdown(file.path, file.content)));
  }

  public async getTrashNote(id: string): Promise<Note> {
    const file = await this.findTrashFile(id);
    return parseNoteMarkdown(file.path, file.content);
  }

  public async restoreTrashNote(id: string): Promise<NoteMutationResult> {
    const trashFile = await this.findTrashFile(id);
    const restoredFileName = await this.availableFileNameInFolder(this.config.notesFolder, path.basename(trashFile.path));
    const restoredPath = this.activePath(restoredFileName);
    const restoredMarkdown = updateMarkdownMetadata(trashFile.content, (metadata) => ({
      ...metadata,
      deleted: undefined
    }));
    const restoredNote = parseNoteMarkdown(restoredPath, restoredMarkdown);

    await this.gateway.commitChanges(`Restore note: ${restoredNote.title}`, [
      { type: "write", path: restoredPath, content: restoredMarkdown },
      { type: "delete", path: trashFile.path }
    ]);
    await this.reloadActiveNotes();

    return { noteId: restoredNote.id };
  }

  public async permanentlyDeleteTrashNote(id: string): Promise<void> {
    const file = await this.findTrashFile(id);
    await this.gateway.commitChanges(`Delete trash note: ${id}`, [{ type: "delete", path: file.path }]);
  }

  public async emptyTrash(): Promise<void> {
    const files = await this.gateway.listMarkdownFiles(this.config.trashFolder);
    await this.gateway.commitChanges(
      "Empty trash",
      files.map((file) => ({ type: "delete", path: file.path }))
    );
  }

  public async resetLocalAccess(): Promise<void> {
    await this.workingCopy.clear();
    this.editSessions.clear();
    this.loaded = false;
  }

  private async createConflictCopy(originalPath: string, currentRemoteFile: RemoteMarkdownFile, editedMarkdown: string): Promise<ConflictResult> {
    const currentOriginalMarkdown = updateMarkdownMetadata(currentRemoteFile.content, (metadata) => ({
      ...metadata,
      conflict: true
    }));
    const conflictCopyMarkdown = updateMarkdownMetadata(editedMarkdown, (metadata) => ({
      ...metadata,
      updated: this.clock.now().toISOString(),
      conflict: true
    }));
    const conflictFileName = await this.availableFileNameInFolder(this.config.notesFolder, path.basename(originalPath));
    const conflictPath = this.activePath(conflictFileName);
    const originalNote = parseNoteMarkdown(originalPath, currentOriginalMarkdown);
    const conflictNote = parseNoteMarkdown(conflictPath, conflictCopyMarkdown);

    await this.gateway.commitChanges(`Create conflict copy: ${originalNote.title}`, [
      { type: "write", path: originalPath, content: currentOriginalMarkdown },
      { type: "write", path: conflictPath, content: conflictCopyMarkdown }
    ]);

    return {
      originalNoteId: originalNote.id,
      conflictNoteId: conflictNote.id,
      message: "The original note changed in GitHub. The original was left unchanged and a conflict copy was created."
    };
  }

  private async commitPinChangeInBackground(id: string, pinned: boolean, note: Note): Promise<void> {
    try {
      await this.gateway.commitChanges(`${pinned ? "Pin" : "Unpin"} note: ${note.title}`, [{ type: "write", path: note.path, content: note.markdown }]);
      const remoteFile = await this.gateway.readMarkdownFile(note.path);
      await this.workingCopy.updateFileSha(id, remoteFile.sha);
    } catch (error) {
      console.error(`Failed to ${pinned ? "pin" : "unpin"} note '${id}' in GitHub.`, error);
    }
  }

  private markSaveFailed(markdown: string): string {
    return updateMarkdownMetadata(markdown, (metadata) => ({
      ...metadata,
      saveFailed: true,
      deleteFailed: undefined
    }));
  }

  private markDeleteFailed(markdown: string): string {
    return updateMarkdownMetadata(markdown, (metadata) => ({
      ...metadata,
      deleteFailed: true,
      saveFailed: undefined
    }));
  }

  private async findTrashFile(id: string): Promise<RemoteMarkdownFile> {
    const files = await this.gateway.listMarkdownFiles(this.config.trashFolder);
    const file = files.find((candidate) => candidate.path.split("/").at(-1)?.replace(/\.md$/i, "") === id);
    if (file === undefined) {
      throw new ResultError("trash_note_not_found", `Trash note '${id}' was not found. Reload trash and try again.`, 404);
    }

    return file;
  }

  private async availableFileNameInFolder(folder: string, preferredFileName: string): Promise<string> {
    const existingFileNames = new Set((await this.gateway.listMarkdownFiles(folder)).map((file) => path.basename(file.path)));
    if (!existingFileNames.has(preferredFileName)) {
      return preferredFileName;
    }

    const extension = path.extname(preferredFileName);
    const baseName = path.basename(preferredFileName, extension);
    for (let index = 2; ; index += 1) {
      const candidate = `${baseName}-${index}${extension}`;
      if (!existingFileNames.has(candidate)) {
        return candidate;
      }
    }
  }

  private sortTrashFilesByDeletedDateDesc(files: readonly RemoteMarkdownFile[]): readonly RemoteMarkdownFile[] {
    return [...files].sort((left, right) => Date.parse(this.trashDeletedDate(right)) - Date.parse(this.trashDeletedDate(left)));
  }

  private sortTrashFilesByDeletedDateAsc(files: readonly RemoteMarkdownFile[]): readonly RemoteMarkdownFile[] {
    return [...files].sort((left, right) => Date.parse(this.trashDeletedDate(left)) - Date.parse(this.trashDeletedDate(right)));
  }

  private trashDeletedDate(file: RemoteMarkdownFile): string {
    const note = parseNoteMarkdown(file.path, file.content);
    return note.deleted ?? note.updated;
  }

  private async syncFromGitHub(): Promise<NotesSyncStatus> {
    try {
      await this.gateway.validateRepositorySetup();
      const files = await this.gateway.listMarkdownFiles(this.config.notesFolder);
      await this.workingCopy.replaceAll(files);
      this.loaded = true;
      this.lastSyncStatus = "synced";
      return "synced";
    } catch (error) {
      if (!isRecoverableSyncError(error)) {
        throw error;
      }

      console.error("Could not sync notes from GitHub. Showing local working copy.", error);
      this.loaded = true;
      this.lastSyncStatus = "sync_failed";
      return "sync_failed";
    }
  }

  private async listLocalNoteSummaries(): Promise<readonly NoteSummary[]> {
    return sortNotes((await this.workingCopy.listNotes()).map(toNoteSummary));
  }

  private async ensureLoaded(): Promise<NotesSyncStatus> {
    if (!this.loaded) {
      return this.syncFromGitHub();
    }

    return this.lastSyncStatus;
  }

  private activePath(fileName: string): string {
    return `${this.config.notesFolder}/${fileName}`;
  }

  private trashPath(fileName: string): string {
    return `${this.config.trashFolder}/${fileName}`;
  }
}

function isRecoverableSyncError(error: unknown): boolean {
  return error instanceof ResultError && error.code === "github_temporary_error";
}
