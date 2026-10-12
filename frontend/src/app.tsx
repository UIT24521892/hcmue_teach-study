import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BookOpenText,
  CalendarDays,
  ChartNoAxesCombined,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sprout,
  Sun,
  Users,
  X,
} from "lucide-react";
import { LogoMark } from "@mach/ui";
import { cn } from "./lib/cn";
import { initialsOf, roleLabels } from "./lib/roles";
import { Badge, EmptyState, LinkButton, Modal } from "./components/page-ui";
import { DemoProvider } from "./features/demo/provider";
import { useDemo } from "./features/demo/context";
import { AuthProvider } from "./features/auth/auth-provider";
import { useAuth } from "./features/auth/auth-context";
import { LoginPage, RegisterPage } from "./features/auth/auth-page";
import { AccountPage } from "./features/auth/account-page";
import { RequireAuth } from "./features/auth/require-auth";
import { useEffectiveRole } from "./features/auth/use-effective-role";
import { DashboardPage } from "./features/dashboard/dashboard-page";
import { DocumentsPage } from "./features/documents/documents-page";
import { ClassesPage, ClassDetailPage } from "./features/classes/classes-page";
import { NotesPage } from "./features/notes/notes-page";
import { ProgressPage } from "./features/progress/progress-page";
import { SettingsPage } from "./features/settings/settings-page";
import { PracticePage, QuizPage, ResultPage } from "./features/practice/practice-page";
import { AttemptPage } from "./features/attempts/attempt-page";

const navigation = [
  { label: "Tổng quan", path: "/", icon: LayoutDashboard },
  { label: "Lớp học", path: "/classes", icon: Users },
  { label: "Tài liệu", path: "/documents", icon: BookOpenText },
  { label: "Bài luyện", path: "/practice", icon: GraduationCap },
  { label: "Ghi chú", path: "/notes", icon: CalendarDays },
  { label: "Tiến độ", path: "/progress", icon: ChartNoAxesCombined },
];
type Theme = "light" | "dark";
function readPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function initialTheme(): Theme {
  const saved = readPreference("mach-theme");
  return saved === "dark" || saved === "light"
    ? saved
    : window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
}

