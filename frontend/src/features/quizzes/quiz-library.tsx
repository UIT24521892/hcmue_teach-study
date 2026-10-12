import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Clock3,
  Eye,
  ListChecks,
  LoaderCircle,
  PencilLine,
  Play,
  Plus,
  RotateCcw,
  Send,
  X,
} from "lucide-react";

import type {
  Document,
  Question,
  QuizDetail,
  QuizItem,
  QuizStatus,
  QuizSummary,
} from "@mach/contracts";
import { Button } from "@mach/ui";

import { Badge, EmptyState, LinkButton, Modal } from "../../components/page-ui";
import { ApiError } from "../auth/api-client";
import { useAuth } from "../auth/auth-context";
import { createAttemptsApi } from "../attempts/attempts-api";
import { createDocumentsApi } from "../documents/documents-api";
import { createQuizzesApi } from "./quizzes-api";

const statusLabels: Record<QuizStatus, string> = {
  draft: "Nháp",
  published: "Đã công bố",
  archived: "Đã lưu trữ",
};

const typeLabels: Record<Question["type"], string> = {
  multiple_choice: "Trắc nghiệm",
  fill_blank: "Điền từ",
  true_false: "Đúng / sai",
};

const MAX_QUESTIONS = 50;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details as { notApprovedQuestionIds?: unknown } | undefined;
    if (Array.isArray(details?.notApprovedQuestionIds)) {
      return `${error.message} (${details.notApprovedQuestionIds.length} câu cần duyệt lại trong Thư viện tài liệu.)`;
    }
    return error.message;
  }
  return "Không kết nối được máy chủ. Kiểm tra API rồi thử lại.";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface SelectedQuestion {
  id: string;
  prompt: string;
  type: Question["type"];
}

