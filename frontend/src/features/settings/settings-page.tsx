import { useState } from "react";
import { Button } from "@mach/ui";
import { Save } from "lucide-react";
import { PageHeading, Badge } from "../../components/page-ui";
import { roleLabels } from "../../lib/roles";
import { useEffectiveRole } from "../auth/use-effective-role";
import { useDemo } from "../demo/context";

export function SettingsPage() {
  const { data, update, storageError } = useDemo();
  const effectiveRole = useEffectiveRole();
  const [name, setName] = useState(data.name);
  const [goal, setGoal] = useState(data.goal);
  const [saved, setSaved] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="Cài đặt không gian"
        title="Học theo cách của bạn."
        description="Điều chỉnh hồ sơ demo và nhịp học. Tất cả thay đổi chỉ lưu trên trình duyệt hiện tại."
      />
      <form
        className="panel max-w-3xl p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setSaved("Tên hiển thị không được để trống.");
            return;
          }
          update((current) => ({
            ...current,
            name: name.trim(),
            goal,
          }));
          setSaved("Đã lưu cài đặt demo.");
        }}
      >
        <div className="mb-7 flex items-center gap-4 border-b border-line pb-6">
          <span className="grid size-16 place-items-center rounded-full bg-accent/20 font-display text-2xl">
            {name.trim().slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold">Hồ sơ trên thiết bị</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Tên hiển thị và mục tiêu chỉ lưu trên trình duyệt này
            </p>
          </div>
        </div>
        <label htmlFor="profile-name" className="field-label">
          Tên hiển thị
        </label>
        <input
          id="profile-name"
          className="field"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="mt-5">
          <p className="field-label">Vai trò tài khoản</p>
          <p className="field mt-2 flex items-center" aria-label="Vai trò tài khoản">
            {roleLabels[effectiveRole]}
          </p>
          <p className="mt-2 text-xs leading-6 text-ink-muted">
            Vai trò do máy chủ xác thực. Cài đặt trên thiết bị không thay đổi quyền tài khoản.
          </p>
        </div>
        <label htmlFor="weekly-goal" className="field-label mt-5">
          Mục tiêu mỗi tuần
        </label>
        <select
          id="weekly-goal"
          className="field"
          value={goal}
          onChange={(e) => setGoal(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((value) => (
            <option key={value} value={value}>
              {value} ngày học / tuần
            </option>
          ))}
        </select>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Badge>{Intl.DateTimeFormat().resolvedOptions().timeZone}</Badge>
          <Button type="submit">
            <Save className="size-4" />
            Lưu thay đổi
          </Button>
        </div>
        <p role="status" className="mt-4 text-sm leading-6 text-ink-muted">
          {storageError || saved}
        </p>
      </form>
      <aside className="mt-6 max-w-3xl rounded-2xl border border-dashed border-line p-6">
        <h2 className="text-sm font-semibold">Tài khoản & bảo mật</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Đăng ký, đăng nhập và phiên tài khoản đã kết nối máy chủ. Đổi/khôi phục mật khẩu, chỉnh
          sửa hồ sơ và đồng bộ dữ liệu học tập vẫn nằm trong kế hoạch Auth/RBAC.
        </p>
      </aside>
    </>
  );
}
