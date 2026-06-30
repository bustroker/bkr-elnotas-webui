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
const toastAutoDismissMs = 5000;
const toastFadeOutMs = 250;

interface HelpActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly help: string;
  readonly helpId: string;
  readonly actionClassName?: string;
  readonly children: ReactNode;
}

export function App() {
  const [user, setUser] = useState<UserState>({ authenticated: false });
  const [notes, setNotes] = useState<readonly NoteSummary[]>([]);
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
  const [isBusy, setIsBusy] = useState(false);
  const [pwaUpdateReady, setPwaUpdateReady] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [openHelpId, setOpenHelpId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

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
  const attentionNotes = useMemo(() => filteredNotes.filter((note) => note.saveFailed || note.conflict), [filteredNotes]);
  const pinnedNotes = useMemo(() => filteredNotes.filter((note) => note.pinned && !note.saveFailed && !note.conflict), [filteredNotes]);
  const normalNotes = useMemo(() => filteredNotes.filter((note) => !note.pinned && !note.saveFailed && !note.conflict), [filteredNotes]);
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
      setEditTitle(response.note.title);
      setEditTags(response.note.tags.join(", "));
      setEditBody(response.note.body);
      setEditSessionId(response.editSessionId);
      setModalMode("edit");
    });
  }

  async function beginEditById(id: string): Promise<void> {
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
    if (activeNote === null || editSessionId === null) {
      return;
    }

    await run("Saving note", async () => {
      const result = await updateNote(activeNote.id, {
        markdown: buildNoteMarkdown({
          ...activeNote,
          title: editTitle,
          tags: parseTags(editTags),
          body: editBody
        }),
        editSessionId
      });
      setNotes(await listNotes());
      setActiveNote(null);
      setModalMode("read");
      setEditSessionId(null);
      if (result.saveFailed === true) {
        setToast({ tone: "error", message: "Failed to save to GitHub. Open the note and save it again." });
      } else if (result.conflict !== undefined) {
        setToast({ tone: "error", message: `${result.conflict.message} Review both notes, consolidate them into one, and remove the duplicate.` });
      } else {
        setToast(null);
      }
    });
  }

  async function submitCreate(): Promise<void> {
    setIsBusy(true);
    try {
      const result = await createNote({
        title: createTitle,
        body: createBody,
        tags: parseTags(createTags)
      });
      setNotes(await listNotes());
      setActiveNote(null);
      setModalMode("read");
      setCreateTitle("");
      setCreateTags("");
      setCreateBody("");
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

      setToast(toastFromError(error, "Creating note failed."));
    } finally {
      setIsBusy(false);
    }
  }

  async function togglePin(note: NoteSummary): Promise<void> {
    const pinned = !note.pinned;
    const optimisticUpdated = new Date().toISOString();
    const previousNotes = notes;
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

    await trashNote(activeNote.id);
    setActiveNote(null);
  }

  async function trashNote(id: string): Promise<void> {
    await run("Sending note to trash", async () => {
      await sendNoteToTrash(id);
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
          <h1>El Notas</h1>
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
          <h1>El Notas</h1>
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
              <article key={note.id} className="noteCard trashCard">
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

  function renderNoteCard(note: NoteSummary): ReactNode {
    return (
      <article
        key={note.id}
        className={`noteCard ${note.pinned ? "notePinned" : ""} ${note.conflict ? "noteConflict" : ""} ${note.saveFailed ? "noteSaveFailed" : ""}`}
      >
        <button type="button" className="cardBodyButton" onClick={() => void openNote(note.id)}>
          <div className="cardHeader">
            <h2>{note.title}</h2>
            <time>{formatDate(note.updated)}</time>
          </div>
          {note.saveFailed && <p className="statusBadge">Save failed</p>}
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
          <button type="button" className="iconButton buttonDanger cardTrashButton" onClick={() => void trashNote(note.id)} aria-label="Move note to trash">
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
      <section className={`noteModal ${props.note.conflict ? "modalConflict" : ""} ${props.note.saveFailed ? "modalSaveFailed" : ""}`}>
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

function parseTags(value: string): readonly string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function buildNoteMarkdown(note: Pick<Note, "title" | "date" | "updated" | "tags" | "pinned" | "conflict" | "body">): string {
  const metadata = [
    `title: ${JSON.stringify(note.title)}`,
    `date: ${note.date}`,
    `updated: ${note.updated}`,
    `tags: [${note.tags.map((tag) => JSON.stringify(tag)).join(", ")}]`,
    note.pinned ? "pinned: true" : null,
    note.conflict ? "conflict: true" : null
  ].filter((line): line is string => line !== null);

  return `---\n${metadata.join("\n")}\n---\n\n${note.body.trimStart()}`.trimEnd() + "\n";
}

function sortClientNotes(notes: readonly NoteSummary[]): readonly NoteSummary[] {
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