function QuizBuilder({
  initial,
  onSaved,
}: {
  initial: QuizDetail | null;
  onSaved: (quiz: QuizDetail) => void;
}) {
  const auth = useAuth();
  const documentsApi = useMemo(() => createDocumentsApi(auth.client), [auth.client]);
  const quizzesApi = useMemo(() => createQuizzesApi(auth.client), [auth.client]);
  const fieldId = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [timeLimit, setTimeLimit] = useState(initial?.timeLimitMinutes?.toString() ?? "");
  const [selected, setSelected] = useState<SelectedQuestion[]>(
    () =>
      initial?.items.flatMap((item) =>
        item.sourceQuestionId
          ? [{ id: item.sourceQuestionId, prompt: item.prompt, type: item.type }]
          : [],
      ) ?? [],
  );
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [bank, setBank] = useState<Question[]>([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankError, setBankError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void documentsApi
      .list()
      .then((response) => {
        if (cancelled) return;
        const ready = response.documents.filter((document) => document.status === "ready");
        setDocuments(ready);
        setDocumentId((current) => current || ready[0]?.id || "");
        if (ready.length === 0) setBankLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBankError(errorMessage(error));
        setBankLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentsApi]);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    setBankLoading(true);
    void documentsApi
      .questions(documentId, "approved")
      .then((response) => {
        if (cancelled) return;
        setBank(response.questions);
        setBankError("");
      })
      .catch((error: unknown) => {
        if (!cancelled) setBankError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setBankLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentsApi, documentId]);

  const selectedIds = new Set(selected.map((question) => question.id));
  const minutes = timeLimit.trim() === "" ? null : Number(timeLimit);
  const timeLimitInvalid =
    minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 180);
  const titleError = formError && !title.trim() ? "Nhập tên quiz." : "";

  function toggle(question: Question) {
    setFormError("");
    setSelected((current) =>
      current.some((item) => item.id === question.id)
        ? current.filter((item) => item.id !== question.id)
        : current.length >= MAX_QUESTIONS
          ? current
          : [...current, { id: question.id, prompt: question.prompt, type: question.type }],
    );
  }

  function move(index: number, offset: -1 | 1) {
    setSelected((current) => {
      const next = [...current];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || selected.length === 0 || timeLimitInvalid) {
      setFormError(
        !title.trim()
          ? "Quiz cần có tên."
          : selected.length === 0
            ? "Chọn ít nhất một câu hỏi đã duyệt."
            : "Thời gian làm bài là số phút nguyên từ 1 đến 180.",
      );
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      title: title.trim(),
      timeLimitMinutes: minutes,
      questionIds: selected.map((question) => question.id),
    };
    try {
      const response = initial
        ? await quizzesApi.update(initial.id, { ...payload, version: initial.version })
        : await quizzesApi.create(payload);
      onSaved(response.quiz);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <label className="field-label" htmlFor={`${fieldId}-title`}>
        Tên quiz <span aria-hidden="true">*</span>
      </label>
      <input
        id={`${fieldId}-title`}
        className="field"
        value={title}
        maxLength={160}
        required
        aria-invalid={titleError ? true : undefined}
        aria-describedby={titleError ? `${fieldId}-title-error` : undefined}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Ví dụ: Unit 3 · Vocabulary check"
      />
      {titleError && (
        <p id={`${fieldId}-title-error`} className="mt-2 text-xs text-accent-strong">
          {titleError}
        </p>
      )}
      <label className="field-label mt-4" htmlFor={`${fieldId}-time`}>
        Thời gian làm bài (phút)
      </label>
      <input
        id={`${fieldId}-time`}
        className="field"
        inputMode="numeric"
        value={timeLimit}
        aria-invalid={timeLimitInvalid ? true : undefined}
        aria-describedby={`${fieldId}-time-help`}
        onChange={(event) => setTimeLimit(event.target.value)}
        placeholder="Để trống nếu không giới hạn"
      />
      <p
        id={`${fieldId}-time-help`}
        className={
          timeLimitInvalid ? "mt-2 text-xs text-accent-strong" : "mt-2 text-xs text-ink-muted"
        }
      >
        Số nguyên từ 1 đến 180. Máy chủ sẽ kiểm tra hạn giờ khi học sinh nộp bài.
      </p>

      <fieldset className="mt-6">
        <legend className="field-label">Ngân hàng câu hỏi đã duyệt</legend>
        {documents.length > 0 && (
          <label className="mb-3 block">
            <span className="sr-only">Chọn tài liệu nguồn</span>
            <select
              className="field"
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
            >
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.originalName}
                </option>
              ))}
            </select>
          </label>
        )}
        {bankError && (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-accent/50 bg-accent/10 p-3 text-sm"
          >
            {bankError}
          </p>
        )}
        {bankLoading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Đang tải câu hỏi…
          </p>
        ) : documents.length === 0 ? (
          <p className="text-sm leading-6 text-ink-muted">
            Chưa có tài liệu nào sẵn sàng. Tải tài liệu và duyệt câu hỏi ở Thư viện tài liệu trước.
          </p>
        ) : bank.length === 0 ? (
          <p className="text-sm leading-6 text-ink-muted">
            Tài liệu này chưa có câu hỏi đã duyệt. Mở Thư viện tài liệu để duyệt câu hỏi.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-canvas p-2">
            {bank.map((question) => (
              <li key={question.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 focus-within:ring-2 focus-within:ring-focus hover:bg-surface-raised">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-focus"
                    checked={selectedIds.has(question.id)}
                    disabled={!selectedIds.has(question.id) && selected.length >= MAX_QUESTIONS}
                    onChange={() => toggle(question)}
                  />
                  <span className="min-w-0 text-sm leading-6">
                    <span className="block break-words">{question.prompt}</span>
                    <span className="text-xs text-ink-muted">{typeLabels[question.type]}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div className="mt-6">
        <h3 className="field-label" id={`${fieldId}-order`}>
          Thứ tự trong quiz · {selected.length}/{MAX_QUESTIONS}
        </h3>
        {selected.length === 0 ? (
          <p className="text-sm text-ink-muted">Chưa chọn câu hỏi nào.</p>
        ) : (
          <ol aria-labelledby={`${fieldId}-order`} className="space-y-2">
            {selected.map((question, index) => (
              <li
                key={question.id}
                className="flex items-center gap-2 rounded-xl border border-line p-2 pl-3 text-sm"
              >
                <span className="w-6 shrink-0 text-ink-muted tabular-nums">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate" title={question.prompt}>
                  {question.prompt}
                </span>
                <button
                  type="button"
                  className="icon-button size-9"
                  aria-label={`Đưa câu ${index + 1} lên`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button size-9"
                  aria-label={`Đưa câu ${index + 1} xuống`}
                  disabled={index === selected.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button size-9"
                  aria-label={`Bỏ câu ${index + 1} khỏi quiz`}
                  onClick={() =>
                    setSelected((current) => current.filter((item) => item.id !== question.id))
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p role="alert" className="mt-4 min-h-5 text-sm text-accent-strong">
        {formError}
      </p>
      <Button className="mt-3 w-full" type="submit" disabled={saving}>
        {saving && (
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {initial ? "Lưu bản nháp" : "Tạo bản nháp"}
      </Button>
      <p className="mt-3 text-xs leading-5 text-ink-muted">
        Bản nháp chỉ bạn thấy. Khi công bố, nội dung câu hỏi được cố định để lịch sử làm bài không
        đổi.
      </p>
    </form>
  );
}

function QuizItemsPreview({ items }: { items: QuizItem[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.position} className="rounded-2xl bg-canvas p-4 text-sm leading-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge>
              Câu {item.position} · {typeLabels[item.type]}
            </Badge>
          </div>
          <p className="break-words font-medium">{item.prompt}</p>
          {item.options && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
              {item.options.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
          )}
          <p className="mt-2">
            <span className="font-semibold">Đáp án:</span>{" "}
            {item.type === "true_false"
              ? item.correctAnswer === "true"
                ? "Đúng"
                : "Sai"
              : item.correctAnswer}
          </p>
          <p className="mt-1 text-ink-muted">{item.explanation}</p>
        </li>
      ))}
    </ol>
  );
}

type QuizDialog =
  | { kind: "create" }
  | { kind: "edit"; quiz: QuizDetail }
  | { kind: "view"; quiz: QuizDetail }
  | null;

/** Real quiz authoring for signed-in teachers and self-learners. */
export function QuizLibrary() {
  const auth = useAuth();
  const api = useMemo(() => createQuizzesApi(auth.client), [auth.client]);
  const attemptsApi = useMemo(() => createAttemptsApi(auth.client), [auth.client]);
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState<QuizDialog>(null);
  const [confirm, setConfirm] = useState<{
    action: "publish" | "archive";
    quiz: QuizSummary;
  } | null>(null);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .list()
      .then((response) => {
        if (cancelled) return;
        setQuizzes(response.quizzes);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, refreshKey]);

  function replace(quiz: QuizDetail) {
    setQuizzes((current) => [quiz, ...current.filter((item) => item.id !== quiz.id)]);
  }

  async function open(quiz: QuizSummary, kind: "edit" | "view") {
    setBusyId(quiz.id);
    setError("");
    try {
      const response = await api.get(quiz.id);
      setDialog({ kind, quiz: response.quiz });
    } catch (openError) {
      setError(errorMessage(openError));
    } finally {
      setBusyId("");
    }
  }

  async function takeQuiz(quiz: QuizSummary) {
    setBusyId(quiz.id);
    setError("");
    try {
      const response = await attemptsApi.start(quiz.id);
      navigate(`/attempts/${response.attempt.id}`);
    } catch (startError) {
      setError(errorMessage(startError));
      setBusyId("");
    }
  }

  async function transition() {
    if (!confirm) return;
    const { action, quiz } = confirm;
    setConfirm(null);
    setBusyId(quiz.id);
    setError("");
    try {
      const response =
        action === "publish"
          ? await api.publish(quiz.id, quiz.version)
          : await api.archive(quiz.id, quiz.version);
      replace(response.quiz);
      setNotice(
        action === "publish"
          ? `Đã công bố “${response.quiz.title}”. Nội dung câu hỏi đã được cố định.`
          : `Đã lưu trữ “${response.quiz.title}”.`,
      );
    } catch (transitionError) {
      setError(errorMessage(transitionError));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section aria-labelledby="quiz-library-title" className="mb-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Dữ liệu máy chủ</p>
          <h2 id="quiz-library-title" className="font-display text-3xl font-semibold">
            Quiz của bạn
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Gom câu hỏi đã duyệt thành quiz, sắp xếp thứ tự rồi công bố khi sẵn sàng.
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Plus className="size-4" aria-hidden="true" />
          Soạn quiz mới
        </Button>
      </div>
      <p role="status" className="mb-3 min-h-5 text-sm text-ink-muted">
        {loading ? "Đang tải quiz…" : notice}
      </p>
      {error && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-sm"
        >
          <span>{error}</span>
          <Button variant="secondary" onClick={() => setRefreshKey((value) => value + 1)}>
            <RotateCcw className="size-4" aria-hidden="true" /> Thử lại
          </Button>
        </div>
      )}
      {loading && quizzes.length === 0 ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3" aria-hidden="true">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="panel h-56 animate-pulse bg-surface-raised motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : quizzes.length === 0 && !error ? (
        <EmptyState
          title="Chưa có quiz nào"
          description="Duyệt vài câu hỏi trong Thư viện tài liệu, rồi quay lại đây để gom chúng thành quiz đầu tiên."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => setDialog({ kind: "create" })}>
                <Plus className="size-4" aria-hidden="true" /> Soạn quiz
              </Button>
              <LinkButton to="/documents" secondary>
                Đến thư viện tài liệu
              </LinkButton>
            </div>
          }
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="panel flex min-w-0 flex-col p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-tree">
                  <ListChecks className="size-5" aria-hidden="true" />
                </span>
                <Badge
                  tone={
                    quiz.status === "published"
                      ? "blue"
                      : quiz.status === "draft"
                        ? "accent"
                        : "muted"
                  }
                >
                  {statusLabels[quiz.status]}
                </Badge>
              </div>
              <h3 className="break-words font-display text-2xl font-semibold">{quiz.title}</h3>
              <p className="mb-5 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                <span>{quiz.questionCount} câu hỏi</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} phút` : "Không giới hạn giờ"}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {quiz.publishedAt
                    ? `Công bố ${formatDate(quiz.publishedAt)}`
                    : `Cập nhật ${formatDate(quiz.updatedAt)}`}
                </span>
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {quiz.status === "draft" ? (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busyId === quiz.id}
                      onClick={() => void open(quiz, "edit")}
                    >
                      <PencilLine className="size-4" aria-hidden="true" /> Sửa nháp
                    </Button>
                    <Button
                      disabled={busyId === quiz.id || quiz.questionCount === 0}
                      onClick={() => setConfirm({ action: "publish", quiz })}
                    >
                      <Send className="size-4" aria-hidden="true" /> Công bố
                    </Button>
                  </>
                ) : (
                  <>
                    {quiz.status === "published" && (
                      <Button disabled={busyId === quiz.id} onClick={() => void takeQuiz(quiz)}>
                        <Play className="size-4" aria-hidden="true" /> Làm bài
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      disabled={busyId === quiz.id}
                      onClick={() => void open(quiz, "view")}
                    >
                      <Eye className="size-4" aria-hidden="true" /> Xem câu hỏi
                    </Button>
                  </>
                )}
                {quiz.status !== "archived" && (
                  <Button
                    variant="secondary"
                    disabled={busyId === quiz.id}
                    onClick={() => setConfirm({ action: "archive", quiz })}
                  >
                    <Archive className="size-4" aria-hidden="true" /> Lưu trữ
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={dialog !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDialog(null);
        }}
        title={
          dialog?.kind === "view"
            ? dialog.quiz.title
            : dialog?.kind === "edit"
              ? "Sửa quiz nháp"
              : "Soạn quiz mới"
        }
        description={
          dialog?.kind === "view"
            ? "Nội dung đã cố định tại thời điểm công bố, kể cả khi câu hỏi gốc được sửa sau đó."
            : "Chỉ câu hỏi bạn đã duyệt mới có thể đưa vào quiz."
        }
      >
        {dialog?.kind === "view" ? (
          <QuizItemsPreview items={dialog.quiz.items} />
        ) : dialog ? (
          <QuizBuilder
            key={dialog.kind === "edit" ? `${dialog.quiz.id}-${dialog.quiz.version}` : "create"}
            initial={dialog.kind === "edit" ? dialog.quiz : null}
            onSaved={(quiz) => {
              replace(quiz);
              setDialog(null);
              setNotice(`Đã lưu bản nháp “${quiz.title}”.`);
            }}
          />
        ) : null}
      </Modal>

      <AlertDialog.Root
        open={confirm !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirm(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
          <AlertDialog.Content className="dialog-panel">
            <AlertDialog.Title className="font-display text-2xl font-semibold">
              {confirm?.action === "publish" ? "Công bố quiz này?" : "Lưu trữ quiz này?"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm leading-6 text-ink-muted">
              {confirm?.action === "publish"
                ? "Sau khi công bố, quiz không sửa được nữa. Nội dung câu hỏi được cố định; muốn thay đổi hãy soạn quiz mới."
                : "Quiz đã lưu trữ không dùng để giao bài mới. Thao tác này không xóa dữ liệu."}
            </AlertDialog.Description>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Để sau</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button onClick={() => void transition()}>
                  {confirm?.action === "publish" ? "Công bố" : "Lưu trữ"}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
