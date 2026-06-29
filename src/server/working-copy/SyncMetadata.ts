export interface SyncMetadata {
  readonly files: Record<string, SyncMetadataFile>;
}

export interface SyncMetadataFile {
  readonly sha: string | null;
  readonly path: string;
}

export function emptySyncMetadata(): SyncMetadata {
  return { files: {} };
}
