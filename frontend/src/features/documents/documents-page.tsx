import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  FileText,
  FileUp,
  LoaderCircle,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import type { Document, DocumentJob, Question, UpdateQuestionRequest } from "@mach/contracts";
import { Button } from "@mach/ui";

import {
  Badge,
  EmptyState,
  LinkButton,
  Modal,
  PageHeading,
  Pagination,
} from "../../components/page-ui";
import { usePagination } from "../../lib/use-pagination";
import { ApiError } from "../auth/api-client";
import { useAuth } from "../auth/auth-context";
import { useEffectiveRole } from "../auth/use-effective-role";
import { useDemo } from "../demo/context";
import type { StudyDocument } from "../demo/schema";
import { createDocumentsApi } from "./documents-api";

const demoStatusLabels = {
  ready: "Sẵn sàng · mẫu",
  review: "Chờ duyệt · mẫu",
  local: "Chỉ lưu tên file",
};

const documentStatusLabels: Record<Document["status"], string> = {
  uploaded: "Đã nhận file",
  queued: "Đang chờ xử lý",
  processing: "Đang tạo câu hỏi",
  ready: "Câu hỏi đã sẵn sàng",
  failed: "Cần thử lại",
};

const questionTypeLabels: Record<Question["type"], string> = {
  multiple_choice: "Trắc nghiệm",
  fill_blank: "Điền từ",
  true_false: "Đúng / sai",
};

const fileTypes: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Không kết nối được máy chủ. Kiểm tra API rồi thử lại.";
}

