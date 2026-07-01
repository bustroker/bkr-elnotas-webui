import matter from "gray-matter";
import type { Note } from "./Note.js";

export interface NoteMetadata {
  readonly title: string;
  readonly date: string;
  readonly updated: string;
  readonly tags: readonly string[];
  readonly pinned?: true;
  readonly conflict?: true;
  readonly saveFailed?: true;
  readonly deleteFailed?: true;
}

export function parseNoteMarkdown(path: string, markdown: string): Note {
  const parsed = matter(markdown);
  const metadata = normalizeMetadata(parsed.data, path);
  const fileName = path.split("/").at(-1) ?? path;

  return {
    id: fileName.replace(/\.md$/i, ""),
    fileName,
    path,
    title: metadata.title,
    date: metadata.date,
    updated: metadata.updated,
    tags: metadata.tags,
    pinned: metadata.pinned === true,
    conflict: metadata.conflict === true,
    saveFailed: metadata.saveFailed === true,
    deleteFailed: metadata.deleteFailed === true,
    body: parsed.content,
    markdown: serializeNoteMarkdown(metadata, parsed.content)
  };
}

export function serializeNoteMarkdown(metadata: NoteMetadata, body: string): string {
  const data: Record<string, unknown> = {
    title: metadata.title,
    date: metadata.date,
    updated: metadata.updated,
    tags: metadata.tags
  };

  if (metadata.pinned === true) {
    data.pinned = true;
  }

  if (metadata.conflict === true) {
    data.conflict = true;
  }

  if (metadata.saveFailed === true) {
    data.save_failed = true;
  }

  if (metadata.deleteFailed === true) {
    data.delete_failed = true;
  }

  return matter.stringify(body.trimStart(), data).trimEnd() + "\n";
}

export function updateMarkdownMetadata(markdown: string, updater: (metadata: NoteMetadata) => NoteMetadata): string {
  const parsed = matter(markdown);
  const metadata = normalizeMetadata(parsed.data, "note.md");
  return serializeNoteMarkdown(updater(metadata), parsed.content);
}

export function createNoteMarkdown(input: {
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly nowIso: string;
}): string {
  return serializeNoteMarkdown(
    {
      title: input.title,
      date: input.nowIso,
      updated: input.nowIso,
      tags: normalizeTags(input.tags)
    },
    input.body
  );
}

function normalizeMetadata(value: Record<string, unknown>, path: string): NoteMetadata {
  return {
    title: readString(value.title) ?? titleFromPath(path),
    date: readString(value.date) ?? new Date(0).toISOString(),
    updated: readString(value.updated) ?? readString(value.date) ?? new Date(0).toISOString(),
    tags: normalizeTags(readTags(value.tags)),
    pinned: value.pinned === true ? true : undefined,
    conflict: value.conflict === true ? true : undefined,
    saveFailed: value.save_failed === true ? true : undefined,
    deleteFailed: value.delete_failed === true ? true : undefined
  };
}

function readTags(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return [];
}

function normalizeTags(tags: readonly string[]): readonly string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function titleFromPath(path: string): string {
  const fileName = path.split("/").at(-1)?.replace(/\.md$/i, "") ?? "Untitled note";
  return fileName
    .replace(/^\d{8}-\d{6}-/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}
