export interface StudyTreeProgress {
  completedBranches: number;
  completedSessions: number;
  growthLabel: string;
  leavesOnGrowingBranch: number;
  sessionsUntilNextBranch: number;
}

const sessionsPerBranch = 10;

export function getStudyTreeProgress(completedSessions: number): StudyTreeProgress {
  const safeSessions = Number.isFinite(completedSessions)
    ? Math.max(0, Math.floor(completedSessions))
    : 0;
  const completedBranches = Math.floor(safeSessions / sessionsPerBranch);
  const leavesOnGrowingBranch = safeSessions % sessionsPerBranch;

  let growthLabel = "Mầm mới";
  if (completedBranches >= 5) growthLabel = "Cây trưởng thành";
  else if (completedBranches >= 3) growthLabel = "Cây đang lớn";
  else if (completedBranches >= 1) growthLabel = "Cây non";

  return {
    completedBranches,
    completedSessions: safeSessions,
    growthLabel,
    leavesOnGrowingBranch,
    sessionsUntilNextBranch:
      leavesOnGrowingBranch === 0 ? sessionsPerBranch : sessionsPerBranch - leavesOnGrowingBranch,
  };
}
