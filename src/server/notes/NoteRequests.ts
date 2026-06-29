export interface CreateNoteRequest {
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
}

export interface UpdateNoteRequest {
  readonly markdown: string;
  readonly editSessionId: string;
}

export interface PinNoteRequest {
  readonly pinned: boolean;
}

export interface NoteMutationResult {
  readonly noteId?: string;
  readonly saveFailed?: true;
  readonly conflict?: ConflictResult;
}

export interface ConflictResult {
  readonly originalNoteId: string;
  readonly conflictNoteId: string;
  readonly message: string;
}
