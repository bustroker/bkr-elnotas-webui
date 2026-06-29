import type { Note, NoteSummary } from "./Note.js";

export function sortNotes<T extends Pick<Note | NoteSummary, "saveFailed" | "conflict" | "pinned" | "updated">>(notes: readonly T[]): readonly T[] {
  return [...notes].sort((left, right) => {
    if (left.saveFailed !== right.saveFailed) {
      return left.saveFailed ? -1 : 1;
    }

    if (left.conflict !== right.conflict) {
      return left.conflict ? -1 : 1;
    }

    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return Date.parse(right.updated) - Date.parse(left.updated);
  });
}
