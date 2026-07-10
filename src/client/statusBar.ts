import { ApiRequestError } from "./api";

export type StatusBarTone = "info" | "error" | "success" | "busy";

export interface StatusBar {
  readonly tone: StatusBarTone;
  readonly message: string;
  readonly autoHideMs: number | null;
  readonly showSpinner: boolean;
  readonly showClose: boolean;
}

export const defaultStatusBarAutoHideMs = 5000;
export const defaultStatusBarErrorMessage = "Something went wrong. Reload the page. If it happens again, check the app logs.";

export function statusBarErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof ApiRequestError) {
    return apiErrorMessage(error);
  }

  return defaultMessage.trim().length > 0 ? defaultMessage : defaultStatusBarErrorMessage;
}

function apiErrorMessage(error: ApiRequestError): string {
  if (error.code === "internal_server_error") {
    return defaultStatusBarErrorMessage;
  }

  if (error.code === "github_temporary_error") {
    return "GitHub had a temporary problem while accessing the notes repository. Try Reload in a moment.";
  }

  if (error.code === "not_authenticated") {
    return "Your session expired. Sign in with GitHub again.";
  }

  if (error.code === "note_not_found" || error.code === "github_file_not_found" || error.code === "trash_note_not_found") {
    return messageWithAction(error.message, "Reload notes from GitHub and try again.");
  }

  if (error.code === "invalid_edit_session") {
    return messageWithAction(error.message, "Close the note, reopen it, and save again.");
  }

  if (error.code === "invalid_request" || error.code === "invalid_path") {
    return messageWithAction(error.message, "Check the input and try again.");
  }

  if (error.message.trim().length > 0) {
    return hasRecommendedAction(error.message) ? error.message : `${error.message} Try again.`;
  }

  return defaultStatusBarErrorMessage;
}

function messageWithAction(message: string, action: string): string {
  return hasRecommendedAction(message) ? message : `${message} ${action}`;
}

function hasRecommendedAction(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return [
    "try ",
    "reload",
    "sign in",
    "check ",
    "confirm ",
    "install ",
    "update ",
    "fix ",
    "close ",
    "reopen",
    "review "
  ].some((action) => normalizedMessage.includes(action));
}
