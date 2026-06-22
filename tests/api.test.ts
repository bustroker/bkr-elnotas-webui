import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { describe, expect, it } from "vitest";
import { AuthSessionStore } from "../src/server/auth/AuthSessionStore.js";
import { registerErrorHandler } from "../src/server/http/registerErrorHandler.js";
import { registerNotesRoutes, type NotesApi } from "../src/server/notes/registerNotesRoutes.js";
import { testConfig } from "./fixtures.js";

describe("notes API", () => {
  it("requires authentication for notes", async () => {
    const app = Fastify({ logger: false });
    await app.register(fastifyCookie);
    registerNotesRoutes({ app, config: testConfig(), sessions: new AuthSessionStore(), notes: fakeNotesApi() });
    registerErrorHandler(app);

    const response = await app.inject({ method: "GET", url: "/api/notes" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "not_authenticated" } });
  });

  it("returns notes for authenticated sessions", async () => {
    const app = Fastify({ logger: false });
    await app.register(fastifyCookie);
    const sessions = new AuthSessionStore();
    const session = sessions.create("alice");
    registerNotesRoutes({ app, config: testConfig(), sessions, notes: fakeNotesApi() });
    registerErrorHandler(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/notes",
      cookies: {
        elnotas_session: session.id
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ notes: [{ id: "one", title: "One" }] });
  });
});

function fakeNotesApi(): NotesApi {
  const note = {
    id: "one",
    fileName: "one.md",
    path: "notes/one.md",
    title: "One",
    date: "2026-06-22T10:00:00.000Z",
    updated: "2026-06-22T10:00:00.000Z",
    tags: ["test"],
    pinned: false,
    conflict: false,
    excerpt: "Body",
    searchableText: "One Body",
    body: "Body",
    markdown: "---\ntitle: One\n---\n\nBody"
  };

  return {
    async reloadActiveNotes() {
      return [note];
    },
    async listNotes() {
      return [note];
    },
    async getNote() {
      return note;
    },
    async createNote() {
      return { noteId: note.id };
    },
    async startEditSession() {
      return { note, editSessionId: "edit" };
    },
    async updateNote() {
      return { noteId: note.id };
    },
    async pinNote() {
      return { noteId: note.id };
    },
    async sendToTrash() {
      return { noteId: note.id };
    },
    async listTrash() {
      return [];
    },
    async permanentlyDeleteTrashNote() {},
    async emptyTrash() {}
  };
}
