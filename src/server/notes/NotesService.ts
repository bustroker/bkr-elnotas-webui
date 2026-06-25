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

export class NotesService {
  private readonly config: AppConfig;
  private readonly gateway: GitHubNotesGateway;
  private readonly workingCopy: WorkingCopyRepository;
  private readonly clock: Clock;
  private readonly editSessions: EditSessionStore;
  private loaded = false;

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

  public async reloadActiveNotes(): Promise<readonly NoteSummary[]> {
    await this.gateway.validateRepositorySetup();
    const files = await this.gateway.listMarkdownFiles(this.config.notesFolder);
    await this.workingCopy.replaceAll(files);
    this.loaded = true;
    return this.listNotes();
  }

  public async listNotes(): Promise<readonly NoteSummary[]> {
    await this.ensureLoaded();
    return sortNotes((await this.workingCopy.listNotes()).map(toNoteSummary));
  }

  public async getNote(id: string): Promise<Note> {
    await this.ensureLoaded();
    return this.workingCopy.getNote(id);
  }

  public async createNote(request: CreateNoteRequest): Promise<NoteMutationResult> {
    await this.ensureLoaded();
    const nowIso = this.clock.now().toISOString();
    const fileName = `${timestampSlug(this.clock.now())}-${slugify(request.title)}.md`;
    const filePath = this.activePath(fileName);
    const markdown = createNoteMarkdown({
      title: request.title,
      body: request.body,
      tags: request.tags,
      nowIso
    });

    await this.gateway.commitChanges(`Add note: ${request.title}`, [{ type: "write", path: filePath, content: markdown }]);
    await this.reloadActiveNotes();

    return { noteId: fileName.replace(/\.md$/i, "") };
  }

  public async startEditSession(id: string): Promise<{ readonly note: Note; readonly editSessionId: string }> {
    await this.ensureLoaded();
    const note = await this.workingCopy.getNote(id);
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
      throw new ResultError("invalid_edit_session", "The edit session is missing or invalid.", 409);
    }

    const currentRemoteFile = await this.gateway.readMarkdownFile(editSession.path);
    if (currentRemoteFile.sha !== editSession.sha) {
      const conflict = await this.createConflictCopy(editSession.path, currentRemoteFile, request.markdown);
      await this.reloadActiveNotes();
      return { conflict };
    }

    const updatedMarkdown = updateMarkdownMetadata(request.markdown, (metadata) => ({
      ...metadata,
      updated: this.clock.now().toISOString()
    }));
    const note = parseNoteMarkdown(editSession.path, updatedMarkdown);

    await this.gateway.commitChanges(`Update note: ${note.title}`, [
      {
        type: "write",
        path: editSession.path,
        content: updatedMarkdown
      }
    ]);
    await this.reloadActiveNotes();

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

    await this.gateway.commitChanges(`${request.pinned ? "Pin" : "Unpin"} note: ${updatedNote.title}`, [
      { type: "write", path: note.path, content: markdown }
    ]);
    await this.reloadActiveNotes();

    return { noteId: id };
  }

  public async sendToTrash(id: string): Promise<NoteMutationResult> {
    await this.ensureLoaded();
    const note = await this.workingCopy.getNote(id);
    const currentRemoteFile = await this.gateway.readMarkdownFile(note.path);
    const trashFileName = `${timestampSlug(this.clock.now())}-${note.fileName}`;
    const trashPath = this.trashPath(trashFileName);
    const changes: GitHubFileChange[] = [
      { type: "write", path: trashPath, content: currentRemoteFile.content },
      { type: "delete", path: note.path }
    ];

    const trashFiles = await this.gateway.listMarkdownFiles(this.config.trashFolder);
    if (trashFiles.length >= this.config.trashSizeLimit) {
      const oldestFiles = [...trashFiles].sort((left, right) => left.path.localeCompare(right.path));
      const deleteCount = trashFiles.length - this.config.trashSizeLimit + 1;
      for (const file of oldestFiles.slice(0, deleteCount)) {
        changes.push({ type: "delete", path: file.path });
      }
    }

    await this.gateway.commitChanges(`Move note to trash: ${note.title}`, changes);
    await this.reloadActiveNotes();

    return { noteId: id };
  }

  public async listTrash(): Promise<readonly NoteSummary[]> {
    const files = await this.gateway.listMarkdownFiles(this.config.trashFolder);
    return sortNotes(files.map((file) => toNoteSummary(parseNoteMarkdown(file.path, file.content))));
  }

  public async permanentlyDeleteTrashNote(id: string): Promise<void> {
    const files = await this.gateway.listMarkdownFiles(this.config.trashFolder);
    const file = files.find((candidate) => candidate.path.split("/").at(-1)?.replace(/\.md$/i, "") === id);
    if (file === undefined) {
      throw new ResultError("trash_note_not_found", `Trash note '${id}' was not found.`, 404);
    }

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
    const originalFileName = path.basename(originalPath, ".md");
    const conflictFileName = `${originalFileName}-conflict-${timestampSlug(this.clock.now())}.md`;
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

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.reloadActiveNotes();
    }
  }

  private activePath(fileName: string): string {
    return `${this.config.notesFolder}/${fileName}`;
  }

  private trashPath(fileName: string): string {
    return `${this.config.trashFolder}/${fileName}`;
  }
}
