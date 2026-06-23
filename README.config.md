# Configuration

Configure the app before running it locally or deploying it.

## Create Local Files

```sh
cp config/app.example.json config/app.json
cp .env.example .env
```

`config/app.json` contains non-secret runtime configuration.

`.env` contains secrets and must not be committed.

## App Config

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

`notesGitHubRepository.account` is the GitHub user or organization that owns the notes repository.

`notesGitHubRepository.repo` is the repository where note markdown files live.

`notesGitHubRepository.branch` is the branch used for all note read/write operations.

`notesFolder` is the root-level folder that contains active notes.

`trashFolder` is the root-level folder that contains trashed notes.

`trashSizeLimit` is the maximum number of notes kept in trash.

`localWorkingCopyFolder` is where the backend stores its local working copy.

`allowedGitHubUsernames` is the login whitelist for people who may use this web app.

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

- GitHub App name: `bkr-elnotas-webui-local`
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

## Secret Environment Variables

```env
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY=
SESSION_SECRET=
```

## Runtime Files

Ignored local files:

```text
.env
config/app.json
data/
dist/
node_modules/
```

`data/working-copy` stores the local markdown working copy.
