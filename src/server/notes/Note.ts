export interface Note {
  readonly id: string;
  readonly fileName: string;
  readonly path: string;
  readonly title: string;
  readonly date: string;
  readonly updated: string;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly conflict: boolean;
  readonly body: string;
  readonly markdown: string;
}

export interface NoteSummary {
  readonly id: string;
  readonly title: string;
  readonly date: string;
  readonly updated: string;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly conflict: boolean;
  readonly excerpt: string;
  readonly searchableText: string;
}

export function toNoteSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    date: note.date,
    updated: note.updated,
    tags: note.tags,
    pinned: note.pinned,
    conflict: note.conflict,
    excerpt: note.body.replace(/\s+/g, " ").trim().slice(0, 220),
    searchableText: `${note.title}\n${note.tags.join(" ")}\n${note.body}`
  };
}
