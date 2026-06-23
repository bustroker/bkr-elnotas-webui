# bkr-elnotas-webui

`bkr-elnotas-webui` is a personal notes web app you can use in the browser or install on your phone, with every note saved as Markdown in a GitHub repo. It provides a private interface for reading, searching, and editing notes while keeping them portable and versioned. It is also agent-friendly: agents can manage the same notes directly through the backing GitHub repo.

## Main Features

- Notes stay synced with a GitHub repository.
- Each note is a plain Markdown file.
- Browse notes as cards for quick scanning.
- Private access through GitHub login and a username whitelist.
- Search by tag or across the full note content.
- Edit notes directly as raw Markdown.
- Installable from the browser for app-like mobile access.

## How It Works

- The configured GitHub repository is the source of truth.
- The app uses a GitHub App with read/write access to the notes repository.
- The backend keeps a local working copy for fast listing and filtering.
- Saves are committed back to GitHub immediately.
- Entering edit mode reloads the note from GitHub and captures its file version.
- If the remote note changed meanwhile, the app creates a conflict copy instead of overwriting the original.

## Docs

- [Configuration](README.config.md)
- [Run, test, and tech stack](README.run.md)
- [Deploy on Render](README.deploy.md)
