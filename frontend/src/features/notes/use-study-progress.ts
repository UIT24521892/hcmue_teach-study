import { useCallback, useEffect, useMemo, useState } from "react";

import type { StudyProgress } from "@mach/contracts";

import { ApiError } from "../auth/api-client";
import { useAuth } from "../auth/auth-context";
import { createNotesApi } from "./notes-api";

/**
 * Server-computed sessions and streak in the user's timezone. Every surface
 * that draws the study tree reads this, so the numbers always agree.
 */
export function useStudyProgress() {
  const auth = useAuth();
  const api = useMemo(() => createNotesApi(auth.client), [auth.client]);
  const [progress, setProgress] = useState<StudyProgress | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void api
      .progress()
      .then((response) => {
        if (cancelled) return;
        setProgress(response.progress);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : "Không tải được tiến độ học. Kiểm tra kết nối rồi thử lại.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);
  return { progress, error, reload };
}