function formatBytes(value: number): string {
  if (value < 1_024 * 1_024) return `${Math.max(1, Math.round(value / 1_024))} KB`;
  return `${(value / (1_024 * 1_024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

function QuestionEditor({
  question,
  busy,
  onUpdate,
  onReview,
}: {
  question: Question;
  busy: boolean;
  onUpdate: (input: UpdateQuestionRequest) => Promise<void>;
  onReview: (status: "approved" | "rejected") => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [answer, setAnswer] = useState(question.correctAnswer);
  const [explanation, setExplanation] = useState(question.explanation);
  const [difficulty, setDifficulty] = useState(question.difficulty);
  const [options, setOptions] = useState(question.options?.join("\n") ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onUpdate({
      prompt,
      correctAnswer: answer,
      explanation,
      difficulty,
      options:
        question.type === "multiple_choice"
          ? options
              .split("\n")
              .map((option) => option.trim())
              .filter(Boolean)
          : null,
      version: question.version,
    });
  }

  return (
    <form className="rounded-2xl bg-canvas p-4 sm:p-5" onSubmit={(event) => void submit(event)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Badge tone={question.reviewStatus === "approved" ? "blue" : "muted"}>
          {questionTypeLabels[question.type]} · v{question.version}
        </Badge>
        <span className="text-xs text-ink-muted">
          {question.reviewStatus === "approved"
            ? "Đã duyệt"
            : question.reviewStatus === "rejected"
              ? "Đã loại"
              : "Chờ duyệt"}
        </span>
      </div>
      <label className="field-label" htmlFor={`prompt-${question.id}`}>
        Câu hỏi
      </label>
      <textarea
        id={`prompt-${question.id}`}
        className="field min-h-20 resize-y sm:min-h-24"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      {question.type === "multiple_choice" && (
        <>
          <label className="field-label mt-4" htmlFor={`options-${question.id}`}>
            Lựa chọn · mỗi dòng một đáp án
          </label>
          <textarea
            id={`options-${question.id}`}
            className="field min-h-24 resize-y sm:min-h-28"
            value={options}
            onChange={(event) => setOptions(event.target.value)}
          />
        </>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label>
          <span className="field-label">Đáp án đúng</span>
          {question.type === "true_false" ? (
            <select
              className="field"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
            >
              <option value="true">Đúng</option>
              <option value="false">Sai</option>
            </select>
          ) : (
            <input
              className="field"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
            />
          )}
        </label>
        <label>
          <span className="field-label">Độ khó</span>
          <select
            className="field"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as Question["difficulty"])}
          >
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </label>
      </div>
      <label className="field-label mt-4" htmlFor={`explanation-${question.id}`}>
        Giải thích
      </label>
      <textarea
        id={`explanation-${question.id}`}
        className="field min-h-20 resize-y sm:min-h-24"
        value={explanation}
        onChange={(event) => setExplanation(event.target.value)}
      />
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}
          Lưu chỉnh sửa
        </Button>
        <Button type="button" disabled={busy} onClick={() => void onReview("approved")}>
          <Check className="size-4" />
          Duyệt
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void onReview("rejected")}
        >
          <X className="size-4" />
          Loại
        </Button>
      </div>
    </form>
  );
}

export function DocumentsPage() {
  const { data, update } = useDemo();
  const auth = useAuth();
  const role = useEffectiveRole();
  const api = useMemo(() => createDocumentsApi(auth.client), [auth.client]);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedDemo, setSelectedDemo] = useState<StudyDocument | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [added, setAdded] = useState("");
  const [remoteDocuments, setRemoteDocuments] = useState<Document[]>([]);
  const [jobs, setJobs] = useState<Record<string, DocumentJob | undefined>>({});
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState("");
  const [questionBusy, setQuestionBusy] = useState("");
  const hasLoadedDocuments = useRef(false);
  const isRemoteLibrary = auth.status === "authenticated" && role !== "student";
  const uploadOpen = params.get("upload") === "1" && role !== "student";

  useEffect(() => {
    hasLoadedDocuments.current = false;
    setRemoteDocuments([]);
    setJobs({});
    setSelectedDocument(null);
  }, [auth.user?.id]);

  useEffect(() => {
    if (!isRemoteLibrary) return;
    let cancelled = false;
    let timer: number | undefined;

    async function load() {
      if (!hasLoadedDocuments.current) setDocumentsLoading(true);
      try {
        const result = await api.list();
        const active = result.documents.filter((document) =>
          ["uploaded", "queued", "processing"].includes(document.status),
        );
        const polled = await Promise.all(
          active.map(async (document) => {
            const response = await api.jobs(document.id);
            return [document.id, response.jobs[0]] as const;
          }),
        );
        if (cancelled) return;
        setRemoteDocuments(result.documents);
        setJobs(Object.fromEntries(polled));
        setDocumentsError("");
        if (active.length > 0) timer = window.setTimeout(() => void load(), 1_500);
      } catch (loadError) {
        if (!cancelled) setDocumentsError(errorMessage(loadError));
      } finally {
        if (!cancelled) {
          hasLoadedDocuments.current = true;
          setDocumentsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [api, isRemoteLibrary, refreshKey]);

  useEffect(() => {
    if (!selectedDocument || selectedDocument.status !== "ready") {
      setQuestions([]);
      setQuestionsError("");
      return;
    }
    let cancelled = false;
    setQuestionsLoading(true);
    void api
      .questions(selectedDocument.id)
      .then((response) => {
        if (!cancelled) {
          setQuestions(response.questions);
          setQuestionsError("");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setQuestionsError(errorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, selectedDocument]);

  const demoDocuments = data.documents.filter(
    (document) =>
      document.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === "all" || document.status === filter),
  );
  const actualDocuments = remoteDocuments.filter(
    (document) =>
      document.originalName.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === "all" || document.status === filter),
  );
  const visibleDocuments: Array<Document | StudyDocument> = isRemoteLibrary
    ? actualDocuments
    : demoDocuments;
  const { pageItems, page, pageCount, setPage } = usePagination(visibleDocuments);

  function setUpload(open: boolean) {
    setParams(open ? { upload: "1" } : {});
    setError("");
    setFile(null);
  }

  function validateFile(selectedFile: File): string {
    const extension = selectedFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !fileTypes[extension] ||
      (selectedFile.type && !fileTypes[extension].includes(selectedFile.type))
    ) {
      return "Định dạng không hợp lệ. Chọn PDF, DOCX, TXT, PNG, JPG hoặc WebP.";
    }
    if (selectedFile.size > 10 * 1_024 * 1_024 || selectedFile.size === 0) {
      return "File phải có nội dung và không vượt quá 10 MB.";
    }
    return "";
  }

  async function submitUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Hãy chọn một file.");
      return;
    }
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isRemoteLibrary) {
      setUploading(true);
      try {
        const result = await api.upload(file);
        setAdded(`Đã tải ${result.document.originalName}. Mạch đang tạo câu hỏi ở chế độ nền.`);
        setRemoteDocuments((current) => [result.document, ...current]);
        setJobs((current) => ({ ...current, [result.document.id]: result.job }));
        setUpload(false);
        setRefreshKey((value) => value + 1);
      } catch (uploadError) {
        setError(errorMessage(uploadError));
      } finally {
        setUploading(false);
      }
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    update((current) => ({
      ...current,
      documents: [
        {
          id: crypto.randomUUID(),
          title: file.name.slice(0, 180),
          type: extension.toUpperCase(),
          status: "local",
          size: formatBytes(file.size),
        },
        ...current.documents,
      ],
    }));
    setAdded(`Đã thêm thông tin ${file.name}. Chưa tải file lên máy chủ.`);
    setUpload(false);
  }

  async function retry(document: Document) {
    setDocumentsError("");
    try {
      const result = await api.process(document.id);
      setJobs((current) => ({ ...current, [document.id]: result.job }));
      setRemoteDocuments((current) =>
        current.map((item) => (item.id === document.id ? result.document : item)),
      );
      setAdded(`Đã đưa ${document.originalName} trở lại hàng đợi.`);
      setRefreshKey((value) => value + 1);
    } catch (retryError) {
      setDocumentsError(errorMessage(retryError));
    }
  }

  async function updateQuestion(question: Question, input: UpdateQuestionRequest) {
    if (!selectedDocument) return;
    setQuestionBusy(question.id);
    setQuestionsError("");
    try {
      const result = await api.updateQuestion(selectedDocument.id, question.id, input);
      setQuestions((current) =>
        current.map((item) => (item.id === question.id ? result.question : item)),
      );
    } catch (updateError) {
      setQuestionsError(errorMessage(updateError));
    } finally {
      setQuestionBusy("");
    }
  }

  async function reviewQuestion(question: Question, status: "approved" | "rejected") {
    if (!selectedDocument) return;
    setQuestionBusy(question.id);
    setQuestionsError("");
    try {
      const result = await api.reviewQuestion(selectedDocument.id, question.id, {
        status,
        version: question.version,
      });
      setQuestions((current) =>
        current.map((item) => (item.id === question.id ? result.question : item)),
      );
    } catch (reviewError) {
      setQuestionsError(errorMessage(reviewError));
    } finally {
      setQuestionBusy("");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Thư viện tài liệu"
        title="Một nơi cho mọi điều muốn học."
        description={
          role === "student"
            ? "Khám phá tài liệu mẫu và tiếp tục luyện tập. Tài liệu được giao từ lớp sẽ xuất hiện ở giai đoạn lớp học."
            : isRemoteLibrary
              ? "Tải tài liệu, theo dõi tiến trình trích xuất và duyệt câu hỏi trước khi dùng."
              : "Sắp xếp tài liệu mẫu hoặc đăng nhập để tải file và tạo câu hỏi thật."
        }
        action={
          role !== "student" && (
            <Button onClick={() => setUpload(true)}>
              <FileUp className="size-4" />
              Thêm tài liệu
            </Button>
          )
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Tìm tài liệu</span>
          <Search className="absolute left-4 top-3.5 size-4 text-ink-muted" />
          <input
            className="field pl-11"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên tài liệu…"
          />
        </label>
        <label>
          <span className="sr-only">Trạng thái tài liệu</span>
          <select
            className="field"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Mọi trạng thái</option>
            {isRemoteLibrary ? (
              <>
                <option value="queued">Đang chờ</option>
                <option value="processing">Đang xử lý</option>
                <option value="ready">Sẵn sàng</option>
                <option value="failed">Có lỗi</option>
              </>
            ) : (
              <>
                <option value="ready">Sẵn sàng</option>
                <option value="review">Chờ duyệt</option>
                <option value="local">File đã chọn</option>
              </>
            )}
          </select>
        </label>
      </div>
      <p role="status" className="mb-3 min-h-5 text-sm text-ink-muted">
        {documentsLoading ? "Đang đồng bộ thư viện…" : added}
      </p>
      {documentsError && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-sm"
        >
          <span>{documentsError}</span>
          <Button variant="secondary" onClick={() => setRefreshKey((value) => value + 1)}>
            <RotateCcw className="size-4" /> Thử lại
          </Button>
        </div>
      )}
      {visibleDocuments.length ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {pageItems.map((item) => {
            if (!("originalName" in item)) {
              const document = item as StudyDocument;
              return (
                <article className="panel flex min-w-0 flex-col p-6" key={document.id}>
                  <div className="mb-8 flex items-start justify-between gap-3">
                    <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-tree">
                      <FileText className="size-6" strokeWidth={1.5} />
                    </span>
                    <Badge tone={document.status === "review" ? "accent" : "muted"}>
                      {demoStatusLabels[document.status]}
                    </Badge>
                  </div>
                  <p className="eyebrow mb-2">
                    {document.type} · {document.size}
                  </p>
                  <h2 className="break-words font-display text-2xl font-semibold">
                    {document.title}
                  </h2>
                  <p className="mb-6 mt-3 text-sm leading-6 text-ink-muted">
                    {document.status === "local"
                      ? "Tên và dung lượng đã lưu trên trình duyệt. File chưa được tải lên máy chủ."
                      : "Tài liệu minh họa để bạn khám phá luồng học tập của Mạch."}
                  </p>
                  <Button
                    className="mt-auto w-full justify-between"
                    variant="secondary"
                    onClick={() => setSelectedDemo(document)}
                  >
                    {document.status === "review" && role === "teacher"
                      ? "Xem & duyệt mẫu"
                      : "Xem tài liệu"}
                    <ArrowUpRight className="size-4" />
                  </Button>
                </article>
              );
            }

            const document = item as Document;
            const job = jobs[document.id];
            return (
              <article className="panel flex min-w-0 flex-col p-6" key={document.id}>
                <div className="mb-7 flex items-start justify-between gap-3">
                  <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-tree">
                    {document.status === "queued" || document.status === "processing" ? (
                      <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <FileText className="size-6" strokeWidth={1.5} />
                    )}
                  </span>
                  <Badge
                    tone={
                      document.status === "failed"
                        ? "accent"
                        : document.status === "ready"
                          ? "blue"
                          : "muted"
                    }
                  >
                    {documentStatusLabels[document.status]}
                  </Badge>
                </div>
                <p className="eyebrow mb-2">
                  {document.extension.toUpperCase()} · {formatBytes(document.byteSize)}
                </p>
                <h2 className="break-words font-display text-2xl font-semibold">
                  {document.originalName}
                </h2>
                {(document.status === "queued" || document.status === "processing") && (
                  <div className="my-5">
                    <div className="mb-2 flex justify-between text-xs text-ink-muted tabular-nums">
                      <span>
                        Lần xử lý {job?.attempt ?? 0}/{job?.maxAttempts ?? 3}
                      </span>
                      <span>{job?.progress ?? 0}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-surface-raised"
                      role="progressbar"
                      aria-label={`Tiến trình ${document.originalName}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={job?.progress ?? 0}
                    >
                      <div
                        className="h-full rounded-full bg-focus transition-[width] motion-reduce:transition-none"
                        style={{ width: `${job?.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}
                <p className="mb-6 mt-3 text-sm leading-6 text-ink-muted">
                  {document.processingError?.message ??
                    (document.status === "ready"
                      ? `${document.characterCount?.toLocaleString("vi-VN") ?? 0} ký tự đã trích xuất. Mở để kiểm tra câu hỏi.`
                      : "Bạn có thể rời trang; tác vụ tiếp tục ở chế độ nền.")}
                </p>
                {document.status === "failed" ? (
                  <Button
                    className="mt-auto w-full"
                    variant="secondary"
                    onClick={() => void retry(document)}
                  >
                    <RotateCcw className="size-4" /> Thử xử lý lại
                  </Button>
                ) : (
                  <Button
                    className="mt-auto w-full justify-between"
                    variant="secondary"
                    disabled={document.status !== "ready"}
                    onClick={() => setSelectedDocument(document)}
                  >
                    {document.status === "ready" ? "Xem & duyệt câu hỏi" : "Đang chuẩn bị"}
                    <ArrowUpRight className="size-4" />
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      ) : documentsLoading ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3" aria-label="Đang tải tài liệu">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="panel h-72 animate-pulse bg-surface-raised motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            isRemoteLibrary && remoteDocuments.length === 0
              ? "Thư viện đang chờ tài liệu đầu tiên"
              : "Chưa tìm thấy tài liệu"
          }
          description={
            isRemoteLibrary && remoteDocuments.length === 0
              ? "Tải một bài đọc hoặc ảnh bài học; Mạch sẽ trích xuất và tạo bộ câu hỏi nền."
              : "Thử một từ khóa khác hoặc bỏ bộ lọc để xem lại thư viện."
          }
          action={
            isRemoteLibrary && remoteDocuments.length === 0 ? (
              <Button onClick={() => setUpload(true)}>
                <FileUp className="size-4" /> Tải tài liệu
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Bỏ bộ lọc
              </Button>
            )
          }
        />
      )}
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      <aside className="mt-8 flex items-start gap-3 rounded-2xl border border-dashed border-line p-5 text-sm leading-6 text-ink-muted">
        <FileUp className="mt-1 size-5 shrink-0" />
        <p>
          PDF, DOCX, TXT và ảnh · Tối đa 10 MB/file.{" "}
          {isRemoteLibrary
            ? "File được lưu riêng tư; AI local mock đang dùng trong môi trường phát triển và mọi câu hỏi đều cần bạn xác nhận."
            : "Bản trải nghiệm chỉ lưu metadata trên thiết bị; đăng nhập để dùng pipeline máy chủ."}
        </p>
      </aside>

      <Modal
        open={uploadOpen}
        onOpenChange={setUpload}
        title="Thêm một tài liệu mới"
        description={
          isRemoteLibrary
            ? "File sẽ được gửi lên kho riêng tư và xử lý nền sau khi kiểm tra định dạng."
            : "Chọn file để thử giao diện. Nội dung file không được gửi đi khi chưa đăng nhập."
        }
      >
        <form onSubmit={(event) => void submitUpload(event)}>
          <label htmlFor="document-file" className="field-label">
            File tài liệu
          </label>
          <input
            id="document-file"
            className="field py-4 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:text-ink"
            type="file"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError("");
            }}
          />
          <p className="mt-2 text-xs text-ink-muted">
            Không dùng tài liệu nhạy cảm trong môi trường phát triển.
          </p>
          <p role="alert" className="mt-3 min-h-5 text-sm text-accent-strong">
            {error}
          </p>
          <Button className="mt-5 w-full" type="submit" disabled={uploading}>
            {uploading && (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            )}
            {isRemoteLibrary ? "Tải lên & tạo câu hỏi" : "Thêm vào thư viện demo"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={selectedDemo !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDemo(null);
        }}
        title={selectedDemo?.title ?? "Tài liệu"}
        description="Xem trước dữ liệu minh họa — không phải nội dung file vừa tải."
      >
        {selectedDemo?.status === "local" ? (
          <p className="text-sm leading-6 text-ink-muted">
            File này mới được chọn trên thiết bị. Đăng nhập để tải lên và tạo câu hỏi.
          </p>
        ) : (
          <>
            <div className="rounded-2xl bg-canvas p-5 text-sm leading-7">
              <h3 className="mb-3 font-semibold">A little progress, every day</h3>
              <p>
                Learning a language takes time. Small habits make it easier to keep going. Read a
                short paragraph, write a sentence, or review five new words.
              </p>
            </div>
            {selectedDemo?.status === "review" && role === "teacher" ? (
              <div className="mt-5">
                <p className="mb-4 text-sm leading-6 text-ink-muted">
                  Đây là thao tác duyệt trạng thái demo, chưa xuất bản hay giao câu hỏi cho học
                  sinh.
                </p>
                <Button
                  onClick={() => {
                    if (!selectedDemo) return;
                    update((current) => ({
                      ...current,
                      documents: current.documents.map((document) =>
                        document.id === selectedDemo.id
                          ? { ...document, status: "ready" }
                          : document,
                      ),
                    }));
                    setSelectedDemo(null);
                    setAdded("Đã duyệt trạng thái tài liệu mẫu. Chưa giao cho lớp.");
                  }}
                >
                  <Check className="size-4" /> Duyệt bản mẫu
                </Button>
              </div>
            ) : (
              <LinkButton className="mt-5" to="/practice/small-habits">
                Thử bài luyện minh họa
              </LinkButton>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={selectedDocument !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDocument(null);
        }}
        title={selectedDocument?.originalName ?? "Bộ câu hỏi"}
        description="Kiểm tra nội dung AI tạo, chỉnh sửa nếu cần rồi duyệt hoặc loại từng câu. Chưa có câu nào được giao cho học sinh."
      >
        {questionsError && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-accent/50 bg-accent/10 p-4 text-sm"
          >
            {questionsError}
          </p>
        )}
        {questionsLoading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> Đang tải bộ
            câu hỏi…
          </p>
        ) : questions.length ? (
          <div className="space-y-4">
            {questions.map((question) => (
              <QuestionEditor
                key={`${question.id}-${question.version}`}
                question={question}
                busy={questionBusy === question.id}
                onUpdate={(input) => updateQuestion(question, input)}
                onReview={(status) => reviewQuestion(question, status)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-ink-muted">
            Chưa có câu hỏi trong tài liệu này. Thử xử lý lại nếu trạng thái vừa thay đổi.
          </p>
        )}
      </Modal>
    </>
  );
}
