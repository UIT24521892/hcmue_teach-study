import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { AuthSession, UserRole } from "@mach/contracts";

import { App } from "./app";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const emptyPage = { page: 1, pageSize: 50, total: 0, pageCount: 0 };

/** Signs the app in as `role`; owner libraries answer with empty pages. */
function stubSession(role: UserRole) {
  const session: AuthSession = {
    user: {
      id: `user_${role}`,
      name: "Cô Minh Anh",
      email: `${role}@example.com`,
      role,
      timezone: "Asia/Ho_Chi_Minh",
      createdAt: "2026-10-12T00:00:00.000Z",
    },
    accessToken: `access-${role}`,
    accessTokenExpiresAt: "2026-10-12T01:00:00.000Z",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse(session);
      if (url.includes("/documents?page=")) {
        return jsonResponse({ documents: [], pagination: emptyPage });
      }
      if (url.includes("/quizzes?page=")) {
        return jsonResponse({ quizzes: [], pagination: emptyPage });
      }
      if (url.endsWith("/notes/progress")) {
        return jsonResponse({
          progress: {
            timezone: "Asia/Ho_Chi_Minh",
            today: "2026-10-13",
            completedSessions: 12,
            streakDays: 3,
          },
        });
      }
      if (url.includes("/notes?from=")) return jsonResponse({ notes: [] });
      if (url.includes("/attempts?status=submitted")) {
        return jsonResponse({ attempts: [], pagination: emptyPage });
      }
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
}

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App access", () => {
  it("sends an anonymous visitor to the login page and keeps the target path", async () => {
    renderApp("/notes");

    expect(await screen.findByRole("heading", { name: "Đăng nhập để tiếp tục." })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: /điều hướng chính/i })).not.toBeInTheDocument();
  });
});

describe("App", () => {
  beforeEach(() => stubSession("teacher"));

  it("renders the dashboard shell", async () => {
    renderApp();

    expect(await screen.findByRole("heading", { name: /giữ nhịp học/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /điều hướng chính/i })).toBeInTheDocument();
  });

  it("changes the saved theme", async () => {
    renderApp();
    const themeButton = await screen.findByRole("button", { name: /chuyển sang giao diện/i });

    fireEvent.click(themeButton);

    expect(window.localStorage.getItem("mach-theme")).toBe(document.documentElement.dataset.theme);
  });

  it("collapses and expands the desktop sidebar", async () => {
    renderApp();

    const collapseButton = await screen.findByRole("button", { name: "Thu gọn thanh bên" });
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(collapseButton);

    const expandButton = screen.getByRole("button", { name: "Mở rộng thanh bên" });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    expect(window.localStorage.getItem("mach-sidebar-collapsed")).toBe("true");

    fireEvent.click(expandButton);

    expect(screen.getByRole("button", { name: "Thu gọn thanh bên" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(window.localStorage.getItem("mach-sidebar-collapsed")).toBe("false");
  });

  it.each([
    ["/documents", "Một nơi cho mọi điều muốn học."],
    ["/classes", "Mỗi lớp học, một hành trình."],
    ["/practice", "Học một chút. Tiến một bước."],
    ["/notes", "Ghi lại điều nhỏ. Nuôi lớn tri thức."],
    ["/progress", "Nhìn lại để đi xa hơn."],
    ["/settings", "Học theo cách của bạn."],
    ["/missing", "Trang này chưa có trong khu vườn"],
  ])("renders route %s directly", async (path, title) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
  });

  it("navigates to a real page and marks the active link", async () => {
    renderApp();
    fireEvent.click(await screen.findByRole("link", { name: "Tài liệu" }));
    expect(
      screen.getByRole("heading", { name: "Một nơi cho mọi điều muốn học." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tài liệu" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the server-verified role in settings without a preview switch", async () => {
    renderApp("/settings");
    expect(await screen.findByLabelText("Vai trò tài khoản")).toHaveTextContent("Giáo viên");
    expect(screen.queryByLabelText("Xem giao diện theo vai trò")).not.toBeInTheDocument();
  });

  it("does not crash on corrupted stored demo data", async () => {
    localStorage.setItem("mach-demo-v1", "invalid-json");
    renderApp();
    expect(await screen.findByRole("heading", { name: /giữ nhịp học/i })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Không đọc được dữ liệu đã lưu");
  });
});

describe("App by role", () => {
  it("removes classes from the self-learner navigation", async () => {
    stubSession("self_learner");
    renderApp("/settings");
    expect(await screen.findByLabelText("Vai trò tài khoản")).toHaveTextContent("Người tự học");
    expect(screen.queryByRole("link", { name: "Lớp học" })).not.toBeInTheDocument();
  });

  it("shows a useful empty state for a student's sample document search", async () => {
    stubSession("student");
    renderApp("/documents");
    fireEvent.change(await screen.findByRole("searchbox", { name: "Tìm tài liệu" }), {
      target: { value: "no-match" },
    });
    expect(screen.getByRole("heading", { name: "Chưa tìm thấy tài liệu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ bộ lọc" }));
    expect(screen.getByRole("heading", { name: "Small habits, big changes" })).toBeInTheDocument();
  });
});
