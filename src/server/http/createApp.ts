import path from "node:path";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "../config/AppConfig.js";
import type { AppSecrets } from "../env/AppSecrets.js";
import { AuthSessionStore } from "../auth/AuthSessionStore.js";
import { GitHubOAuthClient } from "../auth/GitHubOAuthClient.js";
import { registerAuthRoutes } from "../auth/registerAuthRoutes.js";
import { OctokitGitHubNotesGateway } from "../github/OctokitGitHubNotesGateway.js";
import { EditSessionStore } from "../notes/EditSessionStore.js";
import { NotesService } from "../notes/NotesService.js";
import { registerNotesRoutes } from "../notes/registerNotesRoutes.js";
import { SystemClock } from "../shared/Clock.js";
import { WorkingCopyRepository } from "../working-copy/WorkingCopyRepository.js";
import { registerErrorHandler } from "./registerErrorHandler.js";

export interface CreateAppInput {
  readonly config: AppConfig;
  readonly secrets: AppSecrets;
  readonly clientDistPath: string;
}

export async function createApp(input: CreateAppInput): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info"
    }
  });

  await app.register(fastifyCookie, {
    secret: input.secrets.sessionSecret
  });

  const sessions = new AuthSessionStore();
  const githubOAuth = new GitHubOAuthClient(input.secrets);
  const gateway = new OctokitGitHubNotesGateway(input.config, input.secrets);
  const workingCopy = new WorkingCopyRepository(input.config.localWorkingCopyFolder, input.config.notesFolder);
  const notes = new NotesService({
    config: input.config,
    gateway,
    workingCopy,
    clock: new SystemClock(),
    editSessions: new EditSessionStore()
  });

  registerAuthRoutes({ app, config: input.config, sessions, githubOAuth });
  registerNotesRoutes({ app, config: input.config, sessions, notes });
  registerErrorHandler(app);

  await app.register(fastifyStatic, {
    root: path.resolve(input.clientDistPath),
    prefix: "/"
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({
        error: {
          code: "not_found",
          message: "API endpoint not found."
        }
      });
    }

    return reply.sendFile("index.html");
  });

  return app;
}
