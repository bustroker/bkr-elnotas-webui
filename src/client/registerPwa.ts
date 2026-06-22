import { registerSW } from "virtual:pwa-register";

export function registerPwa(onNeedRefresh: () => void): void {
  registerSW({
    onNeedRefresh,
    onOfflineReady() {
      // The app shell is available offline. Note mutations still require network.
    }
  });
}
