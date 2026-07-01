import { describe, expect, it, vi } from "vitest";
import { KeepAlivePinger, type KeepAliveTimers } from "../src/server/runtime/KeepAlivePinger.js";

describe("KeepAlivePinger", () => {
  it("does not schedule pings when disabled", () => {
    const fetch = vi.fn();
    const logger = { warn: vi.fn() };
    const timers = fakeTimers();
    const pinger = new KeepAlivePinger({
      config: {
        enabled: false,
        url: "",
        intervalMinutes: 5
      },
      fetch,
      logger,
      timers
    });

    pinger.start();

    expect(timers.setInterval).not.toHaveBeenCalled();
  });

  it("schedules pings when enabled", () => {
    const fetch = vi.fn().mockResolvedValue(undefined);
    const logger = { warn: vi.fn() };
    const timers = fakeTimers();
    const pinger = new KeepAlivePinger({
      config: {
        enabled: true,
        url: "https://example.com/api/health",
        intervalMinutes: 5
      },
      fetch,
      logger,
      timers
    });

    pinger.start();

    expect(timers.setInterval).toHaveBeenCalledWith(expect.any(Function), 300_000);
  });

  it("logs a warning when a ping fails", async () => {
    const error = new Error("network unavailable");
    const fetch = vi.fn().mockRejectedValue(error);
    const logger = { warn: vi.fn() };
    const pinger = new KeepAlivePinger({
      config: {
        enabled: true,
        url: "https://example.com/api/health",
        intervalMinutes: 5
      },
      fetch,
      logger
    });

    await pinger.ping();

    expect(logger.warn).toHaveBeenCalledWith(
      { err: error, url: "https://example.com/api/health" },
      "Keep-alive request failed."
    );
  });
});

function fakeTimers(): KeepAliveTimers & { readonly setInterval: ReturnType<typeof vi.fn> } {
  return {
    setInterval: vi.fn(() => "interval-handle"),
    clearInterval: vi.fn()
  };
}
