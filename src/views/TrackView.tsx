import { useState } from "react";
import { Download, Flame, Pencil, Play, Plus, Square, X } from "lucide-react";
import { activeProjects, projectById, running, useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { MIN, dayKey, fmtDate, fmtDuration, fmtElapsed, fmtHM, fmtTime } from "@/lib/time";
import { dayRange, logStreak, projectTotals, totalMs } from "@/lib/stats";
import { isInstalled, useInstallPrompt } from "@/lib/pwa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dot, SectionTitle, tint } from "@/components/common";
import { EntryDialog, ProjectDialog, type EntryDraft } from "@/components/Dialogs";
import { Page } from "@/components/Shell";

export function TrackView() {
  const now = useNow(1000);
  const s = useStore();
  const { settings, entries } = s;
  const cur = running(s);
  const curProject = cur ? projectById(s, cur.projectId) : null;
  const projects = activeProjects(s);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [newProject, setNewProject] = useState(false);

  const { from, to } = dayRange(now);
  const todayMin = totalMs(entries, from, to, now) / MIN;
  const perProject = projectTotals(entries, from, to, now);
  const goal = settings.dailyGoalMin;
  const streak = logStreak(entries, settings, now);

  // The most recent finished entry, for "Resume" and "untracked since…".
  const last = cur ? null : [...entries].filter((e) => e.end !== null).sort((a, b) => b.end! - a.end!)[0];
  const lastProject = last ? projectById(s, last.projectId) : null;
  const untrackedMin = last && dayKey(last.end!) === dayKey(now) ? (now - last.end!) / MIN : 0;

  return (
    <Page
      title={
        <>
          <div className="text-xl font-bold">Today</div>
          <div className="text-xs text-muted-foreground">{fmtDate(now, { weekday: "long", month: "long", day: "numeric" })}</div>
        </>
      }
      right={
        <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm" title="Workdays in a row with time logged">
          <Flame className={cn("size-4", streak ? "fill-energy-high text-energy-high" : "text-muted-foreground")} />
          <b className="tabular-nums">{streak}</b>
          <span className="text-xs text-muted-foreground">day{streak === 1 ? "" : "s"}</span>
        </div>
      }
    >
      <InstallBanner />

      {/* Today's total vs goal */}
      <div className="mb-3 rounded-2xl border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">{fmtDuration(todayMin, settings.hourFormat)}</span>
          <span className="text-sm text-muted-foreground">
            {goal ? (todayMin >= goal ? <span className="font-medium text-win">Goal hit ✓</span> : `${fmtHM(goal - todayMin)} to ${fmtHM(goal)} goal`) : "tracked today"}
          </span>
        </div>
        {goal > 0 && <Progress value={Math.min(100, (todayMin / goal) * 100)} className={cn("h-2.5", todayMin >= goal && "[&>div]:bg-win")} />}
      </div>

      {/* The timer */}
      {cur && curProject ? (
        <div className="mb-5 rounded-2xl border-2 p-4" style={{ borderColor: curProject.color, background: tint(curProject.color, 10) }}>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase" style={{ color: curProject.color }}>
            <span className="animate-breathe size-2 rounded-full" style={{ background: curProject.color }} /> Tracking
          </div>
          <div className="mt-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-xl font-bold">{curProject.name}</div>
              {curProject.code && <div className="text-xs text-muted-foreground">{curProject.code}</div>}
            </div>
            <Button variant="ghost" size="icon" aria-label="Edit this entry" onClick={() => setDraft({ ...cur })}>
              <Pencil />
            </Button>
          </div>
          <div className="my-3 text-center text-5xl font-bold tracking-tight tabular-nums">{fmtElapsed(now - cur.start)}</div>
          <div className="mb-2 text-center text-xs text-muted-foreground">since {fmtTime(cur.start)}</div>
          <div className="mb-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <span className="mr-1">Started earlier?</span>
            {[5, 15, 30].map((m) => (
              <button key={m} type="button" onClick={() => s.setRunningStart(cur.start - m * MIN)} className="min-h-8 rounded-full bg-background/60 px-3 font-semibold text-foreground active:scale-95">
                −{m}m
              </button>
            ))}
          </div>
          <Input
            value={cur.note ?? ""}
            onChange={(e) => s.setRunningNote(e.target.value)}
            placeholder="What are you doing? (optional note)"
            className="mb-3 h-11 bg-background/50"
          />
          <Button className="h-14 w-full bg-energy-high text-base font-semibold text-background hover:bg-energy-high/90" onClick={() => s.stop()}>
            <Square className="fill-current" /> Stop
          </Button>
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-dashed p-4 text-center">
          <div className="text-lg font-semibold">Not tracking</div>
          <div className="text-sm text-muted-foreground">Tap a project below to start the clock.</div>
          {untrackedMin >= 5 && last && (
            <button
              type="button"
              onClick={() => setDraft({ projectId: null, start: last.end!, end: now })}
              className="mt-3 w-full rounded-xl bg-energy-medium/10 px-3 py-2.5 text-sm text-energy-medium"
            >
              ⏳ Untracked since {fmtTime(last.end!)} ({fmtHM(untrackedMin)}). <b>Fill it in ›</b>
            </button>
          )}
          {lastProject && !lastProject.archived && (
            <Button variant="secondary" className="mt-3 h-11 w-full" onClick={() => s.start(lastProject.id)}>
              <Play className="fill-current" /> Resume {lastProject.name}
            </Button>
          )}
        </div>
      )}

      <SectionTitle
        right={
          <Button variant="ghost" size="sm" onClick={() => setDraft({ projectId: null, start: now - 30 * MIN, end: now })}>
            <Plus /> Add time
          </Button>
        }
      >
        {cur ? "Tap to switch" : "Projects"}
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {projects.map((p) => {
          const active = cur?.projectId === p.id;
          const min = (perProject.get(p.id) ?? 0) / MIN;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => s.start(p.id)}
              className={cn("relative flex min-h-20 flex-col justify-between overflow-hidden rounded-2xl border-2 p-3 pl-4 text-left transition-transform active:scale-[0.97]", !active && "border-transparent bg-card")}
              style={active ? { borderColor: p.color, background: tint(p.color) } : undefined}
            >
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: p.color }} />
              <span className="line-clamp-2 leading-tight font-semibold">{p.name}</span>
              <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                {active ? <Dot color={p.color} className="animate-breathe" /> : null}
                {min >= 1 ? fmtHM(min) : active ? "just started" : p.code || "–"}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setNewProject(true)}
          className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-sm text-muted-foreground active:scale-[0.97]"
        >
          <Plus className="size-5" /> New project
        </button>
      </div>

      <EntryDialog draft={draft} onClose={() => setDraft(null)} />
      <ProjectDialog project={null} open={newProject} onClose={() => setNewProject(false)} />
    </Page>
  );
}

function InstallBanner() {
  const { available, install } = useInstallPrompt();
  const dismissed = useStore((s) => s.installDismissed);
  const dismiss = useStore((s) => s.dismissInstall);
  if (!available || dismissed || isInstalled()) return null;
  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-3">
      <Download className="size-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <b>Add to your home screen</b>
        <div className="text-xs text-muted-foreground">One tap to open, works offline.</div>
      </div>
      <Button size="sm" onClick={install}>
        Install
      </Button>
      <button type="button" aria-label="Dismiss" onClick={dismiss} className="p-1 text-muted-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
