import { ChevronLeft, ChevronRight, Copy, Share2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { MIN, addDays, dayKey, fmtDate, fmtDecimal, fmtDuration, fmtHM, fromDayKey, roundMin, startOfWeek } from "@/lib/time";
import { entriesIn, projectTotals } from "@/lib/stats";
import { entriesCsv, shareFile, timesheetCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dot, SectionTitle } from "@/components/common";
import { Page } from "@/components/Shell";

export function WeekView() {
  const now = useNow(30000);
  const s = useStore();
  const { entries, projects, settings, weekCursor, setWeekCursor, openDay, toast } = s;

  const weekStart = startOfWeek(fromDayKey(weekCursor), settings.weekStart);
  const weekEnd = addDays(weekStart, 7);
  const isThisWeek = dayKey(startOfWeek(now, settings.weekStart)) === dayKey(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const totals = projectTotals(entries, d.getTime(), addDays(d, 1).getTime(), now);
    const min = [...totals.values()].reduce((a, b) => a + b, 0) / MIN;
    return { d, totals, min, workday: settings.workdays.includes(d.getDay()) };
  });
  const weekMin = days.reduce((n, d) => n + d.min, 0);
  const target = settings.dailyGoalMin * days.filter((d) => d.workday).length;
  const maxDay = Math.max(settings.dailyGoalMin, ...days.map((d) => d.min), 1);

  // Timesheet rows: each project's per-day minutes, rounded per day like a real timesheet.
  const sheet = projects
    .map((p) => {
      const perDay = days.map((d) => (d.totals.get(p.id) ?? 0) / MIN);
      const rounded = perDay.map((m) => (m ? roundMin(m, settings.roundingMin) : 0));
      return { p, perDay, rounded, exact: perDay.reduce((a, b) => a + b, 0), sheet: rounded.reduce((a, b) => a + b, 0) };
    })
    .filter((r) => r.exact > 0);
  const shownDays = days.map((d, i) => ({ ...d, i })).filter((d) => d.workday || d.min > 0);
  const sheetTotal = sheet.reduce((n, r) => n + r.sheet, 0);

  const go = (n: number) => setWeekCursor(dayKey(addDays(weekStart, n * 7)));
  const label = `${fmtDate(weekStart, { month: "short", day: "numeric" })} – ${fmtDate(addDays(weekStart, 6), { month: "short", day: "numeric" })}`;
  const fileStem = `time-${dayKey(weekStart)}`;

  const copySummary = async () => {
    const lines = [`Week of ${label}`, ""];
    for (const { d, i } of shownDays) {
      const items = sheet.filter((r) => r.rounded[i]).map((r) => `${r.p.name}${r.p.code ? ` (${r.p.code})` : ""} ${fmtDecimal(r.rounded[i])}h`);
      if (items.length) lines.push(`${fmtDate(d)}: ${items.join(", ")}`);
    }
    lines.push("", `Total: ${fmtDecimal(sheetTotal)}h`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Copied the week's summary", "win");
    } catch {
      toast("Couldn't copy on this device", "error");
    }
  };

  return (
    <Page
      title={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => go(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-lg font-bold">{isThisWeek ? "This week" : "Week"}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => go(1)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      }
      right={
        !isThisWeek && (
          <Button variant="secondary" size="sm" onClick={() => setWeekCursor(dayKey())}>
            Now
          </Button>
        )
      }
    >
      <div className="mb-5 rounded-2xl border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">{fmtDuration(weekMin, settings.hourFormat)}</span>
          {target > 0 && <span className="text-sm text-muted-foreground">of {fmtHM(target)} target</span>}
        </div>
        {target > 0 && <Progress value={Math.min(100, (weekMin / target) * 100)} className={cn("h-2.5", weekMin >= target && "[&>div]:bg-win")} />}
      </div>

      <SectionTitle>By day</SectionTitle>
      <div className="mb-5 grid gap-1.5">
        {days.map(({ d, totals, min, workday }) => (
          <button key={d.getTime()} type="button" onClick={() => openDay(dayKey(d))} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-2 text-left active:bg-muted", !workday && !min && "opacity-50")}>
            <span className={cn("w-12 text-sm", dayKey(d) === dayKey(now) && "font-bold text-primary")}>
              {fmtDate(d, { weekday: "short" })}
              <span className="block text-[11px] text-muted-foreground">{d.getDate()}</span>
            </span>
            <span className="relative flex h-5 flex-1 overflow-hidden rounded-md bg-muted">
              {projects.map((p) => {
                const pm = (totals.get(p.id) ?? 0) / MIN;
                return pm ? <span key={p.id} style={{ width: `${(pm / maxDay) * 100}%`, background: p.color }} /> : null;
              })}
              {settings.dailyGoalMin > 0 && workday && <span className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${(settings.dailyGoalMin / maxDay) * 100}%` }} />}
            </span>
            <span className="w-14 text-right text-sm font-semibold tabular-nums">{min ? fmtHM(min) : "–"}</span>
          </button>
        ))}
      </div>

      {sheet.length > 0 ? (
        <>
          <SectionTitle>Timesheet {settings.roundingMin ? `(rounded to ${settings.roundingMin} min)` : ""}</SectionTitle>
          <div className="mb-5 overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b text-[11px] text-muted-foreground uppercase">
                  <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium">Project</th>
                  {shownDays.map(({ d }) => (
                    <th key={d.getTime()} className="px-1.5 py-2 text-right font-medium">
                      {fmtDate(d, { weekday: "narrow" })}
                      <span className="block font-normal">{d.getDate()}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sheet.map((r) => (
                  <tr key={r.p.id} className="border-b last:border-0">
                    <td className="sticky left-0 max-w-32 bg-card px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Dot color={r.p.color} />
                        <span className="truncate">{r.p.name}</span>
                      </div>
                      {r.p.code && <div className="pl-[18px] text-[11px] text-muted-foreground">{r.p.code}</div>}
                    </td>
                    {shownDays.map(({ i }) => (
                      <td key={i} className={cn("px-1.5 py-2.5 text-right", !r.rounded[i] && "text-muted-foreground/40")}>
                        {r.rounded[i] ? fmtDecimal(r.rounded[i]) : "·"}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-semibold">{fmtDecimal(r.sheet)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className="sticky left-0 bg-[#201e2e] px-3 py-2.5">Total</td>
                  {shownDays.map(({ i }) => {
                    const t = sheet.reduce((n, r) => n + r.rounded[i], 0);
                    return (
                      <td key={i} className="px-1.5 py-2.5 text-right">
                        {t ? fmtDecimal(t) : "·"}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right text-primary">{fmtDecimal(sheetTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <SectionTitle>Send it somewhere</SectionTitle>
          <div className="grid gap-2">
            <Button variant="secondary" className="h-12 justify-start" onClick={() => shareFile(`${fileStem}-timesheet.csv`, timesheetCsv(entries, projects, weekStart, 7, settings), "text/csv")}>
              <Share2 /> Share timesheet (CSV)
            </Button>
            <Button
              variant="secondary"
              className="h-12 justify-start"
              onClick={() => shareFile(`${fileStem}-entries.csv`, entriesCsv(entriesIn(entries, weekStart.getTime(), weekEnd.getTime(), now), projects), "text/csv")}
            >
              <Share2 /> Share every entry (CSV)
            </Button>
            <Button variant="secondary" className="h-12 justify-start" onClick={copySummary}>
              <Copy /> Copy summary as text
            </Button>
            <p className="px-1 text-xs text-muted-foreground">Tip: share to your work email, then open the CSV in Excel on your work computer.</p>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No time tracked this week.</div>
      )}
    </Page>
  );
}
