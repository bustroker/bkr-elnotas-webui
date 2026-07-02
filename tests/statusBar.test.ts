import { describe, expect, it } from "vitest";
import { defaultStatusBarAutoHideMs, statusBarErrorMessage } from "../src/client/statusBar";

describe("statusBar", () => {
  it("defines the default auto-hide duration", () => {
    expect(defaultStatusBarAutoHideMs).toBe(5000);
  });

  it("preserves messages from thrown errors", () => {
    expect(statusBarErrorMessage(new Error("GitHub App is not installed."), "Fallback")).toBe("GitHub App is not installed.");
  });

  it("uses the default message for non-error values", () => {
    expect(statusBarErrorMessage("unexpected", "Saving failed.")).toBe("Saving failed.");
  });
});
