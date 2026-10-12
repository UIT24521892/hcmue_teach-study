import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2, LogIn, Sprout, UserPlus } from "lucide-react";
import { Button, LogoMark } from "@mach/ui";
import {
  loginRequestSchema,
  registerRequestSchema,
  timezoneSchema,
  type LoginRequest,
  type RegisterRequest,
  type SelfRegisterableRole,
} from "@mach/contracts";

import { cn } from "../../lib/cn";
import { roleLabels, selfRegisterableRoles } from "../../lib/roles";
import { ApiError } from "./api-client";
import { useAuth } from "./auth-context";

type FieldErrors = Record<string, string>;

function toFieldErrors(issues: { path: (string | number)[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }

  return errors;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Không kết nối được máy chủ. Kiểm tra API đang chạy rồi thử lại.";
}

/** Only same-origin relative paths, so `?next=` cannot become an open redirect. */
function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-xs font-medium text-accent-strong">
      {message}
    </p>
  );
}

function FormAlert({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="mb-5 rounded-xl border border-accent/60 bg-accent/10 px-4 py-3 text-sm leading-6"
    >
      {message}
    </p>
  );
}

function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex xl:p-14">
        <Link to="/" className="focus-ring flex items-center gap-3 rounded-xl">
          <LogoMark className="size-10 text-ink" />
          <span className="font-display text-3xl font-bold">
            Mạch<span className="text-accent-strong">.</span>
          </span>
        </Link>
        <div className="max-w-md">
          <Sprout className="mb-5 size-7 text-tree" aria-hidden="true" />
          <p className="font-display text-4xl font-semibold leading-tight">
            Học tập có nhịp, tiến bộ mỗi ngày.
          </p>
          <p className="mt-5 text-sm leading-7 text-ink-muted">
            Một tài khoản cho giáo viên, học sinh và người tự học: tài liệu riêng, lớp học, bài
            luyện và cây tri thức theo từng buổi học.
          </p>
        </div>
        <p className="text-xs text-ink-muted">Chậm thôi, nhưng đừng dừng lại.</p>
      </section>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="focus-ring mb-8 flex items-center gap-3 rounded-xl lg:hidden">
            <LogoMark className="size-9 text-ink" />
            <span className="font-display text-2xl font-bold">
              Mạch<span className="text-accent-strong">.</span>
            </span>
          </Link>

          <div className="panel p-6 sm:p-8">
            <p className="eyebrow mb-3">Tài khoản Mạch</p>
            <h1 className="font-display text-3xl font-semibold">{title}</h1>
            <p className="mb-7 mt-3 text-sm leading-6 text-ink-muted">{description}</p>
            {children}
          </div>

          <p className="mt-6 text-center text-sm leading-6 text-ink-muted">{footer}</p>
        </div>
      </main>
    </div>
  );
}

function SessionCheckPage({ error, onRetry }: { error: string; onRetry: () => Promise<void> }) {
  const loading = !error;

  return (
    <AuthShell
      title={loading ? "Đang kiểm tra phiên đăng nhập." : "Chưa thể kiểm tra phiên."}
      description={
        loading
          ? "Mạch đang xác nhận phiên an toàn trên thiết bị này."
          : "Kết nối tới máy chủ đang gián đoạn. Bạn có thể thử lại mà không cần nhập lại thông tin."
      }
      footer={
        <Link to="/" className="focus-ring rounded font-semibold underline underline-offset-4">
          Về bản trải nghiệm
        </Link>
      }
    >
      <div className="rounded-xl border border-line bg-surface-raised p-5 text-center">
        {loading ? (
          <>
            <Loader2
              className="mx-auto mb-3 size-5 animate-spin text-ink-muted"
              aria-hidden="true"
            />
            <p role="status" className="text-sm text-ink-muted">
              Đang kiểm tra phiên đăng nhập…
            </p>
          </>
        ) : (
          <>
            <p role="alert" className="text-sm leading-6 text-ink-muted">
              {error}
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => void onRetry()}>
              Thử lại
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}

export function LoginPage() {
  const { login, status, sessionError, retrySession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  if (status === "authenticated") {
    return <Navigate to={next} replace />;
  }

  if (status === "loading" || status === "error") {
    return <SessionCheckPage error={sessionError} onRetry={retrySession} />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error.issues));
      return;
    }

    setPending(true);
    try {
      await login(parsed.data satisfies LoginRequest);
      navigate(next, { replace: true });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Đăng nhập để tiếp tục."
      description="Dùng tài khoản của bạn để mở tài liệu, lớp học và tiến độ học tập."
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link
            to="/register"
            className="focus-ring rounded font-semibold text-ink underline underline-offset-4"
          >
            Tạo tài khoản mới
          </Link>
        </>
      }
    >
      <FormAlert message={error} />
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="login-email" className="field-label">
          Email
        </label>
        <input
          id="login-email"
          className="field"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FieldError id="login-email-error" message={fieldErrors.email} />

        <label htmlFor="login-password" className="field-label mt-5">
          Mật khẩu
        </label>
        <input
          id="login-password"
          className="field"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          required
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FieldError id="login-password-error" message={fieldErrors.password} />

        <Button type="submit" className="mt-7 w-full" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogIn className="size-4" aria-hidden="true" />
          )}
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
        <p role="status" className="sr-only">
          {pending ? "Đang xử lý đăng nhập." : ""}
        </p>
      </form>
    </AuthShell>
  );
}

