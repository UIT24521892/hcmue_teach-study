import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@mach/ui";

import { useAuth } from "./auth-context";

/**
 * Client-side route guard. It improves the experience by not rendering a
 * screen the API would reject, but it is never the security boundary — the
 * API re-checks the session and the role on every request.
 */
export function RequireAuth({
  children,
  fullPage = false,
}: {
  children: ReactNode;
  /** Centre loading/error states on an empty page when guarding the whole shell. */
  fullPage?: boolean;
}) {
  const { status, sessionError, retrySession } = useAuth();
  const location = useLocation();

  const frame = (content: ReactNode) =>
    fullPage ? (
      <div className="grid min-h-dvh place-items-center bg-canvas p-4">
        <div className="w-full max-w-md">{content}</div>
      </div>
    ) : (
      content
    );

  if (status === "loading") {
    return frame(
      <div className="panel grid min-h-48 place-items-center p-8 text-center">
        <div>
          <Loader2 className="mx-auto mb-3 size-5 animate-spin text-ink-muted" aria-hidden="true" />
          <p role="status" className="text-sm text-ink-muted">
            Đang kiểm tra phiên đăng nhập…
          </p>
        </div>
      </div>,
    );
  }

  if (status === "error") {
    return frame(
      <div className="panel grid min-h-48 place-items-center p-8 text-center">
        <div>
          <p role="alert" className="text-sm text-ink-muted">
            {sessionError}
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => void retrySession()}>
            Thử lại
          </Button>
        </div>
      </div>,
    );
  }

  if (status === "anonymous") {
    const next = `${location.pathname}${location.search}`;

    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}
