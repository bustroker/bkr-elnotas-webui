export interface SyncMetadata {
  readonly files: Record<string, SyncMetadataFile>;
}

export interface SyncMetadataFile {
  readonly sha: string;
  readonly path: string;
}

export function emptySyncMetadata(): SyncMetadata {
  return { files: {} };
}
