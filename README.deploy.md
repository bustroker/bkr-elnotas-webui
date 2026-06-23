# Deploy On Render

Deploy `bkr-elnotas-webui` to Render as a single Docker container built from this repository.

Render Free is enough for personal use if cold starts are acceptable. Free web services spin down after idle time, and their local filesystem is ephemeral. That is acceptable here because GitHub is the source of truth and the local working copy is only a cache.

## First-Time Setup

Push this app repository to GitHub before creating the Render service.

Create the service:

1. Open Render Dashboard.
2. Select `New > Web Service`.
3. Connect the GitHub repository for this app.
4. Use the branch you deploy from, usually `main`.
5. Use Docker deployment from the repository `Dockerfile`.
6. Choose the `Free` instance type.
7. Set the health check path to `/api/health`.
8. Leave the root directory empty unless this app is inside a larger monorepo.

Set environment variables:

```env
NODE_ENV=production
PORT=10000
CONFIG_FILE=/etc/secrets/app.json
GITHUB_APP_ID=<github-app-id>
GITHUB_APP_CLIENT_ID=<github-app-client-id>
GITHUB_APP_CLIENT_SECRET=<github-app-client-secret>
GITHUB_APP_PRIVATE_KEY=<github-app-private-key-with-escaped-newlines>
SESSION_SECRET=<long-random-session-secret>
```

Use the same escaped newline format documented in [README.config.md](README.config.md):

```env
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

Add a Render secret file named `app.json`. Render mounts it at `/etc/secrets/app.json`, matching `CONFIG_FILE`.

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
  "localWorkingCopyFolder": "/tmp/bkr-elnotas-webui/working-copy",
  "allowedGitHubUsernames": ["your-github-username"]
}
```

Use `/tmp` for `localWorkingCopyFolder` on Render Free. The folder can disappear after a restart, redeploy, or spin-down; the app reloads notes from GitHub when needed.

Configure the GitHub App:

1. Add the production callback URL:

   ```text
   https://<render-service-name>.onrender.com/auth/github/callback
   ```

2. If you use a custom domain, add that callback too:

   ```text
   https://<your-domain>/auth/github/callback
   ```

3. Keep repository permissions as:
   - Contents: Read and write
   - Metadata: Read-only

4. Install the GitHub App on the notes repository configured in `app.json`.

The GitHub account connected to Render deploys the app code. The GitHub App configured above is what `bkr-elnotas-webui` uses at runtime to read and write the notes repository.

## Deploy

Use the same deploy flow for the first release and later releases.

Validate locally:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Push the version you want to deploy:

```sh
git push origin main
```

If Render auto-deploys are enabled, Render rebuilds and deploys after the push.

If auto-deploys are disabled:

```text
Render Dashboard -> Service -> Manual Deploy -> Deploy latest commit
```

After deploy, check:

```text
https://<render-service-name>.onrender.com/api/health
```

Then open the app, log in with GitHub, and use Reload if the working copy has not loaded the latest notes yet.

## Updating Config Or Secrets

When `app.json`, GitHub App credentials, or `SESSION_SECRET` change:

1. Open the Render service.
2. Edit Environment variables or the `app.json` secret file.
3. Save and deploy the service.
4. Verify `/api/health`.

Changing the GitHub App callback URLs is done in GitHub, not in Render.

## Render Free Limits To Expect

- First request after idle time can take about a minute.
- The local working copy can be lost after spin-down, restart, or redeploy.
- Free web services do not support persistent disks.
- Build minutes, outbound bandwidth, and free instance hours have monthly limits.

Official Render references:

- [Deploy for Free](https://render.com/docs/free)
- [Web Services](https://render.com/docs/web-services)
- [Environment Variables and Secrets](https://render.com/docs/configure-environment-variables)
- [Using Secrets with Docker](https://render.com/docs/docker-secrets)
