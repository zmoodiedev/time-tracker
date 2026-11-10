import type { Backup, Entry, Project, Settings } from "./types";
import { MIN, addDays, dayKey, fmtDecimal, roundMin, toTimeInput } from "./time";
import { projectTotals } from "./stats";

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

/** Share a file through Android's share sheet (email, Drive, etc.), or download it. */
export async function shareFile(name: string, content: string, type: string) {
  const file = new File([content], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** One row per day per project, rounded like the timesheet view. */
export function timesheetCsv(entries: Entry[], projects: Project[], from: Date, days: number, settings: Settings) {
  const now = Date.now();
  const rows: (string | number)[][] = [["Date", "Project", "Code", "Hours", "Exact minutes"]];
  for (let i = 0; i < days; i++) {
    const d0 = addDays(from, i).getTime();
    const d1 = addDays(from, i + 1).getTime();
    const totals = projectTotals(entries, d0, d1, now);
    for (const p of projects) {
      const ms = totals.get(p.id);
      if (!ms) continue;
      const min = ms / MIN;
      rows.push([dayKey(d0), p.name, p.code ?? "", fmtDecimal(roundMin(min, settings.roundingMin)), Math.round(min)]);
    }
  }
  return toCsv(rows);
}

/** Every entry, raw. */
export function entriesCsv(entries: Entry[], projects: Project[]) {
  const now = Date.now();
  const byId = new Map(projects.map((p) => [p.id, p]));
  const rows: (string | number)[][] = [["Date", "Start", "End", "Project", "Code", "Minutes", "Note"]];
  for (const e of [...entries].sort((a, b) => a.start - b.start)) {
    const p = byId.get(e.projectId);
    const end = e.end ?? now;
    rows.push([dayKey(e.start), toTimeInput(e.start), e.end ? toTimeInput(end) : "running", p?.name ?? "?", p?.code ?? "", Math.round((end - e.start) / MIN), e.note ?? ""]);
  }
  return toCsv(rows);
}

export function makeBackup(projects: Project[], entries: Entry[], settings: Settings): Backup {
  return { app: "time-tracker", version: 1, exportedAt: new Date().toISOString(), projects, entries, settings };
}

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text);
  if (b?.app !== "time-tracker" || !Array.isArray(b.projects) || !Array.isArray(b.entries)) throw new Error("That file isn't a Time Tracker backup.");
  return b as Backup;
}
