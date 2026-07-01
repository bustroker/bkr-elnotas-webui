import { describe, expect, it } from "vitest";
import { sortNotes } from "../src/server/notes/sortNotes.js";

describe("sortNotes", () => {
  it("sorts by failed status, pinned, then updated descending", () => {
    const sorted = sortNotes([
      { id: "old", saveFailed: false, deleteFailed: false, conflict: false, pinned: false, updated: "2026-06-20T10:00:00.000Z" },
      { id: "pin", saveFailed: false, deleteFailed: false, conflict: false, pinned: true, updated: "2026-06-19T10:00:00.000Z" },
      { id: "new", saveFailed: false, deleteFailed: false, conflict: false, pinned: false, updated: "2026-06-22T10:00:00.000Z" },
      { id: "conflict", saveFailed: false, deleteFailed: false, conflict: true, pinned: false, updated: "2026-06-18T10:00:00.000Z" },
      { id: "delete-failed", saveFailed: false, deleteFailed: true, conflict: false, pinned: false, updated: "2026-06-16T10:00:00.000Z" },
      { id: "failed", saveFailed: true, deleteFailed: false, conflict: false, pinned: false, updated: "2026-06-17T10:00:00.000Z" }
    ]);

    expect(sorted.map((note) => note.id)).toEqual(["failed", "delete-failed", "conflict", "pin", "new", "old"]);
  });
});
