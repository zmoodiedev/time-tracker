import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { projectById, useStore } from "@/lib/store";
import type { Entry } from "@/lib/types";
import { useNow } from "@/lib/hooks";
import { MIN, addDays, dayKey, fmtDate, fmtDecimal, fmtDuration, fmtHM, fmtTime, fromDayKey, roundMin } from "@/lib/time";
import { dayRange, entriesIn, entryEnd, gapsIn, projectTotals, type Gap } from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { Dot, SectionTitle } from "@/components/common";
import { EntryDialog, type EntryDraft } from "@/components/Dialogs";
import { Page } from "@/components/Shell";

export function DayView() {
  const now = useNow(15000);
  const s = useStore();
  const { entries, settings, dayCursor, setDayCursor } = s;
  const [draft, setDraft] = useState<EntryDraft | null>(null);

  const day = fromDayKey(dayCursor);
  const { from, to } = dayRange(day);
  const isToday = dayCursor === dayKey(now);
  const list = entriesIn(entries, from, to, now);
  const gaps = gapsIn(list, from, to, now);
  const totals = projectTotals(entries, from, to, now);
  const rows = s.projects.filter((p) => totals.has(p.id)).map((p) => ({ p, min: totals.get(p.id)! / MIN }));
  const totalMin = rows.reduce((n, r) => n + r.min, 0);
  const roundedTotal = rows.reduce((n, r) => n + roundMin(r.min, settings.roundingMin), 0);

  // Interleave entries and the gaps between them, in time order.
  const timeline: ({ kind: "entry"; e: Entry; at: number } | { kind: "gap"; g: Gap; at: number })[] = [
    ...list.map((e) => ({ kind: "entry" as const, e, at: Math.max(e.start, from) })),
    ...gaps.map((g) => ({ kind: "gap" as const, g, at: g.start })),
  ].sort((a, b) => a.at - b.at || (a.kind === "entry" ? 1 : -1));

  const go = (n: number) => setDayCursor(dayKey(addDays(day, n)));
  const newDraft = (): EntryDraft => {
    if (isToday) return { projectId: null, start: now - 30 * MIN, end: now };
    const nine = new Date(day);
    nine.setHours(9, 0, 0, 0);
    return { projectId: null, start: nine.getTime(), end: nine.getTime() + 30 * MIN };
  };

  return (
    <Page
      title={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => go(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-lg font-bold">{isToday ? "Today" : fmtDate(day, { weekday: "long" })}</div>
            <div className="text-xs text-muted-foreground">{fmtDate(day, { month: "long", day: "numeric", year: "numeric" })}</div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => go(1)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      }
      right={
        !isToday && (
          <Button variant="secondary" size="sm" onClick={() => setDayCursor(dayKey())}>
            Today
          </Button>
        )
      }
    >
      {/* Timesheet numbers for the day */}
      <div className="mb-5 rounded-2xl border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">{fmtDuration(totalMin, settings.hourFormat)}</span>
          {settings.roundingMin > 0 && rows.length > 0 && <span className="text-sm text-muted-foreground">Timesheet: <b className="text-foreground">{fmtDecimal(roundedTotal)}h</b></span>}
        </div>
        {rows.length > 0 && (
          <div className="mt-3 grid gap-2 border-t pt-3">
            <div className="flex text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <span className="flex-1">Project</span>
              <span className="w-16 text-right">Tracked</span>
              <span className="w-16 text-right">Sheet</span>
            </div>
            {rows.map(({ p, min }) => (
              <div key={p.id} className="flex items-center text-sm">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Dot color={p.color} />
                  <span className="truncate">{p.name}</span>
                  {p.code && <span className="shrink-0 text-xs text-muted-foreground">{p.code}</span>}
                </span>
                <span className="w-16 text-right text-muted-foreground tabular-nums">{fmtHM(min)}</span>
                <span className="w-16 text-right font-semibold tabular-nums">{fmtDecimal(roundMin(min, settings.roundingMin))}h</span>
              </div>
            ))}
            {settings.roundingMin > 0 && <p className="text-[11px] text-muted-foreground">"Sheet" is rounded to the nearest {settings.roundingMin} min per project. Change it in Settings.</p>}
          </div>
        )}
      </div>

      <SectionTitle>Timeline</SectionTitle>
      {timeline.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing tracked {isToday ? "yet today" : "on this day"}.
          <Button variant="secondary" className="mt-3 h-11 w-full" onClick={() => setDraft(newDraft())}>
            <Plus /> Add time
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          {timeline.map((item) =>
            item.kind === "gap" ? (
              <button
                key={`gap-${item.g.start}`}
                type="button"
                onClick={() => setDraft({ projectId: null, start: item.g.start, end: item.g.end })}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-energy-medium/40 px-3 text-left text-sm text-energy-medium"
              >
                <span className="flex-1">
                  Untracked {fmtTime(item.g.start)} – {fmtTime(item.g.end)}
                </span>
                <span className="tabular-nums">{fmtHM((item.g.end - item.g.start) / MIN)}</span>
                <b>Fill ›</b>
              </button>
            ) : (
              <EntryRow key={item.e.id} e={item.e} from={from} to={to} now={now} onClick={() => setDraft({ ...item.e })} />
            )
          )}
        </div>
      )}

      <Button
        size="icon-lg"
        aria-label="Add time"
        onClick={() => setDraft(newDraft())}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-20 size-14 rounded-full shadow-xl"
      >
        <Plus className="size-6" />
      </Button>

      <EntryDialog draft={draft} onClose={() => setDraft(null)} />
    </Page>
  );
}

function EntryRow({ e, from, to, now, onClick }: { e: Entry; from: number; to: number; now: number; onClick: () => void }) {
  const s = useStore();
  const p = projectById(s, e.projectId);
  const color = p?.color ?? "#94a3b8";
  const end = entryEnd(e, now);
  const min = (Math.min(end, to) - Math.max(e.start, from)) / MIN;
  return (
    <button type="button" onClick={onClick} className="relative flex min-h-16 items-center gap-3 overflow-hidden rounded-xl bg-card py-2.5 pr-3 pl-4 text-left active:scale-[0.98]">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-medium">
          <span className="truncate">{p?.name ?? "Deleted project"}</span>
          {e.end === null && <Dot color={color} className="animate-breathe" />}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {e.start < from && "(prev. day) "}
          {fmtTime(e.start)} – {e.end === null ? "now" : fmtTime(end)}
          {end > to && " (next day)"}
        </div>
        {e.note && <div className="mt-0.5 truncate text-xs text-foreground/80">{e.note}</div>}
      </div>
      <span className="font-semibold tabular-nums">{fmtHM(min)}</span>
    </button>
  );
}
