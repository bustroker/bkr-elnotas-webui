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

## Local Configuration

```sh
cp config/app.example.json config/app.json
cp .env.example .env
```

Edit `config/app.json`:

```json
{
  "notesGitHubRepository": {
    "account": "your-notes-github-account-or-org",
    "repo": "elnotas-notes",
    "branch": "main"
  },
  "notesFolder": "notes",
  "trashFolder": "trash",
  "trashSizeLimit": 10,
  "localWorkingCopyFolder": "./data/working-copy",
  "allowedGitHubUsernames": ["your-github-username"]
}
```

`notesGitHubRepository.account` is the GitHub user or organization that owns the notes repository. `allowedGitHubUsernames` is the login whitelist for people who may use this web app.

The notes repository must contain root-level folders matching the config:

```text
notes/
trash/
```

## Create The GitHub App

```text
GitHub -> Settings -> Developer settings -> GitHub Apps -> New GitHub App
```

Use these local values:

- GitHub App name: `5l-elnotas-webui-local`
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/auth/github/callback`
- Webhook: inactive
- Repository permissions:
  - Contents: Read and write
  - Metadata: Read-only
- Account permissions: none
- Installation target: only this account

After creating the app:

1. Copy the App ID into `GITHUB_APP_ID`.
2. Copy the Client ID into `GITHUB_APP_CLIENT_ID`.
3. Generate a Client Secret and put it in `GITHUB_APP_CLIENT_SECRET`.
4. Generate a private key.
5. Put the private key in `GITHUB_APP_PRIVATE_KEY`.
6. Install the GitHub App on the notes repository from `config/app.json`.

Use escaped newlines for the private key in `.env`:

```env
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

Set a long random session secret:

```env
SESSION_SECRET=replace-with-a-long-random-value
```

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

## Runtime Files

Ignored local files:

```text
.env
config/app.json
data/
dist/
node_modules/
```

`config/app.json` contains non-secret runtime configuration.

`.env` contains secrets and must not be committed.

`data/working-copy` stores the local markdown working copy.

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
