import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config/AppConfig.js";
import type { AuthSessionStore } from "./AuthSessionStore.js";
import type { GitHubOAuthClient } from "./GitHubOAuthClient.js";
import { oauthStateCookieName, sessionCookieName } from "./AuthCookies.js";
import { ResultError } from "../shared/ResultError.js";

export function registerAuthRoutes(input: {
  readonly app: FastifyInstance;
  readonly config: AppConfig;
  readonly sessions: AuthSessionStore;
  readonly githubOAuth: GitHubOAuthClient;
}): void {
  const { app, config, sessions, githubOAuth } = input;

  app.get("/auth/github", async (request, reply) => {
    const state = randomBytes(24).toString("hex");
    reply.setCookie(oauthStateCookieName, state, {
      httpOnly: true,
      secure: isSecureCookie(request),
      sameSite: "lax",
      path: "/auth/github/callback",
      maxAge: 600
    });
    return reply.redirect(githubOAuth.authorizationUrl({ redirectUri: callbackUrl(request), state }));
  });

  app.get("/auth/github/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    const stateCookie = request.cookies[oauthStateCookieName];
    if (query.code === undefined || query.state === undefined || stateCookie !== query.state) {
      throw new ResultError("invalid_oauth_state", "GitHub OAuth state is invalid.", 401);
    }

    const user = await githubOAuth.exchangeCodeForUser({
      code: query.code,
      redirectUri: callbackUrl(request)
    });

    if (!config.allowedGitHubUsernames.includes(user.login)) {
      throw new ResultError("user_not_allowed", "This GitHub user is not allowed to use this app.", 403);
    }

    const session = sessions.create(user.login);
    reply.clearCookie(oauthStateCookieName, { path: "/auth/github/callback" });
    reply.setCookie(sessionCookieName, session.id, {
      httpOnly: true,
      secure: isSecureCookie(request),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    return reply.redirect("/");
  });

  app.post("/auth/logout", async (request, reply) => {
    const session = getSessionFromCookie(request, sessions);
    if (session !== null) {
      sessions.delete(session.id);
    }

    reply.clearCookie(sessionCookieName, { path: "/" });
    return reply.send({ ok: true });
  });
}

export function getRequiredUsername(request: FastifyRequest, sessions: AuthSessionStore): string {
  const session = getSessionFromCookie(request, sessions);
  if (session === null) {
    throw new ResultError("not_authenticated", "Authentication is required.", 401);
  }

  return session.username;
}

export function getSessionFromCookie(request: FastifyRequest, sessions: AuthSessionStore): { readonly id: string; readonly username: string } | null {
  const sessionId = request.cookies[sessionCookieName];
  if (sessionId === undefined) {
    return null;
  }

  const session = sessions.get(sessionId);
  return session === null
    ? null
    : {
        id: session.id,
        username: session.username
      };
}

function callbackUrl(request: FastifyRequest): string {
  const host = request.headers["x-forwarded-host"] ?? request.headers.host ?? "localhost:3000";
  const proto = request.headers["x-forwarded-proto"] ?? (isSecureCookie(request) ? "https" : "http");
  return `${proto}://${host}/auth/github/callback`;
}

function isSecureCookie(request: FastifyRequest): boolean {
  return request.headers["x-forwarded-proto"] === "https" || request.protocol === "https";
}
