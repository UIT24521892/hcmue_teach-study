import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Plus, Users, BookOpenText } from "lucide-react";
import { Button } from "@mach/ui";
import {
  PageHeading,
  Badge,
  Modal,
  LinkButton,
  EmptyState,
  Pagination,
} from "../../components/page-ui";
import { usePagination } from "../../lib/use-pagination";
import { useDemo } from "../demo/context";

export function ClassesPage() {
  const { data, update } = useDemo();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const { pageItems, page, pageCount, setPage } = usePagination(data.classes);
  if (data.role === "self_learner")
    return (
      <EmptyState
        title="Không gian tự học của bạn"
        description="Người tự học không cần tham gia lớp. Tài liệu và bài luyện riêng luôn sẵn sàng."
        action={<LinkButton to="/practice">Đến bài luyện</LinkButton>}
      />
    );
  return (
    <>
      <PageHeading
        eyebrow={data.role === "teacher" ? "Không gian giảng dạy" : "Cùng học, cùng tiến bộ"}
        title="Mỗi lớp học, một hành trình."
        description={
          data.role === "teacher"
            ? "Một góc nhìn gọn gàng về các lớp, tài liệu và nhịp học của học sinh."
            : "Theo dõi lớp và bài luyện của bạn trong không gian chung."
        }
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            {data.role === "teacher" ? "Tạo lớp mới" : "Tham gia lớp"}
          </Button>
        }
      />
      <div className="grid gap-5 md:grid-cols-2">
        {pageItems.map((classroom, i) => (
          <article className="panel overflow-hidden" key={classroom.id}>
            <div className="flex items-center justify-between border-b border-line bg-accent/5 px-6 py-5">
              <span className="font-display text-3xl text-tree/70">
                Lớp {String(page * 6 + i + 1).padStart(2, "0")}
              </span>
              <Users className="size-7 text-tree" strokeWidth={1.3} />
            </div>
            <div className="p-6">
              <Badge>{classroom.members ? "Lớp mẫu" : "Bản nháp cục bộ"}</Badge>
              <h2 className="mb-2 mt-4 break-words font-display text-2xl font-semibold">
                {classroom.name}
              </h2>
              <p className="min-h-12 text-sm leading-6 text-ink-muted">
                {classroom.description || "Một hành trình học tập mới đang bắt đầu."}
              </p>
              <div className="mb-5 mt-5 flex flex-wrap gap-4 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-2">
                  <Users className="size-4" />
                  {classroom.members} học sinh mẫu
                </span>
                <span className="inline-flex items-center gap-2">
                  <BookOpenText className="size-4" />
                  {classroom.members ? 1 : 0} bài minh họa
                </span>
              </div>
              <LinkButton
                to={`/classes/${classroom.id}`}
                secondary
                className="w-full justify-between"
              >
                Vào không gian lớp
                <ArrowUpRight className="size-4" />
              </LinkButton>
            </div>
          </article>
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={data.role === "teacher" ? "Tạo lớp học" : "Tham gia lớp bằng mã"}
        description="Chế độ demo — chưa tạo lớp hay membership trên máy chủ."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (data.role === "student") {
              setError(
                "Chưa kết nối API tham gia lớp. Bạn có thể mở hai lớp mẫu để xem giao diện.",
              );
              return;
            }
            if (!name.trim()) {
              setError("Vui lòng nhập tên lớp.");
              return;
            }
            update((current) => ({
              ...current,
              classes: [
                ...current.classes,
                {
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  description,
                  members: 0,
                  code: "CHƯA CẤP",
                },
              ],
            }));
            setOpen(false);
            setName("");
            setDescription("");
          }}
        >
          <label htmlFor="class-name" className="field-label">
            {data.role === "teacher" ? "Tên lớp" : "Mã lớp"}
          </label>
          <input
            id="class-name"
            className="field"
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder={
              data.role === "teacher" ? "Ví dụ: Tiếng Anh 11A1" : "Nhập mã giáo viên cung cấp"
            }
            required
          />
          {data.role === "teacher" && (
            <>
              <label htmlFor="class-description" className="field-label mt-4">
                Mô tả ngắn
              </label>
              <textarea
                id="class-description"
                className="field"
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </>
          )}
          <p role="alert" className="mt-3 text-sm text-accent-strong">
            {error}
          </p>
          <Button type="submit" className="mt-5 w-full">
            {data.role === "teacher" ? "Lưu lớp demo" : "Kiểm tra mã"}
          </Button>
        </form>
      </Modal>
    </>
  );
}

