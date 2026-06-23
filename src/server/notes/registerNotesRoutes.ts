import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequiredUsername, getSessionFromCookie } from "../auth/registerAuthRoutes.js";
import type { AuthSessionStore } from "../auth/AuthSessionStore.js";
import type { AppConfig } from "../config/AppConfig.js";
import { toPublicConfigSummary } from "../config/PublicConfigSummary.js";
import { ResultError } from "../shared/ResultError.js";
import type { Note, NoteSummary } from "./Note.js";
import type { CreateNoteRequest, NoteMutationResult, PinNoteRequest, UpdateNoteRequest } from "./NoteRequests.js";

const createNoteSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string(),
  tags: z.array(z.string().trim().min(1)).default([])
});

const updateNoteSchema = z.object({
  markdown: z.string().min(1),
  editSessionId: z.string().trim().min(1)
});

const pinNoteSchema = z.object({
  pinned: z.boolean()
});

export function registerNotesRoutes(input: {
  readonly app: FastifyInstance;
  readonly config: AppConfig;
  readonly sessions: AuthSessionStore;
  readonly notes: NotesApi;
}): void {
  const { app, config, sessions, notes } = input;

  app.get("/api/health", async () => ({
    status: "ok",
    app: "bkr-elnotas-webui",
    config: toPublicConfigSummary(config)
  }));

  app.get("/api/me", async (request) => {
    const session = getSessionFromCookie(request, sessions);
    return session === null
      ? { authenticated: false }
      : {
          authenticated: true,
          username: session.username,
          config: toPublicConfigSummary(config)
        };
  });

  app.get("/api/notes", async (request) => {
    getRequiredUsername(request, sessions);
    return { notes: await notes.listNotes() };
  });

  app.get("/api/notes/:id", async (request) => {
    getRequiredUsername(request, sessions);
    const id = pathParam(request.params, "id");
    return { note: await notes.getNote(id) };
  });

  app.post("/api/notes", async (request, reply) => {
    getRequiredUsername(request, sessions);
    const body = parseBody(createNoteSchema, request.body);
    const result = await notes.createNote(body);
    return reply.code(201).send(result);
  });

  app.post("/api/notes/:id/edit-session", async (request) => {
    getRequiredUsername(request, sessions);
    const id = pathParam(request.params, "id");
    return notes.startEditSession(id);
  });

  app.put("/api/notes/:id", async (request) => {
    getRequiredUsername(request, sessions);
    const id = pathParam(request.params, "id");
    const body = parseBody(updateNoteSchema, request.body);
    return notes.updateNote(id, body);
  });

  app.post("/api/notes/:id/pin", async (request) => {
    getRequiredUsername(request, sessions);
    const id = pathParam(request.params, "id");
    const body = parseBody(pinNoteSchema, request.body);
    return notes.pinNote(id, body);
  });

  app.delete("/api/notes/:id", async (request) => {
    getRequiredUsername(request, sessions);
    const id = pathParam(request.params, "id");
    return notes.sendToTrash(id);
  });

  app.get("/api/trash", async (request) => {
    getRequiredUsername(request, sessions);
    return { notes: await notes.listTrash() };
  });

  app.delete("/api/trash/:id", async (request, reply) => {
    getRequiredUsername(request, sessions);
    const id = pathParam(request.params, "id");
    await notes.permanentlyDeleteTrashNote(id);
    return reply.code(204).send();
  });

  app.delete("/api/trash", async (request, reply) => {
    getRequiredUsername(request, sessions);
    await notes.emptyTrash();
    return reply.code(204).send();
  });

  app.post("/api/reload", async (request) => {
    getRequiredUsername(request, sessions);
    return { notes: await notes.reloadActiveNotes() };
  });
}

export interface NotesApi {
  reloadActiveNotes(): Promise<readonly NoteSummary[]>;
  listNotes(): Promise<readonly NoteSummary[]>;
  getNote(id: string): Promise<Note>;
  createNote(request: CreateNoteRequest): Promise<NoteMutationResult>;
  startEditSession(id: string): Promise<{ readonly note: Note; readonly editSessionId: string }>;
  updateNote(id: string, request: UpdateNoteRequest): Promise<NoteMutationResult>;
  pinNote(id: string, request: PinNoteRequest): Promise<NoteMutationResult>;
  sendToTrash(id: string): Promise<NoteMutationResult>;
  listTrash(): Promise<readonly NoteSummary[]>;
  permanentlyDeleteTrashNote(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
}

function parseBody<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ResultError("invalid_request", "The request body is invalid.", 400);
  }

  return result.data;
}

function pathParam(params: unknown, name: string): string {
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    throw new ResultError("invalid_path", "The request path is invalid.", 400);
  }

  const value = (params as Record<string, unknown>)[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ResultError("invalid_path", "The request path is invalid.", 400);
  }

  return value;
}
