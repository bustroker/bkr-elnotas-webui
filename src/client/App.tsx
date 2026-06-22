import { useEffect, useMemo, useState } from "react";
import {
  createNote,
  deleteTrashNote,
  emptyTrash,
  getCurrentUser,
  getNote,
  listNotes,
  listTrash,
  pinNote,
  reloadNotes,
  sendNoteToTrash,
  startEditSession,
  updateNote
} from "./api";
import { renderMarkdown } from "./markdown";
import type { Note, NoteSummary, UserState } from "./types";

type ViewMode = "notes" | "trash";
type ModalMode = "read" | "edit" | "create";

interface Toast {
  readonly tone: "info" | "error" | "success";
  readonly message: string;
}

export function App() {
  const [user, setUser] = useState<UserState>({ authenticated: false });
  const [notes, setNotes] = useState<readonly NoteSummary[]>([]);
  const [trashNotes, setTrashNotes] = useState<readonly NoteSummary[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("notes");
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("read");
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editMarkdown, setEditMarkdown] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pwaUpdateReady, setPwaUpdateReady] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handlePwaUpdate = () => setPwaUpdateReady(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pwa-update-ready", handlePwaUpdate);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pwa-update-ready", handlePwaUpdate);
    };
  }, []);

  useEffect(() => {
    void initialize();
  }, []);

  const tags = useMemo(() => {
    return [...new Set(notes.flatMap((note) => note.tags))].sort((left, right) => left.localeCompare(right));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const normalizedText = textFilter.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesTag = tagFilter.length === 0 || note.tags.includes(tagFilter);
      const matchesText = normalizedText.length === 0 || note.searchableText.toLowerCase().includes(normalizedText);
      return matchesTag && matchesText;
    });
  }, [notes, tagFilter, textFilter]);

  async function initialize(): Promise<void> {
    await run("Loading session", async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser.authenticated) {
        setNotes(await listNotes());
      }
    });
  }

  async function refreshNotes(): Promise<void> {
    await run("Reloading notes", async () => {
      setNotes(await reloadNotes());
      setToast({ tone: "success", message: "Notes reloaded from GitHub." });
    });
  }

  async function openNote(id: string): Promise<void> {
    await run("Opening note", async () => {
      setActiveNote(await getNote(id));
      setModalMode("read");
      setEditSessionId(null);
    });
  }

  async function beginEdit(note: Note): Promise<void> {
    await run("Opening editor", async () => {
      const response = await startEditSession(note.id);
      setActiveNote(response.note);
      setEditMarkdown(response.note.markdown);
      setEditSessionId(response.editSessionId);
      setModalMode("edit");
    });
  }

  async function saveEdit(): Promise<void> {
    if (activeNote === null || editSessionId === null) {
      return;
    }

    await run("Saving note", async () => {
      const result = await updateNote(activeNote.id, { markdown: editMarkdown, editSessionId });
      setNotes(await listNotes());
      setActiveNote(result.noteId === undefined ? null : await getNote(result.noteId));
      setModalMode("read");
      setEditSessionId(null);
      if (result.conflict !== undefined) {
        setToast({ tone: "error", message: result.conflict.message });
      } else {
        setToast({ tone: "success", message: "Note saved." });
      }
    });
  }

  async function submitCreate(): Promise<void> {
    await run("Creating note", async () => {
      const result = await createNote({
        title: createTitle,
        body: createBody,
        tags: parseTags(createTags)
      });
      setNotes(await listNotes());
      if (result.noteId !== undefined) {
        setActiveNote(await getNote(result.noteId));
        setModalMode("read");
      }
      setCreateTitle("");
      setCreateTags("");
      setCreateBody("");
      setToast({ tone: "success", message: "Note created." });
    });
  }

  async function togglePin(note: NoteSummary): Promise<void> {
    await run("Updating pin", async () => {
      await pinNote(note.id, !note.pinned);
      setNotes(await listNotes());
    });
  }

  async function trashActiveNote(): Promise<void> {
    if (activeNote === null) {
      return;
    }

    await run("Sending note to trash", async () => {
      await sendNoteToTrash(activeNote.id);
      setActiveNote(null);
      setNotes(await listNotes());
      setToast({ tone: "success", message: "Note moved to trash." });
    });
  }

  async function openTrash(): Promise<void> {
    await run("Loading trash", async () => {
      setTrashNotes(await listTrash());
      setViewMode("trash");
      setActiveNote(null);
    });
  }

  async function deleteTrash(id: string): Promise<void> {
    await run("Deleting trash note", async () => {
      await deleteTrashNote(id);
      setTrashNotes(await listTrash());
      setToast({ tone: "success", message: "Trash note deleted." });
    });
  }

  async function clearTrash(): Promise<void> {
    await run("Emptying trash", async () => {
      await emptyTrash();
      setTrashNotes([]);
      setToast({ tone: "success", message: "Trash emptied." });
    });
  }

  async function run(label: string, action: () => Promise<void>): Promise<void> {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label} failed.`;
      setToast({ tone: "error", message });
    } finally {
      setIsBusy(false);
    }
  }

  if (!user.authenticated) {
    return (
      <main className="authScreen">
        <section className="authPanel">
          <h1>El Notas</h1>
          <a className="primaryButton" href="/auth/github">
            Sign in with GitHub
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      <header className="topBar">
        <div>
          <h1>El Notas</h1>
          <p>{user.username}</p>
        </div>
        <div className="topActions">
          <span className={isOnline ? "onlineBadge" : "offlineBadge"}>{isOnline ? "Online" : "Offline"}</span>
          {pwaUpdateReady && <span className="updateBadge">Update ready</span>}
          <button type="button" onClick={() => setModalMode("create")}>
            New
          </button>
          <button type="button" onClick={() => void refreshNotes()} disabled={isBusy}>
            Reload
          </button>
          <button type="button" onClick={() => void openTrash()} disabled={isBusy}>
            Trash
          </button>
        </div>
      </header>

      {toast !== null && (
        <div className={`toast toast-${toast.tone}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)}>
            Close
          </button>
        </div>
      )}

      {viewMode === "notes" && (
        <>
          <section className="filters">
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} aria-label="Tag filter">
              <option value="">All tags</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <input value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="Search notes" />
          </section>

          <section className="cardGrid">
            {filteredNotes.map((note) => (
              <article key={note.id} className={`noteCard ${note.pinned ? "notePinned" : ""} ${note.conflict ? "noteConflict" : ""}`}>
                <button type="button" className="cardBodyButton" onClick={() => void openNote(note.id)}>
                  <div className="cardHeader">
                    <h2>{note.title}</h2>
                    <time>{formatDate(note.updated)}</time>
                  </div>
                  <p>{note.excerpt || "No content"}</p>
                  <div className="tagRow">
                    {note.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </button>
                <button type="button" className="pinButton" onClick={() => void togglePin(note)}>
                  {note.pinned ? "Unpin" : "Pin"}
                </button>
              </article>
            ))}
          </section>
        </>
      )}

      {viewMode === "trash" && (
        <section className="trashView">
          <div className="sectionHeader">
            <h2>Trash</h2>
            <div>
              <button type="button" onClick={() => setViewMode("notes")}>
                Back
              </button>
              <button type="button" className="dangerButton" onClick={() => void clearTrash()} disabled={trashNotes.length === 0}>
                Empty Trash
              </button>
            </div>
          </div>
          <div className="cardGrid">
            {trashNotes.map((note) => (
              <article key={note.id} className="noteCard trashCard">
                <div className="trashCardBody">
                  <h2>{note.title}</h2>
                  <time>{formatDate(note.updated)}</time>
                  <p>{note.excerpt || "No content"}</p>
                </div>
                <button type="button" className="dangerButton" onClick={() => void deleteTrash(note.id)}>
                  Delete
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeNote !== null && (
        <NoteModal
          mode={modalMode}
          note={activeNote}
          markdown={editMarkdown}
          onMarkdownChange={setEditMarkdown}
          onClose={() => setActiveNote(null)}
          onEdit={() => void beginEdit(activeNote)}
          onSave={() => void saveEdit()}
          onTrash={() => void trashActiveNote()}
        />
      )}

      {modalMode === "create" && activeNote === null && (
        <div className="modalBackdrop">
          <section className="noteModal">
            <div className="modalHeader">
              <h2>New note</h2>
              <button type="button" onClick={() => setModalMode("read")}>
                Close
              </button>
            </div>
            <label>
              Title
              <input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />
            </label>
            <label>
              Tags
              <input value={createTags} onChange={(event) => setCreateTags(event.target.value)} placeholder="tag1, tag2" />
            </label>
            <label>
              Markdown
              <textarea value={createBody} onChange={(event) => setCreateBody(event.target.value)} />
            </label>
            <div className="modalActions">
              <button type="button" className="primaryButton" onClick={() => void submitCreate()} disabled={createTitle.trim().length === 0}>
                Create
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function NoteModal(props: {
  readonly mode: ModalMode;
  readonly note: Note;
  readonly markdown: string;
  readonly onMarkdownChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onEdit: () => void;
  readonly onSave: () => void;
  readonly onTrash: () => void;
}) {
  return (
    <div className="modalBackdrop">
      <section className={`noteModal ${props.note.conflict ? "modalConflict" : ""}`}>
        <div className="modalHeader">
          <div>
            <h2>{props.note.title}</h2>
            <time>{formatDate(props.note.updated)}</time>
          </div>
          <button type="button" onClick={props.onClose}>
            Close
          </button>
        </div>

        {props.mode === "edit" ? (
          <textarea className="markdownEditor" value={props.markdown} onChange={(event) => props.onMarkdownChange(event.target.value)} />
        ) : (
          <div className="markdownBody" dangerouslySetInnerHTML={{ __html: renderMarkdown(props.note.body) }} />
        )}

        <div className="modalActions">
          {props.mode === "edit" ? (
            <button type="button" className="primaryButton" onClick={props.onSave}>
              Save
            </button>
          ) : (
            <button type="button" className="primaryButton" onClick={props.onEdit}>
              Edit
            </button>
          )}
          <button type="button" className="dangerButton" onClick={props.onTrash}>
            Trash
          </button>
        </div>
      </section>
    </div>
  );
}

function parseTags(value: string): readonly string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