export function ClassDetailPage() {
  const { classId } = useParams();
  const { data } = useDemo();
  const [tab, setTab] = useState("assignments");
  const classroom = data.classes.find((c) => c.id === classId);
  if (!classroom || data.role === "self_learner")
    return (
      <EmptyState
        title="Không tìm thấy lớp"
        description="Lớp không có trong không gian demo hiện tại."
        action={<LinkButton to="/classes">Về danh sách lớp</LinkButton>}
      />
    );
  return (
    <>
      <Link
        className="focus-ring mb-5 inline-flex min-h-11 items-center rounded-lg text-sm text-ink-muted"
        to="/classes"
      >
        ← Tất cả lớp học
      </Link>
      <PageHeading
        eyebrow="Không gian lớp · dữ liệu mẫu"
        title={classroom.name}
        description={classroom.description || "Chưa có mô tả lớp."}
        action={<Badge>Mã minh họa: {classroom.code}</Badge>}
      />
      <div className="mb-6 flex gap-2">
        {[
          { id: "assignments", label: "Bài được giao" },
          ...(data.role === "teacher" ? [{ id: "members", label: "Học sinh & tiến độ" }] : []),
        ].map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "primary" : "secondary"}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {classroom.members === 0 ? (
        <EmptyState
          title="Lớp học vừa nảy mầm"
          description="Bản nháp đã được lưu. Mời học sinh và giao bài sẽ hoạt động sau khi kết nối API lớp học."
          action={<LinkButton to="/documents">Chuẩn bị tài liệu</LinkButton>}
        />
      ) : tab === "assignments" ? (
        <article className="panel p-6">
          <Badge tone="accent">Bài minh họa · Không có hạn nộp</Badge>
          <h2 className="mb-3 mt-4 font-display text-2xl font-semibold">
            Small habits, big changes
          </h2>
          <p className="mb-6 text-sm leading-6 text-ink-muted">
            Reading · 5 câu hỏi · 10 phút. Kết quả demo chỉ lưu trên thiết bị, không gửi cho giáo
            viên.
          </p>
          <LinkButton to="/practice/small-habits">
            {data.role === "teacher" ? "Xem thử bài luyện" : "Bắt đầu làm bài"}
          </LinkButton>
        </article>
      ) : (
        <section className="panel overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="p-5 text-left text-xs text-ink-muted">
              3 học sinh minh họa, không phải dữ liệu kết quả thật.
            </caption>
            <thead className="border-y border-line bg-surface-raised text-xs text-ink-muted">
              <tr>
                <th scope="col" className="p-4">
                  Học sinh
                </th>
                <th scope="col" className="p-4">
                  Trạng thái
                </th>
                <th scope="col" className="p-4">
                  Điểm mẫu
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["An Nguyễn", "Đã hoàn thành", "80%"],
                ["Bảo Trần", "Đang luyện tập", "—"],
                ["Chi Lê", "Đã hoàn thành", "100%"],
              ].map(([name, status, score]) => (
                <tr key={name} className="border-b border-line last:border-0">
                  <td className="p-4 font-medium">{name}</td>
                  <td className="p-4 text-ink-muted">{status}</td>
                  <td className="p-4 tabular-nums">{score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
