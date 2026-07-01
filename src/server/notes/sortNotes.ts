import type { Note, NoteSummary } from "./Note.js";

export function sortNotes<T extends Pick<Note | NoteSummary, "saveFailed" | "deleteFailed" | "conflict" | "pinned" | "updated">>(
  notes: readonly T[]
): readonly T[] {
  return [...notes].sort((left, right) => {
    const leftFailed = left.saveFailed || left.deleteFailed || left.conflict;
    const rightFailed = right.saveFailed || right.deleteFailed || right.conflict;
    if (leftFailed !== rightFailed) {
      return leftFailed ? -1 : 1;
    }

    if (left.saveFailed !== right.saveFailed) {
      return left.saveFailed ? -1 : 1;
    }

    if (left.deleteFailed !== right.deleteFailed) {
      return left.deleteFailed ? -1 : 1;
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
