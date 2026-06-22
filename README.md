# 5l-elnotas-webui

Private GitHub-backed markdown notes, editable from a browser.

`5l-elnotas-webui` is a single web app that turns a GitHub repository into a lightweight notes UI. It authenticates users with GitHub, reads and writes plain markdown files through a GitHub App, keeps a local working copy for fast browsing, and provides card-based search, tags, pinning, editing, conflict handling, and trash.

It is useful when notes must remain portable, agent-friendly, and independently accessible as markdown files, while still offering a comfortable authenticated web interface.

## Main Features

- One markdown file per note.
- GitHub repository as source of truth.
- GitHub login with username whitelist.
- GitHub App read/write access to the notes repository.
- Local working copy for fast listing and filtering.
- Cards sorted by conflict, pinned, then last update.
- Tag and full-content text filters.
- Raw markdown editing in a modal.
- Pin/unpin, trash, empty trash, and permanent delete.
- Conflict copies instead of overwriting stale edits.
- Progressive Web App using `vite-plugin-pwa`.

## Docs

- [Configuration](README.config.md)
- [Run, test, and tech stack](README.run.md)
