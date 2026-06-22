import { useEffect, useState } from "react";

interface HealthResponse {
  readonly status: string;
  readonly app: string;
  readonly config: {
    readonly repository: string;
    readonly branch: string;
    readonly notesFolder: string;
    readonly trashFolder: string;
    readonly trashSizeLimit: number;
  };
}

type HealthState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: HealthResponse }
  | { readonly status: "failed"; readonly message: string };

export function App() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    const abortController = new AbortController();

    fetch("/api/health", { signal: abortController.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health check failed with HTTP ${response.status}.`);
        }

        return (await response.json()) as HealthResponse;
      })
      .then((data) => setHealth({ status: "ready", data }))
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setHealth({ status: "failed", message });
      });

    return () => abortController.abort();
  }, []);

  return (
    <main className="appShell">
      <section className="topBar">
        <div>
          <h1>5l-elnotas-webui</h1>
          <p>Markdown notes from GitHub, edited through a single web app.</p>
        </div>
        <span className={health.status === "ready" ? "statusReady" : "statusPending"}>{health.status}</span>
      </section>

      <section className="panel">
        <h2>Runtime status</h2>
        {health.status === "loading" && <p>Checking backend configuration...</p>}
        {health.status === "failed" && <p className="errorText">{health.message}</p>}
        {health.status === "ready" && (
          <dl className="configGrid">
            <div>
              <dt>Repository</dt>
              <dd>{health.data.config.repository}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{health.data.config.branch}</dd>
            </div>
            <div>
              <dt>Notes folder</dt>
              <dd>{health.data.config.notesFolder}</dd>
            </div>
            <div>
              <dt>Trash folder</dt>
              <dd>{health.data.config.trashFolder}</dd>
            </div>
            <div>
              <dt>Trash limit</dt>
              <dd>{health.data.config.trashSizeLimit}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
}
