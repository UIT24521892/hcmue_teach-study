export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function shiftDate(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}

export function parseDate(key: string): Date {
  const [year = 2026, month = 1, day = 1] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatDate(key: string): string {
  return parseDate(key).toLocaleDateString("vi-VN", { day: "numeric", month: "long" });
}

// UI demo uses the browser's local timezone, not UTC date slicing.
export function calculateStreak(dates: string[], today = new Date()): number {
  const days = new Set(dates);
  let cursor = days.has(dateKey(today)) ? today : shiftDate(today, -1);
  let count = 0;
  while (days.has(dateKey(cursor))) {
    count += 1;
    cursor = shiftDate(cursor, -1);
  }
  return count;
}
