import {
  ArrowUpRight,
  FileUp,
  Flame,
  GraduationCap,
  Leaf,
  NotebookPen,
  RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@mach/ui";

import { LinkButton, TextLink } from "../../components/page-ui";
import { getStudyTreeProgress } from "../../components/study-tree-progress";
import { cn } from "../../lib/cn";
import { parseDate } from "../../lib/dates";
import { useAuth } from "../auth/auth-context";
import { useEffectiveRole } from "../auth/use-effective-role";
import { useDemo } from "../demo/context";
import { quizzes } from "../demo/fixtures";
import { useStudyProgress } from "../notes/use-study-progress";
import { GardenScene } from "./garden-scene";
import { LessonIllustration } from "./illustrations";
import { useWeekActivity } from "./use-week-activity";

export function DashboardPage() {
  const { data } = useDemo();
  const auth = useAuth();
  const role = useEffectiveRole();
  const progressState = useStudyProgress();
  const { progress } = progressState;
  const weekState = useWeekActivity(progress);
  const name = auth.user?.name ?? data.name;
  const todayLabel = (progress ? parseDate(progress.today) : new Date()).toLocaleDateString(
    "vi-VN",
    { weekday: "long", day: "numeric", month: "long" },
  );

  return (
    <>
      <section
        aria-labelledby="dashboard-title"
        className="relative isolate grid animate-fade-up overflow-hidden rounded-panel border border-line/80 bg-gradient-to-br from-accent/10 via-surface to-surface shadow-panel lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
      >
        <div className="relative z-10 flex flex-col p-6 sm:p-10">
          <p className="eyebrow mb-4 first-letter:uppercase">{todayLabel}</p>
          <h1
            id="dashboard-title"
            className="font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl"
          >
            Giữ nhịp học,
            <br />
            <span className="text-accent-strong">gieo tiến bộ.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-ink-muted sm:text-base sm:leading-7">
            Chào {name}. Mỗi buổi học là một chiếc lá mới trên cây của bạn, chậm thôi nhưng đừng
            dừng lại.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton to={role === "student" ? "/practice" : "/documents?upload=1"}>
              {role === "student" ? (
                <GraduationCap className="size-4" aria-hidden="true" />
              ) : (
                <FileUp className="size-4" aria-hidden="true" />
              )}
              {role === "student" ? "Bắt đầu luyện tập" : "Tải tài liệu mới"}
            </LinkButton>
            <LinkButton to="/notes" secondary>
              <NotebookPen className="size-4" aria-hidden="true" />
              Ghi chú hôm nay
            </LinkButton>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-line/80 pt-6">
            <HeroStat
              label="Chuỗi ngày"
              value={progress?.streakDays}
              icon={<Flame className="size-4 text-accent-strong" aria-hidden="true" />}
            />
            <HeroStat
              label="Lá đã gieo"
              value={progress?.completedSessions}
              icon={<Leaf className="size-4 text-tree" aria-hidden="true" />}
            />
            <HeroStat
              label="Bài đã nộp"
              value={weekState.activity?.submittedTotal}
              icon={<GraduationCap className="size-4 text-tree" aria-hidden="true" />}
            />
          </dl>
          {progressState.error ? (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <p>{progressState.error}</p>
              <Button variant="secondary" onClick={progressState.reload}>
                <RotateCcw className="size-4" aria-hidden="true" /> Thử lại
              </Button>
            </div>
          ) : null}
        </div>
        <div className="relative -mt-4 self-end lg:mt-0">
          <GardenScene
            completedSessions={progress?.completedSessions ?? null}
            streakDays={progress?.streakDays ?? null}
          />
          <Link
            to="/progress"
            className="focus-ring absolute left-4 top-4 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-semibold shadow-panel transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
          >
            Cây tri thức
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <TodayLessons />
        <WeekRhythm
          state={weekState}
          completedSessions={progress?.completedSessions ?? null}
          today={progress?.today ?? null}
        />
      </div>
    </>
  );
}

function HeroStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | undefined;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1.5 font-display text-3xl font-semibold tabular-nums">
        {value === undefined ? "—" : value}
      </dd>
    </div>
  );
}

