import type { FastifyInstance } from "fastify";
import { ResultError } from "../shared/ResultError.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ResultError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    app.log.error(error);
    return reply.code(500).send({
      error: {
        code: "internal_server_error",
        message: "An unexpected error occurred."
      }
    });
  });
}
