// Phone app plumbing: offline service worker, install prompt, and the "timer running" notification.
import { useSyncExternalStore } from "react";
import { fmtTime } from "./time";

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
  // Ask the browser not to clear our data when the phone runs low on space.
  navigator.storage?.persist?.().catch(() => {});
}

// --- Install prompt (Android Chrome fires beforeinstallprompt) ---
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let installEvent: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e as InstallEvent;
  emit();
});
window.addEventListener("appinstalled", () => {
  installEvent = null;
  emit();
});

export const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches;

export function useInstallPrompt() {
  const available = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => installEvent !== null
  );
  return {
    available,
    install: async () => {
      if (!installEvent) return;
      await installEvent.prompt();
      await installEvent.userChoice;
      installEvent = null;
      emit();
    },
  };
}

// --- Notifications ---
export const notificationsSupported = () => "Notification" in window && "serviceWorker" in navigator;

export async function askNotificationPermission() {
  if (!notificationsSupported()) return false;
  return (await Notification.requestPermission()) === "granted";
}

const TAG = "running-timer";

export async function showRunningNotification(projectName: string, start: number) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(`⏱ ${projectName}`, {
    body: `Tracking since ${fmtTime(start)}. Tap Stop when you're done.`,
    tag: TAG,
    silent: true,
    requireInteraction: true,
    icon: "./icon-192.png",
    badge: "./badge-96.png",
    // `actions` and `timestamp` are supported on Android Chrome but missing from TS's lib types.
    ...({ timestamp: start, actions: [{ action: "stop", title: "⏹ Stop timer" }] } as object),
  });
}

export async function clearRunningNotification() {
  if (!notificationsSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const list = (await reg?.getNotifications({ tag: TAG })) ?? [];
  list.forEach((n) => n.close());
}
