import { describe, expect, it } from "vitest";

import { calculateStreak, localDateKey, resolveTimeZone, shiftDateKey } from "./local-date.js";

describe("local dates", () => {
  it("decides the day in the user's timezone, not UTC", () => {
    // 17:30 UTC is already 00:30 the next day in Ho Chi Minh City (UTC+7).
    const instant = new Date("2026-10-12T17:30:00.000Z");
    expect(localDateKey(instant, "Asia/Ho_Chi_Minh")).toBe("2026-10-13");
    expect(localDateKey(instant, "UTC")).toBe("2026-10-12");
    // 16:59 UTC is still 23:59 on the same day locally.
    expect(localDateKey(new Date("2026-10-12T16:59:59.000Z"), "Asia/Ho_Chi_Minh")).toBe(
      "2026-10-12",
    );
    expect(localDateKey(instant, "America/Los_Angeles")).toBe("2026-10-12");
  });

  it("shifts across month and leap-year boundaries", () => {
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateKey("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("keeps a streak alive until the day ends and breaks it on a gap", () => {
    const days = ["2026-10-09", "2026-10-10", "2026-10-11"];
    expect(calculateStreak(days, "2026-10-11")).toBe(3);
    expect(calculateStreak(days, "2026-10-12")).toBe(3);
    expect(calculateStreak(days, "2026-10-13")).toBe(0);
    expect(calculateStreak([...days, "2026-10-13"], "2026-10-13")).toBe(1);
    expect(calculateStreak([], "2026-10-13")).toBe(0);
  });

  it("falls back for an unknown stored timezone", () => {
    expect(resolveTimeZone("Mars/Olympus_Mons")).toBe("Asia/Ho_Chi_Minh");
    expect(resolveTimeZone("Europe/Paris")).toBe("Europe/Paris");
  });
});
