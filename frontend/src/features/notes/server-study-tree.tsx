import { RotateCcw } from "lucide-react";
import { Button } from "@mach/ui";

import { StudyTree } from "../../components/study-tree";
import type { useStudyProgress } from "./use-study-progress";

/** The study tree fed by server progress, with loading and error states. */
export function ServerStudyTree({ state }: { state: ReturnType<typeof useStudyProgress> }) {
  if (state.progress) {
    return (
      <StudyTree
        completedSessions={state.progress.completedSessions}
        streakDays={state.progress.streakDays}
      />
    );
  }
  if (state.error) {
    return (
      <div
        role="alert"
        className="mt-5 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-sm"
      >
        <p>{state.error}</p>
        <Button variant="secondary" className="mt-3" onClick={state.reload}>
          <RotateCcw className="size-4" aria-hidden="true" /> Thử lại
        </Button>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-label="Đang tải cây tri thức"
      className="mt-5 h-72 animate-pulse rounded-2xl bg-surface-raised motion-reduce:animate-none"
    />
  );
}
