import { describe, expect, it } from "vitest";
import { parseNoteMarkdown, serializeNoteMarkdown } from "../src/server/notes/NoteMarkdown.js";

describe("NoteMarkdown", () => {
  it("omits pinned and conflict when they do not apply", () => {
    const markdown = serializeNoteMarkdown(
      {
        title: "Title",
        date: "2026-06-22T10:00:00.000Z",
        updated: "2026-06-22T10:00:00.000Z",
        tags: ["a"]
      },
      "Body"
    );

    expect(markdown).not.toContain("pinned:");
    expect(markdown).not.toContain("conflict:");
  });

  it("reads pinned and conflict metadata when present", () => {
    const note = parseNoteMarkdown(
      "notes/example.md",
      `---
title: Example
date: 2026-06-22T10:00:00.000Z
updated: 2026-06-22T10:00:00.000Z
tags:
  - a
pinned: true
conflict: true
---

Body`
    );

    expect(note.pinned).toBe(true);
    expect(note.conflict).toBe(true);
    expect(note.tags).toEqual(["a"]);
  });
});
