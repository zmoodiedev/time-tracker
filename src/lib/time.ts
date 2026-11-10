export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Local-date key like "2026-11-09". */
export function dayKey(d: Date | number = new Date()) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

export function fromDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date | number = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Adds calendar days (safe across daylight-saving changes). */
export function addDays(d: Date | number, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date | number, weekStart: number) {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStart + 7) % 7;
  return addDays(x, -diff);
}

export function fmtTime(t: Date | number) {
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function fmtDate(t: Date | number, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(t).toLocaleDateString([], opts);
}

/** 3725000 -> "1:02:05" */
export function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Minutes -> "2h 05m", "45m", "0m" */
export function fmtHM(min: number) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Minutes -> "2.25" (decimal hours, trailing zeros trimmed) */
export function fmtDecimal(min: number) {
  return String(Math.round((Math.max(0, min) / 60) * 100) / 100);
}

export function fmtDuration(min: number, format: "hm" | "decimal") {
  return format === "decimal" ? `${fmtDecimal(min)}h` : fmtHM(min);
}

/** Round minutes to the nearest step (0 = no rounding). */
export function roundMin(min: number, step: number) {
  return step ? Math.round(min / step) * step : Math.round(min);
}

/** Timestamp -> "HH:MM" for <input type="time"> */
export function toTimeInput(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Combine a "YYYY-MM-DD" day and "HH:MM" into a timestamp. */
export function fromInputs(day: string, hm: string) {
  const d = fromDayKey(day);
  const [h, m] = hm.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

/** Timestamp -> "YYYY-MM-DDTHH:MM" for <input type="datetime-local"> */
export function toDateTimeInput(t: number) {
  return `${dayKey(t)}T${toTimeInput(t)}`;
}

export function isToday(key: string) {
  return key === dayKey();
}
