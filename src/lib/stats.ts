import type { Entry, Settings } from "./types";
import { DAY, MIN, addDays, startOfDay } from "./time";

export const entryEnd = (e: Entry, now: number) => e.end ?? now;

/** How much of an entry falls inside [from, to). */
export function overlapMs(e: Entry, from: number, to: number, now: number) {
  return Math.max(0, Math.min(entryEnd(e, now), to) - Math.max(e.start, from));
}

export function dayRange(day: Date | number) {
  const from = startOfDay(day).getTime();
  return { from, to: addDays(from, 1).getTime() };
}

/** Entries touching [from, to), sorted by start. */
export function entriesIn(entries: Entry[], from: number, to: number, now: number) {
  return entries.filter((e) => e.start < to && entryEnd(e, now) > from).sort((a, b) => a.start - b.start);
}

export function totalMs(entries: Entry[], from: number, to: number, now: number) {
  return entries.reduce((sum, e) => sum + overlapMs(e, from, to, now), 0);
}

/** projectId -> ms inside [from, to) */
export function projectTotals(entries: Entry[], from: number, to: number, now: number) {
  const out = new Map<string, number>();
  for (const e of entries) {
    const ms = overlapMs(e, from, to, now);
    if (ms > 0) out.set(e.projectId, (out.get(e.projectId) ?? 0) + ms);
  }
  return out;
}

export interface Gap {
  start: number;
  end: number;
}

/** Untracked holes of at least `minGapMin` between entries on a day. */
export function gapsIn(dayEntries: Entry[], from: number, to: number, now: number, minGapMin = 5): Gap[] {
  const gaps: Gap[] = [];
  let cursor: number | null = null;
  for (const e of dayEntries) {
    const s = Math.max(e.start, from);
    const end = Math.min(entryEnd(e, now), to);
    if (cursor !== null && s - cursor >= minGapMin * MIN) gaps.push({ start: cursor, end: s });
    cursor = cursor === null ? end : Math.max(cursor, end);
  }
  return gaps;
}

/** Does this entry overlap any other entry? */
export function overlapsOther(entries: Entry[], id: string | null, start: number, end: number, now: number) {
  return entries.some((e) => e.id !== id && e.start < end && entryEnd(e, now) > start);
}

/**
 * Logging streak: workdays in a row with any tracked time.
 * Non-workdays are skipped, and today only counts once you've tracked something.
 */
export function logStreak(entries: Entry[], settings: Settings, now: number) {
  const tracked = new Set<number>();
  for (const e of entries) {
    // Mark every day this entry touches (entries rarely span more than one).
    let d = startOfDay(e.start).getTime();
    const end = entryEnd(e, now);
    while (d < end) {
      tracked.add(d);
      d = addDays(d, 1).getTime();
    }
  }
  let streak = 0;
  let day = startOfDay(now);
  if (tracked.has(day.getTime())) streak++;
  for (let i = 0; i < 400; i++) {
    day = addDays(day, -1);
    if (!settings.workdays.includes(day.getDay())) continue;
    if (!tracked.has(day.getTime())) break;
    streak++;
  }
  return streak;
}

export const msToMin = (ms: number) => ms / MIN;
export const isMultiDay = (e: Entry, now: number) => entryEnd(e, now) - startOfDay(e.start).getTime() > DAY;
