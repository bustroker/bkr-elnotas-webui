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

Follow:

[README.config.md](README.config.md)

## Run With Docker Compose

```sh
docker compose up --build
```

Open `http://localhost:3000`.
Health check: `curl http://localhost:3000/api/health`

## Run Without Docker

```sh
corepack enable
pnpm install
pnpm build
pnpm start
```

Open: `http://localhost:3000`


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

When a new frontend version is available, the UI shows `Update app`. Click it to activate the new service worker and reload the app.

## Reset Local PWA Cache

Use this during local development if the browser keeps alternating between old and new frontend versions after repeated rebuilds.

Open `http://localhost:3000`, then run this in the browser DevTools console:

If Chrome blocks pasting into DevTools, type this first and press Enter:

```text
allow pasting
```

Then paste and run:

```js
await Promise.all((await navigator.serviceWorker.getRegistrations()).map((registration) => registration.unregister()));
await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
location.reload();
```

This unregisters local service workers for the current origin, clears Cache Storage, and reloads the page.
