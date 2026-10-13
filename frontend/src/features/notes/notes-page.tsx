import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  Save,
  Sprout,
  Trash2,
} from "lucide-react";
import { z } from "zod";

import type { AttemptSummary, DailyNote, Document } from "@mach/contracts";
import { Button } from "@mach/ui";

import { Badge, PageHeading } from "../../components/page-ui";
import { cn } from "../../lib/cn";
import { dateKey, formatDate, parseDate, shiftDate } from "../../lib/dates";
import { createAttemptsApi } from "../attempts/attempts-api";
import { ApiError } from "../auth/api-client";
import { useAuth } from "../auth/auth-context";
import { useEffectiveRole } from "../auth/use-effective-role";
import { createDocumentsApi } from "../documents/documents-api";
import { createNotesApi } from "./notes-api";
import { ServerStudyTree } from "./server-study-tree";
import { useStudyProgress } from "./use-study-progress";

const understandingLabels = ["Cần ôn thêm", "Khá ổn", "Rất tự tin"];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
}

function monthStartOf(key: string): Date {
  const date = parseDate(key);
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function sameMonth(key: string, month: Date): boolean {
  const date = parseDate(key);
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

/** Comma-separated input → unique tags, keeping the first spelling. */
function parseTags(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(",")
    .map((tag) => tag.trim().replace(/\s+/g, " "))
    .filter((tag) => {
      const key = tag.toLocaleLowerCase("vi");
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

const draftSchema = z.object({
  content: z.string().max(5_000),
  tags: z.string().max(500),
  understanding: z.number().int().min(1).max(3),
  documentIds: z.array(z.string()).max(10),
  attemptIds: z.array(z.string()).max(10),
});
type Draft = z.infer<typeof draftSchema>;

interface LinkOption {
  id: string;
  title: string;
  detail: string;
}

function LinkChecklist({
  legend,
  options,
  selected,
  onToggle,
  empty,
}: {
  legend: string;
  options: LinkOption[];
  selected: string[];
  onToggle: (id: string) => void;
  empty: string;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="mb-2 text-xs font-semibold text-ink-muted">{legend}</legend>
      {options.length === 0 ? (
        <p className="text-xs leading-5 text-ink-muted">{empty}</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-canvas p-1.5">
          {options.map((option) => (
            <li key={option.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm focus-within:ring-2 focus-within:ring-focus hover:bg-surface-raised">
                <input
                  type="checkbox"
                  className="size-4 accent-focus"
                  checked={selected.includes(option.id)}
                  disabled={!selected.includes(option.id) && selected.length >= 10}
                  onChange={() => onToggle(option.id)}
                />
                <span className="min-w-0 flex-1 truncate" title={option.title}>
                  {option.title}
                </span>
                <span className="shrink-0 text-xs text-ink-muted">{option.detail}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function NoteEditor({
  date,
  note,
  storagePrefix,
  documentOptions,
  attemptOptions,
  canLinkDocuments,
  optionsError,
  onSaved,
  onDeleted,
  onConflict,
}: {
  date: string;
  note: DailyNote | undefined;
  storagePrefix: string;
  documentOptions: LinkOption[];
  attemptOptions: LinkOption[];
  canLinkDocuments: boolean;
  optionsError: string;
  onSaved: (note: DailyNote) => void;
  onDeleted: (date: string) => void;
  onConflict: () => void;
}) {
  const auth = useAuth();
  const api = useMemo(() => createNotesApi(auth.client), [auth.client]);
  const draftKey = `${storagePrefix}-${date}`;
  const saved: Draft = {
    content: note?.content ?? "",
    tags: note?.tags.join(", ") ?? "",
    understanding: note?.understanding ?? 2,
    documentIds: note?.links.flatMap((link) => (link.kind === "document" ? [link.id] : [])) ?? [],
    attemptIds: note?.links.flatMap((link) => (link.kind === "attempt" ? [link.id] : [])) ?? [],
  };
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const stored = sessionStorage.getItem(draftKey);
      if (stored) return draftSchema.parse(JSON.parse(stored));
    } catch {
      /* A malformed draft must not prevent opening the saved note. */
    }
    return saved;
  });
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftError, setDraftError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(draftKey, JSON.stringify(draft));
      else sessionStorage.removeItem(draftKey);
      setDraftError("");
    } catch {
      setDraftError("Không giữ được bản nháp. Hãy lưu ghi chú trước khi đổi ngày hoặc rời trang.");
    }
  }, [draft, draftKey, dirty]);

  // Links already on the note stay listed even if they fall outside the option page.
  const noteLinks = note?.links ?? [];
  const mergedDocuments = [
    ...documentOptions,
    ...noteLinks.flatMap((link) =>
      link.kind === "document" && !documentOptions.some((option) => option.id === link.id)
        ? [{ id: link.id, title: link.title, detail: "Tài liệu" }]
        : [],
    ),
  ];
  const mergedAttempts = [
    ...attemptOptions,
    ...noteLinks.flatMap((link) =>
      link.kind === "attempt" && !attemptOptions.some((option) => option.id === link.id)
        ? [{ id: link.id, title: link.title, detail: link.score === null ? "" : `${link.score}%` }]
        : [],
    ),
  ];

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
  }

  function toggle(key: "documentIds" | "attemptIds", id: string) {
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((value) => value !== id)
        : [...current[key], id],
    }));
  }

  async function save() {
    if (!draft.content.trim()) {
      setError("Hãy ghi lại ít nhất một điều bạn đã học.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.save(date, {
        content: draft.content,
        understanding: draft.understanding,
        tags: parseTags(draft.tags),
        documentIds: draft.documentIds,
        attemptIds: draft.attemptIds,
        ...(note ? { version: note.version } : {}),
      });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* The saved note is authoritative; a stale draft is harmless. */
      }
      onSaved(response.note);
    } catch (saveError) {
      setError(errorMessage(saveError));
      setConflict(saveError instanceof ApiError && saveError.status === 409);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!note) return;
    setConfirmDelete(false);
    setBusy(true);
    setError("");
    try {
      await api.remove(date, note.version);
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* Nothing to clean. */
      }
      onDeleted(date);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      setConflict(deleteError instanceof ApiError && deleteError.status === 409);
      setBusy(false);
    }
  }

  const contentErrorId = `note-content-error-${date}`;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      noValidate
      className="panel p-5 sm:p-7"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">Trang nhật ký của bạn</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Ngày {formatDate(date)}</h2>
        </div>
        <Badge tone={dirty ? "accent" : note ? "blue" : "muted"}>
          {dirty ? "Bản nháp chưa lưu" : note ? "Đã lưu trên máy chủ" : "Một trang mới"}
        </Badge>
      </div>
      {!note && !dirty && (
        <p className="mb-5 rounded-xl bg-canvas p-4 text-sm leading-6 text-ink-muted">
          Ngày này chưa có ghi chú. Viết vài dòng về điều đã học — ghi chú đầu tiên của một ngày
          thêm một chiếc lá vào cây.
        </p>
      )}
      <label className="field-label" htmlFor="note-content">
        Hôm nay bạn học được gì?
      </label>
      <textarea
        id="note-content"
        className="field min-h-48 resize-y leading-7"
        maxLength={5_000}
        value={draft.content}
        aria-invalid={error && !draft.content.trim() ? true : undefined}
        aria-describedby={error && !draft.content.trim() ? contentErrorId : undefined}
        onChange={(event) => update({ content: event.target.value })}
        placeholder="Một từ mới, một cấu trúc hay, hoặc điều bạn muốn ôn lại…"
        required
      />
      <p className="mt-1 text-right text-xs text-ink-muted tabular-nums">
        {draft.content.length}/5000
      </p>
      <label className="field-label mt-4" htmlFor="note-tags">
        Tag
      </label>
      <input
        id="note-tags"
        className="field"
        value={draft.tags}
        maxLength={500}
        aria-describedby="note-tags-help"
        onChange={(event) => update({ tags: event.target.value })}
        placeholder="Ví dụ: Grammar, Reading"
      />
      <p id="note-tags-help" className="mt-2 text-xs text-ink-muted">
        Ngăn cách bằng dấu phẩy, tối đa 10 tag. Tag trùng chữ hoa/thường được gộp làm một.
      </p>
      <fieldset className="mt-5">
        <legend className="field-label">Bạn cảm thấy hiểu bài thế nào?</legend>
        <div className="grid grid-cols-3 gap-2">
          {understandingLabels.map((label, index) => (
            <label
              key={label}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center text-xs focus-within:ring-2 focus-within:ring-focus",
                draft.understanding === index + 1 ? "border-accent bg-accent/10" : "border-line",
              )}
            >
              <input
                type="radio"
                name="understanding"
                value={index + 1}
                checked={draft.understanding === index + 1}
                onChange={() => update({ understanding: index + 1 })}
                className="accent-[hsl(var(--color-accent-strong))]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="field-label">Liên kết với buổi học</h3>
        {optionsError && (
          <p role="alert" className="text-xs text-accent-strong">
            {optionsError}
          </p>
        )}
        {canLinkDocuments && (
          <LinkChecklist
            legend="Tài liệu của bạn"
            options={mergedDocuments}
            selected={draft.documentIds}
            onToggle={(id) => toggle("documentIds", id)}
            empty="Chưa có tài liệu nào để liên kết."
          />
        )}
        <LinkChecklist
          legend="Bài làm đã nộp"
          options={mergedAttempts}
          selected={draft.attemptIds}
          onToggle={(id) => toggle("attemptIds", id)}
          empty="Chưa có bài làm đã nộp. Làm một quiz rồi quay lại liên kết nhé."
        />
      </div>
      <p
        id={contentErrorId}
        role="alert"
        className="mt-5 min-h-5 text-sm leading-6 text-accent-strong"
      >
        {error || draftError}
      </p>
      {conflict && (
        <Button type="button" variant="secondary" className="mt-2" onClick={onConflict}>
          <RotateCcw className="size-4" aria-hidden="true" /> Tải lại ghi chú mới nhất
        </Button>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {note ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" aria-hidden="true" /> Xóa ghi chú
          </Button>
        ) : (
          <span className="text-xs text-ink-muted">Ghi chú là riêng tư, chỉ bạn xem được.</span>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Lưu ghi chú
        </Button>
      </div>
      <p role="status" className="mt-3 text-sm leading-6 text-ink-muted">
        {dirty ? "Bản nháp được giữ trong tab này. Bấm Lưu ghi chú để lưu lên máy chủ." : ""}
      </p>
      <AlertDialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
          <AlertDialog.Content className="dialog-panel">
            <AlertDialog.Title className="font-display text-2xl font-semibold">
              Xóa ghi chú ngày {formatDate(date)}?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm leading-6 text-ink-muted">
              Nội dung, tag và liên kết của ngày này sẽ bị xóa. Nếu ngày này không còn hoạt động học
              nào khác, cây sẽ bớt một lá.
            </AlertDialog.Description>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Giữ lại</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button onClick={() => void remove()}>Xóa ghi chú</Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </form>
  );
}

function NotesWorkspace({
  today,
  progressState,
}: {
  today: string;
  progressState: ReturnType<typeof useStudyProgress>;
}) {
  const auth = useAuth();
  const role = useEffectiveRole();
  const notesApi = useMemo(() => createNotesApi(auth.client), [auth.client]);
  const documentsApi = useMemo(() => createDocumentsApi(auth.client), [auth.client]);
  const attemptsApi = useMemo(() => createAttemptsApi(auth.client), [auth.client]);
  const canLinkDocuments = role !== "student";
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => monthStartOf(today));
  const [notes, setNotes] = useState<Map<string, DailyNote>>(new Map());
  const [loadedMonth, setLoadedMonth] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [notice, setNotice] = useState("");
  const focusSelected = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const monthKey = dateKey(month);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthEnd = dateKey(new Date(month.getFullYear(), month.getMonth(), daysInMonth, 12));
  const offset = (month.getDay() + 6) % 7;

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    void notesApi
      .list(monthKey, monthEnd)
      .then((response) => {
        if (cancelled) return;
        setNotes((current) => {
          const next = new Map(current);
          for (const [key] of next) if (key >= monthKey && key <= monthEnd) next.delete(key);
          for (const note of response.notes) next.set(note.date, note);
          return next;
        });
        setLoadedMonth(monthKey);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [notesApi, monthKey, monthEnd, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      canLinkDocuments ? documentsApi.list(1, 50) : Promise.resolve({ documents: [] }),
      attemptsApi.mine(1, 20),
    ])
      .then(([documentResponse, attemptResponse]) => {
        if (cancelled) return;
        setDocuments(documentResponse.documents);
        setAttempts(attemptResponse.attempts);
      })
      .catch(() => {
        if (!cancelled)
          setOptionsError("Không tải được danh sách để liên kết. Vẫn có thể lưu ghi chú.");
      });
    return () => {
      cancelled = true;
    };
  }, [attemptsApi, canLinkDocuments, documentsApi]);

  useEffect(() => {
    if (!focusSelected.current) return;
    focusSelected.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus();
  }, [selected, month]);

  function select(key: string, moveFocus = false) {
    if (key > today) return;
    if (!sameMonth(key, month)) setMonth(monthStartOf(key));
    focusSelected.current = moveFocus;
    setSelected(key);
    setNotice("");
  }

  function onDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: string) {
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const date = parseDate(key);
    let target: string | null = null;
    if (event.key in deltas) target = dateKey(shiftDate(date, deltas[event.key] ?? 0));
    if (event.key === "Home") target = dateKey(shiftDate(date, -((date.getDay() + 6) % 7)));
    if (event.key === "End") target = dateKey(shiftDate(date, 6 - ((date.getDay() + 6) % 7)));
    if (event.key === "PageUp")
      target = dateKey(new Date(date.getFullYear(), date.getMonth() - 1, 1, 12));
    if (event.key === "PageDown")
      target = dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 1, 12));
    if (target === null) return;
    event.preventDefault();
    select(target > today ? today : target, true);
  }

  // Roving tabindex: exactly one day in the visible month is tabbable.
  const tabbableKey = sameMonth(selected, month)
    ? selected
    : sameMonth(today, month)
      ? today
      : monthKey;
  const notesThisMonth = [...notes.values()].filter(
    (note) => note.date >= monthKey && note.date <= monthEnd,
  ).length;
  const monthLoading = loadedMonth !== monthKey && !loadError;
  const note = notes.get(selected);
  const documentOptions = documents.map((document) => ({
    id: document.id,
    title: document.originalName,
    detail: document.extension.toUpperCase(),
  }));
  const attemptOptions = attempts.map((attempt) => ({
    id: attempt.id,
    title: attempt.quizTitle,
    detail: `${attempt.score ?? 0}% · ${new Date(attempt.startedAt).toLocaleDateString("vi-VN")}`,
  }));
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1, 12);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="contents">
        <section
          aria-labelledby="notes-calendar-title"
          className="panel p-5 xl:col-start-1 xl:row-start-1"
        >
          <div className="mb-5 flex items-center justify-between gap-2">
            <button
              className="icon-button"
              aria-label="Tháng trước"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <h2
              id="notes-calendar-title"
              className="text-sm font-semibold capitalize"
              aria-live="polite"
            >
              {month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
            </h2>
            <button
              className="icon-button disabled:pointer-events-none disabled:opacity-40"
              aria-label="Tháng sau"
              disabled={dateKey(nextMonth) > today}
              onClick={() => setMonth(nextMonth)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div
            ref={gridRef}
            className="grid grid-cols-7 gap-1"
            aria-busy={monthLoading}
            aria-describedby="notes-calendar-help"
          >
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
              <span
                key={day}
                aria-hidden="true"
                className="py-2 text-center text-xs text-ink-muted"
              >
                {day}
              </span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const key = dateKey(new Date(month.getFullYear(), month.getMonth(), index + 1, 12));
              const hasNote = notes.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  data-date={key}
                  disabled={key > today}
                  tabIndex={key === tabbableKey ? 0 : -1}
                  aria-pressed={selected === key}
                  aria-label={`${parseDate(key).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}${hasNote ? ", có ghi chú" : ""}`}
                  aria-current={key === today ? "date" : undefined}
                  onClick={() => select(key)}
                  onKeyDown={(event) => onDayKeyDown(event, key)}
                  className={cn(
                    "focus-ring relative min-h-11 rounded-xl text-sm tabular-nums disabled:opacity-30",
                    selected === key ? "bg-ink text-canvas" : "hover:bg-surface-raised",
                    key === today && selected !== key && "border border-accent",
                  )}
                >
                  {index + 1}
                  {hasNote && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p id="notes-calendar-help" className="sr-only">
            Dùng phím mũi tên để đổi ngày, Home/End để về đầu/cuối tuần, Page Up/Page Down để đổi
            tháng.
          </p>
          {loadError ? (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>{loadError}</span>
              <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
                <RotateCcw className="size-4" aria-hidden="true" /> Thử lại
              </Button>
            </div>
          ) : (
            <p role="status" className="mt-4 text-xs text-ink-muted">
              {monthLoading
                ? "Đang tải ghi chú của tháng…"
                : notesThisMonth === 0
                  ? "Tháng này chưa có ghi chú nào. Chọn một ngày để bắt đầu."
                  : `${notesThisMonth} ngày có ghi chú trong tháng này.`}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-xs text-ink-muted">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              Đã có ghi chú
            </span>
            <button
              className="focus-ring min-h-11 rounded-lg px-2 font-semibold text-ink"
              onClick={() => select(today)}
            >
              Hôm nay
            </button>
          </div>
        </section>
        <section className="panel order-2 p-5 xl:col-start-1 xl:row-start-2">
          <div className="flex items-center gap-2">
            <Sprout className="size-5 text-tree" aria-hidden="true" />
            <h2 className="font-display text-xl font-semibold">Chậm mà xanh tươi</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Mỗi ngày có ghi chú hoặc nộp bài là một buổi học, tính theo múi giờ{" "}
            {progressState.progress?.timezone}.
          </p>
          <ServerStudyTree state={progressState} />
        </section>
      </div>
      <div className="order-1 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <p role="status" className="sr-only">
          {notice}
        </p>
        {monthLoading && !notes.has(selected) && sameMonth(selected, month) ? (
          <div className="panel grid min-h-96 place-items-center p-8">
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Đang mở trang nhật ký…
            </p>
          </div>
        ) : (
          <NoteEditor
            key={`${selected}-${note?.version ?? 0}`}
            date={selected}
            note={note}
            storagePrefix={`mach-note-draft-${auth.user?.id ?? "anonymous"}`}
            documentOptions={documentOptions}
            attemptOptions={attemptOptions}
            canLinkDocuments={canLinkDocuments}
            optionsError={optionsError}
            onSaved={(savedNote) => {
              setNotes((current) => new Map(current).set(savedNote.date, savedNote));
              setNotice(`Đã lưu ghi chú ngày ${formatDate(savedNote.date)}.`);
              progressState.reload();
            }}
            onDeleted={(deletedDate) => {
              setNotes((current) => {
                const next = new Map(current);
                next.delete(deletedDate);
                return next;
              });
              setNotice(`Đã xóa ghi chú ngày ${formatDate(deletedDate)}.`);
              progressState.reload();
            }}
            onConflict={() => setReloadKey((value) => value + 1)}
          />
        )}
      </div>
    </div>
  );
}

export function NotesPage() {
  const progressState = useStudyProgress();
  const today = progressState.progress?.today;
  return (
    <>
      <PageHeading
        eyebrow="Ghi chú học tập"
        title="Ghi lại điều nhỏ. Nuôi lớn tri thức."
        description="Một khoảng lặng để nhìn lại buổi học. Ghi chú được lưu riêng tư trên máy chủ; mỗi ngày có ghi chú hoặc nộp bài thêm một chiếc lá vào cây."
      />
      {today ? (
        <NotesWorkspace today={today} progressState={progressState} />
      ) : progressState.error ? (
        <div
          role="alert"
          className="panel flex flex-wrap items-center justify-between gap-3 p-6 text-sm"
        >
          <span>{progressState.error}</span>
          <Button variant="secondary" onClick={progressState.reload}>
            <RotateCcw className="size-4" aria-hidden="true" /> Thử lại
          </Button>
        </div>
      ) : (
        <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          Đang mở nhật ký…
        </p>
      )}
    </>
  );
}
