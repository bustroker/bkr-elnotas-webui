# Configuration

Configure the app before running it locally or deploying it.

## Create Local Secrets File

```sh
cp .env.example .env
```

`config/app.json` contains non-secret runtime configuration and is committed with the app.

`.env` contains secrets and must not be committed.

## App Config

The app reads non-secret configuration from `config/app.json`:

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

`notesGitHubRepository` identifies the repository where the notes are stored. This is the backing notes repository, not necessarily the repository that contains this web app.

`notesGitHubRepository.account` is the GitHub user or organization that owns the notes repository. For example, if the notes live in `bustroker/bkr-elnotas-notes`, the account is `bustroker`.

`notesGitHubRepository.repo` is the repository name where note markdown files live. For example, if the notes live in `bustroker/bkr-elnotas-notes`, the repo is `bkr-elnotas-notes`.

`notesGitHubRepository.branch` is the branch used for all note read/write operations. This branch must already exist before the app runs.

`notesFolder` is the root-level folder that contains active notes.

`trashFolder` is the root-level folder that contains trashed notes.

`trashSizeLimit` is the maximum number of notes kept in trash.

`localWorkingCopyFolder` is where the backend stores its local working copy.

`allowedGitHubUsernames` is the login whitelist for people who may use this web app.

## Notes Repository Setup

The notes repository must be initialized before the app runs. The app does not create the repository or the configured branch.

The configured repository must contain:

- the branch configured in `notesGitHubRepository.branch`;
- at least one initial commit.

The recommended first commit is a small `.gitignore` file:

```gitignore
.DS_Store
```

The configured `notesFolder` and `trashFolder` do not need to exist before the app runs. Git does not store empty folders, so the app creates those paths naturally when it writes files such as `notes/example.md` or `trash/example.md`.

For example, with this config:

```json
{
  "notesGitHubRepository": {
    "account": "bustroker",
    "repo": "bkr-elnotas-notes",
    "branch": "main"
  },
  "notesFolder": "notes",
  "trashFolder": "trash"
}
```

the app reads and writes markdown files under:

```text
github.com/bustroker/bkr-elnotas-notes/tree/main/notes
github.com/bustroker/bkr-elnotas-notes/tree/main/trash
```

## Create The GitHub App

Create a GitHub App so `bkr-elnotas-webui` can authenticate users and read/write the notes repository.

```text
GitHub -> Settings -> Developer settings -> GitHub Apps -> New GitHub App
```

Use these local values (do the same for the production deployment):

- GitHub App name: `bkr-elnotas-webui-local`
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/auth/github/callback`
- Webhook: inactive
- Repository permissions:
  - Contents: Read and write
  - Metadata: Read-only
- Account permissions: none
- Installation target: only this account

Do not use `Actions` permission for note storage. Reading and writing markdown files in the notes repository requires `Contents: Read and write`.

In the OAuth section:

- Keep `Expire user authorization tokens` enabled.
- Keep `Request user authorization (OAuth) during installation` disabled.
- Keep `Enable Device Flow` disabled.

## Configure GitHub App Secrets

After creating the app, open:

```text
GitHub -> Settings -> Developer settings -> GitHub Apps -> bkr-elnotas-webui-local -> General
```

Copy these values into `.env`:

```env
GITHUB_APP_ID=<app-id>
GITHUB_APP_CLIENT_ID=<client-id>
```

Generate a client secret:

```text
Client secrets -> Generate a new client secret
```

Copy the generated value immediately. GitHub only shows it once.

```env
GITHUB_APP_CLIENT_SECRET=<generated-client-secret>
```

If the value is lost, generate a new client secret and update `.env`.

Generate a private key:

```text
General -> Private keys -> Generate a private key
```

GitHub downloads a `.pem` file. Convert it to escaped newline format:

```sh
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' ~/Downloads/<private-key-file>.pem
```

Put the full output in `.env` with double quotes:

```env
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
```

Generate a session secret:

```sh
openssl rand -base64 48
```

Put the output in `.env`:

```env
SESSION_SECRET=<generated-random-value>
```

`SESSION_SECRET` is not a GitHub value. The app uses it to sign its own browser session cookie.

## Install The GitHub App

Open:

```text
GitHub -> Settings -> Developer settings -> GitHub Apps -> bkr-elnotas-webui-local -> Install App
```

Install the GitHub App on the same account and repository configured in `notesGitHubRepository`.

Example:

```json
"notesGitHubRepository": {
  "account": "bustroker",
  "repo": "bkr-elnotas-notes",
  "branch": "main"
}
```

means:

1. Choose the GitHub account `bustroker` during installation.
2. Select `Only select repositories`.
3. Select the repository `bkr-elnotas-notes`.
4. Confirm the installation.

Do not install it only on the web app repository unless that is also where the markdown notes are stored.

The notes repository must grant:

- Contents: Read and write
- Metadata: Read-only

If repository permissions are changed after the app is already installed, open:

```text
GitHub -> Settings -> Developer settings -> GitHub Apps -> bkr-elnotas-webui-local -> Install App -> Configure
```

Then accept or update the installation permissions for the notes repository.

After accepting new permissions, restart the local app so it requests a fresh GitHub installation token:

```sh
docker compose restart webui
```

## Reset Local Notes Access

The app includes a `Reset Access` action in the UI.

This action only resets local app state:

- clears the local working copy;
- clears active edit sessions;
- clears the local browser session cookie;
- returns the app to the GitHub login screen.

It does not uninstall the GitHub App and does not remove repository access in GitHub.

To remove or change the real GitHub repository access, use:

```text
GitHub -> Settings -> Developer settings -> GitHub Apps -> bkr-elnotas-webui-local -> Install App -> Configure
```

## Local `.env` Example

The final local `.env` should contain these values:

```env
GITHUB_APP_ID=<app-id>
GITHUB_APP_CLIENT_ID=<client-id>
GITHUB_APP_CLIENT_SECRET=<generated-client-secret>
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
SESSION_SECRET=<generated-random-value>
```

For local execution, keep these runtime values unless you need a different port:

```env
PORT=3000
NODE_ENV=development
```

The app always reads non-secret app configuration from `config/app.json`.

## Runtime Files

Ignored local files:

```text
.env
data/
dist/
node_modules/
```

`data/working-copy` stores the local markdown working copy.
