import { describe, expect, it } from "vitest";
import { toNoteSummary, type Note } from "../src/server/notes/Note.js";

describe("Note summaries", () => {
  it("keeps markdown excerpts so cards can render formatted previews", () => {
    const summary = toNoteSummary(noteWithBody("## Watches\n- [Knot](https://example.com)\n- `code`\n> quoted\n"));

    expect(summary.excerpt).toBe("## Watches\n- [Knot](https://example.com)\n- `code`\n> quoted");
  });
});

function noteWithBody(body: string): Note {
  return {
    id: "note",
    fileName: "note.md",
    path: "notes/note.md",
    title: "Note",
    created: "2026-06-25T10:00:00.000Z",
    updated: "2026-06-25T10:00:00.000Z",
    tags: [],
    pinned: false,
    conflict: false,
    saveFailed: false,
    body,
    markdown: body
  };
}
