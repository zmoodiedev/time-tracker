import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Backup, Entry, Project, Settings, View } from "./types";
import { MIN, dayKey, fmtTime, uid } from "./time";
import { dayRange, totalMs } from "./stats";
import { fx } from "./fx";

export const PROJECT_COLORS = ["#9b8cff", "#2dd4bf", "#fbbf24", "#fb7185", "#4ade80", "#60a5fa", "#f472b6", "#fb923c", "#a3e635", "#22d3ee", "#e879f9", "#94a3b8"];

export const DEFAULT_SETTINGS: Settings = {
  dailyGoalMin: 7.5 * 60,
  workdays: [1, 2, 3, 4, 5],
  weekStart: 1,
  roundingMin: 15,
  hourFormat: "hm",
  sounds: false,
  haptics: true,
  notify: false,
  longRunHours: 3,
};

const STARTER_PROJECTS: Project[] = [
  { id: "p-meetings", name: "Meetings", color: "#60a5fa" },
  { id: "p-admin", name: "Email & admin", color: "#fbbf24" },
  { id: "p-project", name: "Project work", color: "#9b8cff" },
];

/** A tap that runs shorter than this is treated as a mis-tap. */
const MISTAP_MS = 60_000;
/** Stopping before this discards the entry. */
const MIN_ENTRY_MS = 30_000;

export interface Toast {
  id: string;
  text: string;
  kind: "win" | "info" | "error";
  action?: { label: string; run: () => void };
}

interface Persisted {
  projects: Project[];
  entries: Entry[];
  settings: Settings;
  /** Day key of the last daily-goal celebration (one per day). */
  celebrated: string | null;
  /** Last time the user confirmed a long timer was still going. */
  longRunAck: number | null;
  installDismissed: boolean;
  lastBackup: number | null;
}

interface State extends Persisted {
  view: View;
  /** Day shown in the Day view, as a day key. */
  dayCursor: string;
  /** Any day inside the week shown in the Week view. */
  weekCursor: string;
  toasts: Toast[];

  setView: (v: View) => void;
  openDay: (key: string) => void;
  setDayCursor: (key: string) => void;
  setWeekCursor: (key: string) => void;

  start: (projectId: string) => void;
  stop: (at?: number) => void;
  setRunningStart: (start: number) => void;
  setRunningNote: (note: string) => void;
  ackLongRun: () => void;

  addEntry: (e: Omit<Entry, "id">) => void;
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  deleteEntry: (id: string) => void;

  addProject: (p: Omit<Project, "id">) => string;
  updateProject: (id: string, patch: Partial<Project>) => void;
  moveProject: (id: string, dir: -1 | 1) => void;
  deleteProject: (id: string) => boolean;

  updateSettings: (patch: Partial<Settings>) => void;
  dismissInstall: () => void;
  markBackedUp: () => void;
  checkGoal: () => void;
  importBackup: (b: Backup) => void;
  eraseAll: () => void;

  toast: (text: string, kind?: Toast["kind"], action?: Toast["action"]) => void;
  dismissToast: (id: string) => void;
}

