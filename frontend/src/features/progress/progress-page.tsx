import { useState } from "react";
import { Button } from "@mach/ui";
import {
  PageHeading,
  EmptyState,
  LinkButton,
  Badge,
  Modal,
  Pagination,
} from "../../components/page-ui";
import { usePagination } from "../../lib/use-pagination";
import { StudyTree } from "../../components/study-tree";
import { useDemo } from "../demo/context";
import { calculateStreak, dateKey, formatDate, shiftDate } from "../../lib/dates";
import { cn } from "../../lib/cn";

export function ProgressPage() {
  const { data } = useDemo();
  const [range, setRange] = useState(7);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSessions, setPreviewSessions] = useState(30);
  const { pageItems, page, pageCount, setPage } = usePagination(data.attempts.slice().reverse());
  const dates = [...data.notes.map((n) => n.date), ...data.attempts.map((a) => a.date)];
  const days = Array.from({ length: range }, (_, i) =>
    dateKey(shiftDate(new Date(), i - range + 1)),
  );
  const activeDays = days.filter((d) => dates.includes(d)).length;
  const mean = data.attempts.length
    ? Math.round(data.attempts.reduce((sum, a) => sum + a.score, 0) / data.attempts.length)
    : null;
  return (
    <>
      <PageHeading
        eyebrow="Tiến độ cá nhân"
        title="Nhìn lại để đi xa hơn."
        description="Không cần giỏi hơn ai khác. Chỉ cần nhận ra mình đã tiến bộ từng ngày như thế nào."
        action={
          <div className="inline-flex gap-1 rounded-full border border-line bg-surface p-1">
            {[7, 30].map((value) => (
              <Button
                key={value}
                variant={range === value ? "primary" : "ghost"}
                aria-pressed={range === value}
                onClick={() => setRange(value)}
              >
                {value} ngày
              </Button>
            ))}
          </div>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="panel p-6">
            <div className="grid grid-cols-3 gap-3 divide-x divide-line">
              {[
                { label: "Ngày có học", value: `${activeDays}/${range}` },
                { label: "Bài đã làm", value: data.attempts.length },
                { label: "Điểm TB mọi bài", value: mean === null ? "—" : `${mean}%` },
              ].map((item) => (
                <div className="px-2 first:pl-0" key={item.label}>
                  <p className="text-xs leading-5 text-ink-muted">{item.label}</p>
                  <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <h2 className="mb-4 mt-8 font-display text-2xl font-semibold">Dấu chân học tập</h2>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => (
                <div
                  key={day}
                  title={`${formatDate(day)}: ${dates.filter((d) => d === day).length} buổi`}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center rounded-xl border text-xs",
                    dates.includes(day) ? "border-accent/30 bg-accent/15" : "border-line bg-canvas",
                  )}
                >
                  <span className="tabular-nums">{Number(day.slice(-2))}</span>
                  <span className="mt-1 text-[0.6rem] text-ink-muted">
                    {dates.filter((d) => d === day).length} buổi
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              {formatDate(days[0] ?? dateKey())} – {formatDate(dateKey())} · Theo ngày trên thiết bị
            </p>
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">Lịch sử bài luyện</h2>
              <Badge>{data.attempts.length} bài</Badge>
            </div>
            {data.attempts.length === 0 ? (
              <EmptyState
                title="Kết quả đầu tiên đang chờ bạn"
                description="Hoàn thành một bài luyện để xem điểm và đọc lại phần giải thích tại đây."
                action={<LinkButton to="/practice">Chọn bài luyện</LinkButton>}
              />
            ) : (
              <div className="panel divide-y divide-line">
                {pageItems.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-5"
                  >
                    <div>
                      <h3 className="text-sm font-semibold">{attempt.title}</h3>
                      <p className="mt-1 text-xs text-ink-muted">{formatDate(attempt.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <strong className="tabular-nums">{attempt.score}%</strong>
                      <LinkButton to={`/results/${attempt.id}`} secondary>
                        Xem lại
                      </LinkButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </section>
        </div>
        <article className="panel p-6">
          <p className="eyebrow">Tích lũy, không đặt lại</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Khu vườn tri thức</h2>
          <StudyTree completedSessions={dates.length} streakDays={calculateStreak(dates)} />
          <p className="mt-5 text-xs leading-6 text-ink-muted">
            Bỏ lỡ một ngày có thể ngắt streak, nhưng không làm mất lá đã tích lũy. Cứ trở lại, cây
            vẫn ở đây.
          </p>
          <Button variant="secondary" className="mt-5 w-full" onClick={() => setPreviewOpen(true)}>
            Xem các mốc trưởng thành
          </Button>
        </article>
      </div>
      <Modal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Cây sẽ lớn lên như thế nào?"
        description="Đây là bản xem trước các mốc, không thay đổi số buổi hoặc streak của bạn."
      >
        <label className="field-label" htmlFor="tree-milestone">
          Mốc buổi học
        </label>
        <select
          id="tree-milestone"
          className="field"
          value={previewSessions}
          onChange={(event) => setPreviewSessions(Number(event.target.value))}
        >
          {[0, 1, 10, 30, 50, 100, 101].map((value) => (
            <option value={value} key={value}>
              {value} buổi học
            </option>
          ))}
        </select>
        <StudyTree completedSessions={previewSessions} />
      </Modal>
    </>
  );
}
