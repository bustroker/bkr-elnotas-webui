import { registerSW } from "virtual:pwa-register";

export function registerPwa(onNeedRefresh: () => void): void {
  const updateSW = registerSW({
    onNeedRefresh,
    onOfflineReady() {
      // The app shell is available offline. Note mutations still require network.
    }
  });

  window.addEventListener("pwa-apply-update", () => {
    void updateSW(true);
  });
}
