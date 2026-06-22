# Run, Test, And Tech Stack

## Tech Stack

- Runtime: Node.js.
- Package manager: pnpm via Corepack.
- Frontend: React, Vite, TypeScript.
- Backend: Fastify, TypeScript.
- GitHub integration: GitHub App installation tokens through Octokit.
- Markdown: `gray-matter` for frontmatter, `marked` for rendering, `dompurify` for sanitization.
- PWA: `vite-plugin-pwa` with generated service worker.
- Tests: Vitest.
- Local container runtime: Docker Compose.

## Prerequisites

```sh
docker --version
docker compose version
```

Optional local Node runtime:

```sh
corepack enable
pnpm --version
```

## Configure First

```sh
cp config/app.example.json config/app.json
cp .env.example .env
```

Then follow:

[README.config.md](README.config.md)

## Run With Docker Compose

```sh
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Health check:

```sh
curl http://localhost:3000/api/health
```

## Run Without Docker

```sh
corepack enable
pnpm install
pnpm build
pnpm start
```

Open:

```text
http://localhost:3000
```

## Development

```sh
corepack enable
pnpm install
pnpm dev
```

`pnpm dev` builds the frontend once and starts the backend in watch mode.

## Validation

```sh
pnpm typecheck
pnpm test
pnpm build
docker compose config
```

## PWA Verification

Production builds generate:

```text
dist/client/manifest.webmanifest
dist/client/sw.js
```

The service worker caches only the app shell and static assets. API routes and auth routes are network-only; note content is not stored in Cache Storage.

Check installability in a production build through the browser application panel or mobile install prompt.
