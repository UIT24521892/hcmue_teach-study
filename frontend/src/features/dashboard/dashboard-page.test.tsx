import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { AuthSession } from "@mach/contracts";

import { App } from "../../app";

const session: AuthSession = {
  user: {
    id: "user_student",
    name: "Lê Chi",
    email: "student@example.com",
    role: "student",
    timezone: "Asia/Ho_Chi_Minh",
    createdAt: "2026-10-01T00:00:00.000Z",
  },
  accessToken: "access-student",
  accessTokenExpiresAt: "2026-10-13T01:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function note(date: string) {
  return {
    id: crypto.randomUUID(),
    date,
    content: "Studied",
    understanding: 2,
    tags: [],
    links: [],
    version: 1,
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
  };
}

function attempt(submittedAt: string) {
  return {
    id: crypto.randomUUID(),
    quizId: "6f5c3f0e-2f0d-4b8e-9a51-3c1d2a7e9b10",
    quizTitle: "Unit 3 check",
    status: "submitted",
    totalCount: 3,
    answeredCount: 3,
    correctCount: 2,
    score: 67,
    startedAt: submittedAt,
    deadlineAt: null,
    submittedAt,
  };
}

function stubServer(options: { failWeek?: boolean } = {}) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) return jsonResponse(session);
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
    if (url.includes("/notes?from=")) {
      if (options.failWeek) {
        return jsonResponse(
          { code: "INTERNAL_ERROR", message: "Máy chủ bận.", requestId: "t" },
          500,
        );
      }
      return jsonResponse({ notes: [note("2026-10-09"), note("2026-10-11")] });
    }
    if (url.includes("/attempts?status=submitted")) {
      return jsonResponse({
        attempts: [
          // 00:30 on 13/10 in Vietnam is still 12/10 in UTC: it belongs to today.
          attempt("2026-10-12T17:30:00.000Z"),
          // Older than the seven-day window: counted in the total only.
          attempt("2026-10-01T03:00:00.000Z"),
        ],
        pagination: { page: 1, pageSize: 50, total: 2, pageCount: 1 },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("dashboard", () => {
  it("leads with the slogan and draws the learner's real tree in the garden", async () => {
    const fetchMock = stubServer();
    renderDashboard();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Giữ nhịp học, gieo tiến bộ." }),
    ).toBeVisible();
    expect(
      await screen.findByRole("group", {
        name: "Khu vườn của bạn: cây có 12 chiếc lá từ 12 buổi học, đang giữ nhịp 3 ngày liên tiếp.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Chào Lê Chi\./)).toBeVisible();
    expect(screen.getByRole("link", { name: /Bắt đầu luyện tập/ })).toHaveAttribute(
      "href",
      "/practice",
    );
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("from=2026-10-07&to=2026-10-13")),
    ).toBe(true);
  });

  it("counts study days of the week in the account timezone", async () => {
    stubServer();
    renderDashboard();

    const week = await screen.findByRole("list", { name: "Các ngày học trong tuần" });
    const days = within(week).getAllByRole("listitem");
    expect(days).toHaveLength(7);
    expect(days[6]).toHaveTextContent("13 tháng 10 (hôm nay): có học");
    expect(days[5]).toHaveTextContent("12 tháng 10: chưa học");
    expect(days[4]).toHaveTextContent("11 tháng 10: có học");
    expect(screen.getByText("3/7 ngày")).toBeVisible();
    expect(screen.getByText("Hôm nay cây đã có thêm một lá.")).toBeVisible();

    const stats = screen.getByText("Bài đã nộp").closest("div");
    expect(stats).toHaveTextContent("2");
    expect(screen.getByRole("progressbar", { name: "Tiến độ tới cành tiếp theo" })).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
  });

  it("lets the keyboard water the tree and make the sun shine", async () => {
    stubServer();
    renderDashboard();
    await screen.findByRole("group", { name: /Khu vườn của bạn: cây có 12 chiếc lá/ });

    const can = screen.getByRole("button", { name: /Bình tưới/ });
    expect(can).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(can, { key: "Enter" });
    await waitFor(() => expect(can).toHaveAttribute("data-pouring", "true"));

    const sun = screen.getByRole("button", { name: /Mặt trời/ });
    fireEvent.keyDown(sun, { key: " " });
    await waitFor(() => expect(document.querySelector("[data-sun-rays]")).not.toBeNull());
  });

  it("shows a retry when the week cannot load", async () => {
    stubServer({ failWeek: true });
    renderDashboard();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Máy chủ bận.");
    expect(within(alert).getByRole("button", { name: "Thử lại" })).toBeVisible();
  });
});
