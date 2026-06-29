export interface UserState {
  readonly authenticated: boolean;
  readonly username?: string;
  readonly config?: {
    readonly repository: string;
    readonly branch: string;
    readonly notesFolder: string;
    readonly trashFolder: string;
    readonly trashSizeLimit: number;
  };
}

export interface NoteSummary {
  readonly id: string;
  readonly title: string;
  readonly date: string;
  readonly updated: string;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly conflict: boolean;
  readonly saveFailed: boolean;
  readonly excerpt: string;
  readonly searchableText: string;
}

export interface Note extends NoteSummary {
  readonly fileName: string;
  readonly path: string;
  readonly body: string;
  readonly markdown: string;
}

export interface EditSessionResponse {
  readonly note: Note;
  readonly editSessionId: string;
}

export interface MutationResult {
  readonly noteId?: string;
  readonly saveFailed?: true;
  readonly conflict?: {
    readonly originalNoteId: string;
    readonly conflictNoteId: string;
    readonly message: string;
  };
}
