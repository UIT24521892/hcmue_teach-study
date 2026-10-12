import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { z } from "zod";
import { ArrowRight, Check, Clock3, CloudOff, LoaderCircle, RotateCcw, X } from "lucide-react";

import type { Attempt, AttemptItem, AttemptSummary } from "@mach/contracts";
import { Button } from "@mach/ui";

import { Badge, EmptyState, LinkButton, PageHeading } from "../../components/page-ui";
import { cn } from "../../lib/cn";
import { ApiError } from "../auth/api-client";
import { useAuth } from "../auth/auth-context";
import { createAttemptsApi } from "./attempts-api";

const typeLabels: Record<AttemptItem["type"], string> = {
  multiple_choice: "Trắc nghiệm",
  fill_blank: "Điền từ",
  true_false: "Đúng / sai",
};

const trueFalseOptions = [
  { value: "true", label: "Đúng" },
  { value: "false", label: "Sai" },
];

function displayAnswer(item: AttemptItem, value: string | null | undefined): string {
  if (!value) return "Chưa trả lời";
  if (item.type === "true_false") return value === "true" ? "Đúng" : "Sai";
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Unsaved answers are mirrored on the device so a short disconnect or a reload
 * does not lose them. The server copy stays authoritative once saved.
 */
const backupSchema = z.object({
  answers: z.record(z.string()),
  dirty: z.array(z.number().int().positive()),
});
type Backup = z.infer<typeof backupSchema>;
const backupKey = (attemptId: string) => `mach-attempt-${attemptId}`;

function readBackup(attemptId: string): Backup | null {
  try {
    const saved = localStorage.getItem(backupKey(attemptId));
    return saved ? backupSchema.parse(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
}

function writeBackup(attemptId: string, backup: Backup): boolean {
  try {
    localStorage.setItem(backupKey(attemptId), JSON.stringify(backup));
    return true;
  } catch {
    return false;
  }
}

function clearBackup(attemptId: string): void {
  try {
    localStorage.removeItem(backupKey(attemptId));
  } catch {
    /* Nothing to clean when storage is unavailable. */
  }
}

type SaveState = "saved" | "pending" | "saving" | "offline" | "error";

function AttemptRoom({
  attempt,
  onFinished,
  onReload,
}: {
  attempt: Attempt;
  onFinished: (attempt: Attempt) => void;
  onReload: () => void;
}) {
  const auth = useAuth();
  const api = useMemo(() => createAttemptsApi(auth.client), [auth.client]);
  const [initial] = useState(() => {
    const backup = readBackup(attempt.id);
    const answers: Record<number, string> = {};
    for (const item of attempt.items) answers[item.position] = item.response ?? "";
    const dirty = new Set<number>();
    for (const position of backup?.dirty ?? []) {
      if (position > attempt.totalCount) continue;
      answers[position] = backup?.answers[String(position)] ?? "";
      dirty.add(position);
    }
    return { answers, dirty };
  });
  const [answers, setAnswers] = useState(initial.answers);
  const [dirty, setDirty] = useState(initial.dirty);
  const [saveState, setSaveState] = useState<SaveState>(
    initial.dirty.size > 0 ? "pending" : "saved",
  );
  const [saveError, setSaveError] = useState("");
  const [backupFailed, setBackupFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [current, setCurrent] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const autoSubmitted = useRef(false);

  // Server time minus device time, so the countdown ignores a wrong device clock.
  const offset = useMemo(() => Date.parse(attempt.serverNow) - Date.now(), [attempt.serverNow]);
  const deadline = attempt.deadlineAt ? Date.parse(attempt.deadlineAt) : null;
  const [now, setNow] = useState(Date.now);
  const remaining =
    deadline === null ? null : Math.max(0, Math.ceil((deadline - (now + offset)) / 1000));
  const expired = remaining === 0;
  const items = attempt.items;
  const item = items[current];
  const answeredCount = items.filter((entry) => answers[entry.position]?.trim()).length;

  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    const stored: Record<string, string> = {};
    for (const [position, value] of Object.entries(answers)) stored[position] = value;
    setBackupFailed(!writeBackup(attempt.id, { answers: stored, dirty: [...dirty] }));
  }, [answers, dirty, attempt.id]);

  useEffect(() => {
    if (dirty.size === 0 || submitting || expired) return;
    let cancelled = false;
    let retry: number | undefined;
    const timer = window.setTimeout(async () => {
      const sent = [...dirty].map((position) => ({
        position,
        response: (answersRef.current[position] ?? "").trim(),
      }));
      setSaveState("saving");
      try {
        await api.save(attempt.id, sent);
        if (cancelled) return;
        setDirty((pending) => {
          const next = new Set(pending);
          for (const answer of sent) {
            // Keep the position pending if it changed while the request flew.
            if ((answersRef.current[answer.position] ?? "").trim() === answer.response) {
              next.delete(answer.position);
            }
          }
          return next;
        });
        setSaveState("saved");
        setSaveError("");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 409) {
          // The server has closed the attempt (time is up or it was submitted).
          onReload();
          return;
        }
        if (error instanceof ApiError) {
          setSaveState("error");
          setSaveError(error.message);
          return;
        }
        setSaveState("offline");
        retry = window.setTimeout(() => setRetryTick((value) => value + 1), 3_000);
      }
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retry !== undefined) window.clearTimeout(retry);
    };
  }, [api, attempt.id, dirty, expired, onReload, retryTick, submitting]);

  const submit = useCallback(async () => {
    setConfirm(false);
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await api.submit(
        attempt.id,
        attempt.items.map((entry) => ({
          position: entry.position,
          response: (answersRef.current[entry.position] ?? "").trim(),
        })),
      );
      clearBackup(attempt.id);
      onFinished(response.attempt);
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [api, attempt.id, attempt.items, onFinished]);

  useEffect(() => {
    if (expired && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit();
    }
  }, [expired, submit]);

  function setAnswer(position: number, value: string) {
    if (expired || submitting) return;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [position]: value }));
    setDirty((pending) => new Set(pending).add(position));
    setSaveState("pending");
  }

  if (!item) return null;
  const choices =
    item.type === "true_false"
      ? trueFalseOptions
      : (item.options ?? []).map((option) => ({ value: option, label: option }));
  const saveLabel: Record<SaveState, string> = {
    saved: "Đã lưu trên máy chủ",
    pending: "Có thay đổi chưa lưu",
    saving: "Đang lưu…",
    offline: "Mất kết nối · đang giữ trên thiết bị và thử lại",
    error: saveError || "Không lưu được câu trả lời",
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/practice" className="focus-ring min-h-11 rounded-lg py-3 text-sm text-ink-muted">
          ← Bài luyện
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <p
            role="status"
            className={cn(
              "flex items-center gap-2 text-xs",
              saveState === "offline" || saveState === "error"
                ? "text-accent-strong"
                : "text-ink-muted",
            )}
          >
            {saveState === "saving" && (
              <LoaderCircle
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            {saveState === "offline" && <CloudOff className="size-3.5" aria-hidden="true" />}
            {saveLabel[saveState]}
          </p>
          {remaining !== null && (
            <div
              role="timer"
              aria-label="Thời gian còn lại"
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2.5 font-semibold tabular-nums",
                remaining < 60 ? "border-accent bg-accent/10" : "border-line bg-surface",
              )}
            >
              <Clock3 className="size-4" aria-hidden="true" />
              {Math.floor(remaining / 60)
                .toString()
                .padStart(2, "0")}
              :{(remaining % 60).toString().padStart(2, "0")}
            </div>
          )}
        </div>
      </div>
      <PageHeading
        eyebrow={`Bài làm · ${attempt.totalCount} câu${remaining === null ? " · không giới hạn giờ" : ""}`}
        title={attempt.quizTitle}
        description="Tập trung vào từng câu. Câu trả lời được lưu lên máy chủ sau mỗi thay đổi; khi mất mạng, Mạch giữ tạm trên thiết bị và tự gửi lại."
      />
      {backupFailed && (
        <p role="alert" className="mb-4 rounded-xl border border-accent p-4 text-sm">
          Trình duyệt không cho lưu tạm trên thiết bị. Giữ kết nối mạng để không mất câu trả lời.
        </p>
      )}
      {(expired || submitError) && (
        <div role="alert" className="mb-5 rounded-2xl border border-accent bg-accent/10 p-5">
          <p className="font-semibold">
            {expired ? "Đã hết thời gian làm bài." : "Chưa nộp được bài."}
          </p>
          <p className="mb-4 mt-2 text-sm">
            {submitError ||
              "Câu trả lời đã được khóa. Mạch đang nộp bài với các câu đã lưu trên máy chủ."}
          </p>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting && (
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            {expired ? "Nộp bài hết giờ" : "Thử nộp lại"}
          </Button>
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <section className="panel p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Badge>
              Câu {current + 1}/{items.length}
            </Badge>
            <span className="text-xs text-ink-muted">{typeLabels[item.type]}</span>
          </div>
          <fieldset disabled={expired || submitting}>
            <legend className="mb-7 text-xl font-semibold leading-8" lang="en">
              {item.prompt}
            </legend>
            {item.type === "fill_blank" ? (
              <label className="block">
                <span className="field-label">Câu trả lời của bạn</span>
                <input
                  lang="en"
                  className="field"
                  value={answers[item.position] ?? ""}
                  maxLength={1_000}
                  autoComplete="off"
                  onChange={(event) => setAnswer(item.position, event.target.value)}
                  placeholder="Nhập từ còn thiếu…"
                />
              </label>
            ) : (
              <div className="space-y-3">
                {choices.map((choice, index) => (
                  <label
                    key={choice.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm leading-6",
                      answers[item.position] === choice.value
                        ? "border-accent bg-accent/10"
                        : "border-line hover:bg-surface-raised",
                    )}
                  >
                    <input
                      type="radio"
                      name={`question-${item.position}`}
                      checked={answers[item.position] === choice.value}
                      onChange={() => setAnswer(item.position, choice.value)}
                    />
                    <span className="font-semibold text-ink-muted">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span lang={item.type === "true_false" ? "vi" : "en"}>{choice.label}</span>
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
            {current < items.length - 1 ? (
              <Button onClick={() => setCurrent((value) => value + 1)}>
                Câu tiếp
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={() => setConfirm(true)} disabled={submitting || expired}>
                Nộp bài
              </Button>
            )}
          </div>
        </section>
        <aside className="panel p-5">
          <h2 className="font-display text-xl font-semibold">Bản đồ câu hỏi</h2>
          <p className="mt-2 text-xs text-ink-muted">
            Đã trả lời {answeredCount}/{items.length} câu
          </p>
          <div className="my-5 grid grid-cols-5 gap-2">
            {items.map((entry, index) => {
              const done = Boolean(answers[entry.position]?.trim());
              return (
                <button
                  key={entry.position}
                  onClick={() => setCurrent(index)}
                  aria-label={`Đến câu ${index + 1}${done ? ", đã trả lời" : ", chưa trả lời"}`}
                  aria-current={index === current ? "step" : undefined}
                  className={cn(
                    "focus-ring min-h-11 rounded-xl border text-sm tabular-nums",
                    current === index
                      ? "border-ink bg-ink text-canvas"
                      : done
                        ? "border-accent bg-accent/15"
                        : "border-line",
                  )}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <p className="mb-5 text-xs leading-5 text-ink-muted">
            {remaining === null
              ? "Bạn có thể rời trang và quay lại tiếp tục bất cứ lúc nào."
              : "Bạn có thể rời trang và quay lại. Đồng hồ do máy chủ tính và vẫn chạy trong lúc vắng mặt."}
          </p>
          <Button
            onClick={() => setConfirm(true)}
            variant="secondary"
            className="w-full"
            disabled={submitting || expired}
          >
            Nộp bài
          </Button>
        </aside>
      </div>
      <AlertDialog.Root open={confirm} onOpenChange={setConfirm}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
          <AlertDialog.Content className="dialog-panel">
            <AlertDialog.Title className="font-display text-2xl font-semibold">
              Sẵn sàng nộp bài?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm leading-6 text-ink-muted">
              Bạn đã trả lời {answeredCount}/{items.length} câu.{" "}
              {answeredCount < items.length ? "Câu chưa trả lời sẽ được tính là sai. " : ""}Sau khi
              nộp, máy chủ chấm điểm và bạn có thể xem đáp án cùng giải thích.
            </AlertDialog.Description>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Tiếp tục làm</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button onClick={() => void submit()}>Xác nhận nộp bài</Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

function AttemptHistory({ quizId, currentId }: { quizId: string; currentId: string }) {
  const auth = useAuth();
  const api = useMemo(() => createAttemptsApi(auth.client), [auth.client]);
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void api
      .history(quizId)
      .then((response) => {
        if (!cancelled) setAttempts(response.attempts);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(errorMessage(loadError));
      });
    return () => {
      cancelled = true;
    };
  }, [api, quizId]);

  return (
    <section aria-labelledby="attempt-history-title" className="panel mt-8 p-5 sm:p-7">
      <h2 id="attempt-history-title" className="font-display text-xl font-semibold">
        Các lần làm bài này
      </h2>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-accent-strong">
          {error}
        </p>
      ) : attempts === null ? (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          Đang tải lịch sử…
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {attempts.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`/attempts/${entry.id}`}
                aria-current={entry.id === currentId ? "page" : undefined}
                className="focus-ring flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 text-sm hover:bg-surface-raised"
              >
                <span>
                  {formatDateTime(entry.startedAt)}
                  {entry.id === currentId && (
                    <span className="ml-2 text-xs text-ink-muted">· lần đang xem</span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">
                  {entry.status === "submitted"
                    ? `${entry.score ?? 0}% · ${entry.correctCount ?? 0}/${entry.totalCount}`
                    : "Đang làm"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AttemptReview({ attempt }: { attempt: Attempt }) {
  const auth = useAuth();
  const api = useMemo(() => createAttemptsApi(auth.client), [auth.client]);
  const navigate = useNavigate();
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState("");

  // Submitting swaps the room for this review in place; move focus and scroll
  // to the top so keyboard and screen-reader users land on the result.
  useEffect(() => {
    document.getElementById("main-content")?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0, behavior: "instant" });
  }, []);

  async function restart() {
    setRestarting(true);
    setRestartError("");
    try {
      const response = await api.start(attempt.quizId);
      navigate(`/attempts/${response.attempt.id}`);
    } catch (error) {
      setRestartError(errorMessage(error));
    } finally {
      setRestarting(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Kết quả bài làm"
        title={attempt.quizTitle}
        description={`Nộp lúc ${attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"}. Điểm do máy chủ chấm từ nội dung đã cố định khi bắt đầu làm bài.`}
        action={<LinkButton to="/notes">Ghi lại điều đã học</LinkButton>}
      />
      <section className="panel mb-6 flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
        <div className="flex items-center gap-5">
          <span className="font-display text-5xl font-semibold tabular-nums">
            {attempt.score ?? 0}
            <span className="text-2xl text-ink-muted">%</span>
          </span>
          <div>
            <p className="font-semibold">
              Đúng {attempt.correctCount ?? 0}/{attempt.totalCount} câu
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Đã trả lời {attempt.answeredCount}/{attempt.totalCount} câu
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void restart()} disabled={restarting}>
            {restarting ? (
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <RotateCcw className="size-4" aria-hidden="true" />
            )}
            Làm lại
          </Button>
          <LinkButton to="/practice" secondary>
            Về bài luyện
          </LinkButton>
        </div>
        {restartError && (
          <p role="alert" className="w-full text-sm text-accent-strong">
            {restartError}
          </p>
        )}
      </section>
      <section className="space-y-4" aria-label="Đáp án và giải thích">
        {attempt.items.map((item) => {
          const correct = item.result?.isCorrect ?? false;
          return (
            <article key={item.position} className="panel p-5 sm:p-7">
              <div className="mb-4 flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full",
                    correct ? "bg-focus/10 text-focus" : "bg-accent/15 text-ink",
                  )}
                >
                  {correct ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <X className="size-4" aria-hidden="true" />
                  )}
                </span>
                <p className="text-xs font-semibold">
                  Câu {item.position} · {correct ? "Chính xác" : "Cần xem lại"}
                </p>
              </div>
              <h2 className="text-base font-semibold leading-7" lang="en">
                {item.prompt}
              </h2>
              <dl className="my-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-muted">Bạn trả lời</dt>
                  <dd className="mt-1 break-words">{displayAnswer(item, item.response)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Đáp án</dt>
                  <dd className="mt-1 break-words font-semibold">
                    {displayAnswer(item, item.result?.correctAnswer)}
                  </dd>
                </div>
              </dl>
              {item.result && (
                <p className="rounded-xl bg-canvas p-4 text-sm leading-7 text-ink-muted">
                  <strong className="text-ink">Vì sao? </strong>
                  {item.result.explanation}
                </p>
              )}
            </article>
          );
        })}
      </section>
      <AttemptHistory quizId={attempt.quizId} currentId={attempt.id} />
    </>
  );
}

/** `/attempts/:attemptId` — the quiz room while open, the review once submitted. */
export function AttemptPage() {
  const { attemptId = "" } = useParams();
  const auth = useAuth();
  const api = useMemo(() => createAttemptsApi(auth.client), [auth.client]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState("");
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError("");
    void api
      .get(attemptId)
      .then((response) => {
        if (!cancelled) setAttempt(response.attempt);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(errorMessage(loadError));
      });
    return () => {
      cancelled = true;
    };
  }, [api, attemptId, loadKey]);

  const reload = useCallback(() => setLoadKey((value) => value + 1), []);

  if (error && !attempt) {
    return (
      <EmptyState
        title="Chưa mở được bài làm"
        description={error}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reload}>
              <RotateCcw className="size-4" aria-hidden="true" /> Thử lại
            </Button>
            <LinkButton to="/practice" secondary>
              Về bài luyện
            </LinkButton>
          </div>
        }
      />
    );
  }
  if (!attempt || attempt.id !== attemptId) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
        <LoaderCircle
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        Đang mở bài làm…
      </p>
    );
  }
  return attempt.status === "submitted" ? (
    <AttemptReview key={attempt.id} attempt={attempt} />
  ) : (
    <AttemptRoom key={attempt.id} attempt={attempt} onFinished={setAttempt} onReload={reload} />
  );
}
