import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, FileUp, Search, ArrowUpRight, Check } from "lucide-react";
import { Button } from "@mach/ui";
import {
  PageHeading,
  Badge,
  EmptyState,
  Modal,
  LinkButton,
  Pagination,
} from "../../components/page-ui";
import { usePagination } from "../../lib/use-pagination";
import { useDemo } from "../demo/context";
import type { StudyDocument } from "../demo/schema";

const statusLabels = {
  ready: "Sẵn sàng · mẫu",
  review: "Chờ duyệt · mẫu",
  local: "Chỉ lưu tên file",
};
const fileTypes: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
};

export function DocumentsPage() {
  const { data, update } = useDemo();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<StudyDocument | null>(null);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [added, setAdded] = useState("");
  const uploadOpen = params.get("upload") === "1" && data.role !== "student";
  const documents = data.documents.filter(
    (doc) =>
      doc.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === "all" || doc.status === filter),
  );
  const { pageItems, page, pageCount, setPage } = usePagination(documents);
  function setUpload(open: boolean) {
    setParams(open ? { upload: "1" } : {});
    setError("");
    setFile(null);
  }
  return (
    <>
      <PageHeading
        eyebrow="Thư viện tài liệu"
        title="Một nơi cho mọi điều muốn học."
        description={
          data.role === "student"
            ? "Khám phá tài liệu mẫu và tiếp tục luyện tập. Tài liệu được giao từ lớp sẽ xuất hiện khi kết nối API."
            : "Sắp xếp tài liệu, xem lại nội dung và chuẩn bị cho buổi luyện tập tiếp theo."
        }
        action={
          data.role !== "student" && (
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên tài liệu…"
          />
        </label>
        <label>
          <span className="sr-only">Trạng thái tài liệu</span>
          <select className="field" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Mọi trạng thái</option>
            <option value="ready">Sẵn sàng</option>
            <option value="review">Chờ duyệt</option>
            <option value="local">File đã chọn</option>
          </select>
        </label>
      </div>
      <p role="status" className="mb-3 text-sm text-ink-muted">
        {added}
      </p>
      {documents.length ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {pageItems.map((doc) => (
            <article className="panel flex min-w-0 flex-col p-6" key={doc.id}>
              <div className="mb-8 flex items-start justify-between gap-3">
                <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-tree">
                  <FileText className="size-6" strokeWidth={1.5} />
                </span>
                <Badge tone={doc.status === "review" ? "accent" : "muted"}>
                  {statusLabels[doc.status]}
                </Badge>
              </div>
              <p className="eyebrow mb-2">
                {doc.type} · {doc.size}
              </p>
              <h2 className="break-words font-display text-2xl font-semibold">{doc.title}</h2>
              <p className="mb-6 mt-3 text-sm leading-6 text-ink-muted">
                {doc.status === "local"
                  ? "Tên và dung lượng đã lưu trên trình duyệt. File chưa được tải lên máy chủ."
                  : "Tài liệu minh họa để bạn khám phá luồng học tập của Mạch."}
              </p>
              <Button
                className="mt-auto w-full justify-between"
                variant="secondary"
                onClick={() => setSelected(doc)}
              >
                {doc.status === "review" && data.role === "teacher"
                  ? "Xem & duyệt mẫu"
                  : "Xem tài liệu"}
                <ArrowUpRight className="size-4" />
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa tìm thấy tài liệu"
          description="Thử một từ khóa khác hoặc bỏ bộ lọc để xem lại thư viện."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Bỏ bộ lọc
            </Button>
          }
        />
      )}
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      <aside className="mt-8 flex items-start gap-3 rounded-2xl border border-dashed border-line p-5 text-sm leading-6 text-ink-muted">
        <FileUp className="mt-1 size-5 shrink-0" />
        <p>
          PDF, DOCX, TXT và ảnh · Tối đa 10 MB/file. Bản trải nghiệm chỉ kiểm tra file ở trình duyệt
          và lưu thông tin; upload, trích xuất và sinh câu hỏi AI chưa kết nối.
        </p>
      </aside>
      <Modal
        open={uploadOpen}
        onOpenChange={setUpload}
        title="Thêm một tài liệu mới"
        description="Chọn file để thử giao diện. Không có nội dung file nào được gửi đi."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) {
              setError("Hãy chọn một file.");
              return;
            }
            const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
            if (!fileTypes[extension] || (file.type && !fileTypes[extension].includes(file.type))) {
              setError("Định dạng không hợp lệ. Chọn PDF, DOCX, TXT, PNG hoặc JPG.");
              return;
            }
            if (file.size > 10 * 1024 * 1024 || file.size === 0) {
              setError("File phải có nội dung và không vượt quá 10 MB.");
              return;
            }
            update((current) => ({
              ...current,
              documents: [
                {
                  id: crypto.randomUUID(),
                  title: file.name.slice(0, 240),
                  type: extension.toUpperCase(),
                  status: "local",
                  size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
                },
                ...current.documents,
              ],
            }));
            setAdded(`Đã thêm thông tin ${file.name}. Chưa tải file lên máy chủ.`);
            setUpload(false);
          }}
        >
          <label htmlFor="document-file" className="field-label">
            File tài liệu
          </label>
          <input
            id="document-file"
            className="field py-4 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:text-ink"
            type="file"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError("");
            }}
          />
          <p className="mt-2 text-xs text-ink-muted">
            Không dùng tài liệu nhạy cảm trong bản demo.
          </p>
          <p role="alert" className="mt-3 text-sm text-accent-strong">
            {error}
          </p>
          <Button className="mt-5 w-full" type="submit">
            Thêm vào thư viện demo
          </Button>
        </form>
      </Modal>
      <Modal
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title ?? "Tài liệu"}
        description="Xem trước dữ liệu minh họa — không phải nội dung file vừa tải."
      >
        {selected?.status === "local" ? (
          <p className="text-sm leading-6 text-ink-muted">
            File này mới được chọn trên thiết bị. Chưa có bản xem trước hoặc câu hỏi; cần hoàn thành
            document pipeline ở backend.
          </p>
        ) : (
          <>
            <div className="rounded-2xl bg-canvas p-5 text-sm leading-7">
              <h3 className="mb-3 font-semibold">A little progress, every day</h3>
              <p>
                Learning a language takes time. Small habits make it easier to keep going. Read a
                short paragraph, write a sentence, or review five new words. A little progress every
                day adds up to big results.
              </p>
            </div>
            {selected?.status === "review" && data.role === "teacher" ? (
              <div className="mt-5">
                <p className="mb-4 text-sm leading-6 text-ink-muted">
                  Đây là thao tác duyệt trạng thái demo, chưa xuất bản hay giao câu hỏi cho học
                  sinh.
                </p>
                <Button
                  onClick={() => {
                    if (!selected) return;
                    update((current) => ({
                      ...current,
                      documents: current.documents.map((doc) =>
                        doc.id === selected.id ? { ...doc, status: "ready" } : doc,
                      ),
                    }));
                    setSelected(null);
                    setAdded("Đã duyệt trạng thái tài liệu mẫu. Chưa giao cho lớp.");
                  }}
                >
                  <Check className="size-4" />
                  Duyệt bản mẫu
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
    </>
  );
}
