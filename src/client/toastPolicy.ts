export interface Toast {
  readonly tone: "info" | "error" | "success";
  readonly message: string;
}

export function shouldAutoDismissToast(toast: Toast): boolean {
  return toast.tone !== "error";
}

export function toastFromError(error: unknown, fallbackMessage: string): Toast {
  return {
    tone: "error",
    message: error instanceof Error ? error.message : fallbackMessage
  };
}
