# 5l-elnotas-webui

Private markdown notes synced with GitHub, editable from a browser.

`5l-elnotas-webui` is a private notes web app where every note is stored as one plain markdown file in a GitHub repository. It gives you a browser UI for reading, searching, filtering, editing, pinning, and deleting notes while keeping the underlying notes portable and easy to access outside the app.

It is useful when notes must stay independent from any database or proprietary app format, but still need a comfortable authenticated web interface.

## Main Features

- Notes synced with a GitHub repository.
- One markdown file per note.
- GitHub login with username whitelist; only predefined GitHub users can log in.
- Cards sorted by conflict, pinned, then last update.
- Tag and full-content text filters.
- Raw markdown editing in a modal.
- Pin/unpin, trash, empty trash, and permanent delete.
- Conflict copies instead of overwriting stale edits.
- Progressive Web App using `vite-plugin-pwa`.

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
