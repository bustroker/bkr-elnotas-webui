import { randomUUID } from "node:crypto";
import type { AuthSession } from "./AuthSession.js";

export class AuthSessionStore {
  private readonly sessions = new Map<string, AuthSession>();

  public create(username: string): AuthSession {
    const session = {
      id: randomUUID(),
      username,
      createdAt: Date.now()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  public get(id: string): AuthSession | null {
    return this.sessions.get(id) ?? null;
  }

  public delete(id: string): void {
    this.sessions.delete(id);
  }
}
