import { createServer as createNodeServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config/AppConfig.js";
import { toPublicConfigSummary } from "../config/PublicConfigSummary.js";

export interface ServerContext {
  readonly config: AppConfig;
  readonly clientDistPath: string;
}

export function createServer(context: ServerContext): Server {
  return createNodeServer((request, response) => {
    handleRequest(request, response, context).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(response, 500, {
        error: {
          code: "internal_server_error",
          message
        }
      });
    });
  });
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, context: ServerContext): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/api/health" && request.method === "GET") {
    writeJson(response, 200, {
      status: "ok",
      app: "5l-elnotas-webui",
      config: toPublicConfigSummary(context.config)
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    writeJson(response, 404, {
      error: {
        code: "not_found",
        message: "API endpoint not found."
      }
    });
    return;
  }

  await serveStaticAsset(url.pathname, response, context.clientDistPath);
}

async function serveStaticAsset(urlPath: string, response: ServerResponse, clientDistPath: string): Promise<void> {
  const filePath = resolveStaticFilePath(urlPath, clientDistPath);
  if (filePath === null) {
    writeText(response, 400, "Invalid path.");
    return;
  }

  const assetPath = await resolveExistingAssetPath(filePath, clientDistPath);
  const content = await readFile(assetPath);
  response.writeHead(200, {
    "Content-Type": contentTypeFor(assetPath),
    "Cache-Control": assetPath.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable"
  });
  response.end(content);
}

function resolveStaticFilePath(urlPath: string, clientDistPath: string): string | null {
  const decodedPath = decodeURIComponent(urlPath);
  const normalizedPath = path.normalize(decodedPath === "/" ? "/index.html" : decodedPath);
  const relativePath = normalizedPath.replace(/^[/\\]+/, "");
  const rootPath = path.resolve(clientDistPath);
  const filePath = path.resolve(rootPath, relativePath);
  const pathFromRoot = path.relative(rootPath, filePath);

  if (pathFromRoot.startsWith("..") || path.isAbsolute(pathFromRoot)) {
    return null;
  }

  return filePath;
}

async function resolveExistingAssetPath(filePath: string, clientDistPath: string): Promise<string> {
  const fileStats = await stat(filePath).catch(() => null);
  if (fileStats?.isFile() === true) {
    return filePath;
  }

  return path.resolve(clientDistPath, "index.html");
}

function contentTypeFor(filePath: string): string {
  const extension = path.extname(filePath);
  switch (extension) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function writeText(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}