function browserTimezone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezoneSchema.safeParse(zone).success ? zone : undefined;
  } catch {
    return undefined;
  }
}

export function RegisterPage() {
  const { register, status, sessionError, retrySession } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SelfRegisterableRole>("self_learner");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  if (status === "loading" || status === "error") {
    return <SessionCheckPage error={sessionError} onRetry={retrySession} />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const timezone = browserTimezone();
    const parsed = registerRequestSchema.safeParse({
      name,
      email,
      password,
      role,
      ...(timezone ? { timezone } : {}),
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error.issues));
      return;
    }

    setPending(true);
    try {
      await register(parsed.data satisfies RegisterRequest);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Bắt đầu một nhịp học mới."
      description="Chọn vai trò đúng với bạn. Bạn có thể đổi cách dùng sau mà không mất dữ liệu."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link
            to="/login"
            className="focus-ring rounded font-semibold text-ink underline underline-offset-4"
          >
            Đăng nhập
          </Link>
        </>
      }
    >
      <FormAlert message={error} />
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="register-name" className="field-label">
          Tên hiển thị
        </label>
        <input
          id="register-name"
          className="field"
          name="name"
          autoComplete="name"
          maxLength={120}
          value={name}
          required
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "register-name-error" : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="register-name-error" message={fieldErrors.name} />

        <label htmlFor="register-email" className="field-label mt-5">
          Email
        </label>
        <input
          id="register-email"
          className="field"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FieldError id="register-email-error" message={fieldErrors.email} />

        <label htmlFor="register-password" className="field-label mt-5">
          Mật khẩu
        </label>
        <input
          id="register-password"
          className="field"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          required
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={
            fieldErrors.password ? "register-password-error" : "register-password-hint"
          }
          onChange={(event) => setPassword(event.target.value)}
        />
        {fieldErrors.password ? (
          <FieldError id="register-password-error" message={fieldErrors.password} />
        ) : (
          <p id="register-password-hint" className="mt-2 text-xs leading-6 text-ink-muted">
            Tối thiểu 10 ký tự.
          </p>
        )}

        <fieldset className="mt-6">
          <legend className="field-label">Bạn dùng Mạch với vai trò nào?</legend>
          <div className="space-y-2">
            {selfRegisterableRoles.map((value) => (
              <label
                key={value}
                className={cn(
                  "focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-canvas flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm",
                  role === value
                    ? "border-accent-strong bg-accent/10 font-semibold"
                    : "border-line bg-surface hover:bg-surface-raised",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  className="size-4 accent-[hsl(var(--color-accent-strong))]"
                  onChange={() => setRole(value)}
                />
                {roleLabels[value]}
              </label>
            ))}
          </div>
          <FieldError id="register-role-error" message={fieldErrors.role} />
        </fieldset>

        <Button type="submit" className="mt-7 w-full" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus className="size-4" aria-hidden="true" />
          )}
          {pending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        </Button>
        <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-ink-muted">
          <ArrowRight className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
          Vai trò quản trị chỉ được cấp bởi hệ thống, không thể tự chọn.
        </p>
      </form>
    </AuthShell>
  );
}
