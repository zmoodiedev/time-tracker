export type View = "track" | "day" | "week" | "settings";
export type HourFormat = "hm" | "decimal";

export interface Project {
  id: string;
  name: string;
  color: string;
  /** Optional timesheet / charge code shown next to the name and in exports. */
  code?: string;
  archived?: boolean;
}

export interface Entry {
  id: string;
  projectId: string;
  start: number;
  /** null while the timer is running. */
  end: number | null;
  note?: string;
}

export interface Settings {
  dailyGoalMin: number;
  /** 0 = Sunday … 6 = Saturday */
  workdays: number[];
  weekStart: 0 | 1;
  /** Round timesheet totals to this many minutes (0 = exact). */
  roundingMin: 0 | 6 | 15 | 30;
  hourFormat: HourFormat;
  sounds: boolean;
  haptics: boolean;
  notify: boolean;
  /** Ask "still working on this?" after a timer runs this long. */
  longRunHours: number;
}

export interface Backup {
  app: "time-tracker";
  version: 1;
  exportedAt: string;
  projects: Project[];
  entries: Entry[];
  settings: Settings;
}