function Navigation({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { data } = useDemo();
  const role = useEffectiveRole();

  return (
    <>
      <nav aria-label="Điều hướng chính" className="space-y-1.5">
        {navigation
          .filter((item) => role !== "self_learner" || item.path !== "/classes")
          .map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "focus-ring flex min-h-12 items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-ink text-canvas"
                    : "text-ink-muted hover:bg-surface-raised hover:text-ink",
                )
              }
            >
              <item.icon className="size-5 shrink-0" aria-hidden="true" />
              <span className={cn(collapsed && "sr-only")}>{item.label}</span>
            </NavLink>
          ))}
      </nav>
      <div className="mt-auto pt-8">
        {!collapsed && (
          <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
            <Sprout className="mb-3 size-5 text-tree" />
            <p className="font-display text-lg font-semibold">Đều đặn hơn, mỗi ngày.</p>
            <p className="mt-2 text-xs leading-6 text-ink-muted">
              Mục tiêu của bạn: {data.goal} ngày học mỗi tuần. Một bước nhỏ hôm nay vẫn có ý nghĩa.
            </p>
          </div>
        )}
        <NavLink
          to="/settings"
          onClick={onNavigate}
          title={collapsed ? "Cài đặt" : undefined}
          className={({ isActive }) =>
            cn(
              "focus-ring flex min-h-12 items-center gap-3 rounded-2xl px-3.5 py-3 text-sm",
              collapsed && "justify-center px-0",
              isActive ? "bg-ink text-canvas" : "text-ink-muted hover:bg-surface-raised",
            )
          }
        >
          <Settings className="size-5 shrink-0" aria-hidden="true" />
          <span className={cn(collapsed && "sr-only")}>Cài đặt</span>
        </NavLink>
      </div>
    </>
  );
}
function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="Mạch — Tổng quan"
      className="focus-ring flex items-center gap-3 rounded-xl"
    >
      <LogoMark className="size-10 text-ink" />
      <span className={cn("font-display text-3xl font-bold", collapsed && "sr-only")}>
        Mạch<span className="text-accent-strong">.</span>
      </span>
    </Link>
  );
}
function AppShell() {
  const { storageError } = useDemo();
  const { user } = useAuth();
  const role = useEffectiveRole();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [collapsed, setCollapsed] = useState(
    () => readPreference("mach-sidebar-collapsed") === "true",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [preferenceError, setPreferenceError] = useState("");
  const isQuiz = /^\/(practice|attempts)\/[^/]+$/.test(location.pathname);
  const pageTitle =
    [
      ...navigation,
      { label: "Cài đặt", path: "/settings" },
      { label: "Tài khoản", path: "/account" },
      { label: "Bài làm", path: "/attempts/" },
    ].find((item) =>
      item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path),
    )?.label ?? (location.pathname.startsWith("/results/") ? "Kết quả bài luyện" : "Mạch");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("mach-theme", theme);
      localStorage.setItem("mach-sidebar-collapsed", String(collapsed));
      setPreferenceError("");
    } catch {
      setPreferenceError("Không lưu được tùy chọn giao diện trên trình duyệt này.");
    }
  }, [theme, collapsed]);
  useEffect(() => {
    document.title = `${pageTitle} · Mạch`;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0, behavior: "instant" });
  }, [location.pathname, pageTitle]);
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="focus-ring fixed left-4 top-4 z-50 -translate-y-24 rounded-full bg-ink px-5 py-3 text-canvas focus:translate-y-0"
      >
        Đến nội dung chính
      </a>
      {!isQuiz && (
        <aside
          id="dashboard-sidebar"
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col overflow-y-auto border-r border-line bg-canvas px-5 py-6 lg:flex",
            collapsed ? "w-[5.5rem] px-3" : "w-[17.5rem]",
          )}
        >
          <div
            className={cn("mb-10 flex items-center justify-between gap-2", collapsed && "flex-col")}
          >
            <Brand collapsed={collapsed} />
            <button
              aria-controls="dashboard-sidebar"
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
              title={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
              className="icon-button size-9"
              onClick={() => setCollapsed((value) => !value)}
            >
              <CollapseIcon className="size-4" />
            </button>
          </div>
          <Navigation collapsed={collapsed} />
        </aside>
      )}
      <div className={cn(!isQuiz && (collapsed ? "lg:pl-[5.5rem]" : "lg:pl-[17.5rem]"))}>
        <header className="sticky top-0 z-20 flex min-h-[4.5rem] items-center gap-3 border-b border-line bg-canvas/95 px-4 sm:px-7 lg:px-9">
          {!isQuiz ? (
            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Trigger asChild>
                <button className="icon-button lg:hidden" aria-label="Mở menu">
                  <Menu className="size-5" />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
                <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,90vw)] flex-col overflow-y-auto border-r border-line bg-canvas p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  <Dialog.Title className="sr-only">Menu điều hướng</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Chọn trang trong không gian học tập Mạch.
                  </Dialog.Description>
                  <div className="mb-8 flex items-center justify-between">
                    <Brand />
                    <Dialog.Close className="icon-button" aria-label="Đóng menu">
                      <X className="size-5" />
                    </Dialog.Close>
                  </div>
                  <Navigation collapsed={false} onNavigate={() => setMobileOpen(false)} />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          ) : (
            <Brand />
          )}
          <span className="hidden text-sm text-ink-muted sm:inline">
            {isQuiz ? " / Phòng luyện tập" : `Không gian học tập / ${pageTitle}`}
          </span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {!isQuiz && (
              <>
                <button
                  className="icon-button"
                  aria-label="Tìm trang"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="size-4" />
                </button>
                <span className="hidden lg:inline">
                  <Badge tone={user ? "blue" : "muted"}>{roleLabels[role]}</Badge>
                </span>
              </>
            )}
            <button
              className="icon-button"
              aria-label={`Chuyển sang giao diện ${theme === "dark" ? "sáng" : "tối"}`}
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
            >
              <ThemeIcon className="size-4" />
            </button>
            {user ? (
              <Link
                to="/account"
                aria-label={`Mở hồ sơ của ${user.name}`}
                className="focus-ring grid size-10 place-items-center rounded-full bg-focus text-sm font-semibold text-surface"
              >
                {initialsOf(user.name)}
              </Link>
            ) : (
              <Link
                to="/login"
                aria-label="Đăng nhập"
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-raised"
              >
                <LogIn className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Đăng nhập</span>
              </Link>
            )}
          </div>
        </header>
        <div className="border-b border-line bg-surface px-4 py-2.5 text-center text-[0.7rem] leading-5 text-ink-muted sm:px-7">
          <span className="font-semibold text-ink">Tài khoản thật</span> · Tài liệu, quiz và bài làm
          lưu trên máy chủ · Lớp học, ghi chú và bài luyện mẫu vẫn là dữ liệu trên thiết bị
        </div>
        {(storageError || preferenceError) && (
          <p role="alert" className="mx-4 mt-4 rounded-xl border border-accent p-4 text-sm">
            {storageError || preferenceError}
          </p>
        )}
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className={cn(
            "mx-auto px-4 py-7 outline-none sm:px-7 lg:px-9 lg:py-9",
            isQuiz ? "max-w-6xl" : "max-w-[96rem]",
          )}
        >
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/classes/:classId" element={<ClassDetailPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/practice/:quizId" element={<QuizPage />} />
            <Route path="/results/:attemptId" element={<ResultPage />} />
            <Route path="/attempts/:attemptId" element={<AttemptPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <EmptyState
                  title="Trang này chưa có trong khu vườn"
                  description="Đường dẫn không tồn tại. Quay về tổng quan để tiếp tục học nhé."
                  action={<LinkButton to="/">Về tổng quan</LinkButton>}
                />
              }
            />
          </Routes>
        </main>
        <footer className="mx-4 mb-6 flex flex-wrap justify-between gap-2 border-t border-line pt-5 text-xs text-ink-muted sm:mx-7 lg:mx-9">
          <span>Mạch · Học tập có nhịp, tiến bộ mỗi ngày.</span>
          <span>Chậm thôi, nhưng đừng dừng lại.</span>
        </footer>
      </div>
      <Modal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Bạn muốn đến đâu?"
        description="Tìm nhanh một trang trong không gian học tập."
      >
        <label htmlFor="page-search" className="sr-only">
          Tên trang
        </label>
        <input
          id="page-search"
          className="field"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tài liệu, ghi chú, bài luyện…"
        />
        <div className="mt-4 space-y-1">
          {[...navigation, { path: "/settings", label: "Cài đặt", icon: Settings }]
            .filter(
              (item) =>
                (role !== "self_learner" || item.path !== "/classes") &&
                item.label.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
            )
            .map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="focus-ring flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm hover:bg-surface-raised"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Không thấy trang cần tìm? Thử từ khóa ngắn hơn.
        </p>
      </Modal>
    </div>
  );
}
export function App() {
  return (
    <AuthProvider>
      <DemoProvider>
        <Routes>
          {/* Auth screens render without the dashboard shell. */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Every workspace page requires a server-verified session. */}
          <Route
            path="*"
            element={
              <RequireAuth fullPage>
                <AppShell />
              </RequireAuth>
            }
          />
        </Routes>
      </DemoProvider>
    </AuthProvider>
  );
}
