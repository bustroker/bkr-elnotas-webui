import { describe, expect, it } from "vitest";
import { shouldAutoDismissToast, toastFromError } from "../src/client/toastPolicy";

describe("toastPolicy", () => {
  it("keeps error messages visible until the user closes them", () => {
    expect(shouldAutoDismissToast({ tone: "error", message: "Action required." })).toBe(false);
  });

  it("auto dismisses informational and success messages", () => {
    expect(shouldAutoDismissToast({ tone: "info", message: "Loaded." })).toBe(true);
    expect(shouldAutoDismissToast({ tone: "success", message: "Saved." })).toBe(true);
  });

  it("keeps busy messages visible while work is running", () => {
    expect(shouldAutoDismissToast({ tone: "busy", message: "Saving note..." })).toBe(false);
  });

  it("preserves error messages from thrown errors", () => {
    expect(toastFromError(new Error("GitHub App is not installed."), "Fallback")).toEqual({
      tone: "error",
      message: "GitHub App is not installed."
    });
  });

  it("uses the fallback message for non-error values", () => {
    expect(toastFromError("unexpected", "Saving failed.")).toEqual({
      tone: "error",
      message: "Saving failed."
    });
  });
});
