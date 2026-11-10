import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Download, FileDown, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Project, Settings } from "@/lib/types";
import { DAY, fmtHM, fmtDate } from "@/lib/time";
import { entriesCsv, makeBackup, parseBackup, shareFile } from "@/lib/export";
import { askNotificationPermission, isInstalled, notificationsSupported, useInstallPrompt } from "@/lib/pwa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dot, Segmented, SectionTitle, Stepper, Toggle } from "@/components/common";
import { ProjectDialog } from "@/components/Dialogs";
import { Page } from "@/components/Shell";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function Row({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 divide-y overflow-hidden rounded-2xl border bg-card">{children}</div>;
}

export function SettingsView() {
  const s = useStore();
  const { settings, updateSettings, projects, entries, toast } = s;
  const set = (patch: Partial<Settings>) => updateSettings(patch);
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { available, install } = useInstallPrompt();

  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);
  const backupAge = s.lastBackup ? Math.floor((Date.now() - s.lastBackup) / DAY) : null;

  const toggleNotify = async (on: boolean) => {
    if (!on) return set({ notify: false });
    if (await askNotificationPermission()) {
      set({ notify: true });
      toast("You'll see a notification with a Stop button while a timer runs", "win");
    } else toast("Notifications are blocked. Allow them in Chrome: ⋮ → Settings → Site settings.", "error");
  };

  const backup = async () => {
    await shareFile(`time-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(makeBackup(projects, entries, settings)), "application/json");
    s.markBackedUp();
  };

  const restore = async (file: File) => {
    try {
      const b = parseBackup(await file.text());
      if (!confirm(`Replace everything on this phone with the backup from ${fmtDate(new Date(b.exportedAt))}? (${b.entries.length} entries)`)) return;
      s.importBackup(b);
      toast("Backup restored", "win");
    } catch (e) {
      toast((e as Error).message || "Couldn't read that file", "error");
    }
  };

  return (
    <Page title={<div className="text-xl font-bold">Settings</div>}>
      <SectionTitle
        right={
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
            <Plus /> New
          </Button>
        }
      >
        Projects
      </SectionTitle>
      <Group>
        {active.map((p, i) => (
          <div key={p.id} className="flex min-h-14 items-center gap-1 pr-2">
            <button type="button" onClick={() => setEditing(p)} className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2 pl-4 text-left">
              <Dot color={p.color} className="size-3.5" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                {p.code && <span className="block text-xs text-muted-foreground">{p.code}</span>}
              </span>
            </button>
            <Button variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => s.moveProject(p.id, -1)}>
              <ChevronUp />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Move down" disabled={i === active.length - 1} onClick={() => s.moveProject(p.id, 1)}>
              <ChevronDown />
            </Button>
          </div>
        ))}
        {active.length === 0 && <div className="p-4 text-sm text-muted-foreground">No projects yet. Tap New.</div>}
        {archived.length > 0 && (
          <>
            <button type="button" onClick={() => setShowArchived((v) => !v)} className="flex min-h-12 w-full items-center justify-between px-4 text-sm text-muted-foreground">
              Archived ({archived.length}) <ChevronDown className={cn("size-4 transition-transform", showArchived && "rotate-180")} />
            </button>
            {showArchived &&
              archived.map((p) => (
                <button key={p.id} type="button" onClick={() => setEditing(p)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm text-muted-foreground">
                  <Dot color={p.color} /> {p.name}
                </button>
              ))}
          </>
        )}
      </Group>
      <p className="-mt-4 mb-6 px-1 text-xs text-muted-foreground">Tap a project to rename it, recolor it, add a timesheet code, or archive it. The order here is the order on the Track screen.</p>

      <SectionTitle>Goals</SectionTitle>
      <Group>
        <Row label="Daily goal" hint="Confetti when you've tracked this much in a day">
          <Stepper value={settings.dailyGoalMin} onChange={(v) => set({ dailyGoalMin: v })} step={15} min={0} max={12 * 60} format={(v) => (v ? fmtHM(v) : "Off")} />
        </Row>
        <div className="px-4 py-3">
          <div className="mb-2 text-sm font-medium">Workdays</div>
          <div className="flex gap-1.5">
            {DAYS.map((d, i) => {
              const on = settings.workdays.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ workdays: on ? settings.workdays.filter((x) => x !== i) : [...settings.workdays, i].sort() })}
                  className={cn("grid aspect-square flex-1 place-items-center rounded-full text-sm font-semibold", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Used for weekly targets. Days off never break your streak.</p>
        </div>
        <div className="px-4 py-3">
          <div className="mb-2 text-sm font-medium">Week starts on</div>
          <Segmented
            value={settings.weekStart}
            onChange={(v) => set({ weekStart: v })}
            options={[
              { value: 1, label: "Monday" },
              { value: 0, label: "Sunday" },
            ]}
          />
        </div>
      </Group>

      <SectionTitle>Timesheet</SectionTitle>
      <Group>
        <div className="px-4 py-3">
          <div className="mb-1 text-sm font-medium">Round each project's daily total to</div>
          <div className="mb-2 text-xs text-muted-foreground">Raw times are always kept. Rounding only changes the timesheet numbers.</div>
          <Segmented
            value={settings.roundingMin}
            onChange={(v) => set({ roundingMin: v })}
            options={[
              { value: 0, label: "Exact" },
              { value: 6, label: "6 min" },
              { value: 15, label: "15 min" },
              { value: 30, label: "30 min" },
            ]}
          />
        </div>
        <div className="px-4 py-3">
          <div className="mb-2 text-sm font-medium">Show durations as</div>
          <Segmented
            value={settings.hourFormat}
            onChange={(v) => set({ hourFormat: v })}
            options={[
              { value: "hm", label: "1h 30m" },
              { value: "decimal", label: "1.5h" },
            ]}
          />
        </div>
      </Group>

      <SectionTitle>Nudges</SectionTitle>
      <Group>
        {notificationsSupported() && (
          <Row label="Running-timer notification" hint="Shows what's running, with a Stop button, when you leave the app">
            <Toggle label="Running-timer notification" checked={settings.notify} onChange={toggleNotify} />
          </Row>
        )}
        <Row label="Check on long timers" hint="Asks “still working on this?” so a forgotten timer doesn't wreck your timesheet">
          <Stepper value={settings.longRunHours} onChange={(v) => set({ longRunHours: v })} step={1} min={1} max={12} format={(v) => `${v}h`} />
        </Row>
        <Row label="Vibration">
          <Toggle label="Vibration" checked={settings.haptics} onChange={(v) => set({ haptics: v })} />
        </Row>
        <Row label="Sounds" hint="Off by default so it's quiet at work">
          <Toggle label="Sounds" checked={settings.sounds} onChange={(v) => set({ sounds: v })} />
        </Row>
      </Group>

      {!isInstalled() && (
        <>
          <SectionTitle>Install</SectionTitle>
          <Group>
            <div className="p-4 text-sm">
              {available ? (
                <Button className="h-12 w-full" onClick={install}>
                  <Download /> Install on home screen
                </Button>
              ) : (
                <p className="text-muted-foreground">
                  In Chrome, tap <b className="text-foreground">⋮</b> then <b className="text-foreground">Add to Home screen</b> (or <b className="text-foreground">Install app</b>).
                </p>
              )}
            </div>
          </Group>
        </>
      )}

      <SectionTitle>Your data</SectionTitle>
      <Group>
        <div className="flex gap-3 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="size-5 shrink-0 text-win" />
          <p>
            Everything is stored only on this phone. Nothing is sent anywhere. Clearing Chrome's site data would erase it, so make a backup now and then.
            <span className={cn("mt-1 block font-medium", backupAge === null || backupAge > 14 ? "text-energy-medium" : "text-foreground")}>
              {backupAge === null ? "No backup yet." : backupAge === 0 ? "Last backup: today ✓" : `Last backup: ${backupAge} day${backupAge === 1 ? "" : "s"} ago`}
            </span>
          </p>
        </div>
        <button type="button" onClick={backup} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-medium">
          <Upload className="size-5 text-primary" /> Back up (save or share a file)
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-medium">
          <Download className="size-5 text-primary" /> Restore from a backup
        </button>
        <button type="button" onClick={() => shareFile("time-tracker-all-entries.csv", entriesCsv(entries, projects), "text/csv")} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-medium">
          <FileDown className="size-5 text-primary" /> Export all entries (CSV)
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Erase ALL projects and time entries on this phone? This can't be undone.") && confirm("Really erase everything?")) {
              s.eraseAll();
              toast("Everything erased", "info");
            }
          }}
          className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-medium text-destructive"
        >
          <Trash2 className="size-5" /> Erase everything
        </button>
      </Group>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) restore(f);
          e.target.value = "";
        }}
      />

      <p className="pb-4 text-center text-xs text-muted-foreground">Time Tracker 1.0 · a sibling of Daily Planner ⚡</p>

      <ProjectDialog project={editing} open={!!editing || creating} onClose={() => (setEditing(null), setCreating(false))} />
    </Page>
  );
}
