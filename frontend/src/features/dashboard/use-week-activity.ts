import { useCallback, useEffect, useMemo, useState } from "react";

import type { StudyProgress } from "@mach/contracts";

import { dateKey, parseDate, shiftDate } from "../../lib/dates";
import { createAttemptsApi } from "../attempts/attempts-api";
import { ApiError } from "../auth/api-client";
import { useAuth } from "../auth/auth-context";
import { createNotesApi } from "../notes/notes-api";

export interface WeekActivity {
  /** Local dates (account timezone) with a note or a submitted attempt. */
  activeDays: ReadonlySet<string>;
  submittedTotal: number;
}

function localDateFormatter(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone });
  } catch {
    // The browser does not know the zone the server resolved; fall back to the device zone.
    return new Intl.DateTimeFormat("en-CA");
  }
}

/**
 * The last seven study days, using the same rule as the server's study
 * sessions (ADR 0007): a day counts when it has a note or a submitted attempt.
 * A single page of 50 submissions covers the week for any realistic learner;
 * Phase 6 replaces this with a dedicated dashboard endpoint.
 */
export function useWeekActivity(progress: StudyProgress | null) {
  const auth = useAuth();
  const notesApi = useMemo(() => createNotesApi(auth.client), [auth.client]);
  const attemptsApi = useMemo(() => createAttemptsApi(auth.client), [auth.client]);
  const [activity, setActivity] = useState<WeekActivity | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const today = progress?.today;
  const timeZone = progress?.timezone;

  const week = useMemo(
    () =>
      today ? Array.from({ length: 7 }, (_, i) => dateKey(shiftDate(parseDate(today), i - 6))) : [],
    [today],
  );

  useEffect(() => {
    const from = week[0];
    if (!today || !timeZone || !from) return;
    let cancelled = false;
    void Promise.all([notesApi.list(from, today), attemptsApi.mine(1, 50)])
      .then(([notes, attempts]) => {
        if (cancelled) return;
        const activeDays = new Set(notes.notes.map((note) => note.date));
        const format = localDateFormatter(timeZone);
        for (const attempt of attempts.attempts) {
          if (!attempt.submittedAt) continue;
          const day = format.format(new Date(attempt.submittedAt));
          if (day >= from && day <= today) activeDays.add(day);
        }
        setActivity({ activeDays, submittedTotal: attempts.pagination.total });
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : "Không tải được nhịp học tuần này. Kiểm tra kết nối rồi thử lại.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [attemptsApi, notesApi, reloadKey, timeZone, today, week]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);
  return { week, activity, error, reload };
}
