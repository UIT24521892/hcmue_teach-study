import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Save, Sprout } from "lucide-react";
import { Button } from "@mach/ui";
import { PageHeading, Badge } from "../../components/page-ui";
import { StudyTree } from "../../components/study-tree";
import { useDemo } from "../demo/context";
import { calculateStreak, dateKey, formatDate, parseDate } from "../../lib/dates";
import { cn } from "../../lib/cn";
import { noteSchema } from "../demo/schema";

const draftSchema = noteSchema.pick({ content: true, tags: true, understanding: true });

function NoteEditor({ selected }: { selected: string }) {
  const { data, update, storageError } = useDemo();
  const note = data.notes.find((n) => n.date === selected);
  const [draft] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`mach-note-draft-${selected}`);
      if (saved) return draftSchema.parse(JSON.parse(saved));
    } catch {
      /* A malformed draft must not prevent opening a saved note. */
    }
    return {
      content: note?.content ?? "",
      tags: note?.tags ?? "",
      understanding: note?.understanding ?? 2,
    };
  });
  const [content, setContent] = useState(draft.content);
  const [tags, setTags] = useState(draft.tags);
  const [understanding, setUnderstanding] = useState(draft.understanding);
  const [message, setMessage] = useState("");
  const [draftError, setDraftError] = useState("");
  const dirty =
    content !== (note?.content ?? "") ||
    tags !== (note?.tags ?? "") ||
    understanding !== (note?.understanding ?? 2);
  useEffect(() => {
    try {
      const key = `mach-note-draft-${selected}`;
      if (dirty) sessionStorage.setItem(key, JSON.stringify({ content, tags, understanding }));
      else sessionStorage.removeItem(key);
      setDraftError("");
    } catch {
      setDraftError("Không giữ được bản nháp. Hãy lưu ghi chú trước khi đổi ngày hoặc rời trang.");
    }
  }, [content, tags, understanding, selected, dirty]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!content.trim()) {
          setMessage("Hãy ghi lại ít nhất một điều bạn đã học.");
          return;
        }
        update((current) => ({
          ...current,
          notes: [
            ...current.notes.filter((n) => n.date !== selected),
            {
              id: note?.id ?? crypto.randomUUID(),
              date: selected,
              content: content.trim(),
              tags,
              understanding,
            },
          ],
        }));
        setContent(content.trim());
        setMessage(
          "Đã cập nhật ghi chú. Mỗi ngày chỉ tính một buổi ghi chú, chỉnh sửa không cộng thêm lá.",
        );
      }}
      className="panel order-1 p-5 sm:p-7 xl:col-start-2 xl:row-span-2 xl:row-start-1"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">Trang nhật ký của bạn</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Ngày {formatDate(selected)}</h2>
        </div>
        <Badge>{dirty ? "Bản nháp chưa lưu" : note ? "Đã có ghi chú" : "Một trang mới"}</Badge>
      </div>
      <label className="field-label" htmlFor="note-content">
        Hôm nay bạn học được gì?
      </label>
      <textarea
        id="note-content"
        className="field min-h-56 resize-y leading-7"
        maxLength={5000}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setMessage("");
        }}
        placeholder="Một từ mới, một cấu trúc hay, hoặc điều bạn muốn ôn lại…"
        required
      />
      <p className="mt-1 text-right text-xs text-ink-muted tabular-nums">{content.length}/5000</p>
      <label className="field-label mt-5" htmlFor="note-tags">
        Tag
      </label>
      <input
        id="note-tags"
        className="field"
        value={tags}
        maxLength={200}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Ví dụ: Grammar, Reading"
      />
      <fieldset className="mt-5">
        <legend className="field-label">Bạn cảm thấy hiểu bài thế nào?</legend>
        <div className="grid grid-cols-3 gap-2">
          {["Cần ôn thêm", "Khá ổn", "Rất tự tin"].map((label, index) => (
            <label
              key={label}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center text-xs",
                understanding === index + 1 ? "border-accent bg-accent/10" : "border-line",
              )}
            >
              <input
                type="radio"
                name="understanding"
                value={index + 1}
                checked={understanding === index + 1}
                onChange={() => setUnderstanding(index + 1)}
                className="accent-[hsl(var(--color-accent-strong))]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">Chỉ lưu trên trình duyệt này</span>
        <Button type="submit">
          <Save className="size-4" />
          Lưu ghi chú
        </Button>
      </div>
      <p role="status" className="mt-3 text-sm leading-6 text-ink-muted">
        {storageError ||
          draftError ||
          message ||
          (dirty ? "Bản nháp được giữ trong tab này. Bấm Lưu ghi chú để ghi nhận buổi học." : "")}
      </p>
    </form>
  );
}

export function NotesPage() {
  const { data } = useDemo();
  const today = dateKey();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
  );
  const offset = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dates = [...data.notes.map((n) => n.date), ...data.attempts.map((a) => a.date)];
  return (
    <>
      <PageHeading
        eyebrow="Ghi chú học tập"
        title="Ghi lại điều nhỏ. Nuôi lớn tri thức."
        description="Một khoảng lặng để nhìn lại buổi học. Ghi chú đầu tiên của mỗi ngày sẽ thêm một chiếc lá vào cây."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="contents">
          <section className="panel p-5 xl:col-start-1 xl:row-start-1">
            <div className="mb-5 flex items-center justify-between gap-2">
              <button
                className="icon-button"
                aria-label="Tháng trước"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}
              >
                <ChevronLeft className="size-4" />
              </button>
              <h2 className="text-sm font-semibold capitalize">
                {month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
              </h2>
              <button
                className="icon-button"
                aria-label="Tháng sau"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                <span key={day} className="py-2 text-center text-xs text-ink-muted">
                  {day}
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`empty-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const key = dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1, 12));
                const hasNote = data.notes.some((n) => n.date === key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={key > today}
                    aria-pressed={selected === key}
                    aria-label={`${i + 1}/${month.getMonth() + 1}/${month.getFullYear()}${hasNote ? ", có ghi chú" : ""}`}
                    aria-current={key === today ? "date" : undefined}
                    onClick={() => setSelected(key)}
                    className={cn(
                      "focus-ring relative min-h-11 rounded-xl text-sm tabular-nums disabled:opacity-30",
                      selected === key ? "bg-ink text-canvas" : "hover:bg-surface-raised",
                      key === today && selected !== key && "border border-accent",
                    )}
                  >
                    {i + 1}
                    {hasNote && (
                      <span className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-xs text-ink-muted">
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-accent" />
                Đã có ghi chú
              </span>
              <button
                className="focus-ring min-h-11 rounded-lg px-2 font-semibold text-ink"
                onClick={() => {
                  setSelected(today);
                  const d = parseDate(today);
                  setMonth(new Date(d.getFullYear(), d.getMonth(), 1, 12));
                }}
              >
                Hôm nay
              </button>
            </div>
          </section>
          <section className="panel order-2 p-5 xl:col-start-1 xl:row-start-2">
            <div className="flex items-center gap-2">
              <Sprout className="size-5 text-tree" />
              <h2 className="font-display text-xl font-semibold">Chậm mà xanh tươi</h2>
            </div>
            <StudyTree completedSessions={dates.length} streakDays={calculateStreak(dates)} />
          </section>
        </div>
        <NoteEditor key={selected} selected={selected} />
      </div>
    </>
  );
}
