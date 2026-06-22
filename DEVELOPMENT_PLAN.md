# Development Plan

## 1. Project Foundation

- Create the React frontend and Node.js/TypeScript backend in one deployable app.
- Use Fastify for backend routing, cookies, static assets, and structured API errors.
- Add strict TypeScript configuration.
- Add JSON configuration loading and environment-based secret loading.
- Add Docker and Docker Compose local execution.
- Add PWA support with `vite-plugin-pwa`.

## 2. Markdown Note Model

- Parse and serialize markdown with frontmatter.
- Manage app-owned fields: `title`, `date`, `updated`, `tags`, `pinned`, and `conflict`.
- Keep `pinned` and `conflict` absent unless they apply.
- Add note sorting and filtering behavior.

## 3. GitHub App Integration

- Implement GitHub login and session handling.
- Validate the authenticated GitHub username against the configured whitelist.
- Generate GitHub App installation tokens server-side.
- Read, create, update, move, and delete files through the GitHub Contents API.

## 4. Local Working Copy

- Download active notes from the configured GitHub repository into the local working copy.
- Keep internal SHA metadata for safe updates.
- Reload all active notes on explicit user action.
- Reload a note before entering edit mode.

## 5. Notes API

- Expose API endpoints for note list, note details, create, update, pin/unpin, send to trash, trash list, permanent delete, empty trash, and reload.
- Keep local working copy details out of API responses.
- Use consistent structured error responses.

## 6. Conflict And Trash Rules

- Detect stale edits using the GitHub file SHA captured before editing.
- On conflict, leave the original note body unchanged, create a conflict copy, and mark both notes with `conflict: true`.
- Move active notes to trash instead of deleting.
- Enforce the configured trash size limit by permanently deleting the oldest trashed note when needed.

## 7. React UI

- Show notes as sortable cards.
- Sort by conflict, pinned, then updated descending.
- Support tag filtering and full-content text filtering.
- Show note details in a large modal with the list greyed out behind it.
- Switch the modal to raw markdown edit mode.
- Add trash access and empty trash flows.

## 8. PWA

- Generate manifest and service worker through `vite-plugin-pwa`.
- Cache only app shell and static assets.
- Keep `/api/*`, `/auth/*`, and note content network-only.
- Support installable standalone mode without offline editing.

## 9. Verification

- Add unit tests for config, markdown parsing, sorting, conflict handling, and trash limit behavior.
- Add API tests with the GitHub adapter mocked.
- Keep a small smoke test suite for startup and health behavior.
- Run typecheck, tests, and production build before release.
