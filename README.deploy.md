# Deploy On Render

Deploy `bkr-elnotas-webui` to Render as a single Docker container published to GitHub Container Registry.

Render Free is enough for personal use if cold starts are acceptable. Free web services spin down after idle time, and their local filesystem is ephemeral. That is acceptable here because GitHub is the source of truth and the local working copy is only a cache.

## First-Time Setup

Set the image publish variables in `.env`, then publish the first image to GitHub Container Registry:

```env
REGISTRY_PREFIX=ghcr.io/<github-owner>
REGISTRY_USERNAME=<github-username>
REGISTRY_TOKEN=<classic-pat-with-write-packages>
DOCKER_DEFAULT_PLATFORM=linux/amd64
IMAGE_NAME=bkr-elnotas-webui
IMAGE_TAG=1.0.0
```

```sh
bash build-push-image.sh
```

Create the service:

1. Open Render Dashboard.
2. Select `New > Web Service`.
3. Select `Existing Image`.
4. Set the image URL:

   ```text
   ghcr.io/<github-owner>/bkr-elnotas-webui:<tag>
   ```

5. If the image is private, configure a Render registry credential with:
   - Username: the GitHub user that can read the package
   - Token: a classic GitHub PAT with `read:packages`
6. Choose the `Free` instance type.
7. Set the health check path to `/api/health`.

Set environment variables:

```env
NODE_ENV=production
PORT=10000
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

`config/app.json` is included in the image. It contains non-secret app configuration. Render only needs the secret environment variables listed above.

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

Render pulls the app image from GitHub Container Registry. The GitHub App configured above is what `bkr-elnotas-webui` uses at runtime to read and write the notes repository.

Create a Render deploy hook and put it in `.env`:

```env
RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-xxxxx?key=yyyyy
```

## Deploy

Use the same deploy flow for the first release and later releases.

Validate locally:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Build and push the image to GitHub Container Registry:

```sh
bash build-push-image.sh
```

Trigger Render to pull and run the configured image:

```sh
bash deploy-render.sh
```

To run both steps:

```sh
bash build-push-image-deploy-render.sh
```

After deploy, check:

```text
https://<render-service-name>.onrender.com/api/health
```

Then open the app, log in with GitHub, and use Reload if the working copy has not loaded the latest notes yet.

For Render Free, `config/app.json` can enable the backend keep-alive ping documented in [README.config.md](README.config.md). It sends a periodic request to `/api/health`, which helps reduce idle spin-downs but does not guarantee the service will never sleep.

## Updating Config Or Secrets

When GitHub App credentials or `SESSION_SECRET` change:

1. Open the Render service.
2. Edit Environment variables.
3. Save and deploy the service.
4. Verify `/api/health`.

When `config/app.json` changes, commit it, publish a new image, and deploy that image.

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
