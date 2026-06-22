export interface AppConfig {
  readonly notesGitHubRepository: NotesGitHubRepositoryConfig;
  readonly notesFolder: string;
  readonly trashFolder: string;
  readonly trashSizeLimit: number;
  readonly localWorkingCopyFolder: string;
  readonly allowedGitHubUsernames: readonly string[];
}

export interface NotesGitHubRepositoryConfig {
  readonly account: string;
  readonly repo: string;
  readonly branch: string;
}
