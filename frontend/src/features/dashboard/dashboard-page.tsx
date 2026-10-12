import { BookOpenText, FileUp, Flame, GraduationCap, ArrowUpRight, Sprout } from "lucide-react";
import { Link } from "react-router-dom";
import { StudyTree } from "../../components/study-tree";
import { Badge, LinkButton, TextLink } from "../../components/page-ui";
import { useDemo } from "../demo/context";
import { useEffectiveRole } from "../auth/use-effective-role";
import { calculateStreak, dateKey, shiftDate } from "../../lib/dates";
import { quizzes } from "../demo/fixtures";

export function DashboardPage() {
  const { data } = useDemo();
  const role = useEffectiveRole();
  const dates = [...data.notes.map((n) => n.date), ...data.attempts.map((a) => a.date)];
  const streak = calculateStreak(dates);
  const sessions = data.notes.length + data.attempts.length;
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(new Date(), i - 6));
  const average = data.attempts.length
    ? `${Math.round(data.attempts.reduce((sum, a) => sum + a.score, 0) / data.attempts.length)}%`
    : "—";
  return (
    <>
      <section className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3">
            {new Date().toLocaleDateString("vi-VN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="page-title">
            Giữ nhịp học,
            <br />
            <span className="text-accent-strong">gieo tiến bộ.</span>
          </h1>
          <p className="mt-4 text-sm leading-6 text-ink-muted">
            Chào {data.name}. Dành một chút thời gian cho tiếng Anh hôm nay.
            <br className="hidden sm:block" /> Mỗi bước nhỏ đều đang làm nên một thay đổi lớn.
          </p>
        </div>
        <LinkButton to={role === "student" ? "/practice" : "/documents?upload=1"}>
          {role === "student" ? (
            <GraduationCap className="size-4" />
          ) : (
            <FileUp className="size-4" />
          )}
          {role === "student" ? "Bắt đầu luyện tập" : "Tải tài liệu mới"}
        </LinkButton>
      </section>
      <section aria-label="Chỉ số học tập" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Bài đã hoàn thành",
            value: data.attempts.length,
            note: "Luyện tập theo nhịp của bạn",
            icon: GraduationCap,
            to: "/practice",
          },
          {
            label: "Điểm trung bình",
            value: average,
            note: data.attempts.length ? "Từ các bài luyện đã nộp" : "Bắt đầu bài đầu tiên nhé",
            icon: ArrowUpRight,
            to: "/progress",
          },
          {
            label: "Chuỗi ngày học",
            value: `${streak} ngày`,
            note: "Một ngày học, một nhịp tiến bộ",
            icon: Flame,
            to: "/notes",
          },
          {
            label: "Tài liệu",
            value: data.documents.length,
            note: "Kho kiến thức của bạn",
            icon: BookOpenText,
            to: "/documents",
          },
        ].map((metric) => (
          <Link
            className="panel focus-ring p-4 hover:border-ink/30 sm:p-5"
            to={metric.to}
            key={metric.label}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-ink-muted">{metric.label}</p>
              <metric.icon className="size-4 shrink-0 text-tree" />
            </div>
            <p className="font-display text-3xl font-semibold tabular-nums">{metric.value}</p>
            <p className="mt-2 text-xs leading-5 text-ink-muted">{metric.note}</p>
          </Link>
        ))}
      </section>
      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <article className="panel overflow-hidden p-6 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Một chút mỗi ngày</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">Buổi học tiếp theo</h2>
              </div>
              <Badge tone="accent">10 phút</Badge>
            </div>
            <div className="my-6 flex items-center gap-5">
              <div className="hidden size-24 shrink-0 place-items-center rounded-2xl bg-accent/10 sm:grid">
                <BookOpenText className="size-10 text-tree" strokeWidth={1.2} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-muted">READING · A2–B1</p>
                <h3 className="font-display text-2xl font-semibold">Small habits, big changes</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">
                  Khám phá sức mạnh của thói quen qua một bài đọc ngắn.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <span className="text-xs text-ink-muted">5 câu hỏi · Có giải thích đáp án</span>
              <LinkButton to="/practice/small-habits">
                Vào học
                <ArrowUpRight className="size-4" />
              </LinkButton>
            </div>
          </article>
          <article className="panel p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow">7 ngày gần nhất</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">Nhịp học của bạn</h2>
              </div>
              <TextLink to="/progress">Chi tiết</TextLink>
            </div>
            <div className="mt-7 grid grid-cols-7 gap-3" aria-label="Số buổi học bảy ngày gần nhất">
              {week.map((day) => {
                const key = dateKey(day);
                const count = dates.filter((d) => d === key).length;
                return (
                  <div key={key} className="text-center">
                    <div className="flex h-24 flex-col justify-end">
                      <span className="mb-2 text-xs font-semibold tabular-nums">{count}</span>
                      <div
                        className="mx-auto w-full max-w-8 rounded-t-lg bg-accent/75"
                        style={{ height: `${Math.min(64, count * 20 + 4)}px` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">
                      {day.toLocaleDateString("vi-VN", { weekday: "short" })}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-ink-muted">
              Một ghi chú trong ngày hoặc một bài luyện đã nộp được tính là một buổi học trong bản
              demo.
            </p>
          </article>
        </div>
        <article className="panel min-w-0 p-6 sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Khu vườn của bạn</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">Cây tri thức</h2>
            </div>
            <Sprout className="size-6 text-tree" strokeWidth={1.5} />
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Mỗi buổi một lá. Mỗi 10 buổi một cành mới.
          </p>
          <StudyTree completedSessions={sessions} streakDays={streak} />
          <div className="mt-5 flex justify-center border-t border-line pt-2">
            <TextLink to="/notes">Chăm cây bằng một ghi chú</TextLink>
          </div>
        </article>
      </section>
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Một nhịp học mới</h2>
          <TextLink to="/practice">Xem tất cả</TextLink>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {quizzes.map((quiz, i) => (
            <Link
              className="panel focus-ring flex items-center gap-4 p-5 hover:border-ink/30"
              to={`/practice/${quiz.id}`}
              key={quiz.id}
            >
              <span className="font-display text-3xl text-tree/60">0{i + 1}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{quiz.title}</h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {quiz.category} · {quiz.level} · {quiz.minutes} phút
                </p>
              </div>
              <ArrowUpRight className="size-5 shrink-0 text-ink-muted" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
