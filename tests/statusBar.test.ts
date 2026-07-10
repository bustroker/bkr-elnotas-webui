import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../src/client/api";
import { defaultStatusBarAutoHideMs, defaultStatusBarErrorMessage, statusBarErrorMessage } from "../src/client/statusBar";

describe("statusBar", () => {
  it("defines the default auto-hide duration", () => {
    expect(defaultStatusBarAutoHideMs).toBe(5000);
  });

  it("uses actionable fallback messages for local errors", () => {
    expect(statusBarErrorMessage(new Error("Failed to fetch"), "Reload the page and try again.")).toBe("Reload the page and try again.");
  });

  it("uses the default actionable message when no fallback is provided", () => {
    expect(statusBarErrorMessage(new Error("Failed to fetch"), "")).toBe(defaultStatusBarErrorMessage);
  });

  it("preserves structured API messages", () => {
    const error = new ApiRequestError({
      code: "github_app_not_installed",
      message: "Install or update the GitHub App on the notes repository, then Reload notes.",
      status: 403
    });

    expect(statusBarErrorMessage(error, "Fallback")).toBe("Install or update the GitHub App on the notes repository, then Reload notes.");
  });

  it("maps temporary GitHub API failures to a reload action", () => {
    const error = new ApiRequestError({
      code: "github_temporary_error",
      message: "GitHub had a temporary problem.",
      status: 502
    });

    expect(statusBarErrorMessage(error, "Fallback")).toBe(
      "GitHub had a temporary problem while accessing the notes repository. Try Reload in a moment."
    );
  });

  it("uses the default message for non-error values", () => {
    expect(statusBarErrorMessage("unexpected", "Saving failed. Open the note and save it again.")).toBe(
      "Saving failed. Open the note and save it again."
    );
  });
});
