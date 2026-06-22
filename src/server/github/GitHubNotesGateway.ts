export interface RemoteMarkdownFile {
  readonly path: string;
  readonly sha: string;
  readonly content: string;
}

export type GitHubFileChange =
  | {
      readonly type: "write";
      readonly path: string;
      readonly content: string;
    }
  | {
      readonly type: "delete";
      readonly path: string;
    };

export interface GitHubNotesGateway {
  listMarkdownFiles(folder: string): Promise<readonly RemoteMarkdownFile[]>;
  readMarkdownFile(path: string): Promise<RemoteMarkdownFile>;
  commitChanges(message: string, changes: readonly GitHubFileChange[]): Promise<void>;
}
