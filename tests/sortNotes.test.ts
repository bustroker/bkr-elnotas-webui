import { describe, expect, it } from "vitest";
import { sortNotes } from "../src/server/notes/sortNotes.js";

describe("sortNotes", () => {
  it("sorts by conflict, pinned, then updated descending", () => {
    const sorted = sortNotes([
      { id: "old", conflict: false, pinned: false, updated: "2026-06-20T10:00:00.000Z" },
      { id: "pin", conflict: false, pinned: true, updated: "2026-06-19T10:00:00.000Z" },
      { id: "new", conflict: false, pinned: false, updated: "2026-06-22T10:00:00.000Z" },
      { id: "conflict", conflict: true, pinned: false, updated: "2026-06-18T10:00:00.000Z" }
    ]);

    expect(sorted.map((note) => note.id)).toEqual(["conflict", "pin", "new", "old"]);
  });
});
