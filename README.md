# 5l-elnotas-webui

React + Node.js web app for markdown notes stored in a GitHub repository.

The backend serves the frontend, authenticates users with GitHub, checks a username whitelist, reads/writes notes through a GitHub App, and keeps a local filesystem working copy for fast browsing and filtering.

## Requirements

```sh
docker --version
docker compose version
```

Optional local Node runtime:

```sh
corepack enable
pnpm --version
```

## Configuration

Configure the app before running it:

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

## PWA

The app uses `vite-plugin-pwa`.

Production builds generate:

```text
dist/client/manifest.webmanifest
dist/client/sw.js
```

The service worker caches only the app shell and static assets. API routes and auth routes are network-only; note content is not stored in Cache Storage.

Check installability in a production build through the browser application panel or mobile install prompt.

## Notes Behavior

- Active notes are markdown files under `notes/`.
- Trash notes are markdown files under `trash/`.
- The app loads active notes into a local working copy.
- The user can explicitly reload active notes from GitHub.
- Entering edit mode reloads the note from GitHub and captures its file SHA.
- Saving commits immediately to GitHub.
- Conflicts create a `*-conflict-YYYYMMDD-HHMMSS.md` copy and mark both notes with `conflict: true`.
- Sending a note to trash moves the file into `trash/`.
- If trash already has the configured maximum number of notes, the oldest trash file is permanently deleted when a new note is sent to trash.
