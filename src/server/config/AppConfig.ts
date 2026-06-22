export interface AppConfig {
  readonly github: GitHubRepositoryConfig;
  readonly notesFolder: string;
  readonly trashFolder: string;
  readonly trashSizeLimit: number;
  readonly localWorkingCopyFolder: string;
  readonly allowedGitHubUsernames: readonly string[];
}

export interface GitHubRepositoryConfig {
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
}