function TodayLessons() {
  const [featured, ...others] = quizzes;
  if (!featured) return null;
  return (
    <article className="panel p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Một chút mỗi ngày</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Hôm nay học gì?</h2>
        </div>
        <TextLink to="/practice">Tất cả bài luyện</TextLink>
      </div>
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="w-24 shrink-0 sm:w-28">
          <LessonIllustration />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {featured.category} · {featured.level} · {featured.minutes} phút
          </p>
          <h3 className="mt-1.5 font-display text-2xl font-semibold">{featured.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{featured.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <LinkButton to={`/practice/${featured.id}`}>
              Vào học
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </LinkButton>
            <span className="text-xs text-ink-muted">
              {featured.questions.length} câu hỏi · Có giải thích đáp án
            </span>
          </div>
        </div>
      </div>
      {others.length ? (
        <ul className="mt-6 divide-y divide-line border-t border-line" aria-label="Bài luyện khác">
          {others.map((quiz) => (
            <li key={quiz.id}>
              <Link
                to={`/practice/${quiz.id}`}
                className="focus-ring group -mx-2 flex items-center gap-4 rounded-xl px-2 py-4 hover:bg-surface-raised/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{quiz.title}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {quiz.category} · {quiz.level} · {quiz.minutes} phút
                  </p>
                </div>
                <ArrowUpRight
                  className="size-4 shrink-0 text-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function WeekRhythm({
  state,
  completedSessions,
  today,
}: {
  state: ReturnType<typeof useWeekActivity>;
  completedSessions: number | null;
  today: string | null;
}) {
  const growth = getStudyTreeProgress(completedSessions ?? 0);
  const activeCount = state.activity
    ? state.week.filter((day) => state.activity?.activeDays.has(day)).length
    : 0;
  const studiedToday = Boolean(today && state.activity?.activeDays.has(today));
  return (
    <article className="panel p-6 sm:p-7">
      <p className="eyebrow">7 ngày gần nhất</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Nhịp học tuần này</h2>
      {state.error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-sm"
        >
          <p>{state.error}</p>
          <Button variant="secondary" className="mt-3" onClick={state.reload}>
            <RotateCcw className="size-4" aria-hidden="true" /> Thử lại
          </Button>
        </div>
      ) : !state.activity ? (
        <div
          role="status"
          aria-label="Đang tải nhịp học tuần này"
          className="mt-5 h-36 animate-pulse rounded-2xl bg-surface-raised motion-reduce:animate-none"
        />
      ) : (
        <>
          <ol className="mt-6 grid grid-cols-7 gap-1" aria-label="Các ngày học trong tuần">
            {state.week.map((day) => {
              const active = state.activity?.activeDays.has(day) ?? false;
              const isToday = day === today;
              const date = parseDate(day);
              return (
                <li key={day} className="flex flex-col items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-9 place-items-center rounded-full sm:size-10",
                      active
                        ? "bg-accent text-accent-ink"
                        : "border border-dashed border-line bg-canvas text-ink-muted/60",
                      isToday && "ring-2 ring-ink/40 ring-offset-2 ring-offset-surface",
                    )}
                  >
                    {active ? <Leaf className="size-4" /> : null}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn("text-xs", isToday ? "font-semibold" : "text-ink-muted")}
                  >
                    {date.toLocaleDateString("vi-VN", { weekday: "short" })}
                  </span>
                  <span className="sr-only">
                    {date.toLocaleDateString("vi-VN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    {isToday ? " (hôm nay)" : ""}: {active ? "có học" : "chưa học"}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 text-sm leading-6">
            <strong className="font-semibold tabular-nums">{activeCount}/7 ngày</strong> có học
            trong tuần.{" "}
            <span className="text-ink-muted">
              {studiedToday
                ? "Hôm nay cây đã có thêm một lá."
                : "Hôm nay vẫn còn chỗ cho một chiếc lá mới."}
            </span>
          </p>
        </>
      )}
      <div className="mt-5 border-t border-line pt-5">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-ink-muted">
          <span>Cành tiếp theo</span>
          <span>
            Còn <strong className="text-ink">{growth.sessionsUntilNextBranch} buổi</strong>
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Tiến độ tới cành tiếp theo"
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={growth.leavesOnGrowingBranch}
          className="h-1.5 overflow-hidden rounded-full bg-surface-raised"
        >
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${growth.leavesOnGrowingBranch * 10}%` }}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <TextLink to="/notes">{studiedToday ? "Xem ghi chú" : "Gieo lá hôm nay"}</TextLink>
        </div>
      </div>
    </article>
  );
}
