export interface AppConfig {
  /** GitHub repository that stores the markdown note files. */
  readonly notesGitHubRepository: NotesGitHubRepositoryConfig;

  /** Root-level folder in the notes repository that contains active note markdown files. */
  readonly notesFolder: string;

  /** Root-level folder in the notes repository that contains trashed note markdown files. */
  readonly trashFolder: string;

  /** Maximum number of markdown files kept in trash before the oldest one is permanently deleted. */
  readonly trashSizeLimit: number;

  /** Local filesystem folder where the backend keeps its working copy of active notes. */
  readonly localWorkingCopyFolder: string;

  /** GitHub usernames allowed to log into and use this web app. */
  readonly allowedGitHubUsernames: readonly string[];
}

export interface NotesGitHubRepositoryConfig {
  /** GitHub account or organization that owns the notes repository. This is not the login whitelist. */
  readonly account: string;

  /** Repository name that contains the configured notes and trash folders. */
  readonly repo: string;

  /** Git branch used for all note read/write operations. */
  readonly branch: string;
}
