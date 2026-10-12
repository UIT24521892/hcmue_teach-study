import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { z } from "zod";
import { ArrowRight, Check, Clock3, GraduationCap, X } from "lucide-react";
import { Button } from "@mach/ui";
import { Badge, EmptyState, LinkButton, PageHeading } from "../../components/page-ui";
import { cn } from "../../lib/cn";
import { dateKey } from "../../lib/dates";
import { useAuth } from "../auth/auth-context";
import { useEffectiveRole } from "../auth/use-effective-role";
import { useDemo } from "../demo/context";
import { QuizLibrary } from "../quizzes/quiz-library";
import { quizzes, scoreQuiz, type Quiz } from "../demo/fixtures";

export function PracticePage() {
  const [filter, setFilter] = useState("Tất cả");
  const { data } = useDemo();
  const auth = useAuth();
  const role = useEffectiveRole();
  const canAuthorQuizzes = auth.status === "authenticated" && role !== "student";
  return (
    <>
      <PageHeading
        eyebrow="Phòng luyện tập"
        title="Học một chút. Tiến một bước."
        description="Chọn một chủ đề vừa sức, dành một khoảng thời gian tập trung và học từ từng câu trả lời."
      />
      {canAuthorQuizzes && <QuizLibrary />}
      {canAuthorQuizzes && (
        <h2 className="mb-4 font-display text-2xl font-semibold">Bài luyện mẫu trên thiết bị</h2>
      )}
      <div className="mb-6 flex flex-wrap gap-2" aria-label="Lọc bài luyện">
        {["Tất cả", "Reading", "Vocabulary"].map((category) => (
          <Button
            key={category}
            variant={filter === category ? "primary" : "secondary"}
            aria-pressed={filter === category}
            onClick={() => setFilter(category)}
          >
            {category}
          </Button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {quizzes
          .filter((quiz) => filter === "Tất cả" || quiz.category === filter)
          .map((quiz, index) => (
            <article key={quiz.id} className="panel flex flex-col overflow-hidden">
              <div className="relative flex h-36 items-center justify-between border-b border-line bg-accent/5 px-7">
                <span className="font-display text-6xl text-tree/40">0{index + 1}</span>
                <GraduationCap className="size-16 text-tree/60" strokeWidth={1} />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge>{quiz.category}</Badge>
                  <Badge>{quiz.level}</Badge>
                  {data.attempts.some((a) => a.quizId === quiz.id) && (
                    <Badge tone="blue">
                      <Check className="size-3" />
                      Đã luyện
                    </Badge>
                  )}
                </div>
                <h2 className="font-display text-2xl font-semibold">{quiz.title}</h2>
                <p className="mb-6 mt-3 flex-1 text-sm leading-6 text-ink-muted">
                  {quiz.description}
                </p>
                <div className="mb-6 flex items-center gap-3 text-xs text-ink-muted">
                  <Clock3 className="size-4" />
                  {quiz.minutes} phút<span>·</span>
                  {quiz.questions.length} câu hỏi
                </div>
                <LinkButton to={`/practice/${quiz.id}`} className="justify-between">
                  Bắt đầu luyện tập
                  <ArrowRight className="size-4" />
                </LinkButton>
              </div>
            </article>
          ))}
      </div>
      <p className="mt-6 text-xs leading-6 text-ink-muted">
        Bộ câu hỏi biên soạn sẵn để thử UI. Chấm điểm demo chạy trên trình duyệt, không phải điểm
        thi chính thức.
      </p>
    </>
  );
}

const draftSchema = z.object({
  id: z.string(),
  answers: z.record(z.string()),
  deadline: z.number().finite().positive(),
});
type Draft = z.infer<typeof draftSchema>;
function readDraft(quiz: Quiz): Draft {
  try {
    const saved = localStorage.getItem(`mach-quiz-${quiz.id}`);
    if (saved) return draftSchema.parse(JSON.parse(saved));
  } catch {
    /* Invalid draft starts a new local attempt. */
  }
  return { id: crypto.randomUUID(), answers: {}, deadline: Date.now() + quiz.minutes * 60_000 };
}

function QuizRoom({ quiz }: { quiz: Quiz }) {
  const { data, update } = useDemo();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => readDraft(quiz));
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [confirm, setConfirm] = useState(false);
  const [saveError, setSaveError] = useState("");
  const remaining = Math.max(0, Math.ceil((draft.deadline - now) / 1000));
  const expired = remaining === 0;
  const answered = quiz.questions.filter((question) => draft.answers[question.id]?.trim()).length;
  const question = quiz.questions[current];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(`mach-quiz-${quiz.id}`, JSON.stringify(draft));
      setSaveError("");
    } catch {
      setSaveError("Không lưu được bản nháp. Giữ trang này mở để tránh mất câu trả lời.");
    }
  }, [draft, quiz.id]);
  useEffect(() => {
    const existing = data.attempts.find((attempt) => attempt.id === draft.id);
    if (existing) navigate(`/results/${existing.id}`, { replace: true });
  }, [data.attempts, draft.id, navigate]);

  function submit() {
    if (!data.attempts.some((attempt) => attempt.id === draft.id))
      update((value) => ({
        ...value,
        attempts: [
          ...value.attempts,
          {
            id: draft.id,
            quizId: quiz.id,
            title: quiz.title,
            score: scoreQuiz(quiz, draft.answers),
            answers: { ...draft.answers },
            date: dateKey(),
          },
        ],
      }));
    try {
      localStorage.removeItem(`mach-quiz-${quiz.id}`);
    } catch {
      /* Submitted id is also checked before entering the room. */
    }
    navigate(`/results/${draft.id}`, { replace: true });
  }
  if (!question) return null;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/practice" className="focus-ring min-h-11 rounded-lg py-3 text-sm text-ink-muted">
          ← Danh sách bài luyện
        </Link>
        <div
          role="timer"
          aria-label="Thời gian còn lại"
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2.5 font-semibold tabular-nums",
            remaining < 60 ? "border-accent bg-accent/10" : "border-line bg-surface",
          )}
        >
          <Clock3 className="size-4" />
          {Math.floor(remaining / 60)
            .toString()
            .padStart(2, "0")}
          :{(remaining % 60).toString().padStart(2, "0")}
        </div>
      </div>
      <PageHeading
        eyebrow={`${quiz.category} · ${quiz.level} · Bài luyện demo`}
        title={quiz.title}
        description="Tập trung vào một câu hỏi mỗi lần. Câu trả lời được lưu tự động trên thiết bị."
      />
      {saveError && (
        <p role="alert" className="mb-4 rounded-xl border border-accent p-4 text-sm">
          {saveError}
        </p>
      )}
      {expired && (
        <div role="alert" className="mb-5 rounded-2xl border border-accent bg-accent/10 p-5">
          <p className="font-semibold">Đã hết thời gian làm bài.</p>
          <p className="mb-4 mt-2 text-sm">
            Câu trả lời đã được khóa. Nộp bài để xem kết quả demo.
          </p>
          <Button onClick={submit}>Nộp bài hết giờ</Button>
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <section className="panel p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Badge>
              Câu {current + 1}/{quiz.questions.length}
            </Badge>
            <span className="text-xs text-ink-muted">
              {question.type === "fill"
                ? "Điền từ"
                : question.type === "boolean"
                  ? "Đúng / Sai"
                  : "Trắc nghiệm"}
            </span>
          </div>
          <fieldset disabled={expired}>
            <legend className="mb-7 text-xl font-semibold leading-8" lang="en">
              {question.prompt}
            </legend>
            {question.type === "fill" ? (
              <label className="block">
                <span className="field-label">Câu trả lời của bạn</span>
                <input
                  lang="en"
                  className="field"
                  value={draft.answers[question.id] ?? ""}
                  maxLength={200}
                  autoComplete="off"
                  onChange={(event) => {
                    if (Date.now() >= draft.deadline) {
                      setNow(Date.now());
                      return;
                    }
                    setDraft((value) => ({
                      ...value,
                      answers: { ...value.answers, [question.id]: event.target.value },
                    }));
                  }}
                  placeholder="Nhập từ còn thiếu…"
                />
              </label>
            ) : (
              <div className="space-y-3">
                {question.options.map((option, i) => (
                  <label
                    key={option}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm leading-6",
                      draft.answers[question.id] === option
                        ? "border-accent bg-accent/10"
                        : "border-line hover:bg-surface-raised",
                    )}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={draft.answers[question.id] === option}
                      onChange={() => {
                        if (Date.now() >= draft.deadline) {
                          setNow(Date.now());
                          return;
                        }
                        setDraft((value) => ({
                          ...value,
                          answers: { ...value.answers, [question.id]: option },
                        }));
                      }}
                    />
                    <span className="font-semibold text-ink-muted">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span lang="en">{option}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
            <Button
              variant="secondary"
              disabled={current === 0}
              onClick={() => setCurrent((value) => value - 1)}
            >
              Câu trước
            </Button>
            {current < quiz.questions.length - 1 ? (
              <Button onClick={() => setCurrent((value) => value + 1)}>
                Câu tiếp
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => setConfirm(true)}>Nộp bài</Button>
            )}
          </div>
        </section>
        <aside className="panel p-5">
          <h2 className="font-display text-xl font-semibold">Bản đồ câu hỏi</h2>
          <p className="mt-2 text-xs text-ink-muted">
            Đã trả lời {answered}/{quiz.questions.length} câu
          </p>
          <div className="my-5 grid grid-cols-5 gap-2">
            {quiz.questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrent(index)}
                aria-label={`Đến câu ${index + 1}${draft.answers[q.id]?.trim() ? ", đã trả lời" : ", chưa trả lời"}`}
                aria-current={index === current ? "step" : undefined}
                className={cn(
                  "focus-ring min-h-11 rounded-xl border text-sm tabular-nums",
                  current === index
                    ? "border-ink bg-ink text-canvas"
                    : draft.answers[q.id]?.trim()
                      ? "border-accent bg-accent/15"
                      : "border-line",
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <p className="mb-5 text-xs leading-5 text-ink-muted">
            Bạn có thể rời trang và quay lại. Đồng hồ vẫn tiếp tục chạy trong lúc vắng mặt.
          </p>
          <Button onClick={() => setConfirm(true)} variant="secondary" className="w-full">
            Nộp bài
          </Button>
        </aside>
      </div>
      <AlertDialog.Root open={confirm} onOpenChange={setConfirm}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
          <AlertDialog.Content className="dialog-panel">
            <AlertDialog.Title className="font-display text-2xl font-semibold">
              Sẵn sàng xem kết quả?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm leading-6 text-ink-muted">
              Bạn đã trả lời {answered}/{quiz.questions.length} câu.{" "}
              {answered < quiz.questions.length ? "Câu chưa trả lời sẽ được tính là sai. " : ""}Sau
              khi nộp, bạn có thể xem đáp án và giải thích.
            </AlertDialog.Description>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Tiếp tục làm</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button onClick={submit}>Xác nhận nộp bài</Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

export function QuizPage() {
  const { quizId } = useParams();
  const quiz = quizzes.find((item) => item.id === quizId);
  return quiz ? (
    <QuizRoom key={quiz.id} quiz={quiz} />
  ) : (
    <EmptyState
      title="Không tìm thấy bài luyện"
      description="Bài luyện không có trong thư viện mẫu hiện tại."
      action={<LinkButton to="/practice">Về phòng luyện tập</LinkButton>}
    />
  );
}

export function ResultPage() {
  const { attemptId } = useParams();
  const { data } = useDemo();
  const attempt = data.attempts.find((item) => item.id === attemptId);
  const quiz = quizzes.find((item) => item.id === attempt?.quizId);
  if (!attempt || !quiz)
    return (
      <EmptyState
        title="Chưa có kết quả này"
        description="Kết quả demo chỉ có trên trình duyệt đã hoàn thành bài luyện."
        action={<LinkButton to="/practice">Chọn bài luyện</LinkButton>}
      />
    );
  return (
    <>
      <PageHeading
        eyebrow="Nhìn lại buổi học"
        title="Thêm một chiếc lá. Thêm một bước tiến."
        description={`Bạn vừa hoàn thành ${attempt.title}. Dành thêm một phút để học từ các câu trả lời nhé.`}
        action={<LinkButton to="/notes">Ghi lại điều đã học</LinkButton>}
      />
      <section className="panel mb-6 flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
        <div className="flex items-center gap-5">
          <span className="font-display text-5xl font-semibold tabular-nums">
            {attempt.score}
            <span className="text-2xl text-ink-muted">%</span>
          </span>
          <div>
            <p className="font-semibold">Kết quả luyện tập demo</p>
            <p className="mt-2 text-xs text-ink-muted">Đã thêm 1 lá vào cây tri thức</p>
          </div>
        </div>
        <LinkButton to={`/practice/${quiz.id}`} secondary>
          Luyện lại
        </LinkButton>
      </section>
      <section className="space-y-4" aria-label="Đáp án và giải thích">
        {quiz.questions.map((question, index) => {
          const correct =
            attempt.answers[question.id]?.trim().toLocaleLowerCase() ===
            question.answer.toLocaleLowerCase();
          return (
            <article key={question.id} className="panel p-5 sm:p-7">
              <div className="mb-4 flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full",
                    correct ? "bg-focus/10 text-focus" : "bg-accent/15 text-ink",
                  )}
                >
                  {correct ? <Check className="size-4" /> : <X className="size-4" />}
                </span>
                <p className="text-xs font-semibold">
                  Câu {index + 1} · {correct ? "Chính xác" : "Cần xem lại"}
                </p>
              </div>
              <h2 className="text-base font-semibold leading-7" lang="en">
                {question.prompt}
              </h2>
              <dl className="my-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-muted">Bạn trả lời</dt>
                  <dd className="mt-1 break-words">
                    {attempt.answers[question.id] || "Chưa trả lời"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Đáp án</dt>
                  <dd className="mt-1 font-semibold">{question.answer}</dd>
                </div>
              </dl>
              <p className="rounded-xl bg-canvas p-4 text-sm leading-7 text-ink-muted">
                <strong className="text-ink">Vì sao? </strong>
                {question.explanation}
              </p>
            </article>
          );
        })}
      </section>
    </>
  );
}
