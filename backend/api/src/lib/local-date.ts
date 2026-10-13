/**
 * Calendar-day helpers that work on `YYYY-MM-DD` keys. All "which day is it"
 * questions are answered in the user's timezone, never the server's.
 */
export const FALLBACK_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** A stored timezone the runtime does not know falls back instead of failing. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isSupportedTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
}

export function localDateKey(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function shiftDateKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** `@db.Date` columns round-trip through UTC midnight. */
export function dateKeyToDbDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dbDateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive active days ending today, or ending yesterday when today has no
 * activity yet — a streak is not broken until the day is over.
 */
export function calculateStreak(activeDays: Iterable<string>, today: string): number {
  const days = new Set(activeDays);
  let cursor = days.has(today) ? today : shiftDateKey(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return count;
}
