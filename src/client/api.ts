import type { EditSessionResponse, MutationResult, Note, NoteSummary, UserState } from "./types";

export class ApiRequestError extends Error {
  public readonly code: string | null;
  public readonly status: number | null;

  public constructor(input: { readonly code: string | null; readonly message: string; readonly status: number | null }) {
    super(input.message);
    this.name = "ApiRequestError";
    this.code = input.code;
    this.status = input.status;
  }
}

export async function getCurrentUser(): Promise<UserState> {
  return request<UserState>("/api/me");
}

export async function listNotes(): Promise<readonly NoteSummary[]> {
  const response = await request<{ readonly notes: readonly NoteSummary[] }>("/api/notes");
  return response.notes;
}

export async function reloadNotes(): Promise<readonly NoteSummary[]> {
  const response = await request<{ readonly notes: readonly NoteSummary[] }>("/api/reload", { method: "POST" });
  return response.notes;
}

export async function resetNotesAccess(): Promise<void> {
  await request<void>("/api/reset-notes-access", { method: "POST" });
}

export async function getNote(id: string): Promise<Note> {
  const response = await request<{ readonly note: Note }>(`/api/notes/${encodeURIComponent(id)}`);
  return response.note;
}

export async function createNote(input: { readonly title: string; readonly body: string; readonly tags: readonly string[] }): Promise<MutationResult> {
  return request<MutationResult>("/api/notes", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function startEditSession(id: string): Promise<EditSessionResponse> {
  return request<EditSessionResponse>(`/api/notes/${encodeURIComponent(id)}/edit-session`, { method: "POST" });
}

export async function updateNote(id: string, input: { readonly markdown: string; readonly editSessionId: string }): Promise<MutationResult> {
  return request<MutationResult>(`/api/notes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function pinNote(id: string, pinned: boolean): Promise<MutationResult> {
  return request<MutationResult>(`/api/notes/${encodeURIComponent(id)}/pin`, {
    method: "POST",
    body: JSON.stringify({ pinned })
  });
}

export async function sendNoteToTrash(id: string): Promise<MutationResult> {
  return request<MutationResult>(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listTrash(): Promise<readonly NoteSummary[]> {
  const response = await request<{ readonly notes: readonly NoteSummary[] }>("/api/trash");
  return response.notes;
}

export async function deleteTrashNote(id: string): Promise<void> {
  await request<void>(`/api/trash/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function emptyTrash(): Promise<void> {
  await request<void>("/api/trash", { method: "DELETE" });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers
  }).catch(() => {
    throw new ApiRequestError({
      code: "network_unavailable",
      message: "Cannot reach the app server. Start or restart the app, then reload the page.",
      status: null
    });
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const error = errorPayload(payload);
    throw new ApiRequestError({
      code: error?.code ?? null,
      message: error?.message ?? `HTTP ${response.status}`,
      status: response.status
    });
  }

  return payload as T;
}

function errorPayload(payload: unknown): { readonly code: string | null; readonly message: string } | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return null;
  }

  const error = (payload as { readonly error?: unknown }).error;
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return null;
  }

  const message = (error as { readonly message?: unknown }).message;
  if (typeof message !== "string") {
    return null;
  }

  const code = (error as { readonly code?: unknown }).code;
  return {
    code: typeof code === "string" ? code : null,
    message
  };
}
