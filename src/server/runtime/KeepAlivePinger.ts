import type { KeepAliveConfig } from "../config/AppConfig.js";

export interface KeepAliveLogger {
  warn(input: { readonly err: unknown; readonly url: string }, message: string): void;
}

export interface KeepAliveTimers {
  setInterval(callback: () => void, delayMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface KeepAlivePingerInput {
  readonly config: KeepAliveConfig;
  readonly fetch: (url: string) => Promise<unknown>;
  readonly logger: KeepAliveLogger;
  readonly timers?: KeepAliveTimers;
}

export class KeepAlivePinger {
  private readonly config: KeepAliveConfig;
  private readonly fetch: (url: string) => Promise<unknown>;
  private readonly logger: KeepAliveLogger;
  private readonly timers: KeepAliveTimers;
  private intervalHandle: unknown = null;

  public constructor(input: KeepAlivePingerInput) {
    this.config = input.config;
    this.fetch = input.fetch;
    this.logger = input.logger;
    this.timers = input.timers ?? {
      setInterval,
      clearInterval
    };
  }

  public start(): void {
    if (!this.config.enabled || this.intervalHandle !== null) {
      return;
    }

    this.intervalHandle = this.timers.setInterval(() => {
      void this.ping();
    }, this.config.intervalMinutes * 60_000);
  }

  public stop(): void {
    if (this.intervalHandle === null) {
      return;
    }

    this.timers.clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  public async ping(): Promise<void> {
    try {
      await this.fetch(this.config.url);
    } catch (error) {
      this.logger.warn({ err: error, url: this.config.url }, "Keep-alive request failed.");
    }
  }
}
