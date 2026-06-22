# 5l-elnotas-webui

Web UI for markdown notes stored in a GitHub repository.

The app runs as one Node.js web application: the backend serves the React frontend and exposes the API used by the UI. Notes are stored as markdown files in GitHub. The backend keeps a local filesystem working copy for fast browsing and filtering.

## Local Setup

```sh
cp config/app.example.json config/app.json
cp .env.example .env
```

Edit `config/app.json`:

```json
{
  "github": {
    "owner": "your-github-owner",
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

Edit `.env` with the GitHub App values described below.

## Create The GitHub App

Open GitHub developer settings:

```text
GitHub -> Settings -> Developer settings -> GitHub Apps -> New GitHub App
```

Use these values for local development:

- GitHub App name: `5l-elnotas-webui-local` or another unique name.
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/auth/github/callback`
- Webhook: inactive for now.
- Repository permissions:
  - Contents: Read and write
  - Metadata: Read-only
- Account permissions: none.
- Where can this GitHub App be installed: only on this account.

After creating the app:

1. Copy the App ID into `GITHUB_APP_ID`.
2. Copy the Client ID into `GITHUB_APP_CLIENT_ID`.
3. Generate a Client Secret and put it in `GITHUB_APP_CLIENT_SECRET`.
4. Generate a private key.
5. Put the private key in `GITHUB_APP_PRIVATE_KEY`.
6. Install the GitHub App on the notes repository configured in `config/app.json`.

For `.env`, use escaped newlines in the private key:

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

The `pnpm dev` command builds the React frontend once and starts the backend in watch mode.

## Required Files

```text
config/app.json
.env
```

`config/app.json` contains non-secret application configuration.

`.env` contains secrets and must not be committed.

## Runtime Configuration

`CONFIG_FILE` points to the JSON config file.

```env
CONFIG_FILE=./config/app.json
```

The app expects these secret environment variables:

```env
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY=
SESSION_SECRET=
```

## Current Scaffold

The current implementation includes:

- React frontend shell.
- Node.js/TypeScript backend shell.
- JSON config validation.
- `.env` loading for local development.
- `/api/health`.
- Dockerfile.
- `docker-compose.yml`.

GitHub auth, notes CRUD, working copy sync, conflict handling, and trash behavior are planned next.
