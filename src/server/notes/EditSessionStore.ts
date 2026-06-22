import { randomUUID } from "node:crypto";

export interface EditSession {
  readonly id: string;
  readonly noteId: string;
  readonly path: string;
  readonly sha: string;
  readonly createdAt: number;
}

export class EditSessionStore {
  private readonly sessions = new Map<string, EditSession>();

  public create(input: Omit<EditSession, "id" | "createdAt">): EditSession {
    const session = {
      ...input,
      id: randomUUID(),
      createdAt: Date.now()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  public consume(id: string): EditSession | null {
    const session = this.sessions.get(id) ?? null;
    if (session !== null) {
      this.sessions.delete(id);
    }

    return session;
  }
}