export const running = (s: Pick<State, "entries">) => s.entries.find((e) => e.end === null) ?? null;
export const projectById = (s: Pick<State, "projects">, id: string) => s.projects.find((p) => p.id === id);
export const activeProjects = (s: Pick<State, "projects">) => s.projects.filter((p) => !p.archived);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      projects: STARTER_PROJECTS,
      entries: [],
      settings: DEFAULT_SETTINGS,
      celebrated: null,
      longRunAck: null,
      installDismissed: false,
      lastBackup: null,

      view: "track",
      dayCursor: dayKey(),
      weekCursor: dayKey(),
      toasts: [],

      setView: (view) => {
        fx.tap();
        set({ view });
      },
      openDay: (key) => set({ view: "day", dayCursor: key }),
      setDayCursor: (dayCursor) => set({ dayCursor }),
      setWeekCursor: (weekCursor) => set({ weekCursor }),

      start: (projectId) => {
        const now = Date.now();
        const cur = running(get());
        const name = projectById(get(), projectId)?.name ?? "project";
        if (cur?.projectId === projectId) {
          fx.tap();
          return;
        }
        // Tapped the wrong tile a moment ago? Swap the project and keep the start time.
        if (cur && now - cur.start < MISTAP_MS) {
          set((s) => ({ entries: s.entries.map((e) => (e.id === cur.id ? { ...e, projectId } : e)) }));
          fx.start();
          get().toast(`Switched to ${name}`, "info");
          return;
        }
        set((s) => ({
          entries: [...s.entries.map((e) => (e.id === cur?.id ? { ...e, end: now } : e)), { id: uid(), projectId, start: now, end: null }],
          longRunAck: null,
        }));
        fx.start();
        get().checkGoal();
      },

      stop: (at = Date.now()) => {
        const cur = running(get());
        if (!cur) return;
        const end = Math.max(at, cur.start);
        if (end - cur.start < MIN_ENTRY_MS) {
          set((s) => ({ entries: s.entries.filter((e) => e.id !== cur.id) }));
          fx.tap();
          get().toast("Under 30 seconds, so it wasn't saved", "info");
          return;
        }
        set((s) => ({ entries: s.entries.map((e) => (e.id === cur.id ? { ...e, end } : e)), longRunAck: null }));
        fx.stop();
        get().checkGoal();
      },

      // "I actually started earlier." Moves the running timer's start back, and trims the
      // entry right before it so the two don't overlap.
      setRunningStart: (wanted) => {
        const s = get();
        const cur = running(s);
        if (!cur) return;
        let start = Math.min(wanted, Date.now());
        const prev = s.entries
          .filter((e) => e.end !== null && e.id !== cur.id && e.end <= cur.start + 1000)
          .sort((a, b) => b.end! - a.end!)[0];
        let trimmed: Entry | null = null;
        if (prev && prev.end! > start) {
          const floor = prev.start + MIN;
          if (start < floor) {
            start = floor;
            get().toast(`Can't go earlier than when "${projectById(s, prev.projectId)?.name}" started (${fmtTime(prev.start)})`, "info");
          }
          trimmed = { ...prev, end: start };
        }
        set({
          entries: s.entries.map((e) => (e.id === cur.id ? { ...e, start } : trimmed && e.id === trimmed.id ? trimmed : e)),
        });
        fx.tap();
      },

      setRunningNote: (note) => {
        const cur = running(get());
        if (cur) get().updateEntry(cur.id, { note });
      },

      ackLongRun: () => set({ longRunAck: Date.now() }),

      addEntry: (e) => {
        set((s) => ({ entries: [...s.entries, { ...e, id: uid() }] }));
        get().checkGoal();
      },
      updateEntry: (id, patch) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      deleteEntry: (id) => {
        const gone = get().entries.find((e) => e.id === id);
        if (!gone) return;
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
        get().toast("Entry deleted", "info", {
          label: "Undo",
          run: () => set((s) => ({ entries: [...s.entries, gone] })),
        });
      },

      addProject: (p) => {
        const id = uid();
        set((s) => ({ projects: [...s.projects, { ...p, id }] }));
        return id;
      },
      updateProject: (id, patch) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      moveProject: (id, dir) =>
        set((s) => {
          const list = [...s.projects];
          const i = list.findIndex((p) => p.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= list.length) return {};
          [list[i], list[j]] = [list[j], list[i]];
          return { projects: list };
        }),
      deleteProject: (id) => {
        if (get().entries.some((e) => e.projectId === id)) return false;
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
        return true;
      },

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      dismissInstall: () => set({ installDismissed: true }),
      markBackedUp: () => set({ lastBackup: Date.now() }),

      // Confetti once per day when you've tracked your daily goal.
      checkGoal: () => {
        const s = get();
        const today = dayKey();
        if (s.celebrated === today || !s.settings.dailyGoalMin) return;
        const now = Date.now();
        const { from, to } = dayRange(now);
        if (totalMs(s.entries, from, to, now) >= s.settings.dailyGoalMin * MIN) {
          set({ celebrated: today });
          fx.goal();
          get().toast("🎉 Daily goal tracked! Nice work keeping the log.", "win");
        }
      },

      importBackup: (b) =>
        set({
          projects: b.projects,
          entries: b.entries,
          settings: { ...DEFAULT_SETTINGS, ...b.settings },
          celebrated: null,
          longRunAck: null,
        }),
      eraseAll: () => set({ projects: STARTER_PROJECTS, entries: [], settings: DEFAULT_SETTINGS, celebrated: null, longRunAck: null }),

      toast: (text, kind = "info", action) => {
        const id = uid();
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind, action }] }));
        setTimeout(() => get().dismissToast(id), action ? 6000 : 3500);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: "time-tracker",
      version: 1,
      partialize: (s): Persisted => ({
        projects: s.projects,
        entries: s.entries,
        settings: s.settings,
        celebrated: s.celebrated,
        longRunAck: s.longRunAck,
        installDismissed: s.installDismissed,
        lastBackup: s.lastBackup,
      }),
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<Persisted>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
      },
    }
  )
);
