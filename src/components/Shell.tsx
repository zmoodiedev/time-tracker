import { CalendarDays, CalendarRange, Settings, Timer } from "lucide-react";
import { running, useStore } from "@/lib/store";
import type { View } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "track", label: "Track", icon: Timer },
  { id: "day", label: "Day", icon: CalendarDays },
  { id: "week", label: "Week", icon: CalendarRange },
  { id: "settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const isRunning = useStore((s) => !!running(s));
  return (
    <nav className="pb-safe shrink-0 border-t bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-xl">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn("relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", view === id ? "text-primary" : "text-muted-foreground")}
          >
            <span className={cn("grid h-7 w-14 place-items-center rounded-full transition-colors", view === id && "bg-primary/15")}>
              <Icon className="size-5" />
            </span>
            {label}
            {id === "track" && isRunning && view !== "track" && <span className="animate-breathe absolute top-2 right-[calc(50%-22px)] size-2 rounded-full bg-win" />}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-[100] mx-auto flex max-w-xl flex-col gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex animate-in items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl duration-300 fade-in slide-in-from-top-4",
            t.kind === "win" && "border-win/40 bg-[#17261e] text-win",
            t.kind === "info" && "bg-popover",
            t.kind === "error" && "border-destructive/50 bg-[#2a1416] text-destructive"
          )}
        >
          <button type="button" className="flex-1 text-left" onClick={() => dismissToast(t.id)}>
            {t.text}
          </button>
          {t.action && (
            <button
              type="button"
              className="rounded-lg bg-primary/15 px-3 py-1.5 font-semibold text-primary"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Page wrapper: sticky title row + scrolling content. */
export function Page({ title, right, children }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-24">
      <header className="pt-safe sticky top-0 z-10 -mx-4 mb-3 flex min-h-14 items-center gap-2 bg-background/90 px-4 pb-2 backdrop-blur">
        <div className="min-w-0 flex-1">{title}</div>
        {right}
      </header>
      {children}
    </div>
  );
}
