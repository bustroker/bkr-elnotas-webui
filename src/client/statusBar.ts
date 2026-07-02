export type StatusBarTone = "info" | "error" | "success" | "busy";

export interface StatusBar {
  readonly tone: StatusBarTone;
  readonly message: string;
  readonly autoHideMs: number | null;
  readonly showSpinner: boolean;
  readonly showClose: boolean;
}

export const defaultStatusBarAutoHideMs = 5000;

export function statusBarErrorMessage(error: unknown, defaultMessage: string): string {
  return error instanceof Error ? error.message : defaultMessage;
}
