import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StudyTree } from "./study-tree";
import { getStudyTreeProgress } from "./study-tree-progress";

describe("getStudyTreeProgress", () => {
  it.each([
    [0, 0, 0, 10, "Mầm mới"],
    [1, 0, 1, 9, "Mầm mới"],
    [9, 0, 9, 1, "Mầm mới"],
    [10, 1, 0, 10, "Cây non"],
    [12, 1, 2, 8, "Cây non"],
    [27, 2, 7, 3, "Cây non"],
    [50, 5, 0, 10, "Cây trưởng thành"],
  ])(
    "maps %i sessions to the expected growth state",
    (sessions, branches, leaves, remaining, label) => {
      expect(getStudyTreeProgress(sessions)).toEqual({
        completedBranches: branches,
        completedSessions: sessions,
        growthLabel: label,
        leavesOnGrowingBranch: leaves,
        sessionsUntilNextBranch: remaining,
      });
    },
  );
});

describe("StudyTree", () => {
  it.each([
    [0, 0, 0],
    [1, 1, 1],
    [10, 10, 1],
    [12, 12, 2],
    [50, 50, 5],
    [60, 60, 6],
    [100, 100, 10],
    [101, 1, 1],
  ])("draws %i sessions without silently dropping leaves", (sessions, leaves, branches) => {
    const { container } = render(<StudyTree completedSessions={sessions} />);
    expect(container.querySelectorAll("[data-tree-leaf]")).toHaveLength(leaves);
    expect(container.querySelectorAll("[data-tree-branch]")).toHaveLength(branches);
    if (sessions === 101)
      expect(screen.getByText("1 cây trọn vẹn trong vườn · Cây 2: 1/100 lá")).toBeInTheDocument();
  });
  it("describes progress without relying on color", () => {
    render(<StudyTree completedSessions={12} />);

    expect(
      screen.getByRole("img", {
        name: "12 buổi học, 1 cành hoàn chỉnh và 12 chiếc lá",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("2/10 buổi đến cành tiếp theo")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tiến độ tới cành tiếp theo" })).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
  });
});

describe("invalid session counts", () => {
  it.each([NaN, Infinity, -Infinity, -1])("normalizes %s", (value) => {
    expect(getStudyTreeProgress(value).completedSessions).toBe(0);
  });
});
