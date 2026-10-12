import { useState } from "react";
import { CalendarClock, Loader2, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@mach/ui";

import { Badge, PageHeading } from "../../components/page-ui";
import { roleLabels } from "../../lib/roles";
import { ApiError } from "./api-client";
import { useAuth } from "./auth-context";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(date);
}

/**
 * The first screen backed entirely by the real API: every field here comes from
 * `GET /auth/me`, not from demo storage.
 */
export function AccountPage() {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="panel grid min-h-48 place-items-center p-8 text-center">
        <div>
          <Loader2 className="mx-auto mb-3 size-5 animate-spin text-ink-muted" aria-hidden="true" />
          <p role="status" className="text-sm text-ink-muted">
            Đang tải hồ sơ…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Tài khoản thật"
        title="Hồ sơ của bạn."
        description="Dữ liệu trên trang này đến từ máy chủ qua phiên đăng nhập thật, không phải dữ liệu mẫu."
        action={<Badge tone="blue">Đã xác thực</Badge>}
      />

      <section className="panel max-w-3xl p-6 sm:p-8">
        <div className="mb-7 flex flex-wrap items-center gap-4 border-b border-line pb-6">
          <span className="grid size-16 place-items-center rounded-full bg-accent/20 font-display text-2xl">
            {user.name.trim().slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold">{user.name}</h2>
            <p className="mt-1 text-xs text-ink-muted">{user.email}</p>
          </div>
        </div>

        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <UserRound className="size-4" aria-hidden="true" />
              Vai trò
            </dt>
            <dd className="mt-2 text-sm">{roleLabels[user.role]}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <Mail className="size-4" aria-hidden="true" />
              Email
            </dt>
            <dd className="mt-2 break-all text-sm">{user.email}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <CalendarClock className="size-4" aria-hidden="true" />
              Thành viên từ
            </dt>
            <dd className="mt-2 text-sm">{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Múi giờ
            </dt>
            <dd className="mt-2 text-sm">{user.timezone}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setError("");
              void logout()
                .catch((caught: unknown) => {
                  setError(
                    caught instanceof ApiError
                      ? caught.message
                      : "Không thể thu hồi phiên trên máy chủ. Vui lòng kiểm tra kết nối và thử lại.",
                  );
                })
                .finally(() => setPending(false));
            }}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            {pending ? "Đang đăng xuất…" : "Đăng xuất"}
          </Button>
          <p className="text-xs leading-6 text-ink-muted">
            Đăng xuất thu hồi phiên trên máy chủ, không chỉ xoá trạng thái trên trình duyệt.
          </p>
          {error && (
            <p role="alert" className="w-full text-sm leading-6 text-accent-strong">
              {error}
            </p>
          )}
        </div>
      </section>

      <aside className="mt-6 max-w-3xl rounded-2xl border border-dashed border-line p-6">
        <h2 className="text-sm font-semibold">Các trang khác vẫn là bản trải nghiệm</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Tài liệu, lớp học, bài luyện, ghi chú và tiến độ hiện dùng dữ liệu mẫu lưu trên trình
          duyệt. Chúng sẽ được nối vào API ở các giai đoạn tương ứng trong kế hoạch.
        </p>
      </aside>
    </>
  );
}
