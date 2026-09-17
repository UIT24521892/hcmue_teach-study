import { Check, Flame, Leaf, Sprout } from "lucide-react";
import { getStudyTreeProgress } from "./study-tree-progress";
import { cn } from "../lib/cn";

export interface StudyTreeProps {
  completedSessions: number;
  streakDays?: number;
}

// Each tree holds 100 leaves; completed trees remain in the garden.
export function StudyTree({ completedSessions, streakDays = 0 }: StudyTreeProps) {
  const progress = getStudyTreeProgress(completedSessions);
  const archivedTrees = Math.max(0, Math.ceil(progress.completedSessions / 100) - 1);
  const leaves =
    progress.completedSessions === 0 ? 0 : ((progress.completedSessions - 1) % 100) + 1;
  const branchCount = Math.ceil(leaves / 10);
  const crownTop = 205 - Math.max(0, Math.ceil(branchCount / 2) - 1) * 30;
  const summary = `${progress.completedSessions} buổi học, ${progress.completedBranches} cành hoàn chỉnh và ${progress.completedSessions} chiếc lá`;
  return (
    <div className="study-tree mt-5">
      <div className="relative isolate overflow-hidden rounded-2xl border border-line bg-canvas">
        <div className="absolute inset-x-4 top-4 z-10 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold">
            <Sprout className="size-3.5 text-tree" />
            {progress.growthLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <Flame className="size-4 text-accent-strong" />
            {streakDays} ngày liên tiếp
          </span>
        </div>
        <svg
          aria-label={summary}
          className="mx-auto block aspect-[7/5] w-full max-w-lg"
          role="img"
          viewBox="0 0 420 300"
        >
          <title>{summary}</title>
          <desc>
            {archivedTrees > 0
              ? `${archivedTrees} cây đã đủ 100 lá. Cây hiện tại có ${leaves} lá.`
              : "Mỗi buổi học thêm một lá, mỗi mười lá hoàn thiện một cành."}
          </desc>
          <circle cx="210" cy="158" r="106" className="fill-accent/5" />
          <circle
            cx="210"
            cy="158"
            r="88"
            className="fill-none stroke-tree/10"
            strokeDasharray="2 7"
          />
          <circle cx="308" cy="100" r="13" className="fill-warning/35" />
          <path
            d="M82 137v8m-4-4h8 M325 198v6m-3-3h6 M132 85v6m-3-3h6"
            className="stroke-tree/40"
            strokeLinecap="round"
          />
          <ellipse cx="210" cy="277" rx="77" ry="8" className="fill-tree/10" />
          <path
            d="M128 275Q210 265 292 275"
            className="fill-none stroke-tree/30"
            strokeWidth="1.5"
          />
          {leaves === 0 ? (
            <g>
              <path
                d="M210 273Q215 251 208 239"
                className="fill-none stroke-tree"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <ellipse cx="211" cy="274" rx="8" ry="4" className="fill-tree" />
              <path d="M208 240Q186 219 199 216Q219 215 208 240" className="fill-accent" />
            </g>
          ) : (
            <>
              <path
                d={`M198 274 Q208 249 204 ${crownTop + 22} Q211 ${crownTop - 2} 212 ${crownTop - 24} Q218 ${crownTop + 40} 216 246 L226 274 Q211 269 198 274Z`}
                className="fill-tree"
              />
              <path
                d={`M210 263Q213 223 211 ${crownTop}`}
                className="fill-none stroke-canvas/25"
                strokeWidth="1.5"
              />
              {Array.from({ length: branchCount }, (_, index) => {
                const side = index % 2 === 0 ? -1 : 1;
                const tier = Math.floor(index / 2);
                const y = 236 - tier * 30;
                const reach = 95 - tier * 7;
                const count = Math.min(10, leaves - index * 10);
                const extent = count === 10 ? 1 : 0.35 + Math.floor((count - 1) / 2) * 0.15;
                const endX = 210 + side * reach * (1.2 * extent - 0.2 * extent * extent);
                const endY = y - 48 * extent - 21 * extent * extent;
                return (
                  <g key={index} data-tree-branch="true">
                    <path
                      d={`M210 ${y} Q${210 + side * reach * 0.6 * extent} ${y - 24 * extent} ${endX} ${endY}`}
                      className="fill-none stroke-tree"
                      strokeWidth={count === 10 ? 4 : 2.5}
                      strokeLinecap="round"
                    />
                    {Array.from({ length: count }, (_, leafIndex) => {
                      const t = 0.3 + Math.floor(leafIndex / 2) * 0.15;
                      const x = 210 + side * reach * (1.2 * t - 0.2 * t * t);
                      const ly = y - 48 * t - 21 * t * t;
                      const angle = side * (leafIndex % 2 === 0 ? 8 : 104);
                      return (
                        <g
                          transform={`translate(${x} ${ly}) rotate(${angle})`}
                          key={leafIndex}
                          data-tree-leaf="true"
                        >
                          <path d="M0 0L0 -6" className="stroke-tree" strokeWidth="1.2" />
                          <path
                            d="M0 -5C-18 -14 -17 -30 0 -36C16 -25 14 -12 0 -5Z"
                            className={cn(
                              leafIndex % 3 === 0
                                ? "fill-accent-strong"
                                : leafIndex % 3 === 1
                                  ? "fill-accent"
                                  : "fill-warning",
                            )}
                          />
                          <path
                            d="M0 -7V-29M0 -18L-6 -23M0 -13L5 -18"
                            className="stroke-canvas/55"
                            fill="none"
                            strokeWidth="1"
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
              <path
                d={`M212 ${crownTop - 21}Q199 ${crownTop - 33} 211 ${crownTop - 42}Q224 ${crownTop - 31} 212 ${crownTop - 21}`}
                className="fill-tree/50"
              />
            </>
          )}
          <path
            d="M159 273q-2-9-8-11m108 12q3-12 10-15"
            className="fill-none stroke-tree/40"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p className="px-4 pb-4 text-center text-xs text-ink-muted">
          {archivedTrees
            ? `${archivedTrees} cây trọn vẹn trong vườn · Cây ${archivedTrees + 1}: ${leaves}/100 lá`
            : "Những điều lớn lao bắt đầu từ một chiếc lá."}
        </p>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Leaf className="size-4 text-tree" />
          <span className="font-display text-2xl font-semibold tabular-nums">
            {progress.completedSessions}
          </span>
          <span className="text-xs text-ink-muted">lá đã gieo</span>
        </div>
        <span className="text-xs text-ink-muted">
          <strong className="text-ink tabular-nums">{progress.completedBranches}</strong> cành hoàn
          chỉnh
        </span>
      </div>
      <div className="mb-2 mt-4 flex flex-wrap justify-between gap-2 text-xs text-ink-muted">
        <span>{progress.leavesOnGrowingBranch}/10 buổi đến cành tiếp theo</span>
        <span>
          Còn <strong className="text-ink">{progress.sessionsUntilNextBranch} buổi</strong>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Tiến độ tới cành tiếp theo"
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={progress.leavesOnGrowingBranch}
        className="h-1.5 overflow-hidden rounded-full bg-surface-raised"
      >
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${progress.leavesOnGrowingBranch * 10}%` }}
        />
      </div>
      <ol
        aria-label="Các mốc trưởng thành"
        className="mt-5 grid grid-cols-4 gap-1 border-t border-line pt-4"
      >
        {[
          { at: 1, label: "Nảy mầm" },
          { at: 10, label: "Cây non" },
          { at: 30, label: "Vươn cành" },
          { at: 50, label: "Vững vàng" },
        ].map((milestone) => (
          <li key={milestone.at} className="text-center">
            <span
              className={cn(
                "mx-auto mb-2 grid size-6 place-items-center rounded-full text-xs",
                progress.completedSessions >= milestone.at
                  ? "bg-accent/20 text-ink"
                  : "bg-surface-raised text-ink-muted",
              )}
            >
              {progress.completedSessions >= milestone.at ? (
                <Check className="size-3.5" />
              ) : (
                milestone.at
              )}
            </span>
            <span className="text-[0.65rem] text-ink-muted">{milestone.label}</span>
            <span className="sr-only">
              {milestone.at} buổi
              {progress.completedSessions >= milestone.at ? ", đã đạt" : ", chưa đạt"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
