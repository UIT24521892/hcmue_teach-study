import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { AuthSession, DailyNote } from "@mach/contracts";

import { App } from "../../app";

const TODAY = "2026-10-13";
const ATTEMPT_ID = "9b2f6a8e-5d0c-4e8b-a1f2-3c4d5e6f7a8b";

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

/** A tiny in-memory notes server: one note per day, versioned, plus progress. */
function notesServer(options: { conflictOnSave?: boolean } = {}) {
  const notes = new Map<string, DailyNote>();
  const requests: Array<{ method: string; url: string; body: unknown }> = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, url, body });
    if (url.endsWith("/auth/refresh")) return jsonResponse(session);
    if (url.endsWith("/notes/progress")) {
      return jsonResponse({
        progress: {
          timezone: "Asia/Ho_Chi_Minh",
          today: TODAY,
          completedSessions: 12 + notes.size,
          streakDays: notes.has(TODAY) ? 4 : 3,
        },
      });
    }
    if (url.includes("/notes?from=")) return jsonResponse({ notes: [...notes.values()] });
    if (url.includes("/attempts?status=submitted")) {
      return jsonResponse({
        attempts: [
          {
            id: ATTEMPT_ID,
            quizId: "6f5c3f0e-2f0d-4b8e-9a51-3c1d2a7e9b10",
            quizTitle: "Unit 3 check",
            status: "submitted",
            totalCount: 3,
            answeredCount: 3,
            correctCount: 2,
            score: 67,
            startedAt: "2026-10-13T02:00:00.000Z",
            deadlineAt: null,
            submittedAt: "2026-10-13T02:10:00.000Z",
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, pageCount: 1 },
      });
    }
    const match = /\/notes\/(\d{4}-\d{2}-\d{2})/.exec(url);
    if (match && method === "PUT") {
      if (options.conflictOnSave) {
        return jsonResponse(
          {
            code: "CONFLICT",
            message: "Ghi chú đã thay đổi ở một phiên khác. Hãy tải lại trang.",
            requestId: "test",
          },
          409,
        );
      }
      const date = match[1]!;
      const previous = notes.get(date);
      const note: DailyNote = {
        id: previous?.id ?? "18ea5220-111c-4143-a108-5ed19cbf5f76",
        date,
        content: body.content.trim(),
        understanding: body.understanding,
        tags: body.tags,
        links: body.attemptIds.map((id: string) => ({
          kind: "attempt",
          id,
          title: "Unit 3 check",
          score: 67,
        })),
        version: (previous?.version ?? 0) + 1,
        createdAt: "2026-10-13T03:00:00.000Z",
        updatedAt: "2026-10-13T03:00:00.000Z",
      };
      notes.set(date, note);
      return jsonResponse({ note }, previous ? 200 : 201);
    }
    if (match && method === "DELETE") {
      notes.delete(match[1]!);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { notes, requests };
}

function renderNotes() {
  return render(
    <MemoryRouter initialEntries={["/notes"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("notes page", () => {
  it("saves today's note with tags and a quiz link, grows the tree and deletes it", async () => {
    const server = notesServer();
    renderNotes();

    expect(await screen.findByRole("heading", { name: "Ngày 13 tháng 10" })).toBeVisible();
    expect(
      screen.getByText("Tháng này chưa có ghi chú nào. Chọn một ngày để bắt đầu."),
    ).toBeVisible();
    expect(await screen.findByRole("img", { name: /^12 buổi học/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    expect(await screen.findByText("Hãy ghi lại ít nhất một điều bạn đã học.")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Hôm nay bạn học được gì?"), {
      target: { value: "Resilient = kiên cường" },
    });
    fireEvent.change(screen.getByLabelText("Tag"), {
      target: { value: "Vocabulary, vocabulary , Reading" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Rất tự tin" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /Unit 3 check/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));

    expect(await screen.findByText("Đã lưu trên máy chủ")).toBeVisible();
    const put = server.requests.find((request) => request.method === "PUT");
    expect(put?.url).toContain(`/notes/${TODAY}`);
    expect(put?.body).toEqual({
      content: "Resilient = kiên cường",
      understanding: 3,
      tags: ["Vocabulary", "Reading"],
      documentIds: [],
      attemptIds: [ATTEMPT_ID],
    });
    expect(await screen.findByRole("img", { name: /^13 buổi học/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /13 tháng 10, có ghi chú/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xóa ghi chú" }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Xóa ghi chú" }));
    expect(await screen.findByText("Một trang mới")).toBeVisible();
    expect(server.notes.size).toBe(0);
  });

  it("moves through days with the keyboard without entering the future", async () => {
    notesServer();
    renderNotes();
    const today = await screen.findByRole("button", { name: /, 13 tháng 10$/ });
    expect(today).toHaveAttribute("tabindex", "0");

    today.focus();
    fireEvent.keyDown(today, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Ngày 13 tháng 10" })).toBeVisible();

    fireEvent.keyDown(today, { key: "ArrowLeft" });
    const yesterday = screen.getByRole("button", { name: /, 12 tháng 10$/ });
    await waitFor(() => expect(yesterday).toHaveFocus());
    expect(yesterday).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Ngày 12 tháng 10" })).toBeVisible();

    fireEvent.keyDown(yesterday, { key: "PageUp" });
    expect(await screen.findByRole("heading", { name: "tháng 9 năm 2026" })).toBeVisible();
    await waitFor(() => expect(screen.getByRole("button", { name: /, 1 tháng 9$/ })).toHaveFocus());
  });

  it("explains a version conflict and offers a reload", async () => {
    notesServer({ conflictOnSave: true });
    renderNotes();
    fireEvent.change(await screen.findByLabelText("Hôm nay bạn học được gì?"), {
      target: { value: "Edited in two tabs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    expect(await screen.findByText(/đã thay đổi ở một phiên khác/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Tải lại ghi chú mới nhất" })).toBeVisible();
    expect(sessionStorage.getItem(`mach-note-draft-user_student-${TODAY}`)).toContain(
      "Edited in two tabs",
    );
  });
});
