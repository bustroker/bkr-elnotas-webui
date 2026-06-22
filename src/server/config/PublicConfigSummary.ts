import type { AppConfig } from "./AppConfig.js";

export interface PublicConfigSummary {
  readonly repository: string;
  readonly branch: string;
  readonly notesFolder: string;
  readonly trashFolder: string;
  readonly trashSizeLimit: number;
}

export function toPublicConfigSummary(config: AppConfig): PublicConfigSummary {
  return {
    repository: `${config.github.owner}/${config.github.repo}`,
    branch: config.github.branch,
    notesFolder: config.notesFolder,
    trashFolder: config.trashFolder,
    trashSizeLimit: config.trashSizeLimit
  };
}
