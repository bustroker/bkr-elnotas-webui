import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Check, CornerUpLeft, Edit3, Info, Menu, Pin, PinOff, Plus, RefreshCw, RotateCcw, Trash2, Unplug, X } from "lucide-react";
import {
  ApiRequestError,
  createNote,
  deleteTrashNote,
  emptyTrash,
  getCurrentUser,
  getNote,
  listNotes,
  listTrash,
  pinNote,
  reloadNotes,
  resetNotesAccess,
  sendNoteToTrash,
  startEditSession,
  updateNote
} from "./api";
import { renderMarkdown } from "./markdown";
import { shouldAutoDismissToast, toastFromError, type Toast } from "./toastPolicy";
import type { Note, NoteSummary, UserState } from "./types";

type ViewMode = "notes" | "trash";
type ModalMode = "read" | "edit" | "create";
type LocalNoteInput = Omit<Note, "excerpt" | "searchableText" | "markdown"> & {
  readonly markdown?: string;
};
const toastAutoDismissMs = 5000;
const toastFadeOutMs = 250;
const cardRemoveAnimationMs = 220;

interface HelpActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly help: string;
  readonly helpId: string;
  readonly actionClassName?: string;
  readonly children: ReactNode;
}

export function App() {
  const [user, setUser] = useState<UserState>({ authenticated: false });
  const [notes, setNotes] = useState<readonly NoteSummary[]>([]);
  const [localNotes, setLocalNotes] = useState<Readonly<Record<string, Note>>>({});
  const [trashNotes, setTrashNotes] = useState<readonly NoteSummary[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("notes");
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("read");
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editBody, setEditBody] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [isToastLeaving, setIsToastLeaving] = useState(false);
  const [removingNoteIds, setRemovingNoteIds] = useState<ReadonlySet<string>>(new Set());
  const [removingTrashIds, setRemovingTrashIds] = useState<ReadonlySet<string>>(new Set());
  const [isBusy, setIsBusy] = useState(false);
  const [pwaUpdateReady, setPwaUpdateReady] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [openHelpId, setOpenHelpId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const localNotesRef = useRef<Readonly<Record<string, Note>>>({});

  useEffect(() => {
    const handlePwaUpdate = () => setPwaUpdateReady(true);
    window.addEventListener("pwa-update-ready", handlePwaUpdate);
    return () => {
      window.removeEventListener("pwa-update-ready", handlePwaUpdate);
    };
  }, []);

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    localNotesRef.current = localNotes;
  }, [localNotes]);

  useEffect(() => {
    if (!actionsMenuOpen) {
      return;
    }

    const closeMenuOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && actionsMenuRef.current?.contains(target) === true) {
        return;
      }

      setActionsMenuOpen(false);
      setOpenHelpId(null);
    };

    document.addEventListener("pointerdown", closeMenuOnOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsidePointer);
    };
  }, [actionsMenuOpen]);

  useEffect(() => {
    if (openHelpId === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpenHelpId(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [openHelpId]);

  useEffect(() => {
    if (toast === null) {
      setIsToastLeaving(false);
      return;
    }

    setIsToastLeaving(false);

    if (!shouldAutoDismissToast(toast)) {
      return;
    }

    const fadeTimeoutId = window.setTimeout(() => {
      setIsToastLeaving(true);
    }, toastAutoDismissMs);
    const removeTimeoutId = window.setTimeout(() => {
      setToast(null);
    }, toastAutoDismissMs + toastFadeOutMs);

    return () => {
      window.clearTimeout(fadeTimeoutId);
      window.clearTimeout(removeTimeoutId);
    };
  }, [toast]);

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
  const attentionNotes = useMemo(() => filteredNotes.filter(hasAttentionStatus), [filteredNotes]);
  const pinnedNotes = useMemo(() => filteredNotes.filter((note) => note.pinned && !hasAttentionStatus(note)), [filteredNotes]);
  const normalNotes = useMemo(() => filteredNotes.filter((note) => !note.pinned && !hasAttentionStatus(note)), [filteredNotes]);
  const canCreateNote = createTitle.trim().length > 0;
  const repositoryLabel = user.config?.repository ?? user.username;

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
    const localNote = localNotes[id];
    if (localNote !== undefined) {
      setActiveNote(localNote);
      setModalMode("read");
      setEditSessionId(null);
      return;
    }

    await run("Opening note", async () => {
      setActiveNote(await getNote(id));
      setModalMode("read");
      setEditSessionId(null);
    });
  }

  async function beginEdit(note: Note): Promise<void> {
    const localNote = localNotes[note.id];
    if (localNote !== undefined) {
      openLocalEditor(localNote);
      return;
    }

    await run("Opening editor", async () => {
      const response = await startEditSession(note.id);
      setActiveNote(response.note);
      setEditTitle(response.note.title);
      setEditTags(response.note.tags.join(", "));
      setEditBody(response.note.body);
      setEditSessionId(response.editSessionId);
      setModalMode("edit");
    });
  }

  async function beginEditById(id: string): Promise<void> {
    const localNote = localNotes[id];
    if (localNote !== undefined) {
      openLocalEditor(localNote);
      return;
    }

    await run("Opening editor", async () => {
      const note = await getNote(id);
      const response = await startEditSession(note.id);
      setActiveNote(response.note);
      setEditTitle(response.note.title);
      setEditTags(response.note.tags.join(", "));
      setEditBody(response.note.body);
      setEditSessionId(response.editSessionId);
      setModalMode("edit");
    });
  }

  async function saveEdit(): Promise<void> {
    if (activeNote === null) {
      return;
    }

    const originalNote = activeNote;
    const updatedNote = buildLocalNote({
      ...originalNote,
      title: editTitle,
      tags: parseTags(editTags),
      body: editBody,
      updated: new Date().toISOString(),
      saveFailed: false,
      deleteFailed: false
    });

    setActiveNote(null);
    setModalMode("read");
    setEditSessionId(null);
    setLocalNotes((current) => ({ ...current, [updatedNote.id]: updatedNote }));
    upsertNoteSummary(noteToSummary(updatedNote));
    setIsBusy(true);
    try {
      const result = localNotes[updatedNote.id] !== undefined && editSessionId === null
        ? await createNote({ fileName: updatedNote.fileName, title: updatedNote.title, body: updatedNote.body, tags: updatedNote.tags })
        : await updateNote(updatedNote.id, {
            markdown: buildNoteMarkdown(updatedNote),
            editSessionId: editSessionId ?? (await startEditSession(updatedNote.id)).editSessionId
          });

      await syncNotesFromBackend();
      setLocalNotes((current) => removeLocalNote(current, updatedNote.id));
      if (result.saveFailed === true) {
        setToast({ tone: "error", message: "Failed to save to GitHub. Open the note and save it again." });
      } else if (result.conflict !== undefined) {
        setToast({ tone: "error", message: `${result.conflict.message} Review both notes, consolidate them into one, and remove the duplicate.` });
      } else {
        setToast(null);
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "not_authenticated") {
        clearSignedInState();
        return;
      }

      const failedNote = buildLocalNote({ ...updatedNote, saveFailed: true, deleteFailed: false });
      setLocalNotes((current) => ({ ...current, [failedNote.id]: failedNote }));
      upsertNoteSummary(noteToSummary(failedNote));
      setToast({ tone: "error", message: "Failed to save to GitHub. Open the note and save it again." });
    } finally {
      setIsBusy(false);
    }
  }

  async function submitCreate(): Promise<void> {
    const localNote = createLocalNote({
      title: createTitle,
      body: createBody,
      tags: parseTags(createTags)
    });
    setModalMode("read");
    setCreateTitle("");
    setCreateTags("");
    setCreateBody("");
    setLocalNotes((current) => ({ ...current, [localNote.id]: localNote }));
    upsertNoteSummary(noteToSummary(localNote));
    setIsBusy(true);
    try {
      const result = await createNote({
        fileName: localNote.fileName,
        title: localNote.title,
        body: localNote.body,
        tags: localNote.tags
      });
      const currentLocalNote = localNotesRef.current[localNote.id];
      if (currentLocalNote?.pinned === true) {
        await pinNote(localNote.id, true);
      }
      await syncNotesFromBackend();
      setLocalNotes((current) => removeLocalNote(current, localNote.id));
      if (result.saveFailed === true) {
        setToast({ tone: "error", message: "Failed to save to GitHub. Open the note and save it again." });
      } else {
        setToast(null);
      }
    } catch (error) {
      setActiveNote(null);
      setModalMode("read");
      if (error instanceof ApiRequestError && error.code === "not_authenticated") {
        clearSignedInState();
        return;
      }

      const failedNote = buildLocalNote({ ...localNote, saveFailed: true });
      setLocalNotes((current) => ({ ...current, [failedNote.id]: failedNote }));
      upsertNoteSummary(noteToSummary(failedNote));
      setToast({ tone: "error", message: "Failed to save to GitHub. Open the note and save it again." });
    } finally {
      setIsBusy(false);
    }
  }

  async function togglePin(note: NoteSummary): Promise<void> {
    const pinned = !note.pinned;
    const optimisticUpdated = new Date().toISOString();
    const previousNotes = notes;
    const localNote = localNotes[note.id];
    setNotes((currentNotes) =>
      sortClientNotes(
        currentNotes.map((currentNote) =>
          currentNote.id === note.id
            ? {
                ...currentNote,
                pinned,
                updated: optimisticUpdated
              }
            : currentNote
        )
      )
    );

    if (localNote !== undefined) {
      const updatedLocalNote = buildLocalNote({
        ...localNote,
        pinned,
        updated: optimisticUpdated
      });
      setLocalNotes((current) => ({ ...current, [updatedLocalNote.id]: updatedLocalNote }));
      return;
    }

    try {
      await pinNote(note.id, pinned);
      setNotes(await listNotes());
    } catch (error) {
      setNotes(previousNotes);
      if (error instanceof ApiRequestError && error.code === "not_authenticated") {
        clearSignedInState();
        return;
      }

      setToast(toastFromError(error, "Updating pin failed."));
    }
  }

  async function trashActiveNote(): Promise<void> {
    if (activeNote === null) {
      return;
    }

    void trashNote(activeNote.id, activeNote);
    setActiveNote(null);
  }

  async function trashNote(id: string, fullNote?: Note): Promise<void> {
    const localNote = localNotes[id] ?? fullNote;
    const previousNotes = notes;
    const previousLocalNotes = localNotes;
    setActiveNote(null);
    setRemovingNoteIds((current) => new Set(current).add(id));
    await delay(cardRemoveAnimationMs);
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
    setLocalNotes((current) => removeLocalNote(current, id));
    setRemovingNoteIds((current) => removeSetValue(current, id));
    setIsBusy(true);
    try {
      const result = await sendNoteToTrash(id);
      await syncNotesFromBackend();
      if (result.deleteFailed === true) {
        setToast({ tone: "error", message: "Failed to move to trash. Open the note and delete again." });
      } else {
        setToast({ tone: "success", message: "Note moved to trash." });
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "not_authenticated") {
        clearSignedInState();
        return;
      }

      const failedNote = localNote === undefined ? null : buildLocalNote({ ...localNote, deleteFailed: true, saveFailed: false });
      setNotes(
        failedNote === null
          ? sortClientNotes(previousNotes.map((note) => (note.id === id ? { ...note, deleteFailed: true, saveFailed: false } : note)))
          : sortClientNotes([...previousNotes.filter((note) => note.id !== id), noteToSummary(failedNote)])
      );
      setLocalNotes(failedNote === null ? previousLocalNotes : { ...previousLocalNotes, [failedNote.id]: failedNote });
      setRemovingNoteIds((current) => removeSetValue(current, id));
      setToast({ tone: "error", message: "Failed to move to trash. Open the note and delete again." });
    } finally {
      setIsBusy(false);
    }
  }

  async function syncNotesFromBackend(): Promise<void> {
    setNotes(await listNotes());
  }

  async function openTrash(): Promise<void> {
    await run("Loading trash", async () => {
      setTrashNotes(await listTrash());
      setViewMode("trash");
      setActiveNote(null);
    });
  }

  async function deleteTrash(id: string): Promise<void> {
    const previousTrashNotes = trashNotes;
    setRemovingTrashIds((current) => new Set(current).add(id));
    await delay(cardRemoveAnimationMs);
    setTrashNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
    setRemovingTrashIds((current) => removeSetValue(current, id));
    setIsBusy(true);
    try {
      await deleteTrashNote(id);
      setToast({ tone: "success", message: "Trash note deleted." });
    } catch (error) {
      setTrashNotes(previousTrashNotes);
      setRemovingTrashIds((current) => removeSetValue(current, id));
      if (error instanceof ApiRequestError && error.code === "not_authenticated") {
        clearSignedInState();
        return;
      }

      setToast({ tone: "error", message: "Failed to delete from trash. Try deleting it again." });
    } finally {
      setIsBusy(false);
    }
  }

  async function clearTrash(): Promise<void> {
    const previousTrashNotes = trashNotes;
    setTrashNotes([]);
    setIsBusy(true);
    try {
      await emptyTrash();
      setToast({ tone: "success", message: "Trash emptied." });
    } catch (error) {
      setTrashNotes(previousTrashNotes);
      if (error instanceof ApiRequestError && error.code === "not_authenticated") {
        clearSignedInState();
        return;
      }

      setToast({ tone: "error", message: "Failed to empty trash. Try emptying it again." });
    } finally {
      setIsBusy(false);
    }
  }

  async function resetLocalNotesAccess(): Promise<void> {
    setResetConfirmOpen(false);
    await run("Resetting notes access", async () => {
      await resetNotesAccess();
      clearSignedInState();
      setToast({ tone: "success", message: "This device was disconnected from the GitHub notes repository." });
    });
  }

  function updateApp(): void {
    setActionsMenuOpen(false);
    setOpenHelpId(null);
    window.dispatchEvent(new CustomEvent("pwa-apply-update"));
  }

  function runMenuAction(action: () => void): void {
    setActionsMenuOpen(false);
    setOpenHelpId(null);
    action();
  }

  function toggleHelp(helpId: string): void {
    setOpenHelpId((currentHelpId) => (currentHelpId === helpId ? null : helpId));
  }

  function clearSignedInState(): void {
    setUser({ authenticated: false });
    setNotes([]);
    setLocalNotes({});
    setTrashNotes([]);
    setActiveNote(null);
    setModalMode("read");
    setEditSessionId(null);
    setEditTitle("");
    setEditTags("");
    setEditBody("");
    setCreateTitle("");
    setCreateTags("");
    setCreateBody("");
    setTagFilter("");
    setTextFilter("");
    setViewMode("notes");
  }

  async function run(label: string, action: () => Promise<void>): Promise<void> {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "not_authenticated") {
        clearSignedInState();
        return;
      }

      setToast(toastFromError(error, `${label} failed.`));
    } finally {
      setIsBusy(false);
    }
  }

  if (!user.authenticated) {
    return (
      <main className="authScreen">
        <section className="authPanel">
          <AppBrand />
          {toast !== null && <p className={`authMessage toast-${toast.tone}`}>{toast.message}</p>}
          <a className="button buttonPrimary" href="/auth/github">
            Sign in with GitHub
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell" onClick={hideToastFromButtonClick}>
      <header className="topBar">
        <div>
          <AppBrand />
          <p>{repositoryLabel}</p>
        </div>
        <div className="topActions">
          {viewMode === "trash" ? (
            <button
              type="button"
              className="iconButton"
              onClick={() => setViewMode("notes")}
              aria-label="Back to notes"
            >
              <CornerUpLeft aria-hidden="true" size={22} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className="iconButton"
                onClick={() => setModalMode("create")}
                aria-label="Create a new note"
              >
                <Plus aria-hidden="true" size={22} />
              </button>
              <div className="actionsMenu" ref={actionsMenuRef}>
                <button
                  type="button"
                  className="iconButton"
                  onClick={() => setActionsMenuOpen((isOpen) => !isOpen)}
                  aria-expanded={actionsMenuOpen}
                  aria-label="Open more actions"
                >
                  <Menu aria-hidden="true" size={22} />
                </button>
                {actionsMenuOpen && (
                  <div className="actionsMenuPanel">
                    {pwaUpdateReady && (
                      <HelpAction
                        type="button"
                        actionClassName="menuAction buttonWarning"
                        onClick={updateApp}
                        help="A new app version is ready. Click to update now, or close all app tabs and reopen later."
                        helpId="update-app"
                        openHelpId={openHelpId}
                        onToggleHelp={toggleHelp}
                      >
                        <RotateCcw aria-hidden="true" size={18} />
                        <span>Update app</span>
                      </HelpAction>
                    )}
                    <HelpAction
                      type="button"
                      actionClassName="menuAction"
                      onClick={() => runMenuAction(() => void refreshNotes())}
                      disabled={isBusy}
                      help="Reload notes from GitHub to get the latest changes."
                      helpId="reload-notes"
                      openHelpId={openHelpId}
                      onToggleHelp={toggleHelp}
                    >
                      <RefreshCw aria-hidden="true" size={18} />
                      <span>Reload</span>
                    </HelpAction>
                    <HelpAction
                      type="button"
                      actionClassName="menuAction buttonDanger"
                      onClick={() => runMenuAction(() => setResetConfirmOpen(true))}
                      disabled={isBusy}
                      help="Disconnect this device from the GitHub notes repository. You can sign in again later."
                      helpId="reset-access"
                      openHelpId={openHelpId}
                      onToggleHelp={toggleHelp}
                    >
                      <Unplug aria-hidden="true" size={18} />
                      <span>Reset Access</span>
                    </HelpAction>
                    <button type="button" className="menuAction" onClick={() => runMenuAction(() => void openTrash())} disabled={isBusy}>
                      <Trash2 aria-hidden="true" size={18} />
                      <span>Trash</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {toast !== null && (
        <div className={`toast toast-${toast.tone} ${isToastLeaving ? "toastLeaving" : ""}`}>
          <span>{toast.message}</span>
          <button type="button" className="iconButton buttonSubtle" onClick={() => setToast(null)} aria-label="Close message">
            <X aria-hidden="true" size={20} />
          </button>
        </div>
      )}

      {resetConfirmOpen && (
        <div className="modalBackdrop">
          <section className="confirmModal">
            <div className="modalHeader">
              <h2>Disconnect notes repository?</h2>
              <button type="button" className="iconButton buttonSubtle" onClick={() => setResetConfirmOpen(false)} aria-label="Close">
                <X aria-hidden="true" size={22} />
              </button>
            </div>
            <p>
              This disconnects this device from the GitHub notes repository. It does not change permissions in GitHub, and you can sign in again later.
            </p>
            <div className="modalActions">
              <button type="button" className="button" onClick={() => setResetConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="button buttonDanger" onClick={() => void resetLocalNotesAccess()} disabled={isBusy}>
                Disconnect
              </button>
            </div>
          </section>
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

          <section className="cardGroups" aria-label="Notes">
            {attentionNotes.length > 0 && <div className="cardGrid">{attentionNotes.map((note) => renderNoteCard(note))}</div>}
            {pinnedNotes.length > 0 && <div className="cardGrid">{pinnedNotes.map((note) => renderNoteCard(note))}</div>}
            {normalNotes.length > 0 && <div className="cardGrid">{normalNotes.map((note) => renderNoteCard(note))}</div>}
          </section>
        </>
      )}

      {viewMode === "trash" && (
        <section className="trashView">
          <div className="sectionHeader">
            <h2>Trash</h2>
            <div>
              <button type="button" className="button buttonDanger" onClick={() => void clearTrash()} disabled={trashNotes.length === 0}>
                Empty Trash
              </button>
            </div>
          </div>
          <div className="cardGrid">
            {trashNotes.map((note) => (
              <article key={note.id} className={`noteCard trashCard ${removingTrashIds.has(note.id) ? "noteRemoving" : ""}`}>
                <div className="trashCardBody">
                  <h2>{note.title}</h2>
                  <time>{formatDate(note.updated)}</time>
                  {note.excerpt.length > 0 ? (
                    <div className="cardMarkdownBody" dangerouslySetInnerHTML={{ __html: renderMarkdown(note.excerpt) }} />
                  ) : (
                    <p>No content</p>
                  )}
                </div>
                <button type="button" className="button buttonDanger" onClick={() => void deleteTrash(note.id)}>
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
          editTitle={editTitle}
          editTags={editTags}
          editBody={editBody}
          onEditTitleChange={setEditTitle}
          onEditTagsChange={setEditTags}
          onEditBodyChange={setEditBody}
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
              <button type="button" className="iconButton buttonSubtle" onClick={() => setModalMode("read")} aria-label="Close">
                <X aria-hidden="true" size={22} />
              </button>
            </div>
            <label>
              Title
              <input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />
              {!canCreateNote && <span className="fieldHint">Add a title to enable Create.</span>}
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
              <button type="button" className="iconButton buttonPrimary" onClick={() => void submitCreate()} disabled={!canCreateNote || isBusy} aria-label="Create note">
                <Check aria-hidden="true" size={20} />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );

  function hideToastFromButtonClick(event: MouseEvent<HTMLElement>): void {
    if (
      toast !== null &&
      shouldAutoDismissToast(toast) &&
      event.target instanceof Element &&
      event.target.closest("button,[role='button']") !== null
    ) {
      dismissTemporaryToast();
    }
  }

  function dismissTemporaryToast(): void {
    setIsToastLeaving(true);
    window.setTimeout(() => {
      setToast(null);
    }, toastFadeOutMs);
  }

  function openLocalEditor(note: Note): void {
    setActiveNote(note);
    setEditTitle(note.title);
    setEditTags(note.tags.join(", "));
    setEditBody(note.body);
    setEditSessionId(null);
    setModalMode("edit");
  }

  function upsertNoteSummary(note: NoteSummary): void {
    setNotes((currentNotes) => sortClientNotes([...currentNotes.filter((currentNote) => currentNote.id !== note.id), note]));
  }

  function renderNoteCard(note: NoteSummary): ReactNode {
    return (
      <article
        key={note.id}
        className={`noteCard ${note.pinned ? "notePinned" : ""} ${note.conflict ? "noteConflict" : ""} ${note.saveFailed ? "noteSaveFailed" : ""} ${note.deleteFailed ? "noteSaveFailed" : ""} ${removingNoteIds.has(note.id) ? "noteRemoving" : ""}`}
      >
        <button type="button" className="cardBodyButton" onClick={() => void openNote(note.id)}>
          <div className="cardHeader">
            <h2>{note.title}</h2>
            <time>{formatDate(note.updated)}</time>
          </div>
          {note.saveFailed && <p className="statusBadge">Save failed</p>}
          {note.deleteFailed && <p className="statusBadge">Delete failed</p>}
          {note.conflict && <p className="statusBadge">Conflict</p>}
          {note.excerpt.length > 0 ? (
            <div className="cardMarkdownBody" dangerouslySetInnerHTML={{ __html: renderMarkdown(note.excerpt) }} />
          ) : (
            <p>No content</p>
          )}
          <div className="tagRow">
            {note.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </button>
        <div className="cardActions">
          <button type="button" className="iconButton pinButton" onClick={() => void togglePin(note)} aria-label={note.pinned ? "Unpin note" : "Pin note"}>
            {note.pinned ? <PinOff aria-hidden="true" size={18} /> : <Pin aria-hidden="true" size={18} />}
          </button>
          <button type="button" className="iconButton" onClick={() => void beginEditById(note.id)} aria-label="Edit note">
            <Edit3 aria-hidden="true" size={18} />
          </button>
          <button type="button" className="iconButton buttonDanger cardTrashButton" onClick={() => void trashNote(note.id, localNotes[note.id])} aria-label="Move note to trash">
            <Trash2 aria-hidden="true" size={18} />
          </button>
        </div>
      </article>
    );
  }
}

function NoteModal(props: {
  readonly mode: ModalMode;
  readonly note: Note;
  readonly editTitle: string;
  readonly editTags: string;
  readonly editBody: string;
  readonly onEditTitleChange: (value: string) => void;
  readonly onEditTagsChange: (value: string) => void;
  readonly onEditBodyChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onEdit: () => void;
  readonly onSave: () => void;
  readonly onTrash: () => void;
}) {
  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>): void {
    if (props.mode === "read" && event.target === event.currentTarget) {
      props.onClose();
    }
  }

  return (
    <div className="modalBackdrop" onClick={closeFromBackdrop}>
      <section
        className={`noteModal ${props.note.conflict ? "modalConflict" : ""} ${props.note.saveFailed || props.note.deleteFailed ? "modalSaveFailed" : ""}`}
      >
        <div className="modalHeader">
          <div className="modalTitleBlock">
            {props.mode === "edit" ? <h2>Edit note</h2> : <h2>{props.note.title}</h2>}
            {props.mode === "read" && props.note.tags.length > 0 && (
              <div className="modalTagRow">
                {props.note.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="iconButton buttonSubtle" onClick={props.onClose} aria-label="Close">
            <X aria-hidden="true" size={22} />
          </button>
        </div>

        {props.mode === "edit" ? (
          <>
            <label>
              Title
              <input value={props.editTitle} onChange={(event) => props.onEditTitleChange(event.target.value)} />
            </label>
            <label>
              Tags
              <input value={props.editTags} onChange={(event) => props.onEditTagsChange(event.target.value)} placeholder="tag1, tag2" />
            </label>
            <label>
              Markdown
              <textarea className="markdownEditor" value={props.editBody} onChange={(event) => props.onEditBodyChange(event.target.value)} />
            </label>
          </>
        ) : (
          <div className="markdownBody" dangerouslySetInnerHTML={{ __html: renderMarkdown(props.note.body) }} />
        )}

        <div className="modalActions">
          {props.mode === "edit" ? (
            <button type="button" className="iconButton buttonPrimary" onClick={props.onSave} aria-label="Save note">
              <Check aria-hidden="true" size={20} />
            </button>
          ) : (
            <button type="button" className="iconButton" onClick={props.onEdit} aria-label="Edit note">
              <Edit3 aria-hidden="true" size={20} />
            </button>
          )}
          <button type="button" className="iconButton buttonDanger" onClick={props.onTrash} aria-label="Move note to trash">
            <Trash2 aria-hidden="true" size={20} />
          </button>
        </div>
      </section>
    </div>
  );
}

function AppBrand() {
  return (
    <div className="appBrand">
      <img src="/android-chrome-192x192.png" alt="" aria-hidden="true" />
      <h1>El Notas</h1>
    </div>
  );
}

function HelpAction({ help, helpId, actionClassName, children, openHelpId, onToggleHelp, ...props }: HelpActionProps & {
  readonly openHelpId: string | null;
  readonly onToggleHelp: (helpId: string) => void;
}) {
  const isHelpOpen = openHelpId === helpId;
  function toggleFromKeyboard(event: KeyboardEvent<HTMLSpanElement>): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onToggleHelp(helpId);
  }

  return (
    <div className="helpAction">
      <button {...props} className={actionClassName}>
        {children}
      </button>
      <span
        role="button"
        tabIndex={0}
        className="helpIconControl"
        onClick={() => onToggleHelp(helpId)}
        onKeyDown={toggleFromKeyboard}
        aria-expanded={isHelpOpen}
        aria-label="Show help"
      >
        <Info aria-hidden="true" size={20} strokeWidth={2.4} />
      </span>
      {isHelpOpen && (
        <div className="helpPopover" role="status">
          {help}
        </div>
      )}
    </div>
  );
}

function createLocalNote(input: { readonly title: string; readonly body: string; readonly tags: readonly string[] }): Note {
  const now = new Date().toISOString();
  const fileName = createNoteFileName(input.title, new Date(now));
  const id = fileName.replace(/\.md$/i, "");
  return buildLocalNote({
    id,
    fileName,
    path: `notes/${fileName}`,
    title: input.title,
    date: now,
    updated: now,
    tags: input.tags,
    pinned: false,
    conflict: false,
    saveFailed: false,
    deleteFailed: false,
    body: input.body,
    markdown: ""
  });
}

function buildLocalNote(note: LocalNoteInput): Note {
  const markdown = buildNoteMarkdown(note);
  return {
    ...note,
    excerpt: note.body.trim().slice(0, 220),
    searchableText: `${note.title}\n${note.tags.join(" ")}\n${note.body}`,
    markdown
  };
}

function noteToSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    date: note.date,
    updated: note.updated,
    tags: note.tags,
    pinned: note.pinned,
    conflict: note.conflict,
    saveFailed: note.saveFailed,
    deleteFailed: note.deleteFailed,
    excerpt: note.body.trim().slice(0, 220),
    searchableText: `${note.title}\n${note.tags.join(" ")}\n${note.body}`
  };
}

function removeLocalNote(notes: Readonly<Record<string, Note>>, id: string): Readonly<Record<string, Note>> {
  const { [id]: _removed, ...remainingNotes } = notes;
  return remainingNotes;
}

function removeSetValue<T>(values: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const nextValues = new Set(values);
  nextValues.delete(value);
  return nextValues;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function createNoteFileName(title: string, date: Date): string {
  return `${timestampSlug(date)}-${slugify(title)}-${Math.random().toString(36).slice(2, 8)}.md`;
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "note";
}

function timestampSlug(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "-");
}

function hasAttentionStatus(note: Pick<NoteSummary, "saveFailed" | "deleteFailed" | "conflict">): boolean {
  return note.saveFailed || note.deleteFailed || note.conflict;
}

function parseTags(value: string): readonly string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function buildNoteMarkdown(note: Pick<Note, "title" | "date" | "updated" | "tags" | "pinned" | "conflict" | "saveFailed" | "deleteFailed" | "body">): string {
  const metadata = [
    `title: ${JSON.stringify(note.title)}`,
    `date: ${note.date}`,
    `updated: ${note.updated}`,
    `tags: [${note.tags.map((tag) => JSON.stringify(tag)).join(", ")}]`,
    note.pinned ? "pinned: true" : null,
    note.conflict ? "conflict: true" : null,
    note.saveFailed ? "save_failed: true" : null,
    note.deleteFailed ? "delete_failed: true" : null
  ].filter((line): line is string => line !== null);

  return `---\n${metadata.join("\n")}\n---\n\n${note.body.trimStart()}`.trimEnd() + "\n";
}

function sortClientNotes(notes: readonly NoteSummary[]): readonly NoteSummary[] {
  return [...notes].sort((left, right) => {
    const leftFailed = hasAttentionStatus(left);
    const rightFailed = hasAttentionStatus(right);
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

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
        hour12: false,
        hourCycle: "h23"
      });
}
