import { useEffect } from "react";
import { projectById, running, useStore } from "@/lib/store";
import { setFx } from "@/lib/fx";
import { useNow } from "@/lib/hooks";
import { clearRunningNotification, showRunningNotification } from "@/lib/pwa";
import { BottomNav, Toaster } from "@/components/Shell";
import { LongRunCheck } from "@/components/Dialogs";
import { TrackView } from "@/views/TrackView";
import { DayView } from "@/views/DayView";
import { WeekView } from "@/views/WeekView";
import { SettingsView } from "@/views/SettingsView";

const VIEWS = { track: TrackView, day: DayView, week: WeekView, settings: SettingsView };

export default function App() {
  const view = useStore((s) => s.view);
  const { sounds, haptics } = useStore((s) => s.settings);
  useEffect(() => setFx(sounds, haptics), [sounds, haptics]);

  useEffect(() => {
    const store = useStore.getState;

    // Links from the home-screen shortcuts and the notification's Stop button.
    const params = new URLSearchParams(location.search);
    const stopAt = params.get("stop");
    if (stopAt) {
      const at = stopAt === "now" ? Date.now() : Number(stopAt);
      if (running(store())) {
        store().stop(Number.isFinite(at) ? at : Date.now());
        store().toast("Timer stopped", "info");
      }
    }
    if (params.get("view") === "day") store().setView("day");
    if (params.size) history.replaceState(null, "", location.pathname);

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "stop" && running(store())) {
        store().stop(e.data.at);
        store().toast("Timer stopped", "info");
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    // While the app is in the background, show what's running with a Stop button.
    const onVisibility = () => {
      const s = store();
      const cur = running(s);
      if (document.hidden && cur && s.settings.notify) showRunningNotification(projectById(s, cur.projectId)?.name ?? "Timer", cur.start);
      else clearRunningNotification();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const unsub = useStore.subscribe((s, prev) => {
      if (running(prev) && !running(s)) clearRunningNotification();
    });

    // The daily goal can be reached while a timer is running.
    const goalTimer = setInterval(() => store().checkGoal(), 30000);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisibility);
      unsub();
      clearInterval(goalTimer);
    };
  }, []);

  const View = VIEWS[view];
  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <View />
      </main>
      <BottomNav />
      <Toaster />
      <LongRunWatcher />
    </div>
  );
}

function LongRunWatcher() {
  const now = useNow(30000);
  return <LongRunCheck now={now} />;
}
