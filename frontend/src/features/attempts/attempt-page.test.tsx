import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { Attempt, AuthSession } from "@mach/contracts";

import { App } from "../../app";

const session: AuthSession = {
  user: {
    id: "user_self_learner",
    name: "Lê Chi",
    email: "learner@example.com",
    role: "self_learner",
    timezone: "Asia/Ho_Chi_Minh",
    createdAt: "2026-10-12T00:00:00.000Z",
  },
  accessToken: "access-self-learner",
  accessTokenExpiresAt: "2026-10-12T01:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ATTEMPT_ID = "9b2f6a8e-5d0c-4e8b-a1f2-3c4d5e6f7a8b";
const QUIZ_ID = "6f5c3f0e-2f0d-4b8e-9a51-3c1d2a7e9b10";

function inProgress(deadlineOffsetMs: number | null): Attempt {
  const now = new Date();
  return {
    id: ATTEMPT_ID,
    quizId: QUIZ_ID,
    quizTitle: "Unit 3 check",
    status: "in_progress",
    totalCount: 2,
    answeredCount: 0,
    correctCount: null,
    score: null,
    startedAt: now.toISOString(),
    deadlineAt:
      deadlineOffsetMs === null ? null : new Date(now.getTime() + deadlineOffsetMs).toISOString(),
    submittedAt: null,
    serverNow: now.toISOString(),
    items: [
      {
        position: 1,
        type: "multiple_choice",
        prompt: "Which word is in the text?",
        options: ["grammar", "ocean"],
        difficulty: "easy",
        response: null,
        result: null,
      },
      {
        position: 2,
        type: "fill_blank",
        prompt: "____ habits help learners.",
        options: null,
        difficulty: "medium",
        response: null,
        result: null,
      },
    ],
  };
}

function submitted(base: Attempt): Attempt {
  return {
    ...base,
    status: "submitted",
    answeredCount: 2,
    correctCount: 1,
    score: 50,
    submittedAt: new Date().toISOString(),
    items: [
      {
        ...base.items[0]!,
        response: "grammar",
        result: { correctAnswer: "grammar", explanation: "Grammar is there.", isCorrect: true },
      },
      {
        ...base.items[1]!,
        response: "weekly",
        result: { correctAnswer: "Daily", explanation: "The text says Daily.", isCorrect: false },
      },
    ],
  };
}

function renderAttempt() {
  return render(
    <MemoryRouter initialEntries={[`/attempts/${ATTEMPT_ID}`]}>
      <App />
    </MemoryRouter>,
  );
}

describe("attempt room", () => {
  it("autosaves, keeps answers on the device while offline and submits once", async () => {
    const open = inProgress(10 * 60_000);
    const saves: unknown[] = [];
    let failNextSave = false;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse(session);
      if (url.endsWith(`/attempts/${ATTEMPT_ID}`)) return jsonResponse({ attempt: open });
      if (url.endsWith(`/attempts/${ATTEMPT_ID}/answers`)) {
        expect(init?.method).toBe("PUT");
        if (failNextSave) {
          failNextSave = false;
          throw new TypeError("offline");
        }
        saves.push(JSON.parse(String(init?.body)));
        return jsonResponse({ attempt: open });
      }
      if (url.endsWith(`/attempts/${ATTEMPT_ID}/submit`)) {
        expect(JSON.parse(String(init?.body))).toEqual({
          answers: [
            { position: 1, response: "grammar" },
            { position: 2, response: "weekly" },
          ],
        });
        return jsonResponse({ attempt: submitted(open) });
      }
      if (url.includes(`/quizzes/${QUIZ_ID}/attempts?`)) {
        return jsonResponse({
          attempts: [submitted(open)].map(({ items: _items, serverNow: _now, ...rest }) => rest),
          pagination: { page: 1, pageSize: 10, total: 1, pageCount: 1 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAttempt();
    expect(await screen.findByRole("heading", { name: "Unit 3 check" })).toBeVisible();
    expect(screen.getByRole("timer", { name: "Thời gian còn lại" })).toHaveTextContent(
      /0?9:5\d|10:00/,
    );
    expect(screen.queryByText("Grammar is there.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /grammar/ }));
    await waitFor(
      () => expect(saves).toEqual([{ answers: [{ position: 1, response: "grammar" }] }]),
      {
        timeout: 2_000,
      },
    );
    expect(await screen.findByText("Đã lưu trên máy chủ")).toBeInTheDocument();

    failNextSave = true;
    fireEvent.click(screen.getByRole("button", { name: "Câu tiếp" }));
    fireEvent.change(screen.getByLabelText("Câu trả lời của bạn"), {
      target: { value: "weekly" },
    });
    expect(
      await screen.findByText(/Mất kết nối/, undefined, { timeout: 2_000 }),
    ).toBeInTheDocument();
    const backup = JSON.parse(localStorage.getItem(`mach-attempt-${ATTEMPT_ID}`) ?? "{}");
    expect(backup).toMatchObject({ answers: { "2": "weekly" }, dirty: [2] });

    fireEvent.click(screen.getAllByRole("button", { name: "Nộp bài" })[0]!);
    const confirm = await screen.findByRole("alertdialog", { name: "Sẵn sàng nộp bài?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Xác nhận nộp bài" }));

    expect(await screen.findByText("Đúng 1/2 câu")).toBeInTheDocument();
    expect(screen.getByText("The text says Daily.")).toBeInTheDocument();
    expect(localStorage.getItem(`mach-attempt-${ATTEMPT_ID}`)).toBeNull();
    expect(await screen.findByText("50% · 1/2")).toBeInTheDocument();
    const submits = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/submit"));
    expect(submits).toHaveLength(1);
  });

  it("locks answers and submits automatically when the server clock says time is up", async () => {
    const expired = inProgress(-1_000);
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse(session);
      if (url.endsWith(`/attempts/${ATTEMPT_ID}`)) return jsonResponse({ attempt: expired });
      if (url.endsWith(`/attempts/${ATTEMPT_ID}/submit`)) {
        return jsonResponse({ attempt: submitted(expired) });
      }
      if (url.includes(`/quizzes/${QUIZ_ID}/attempts?`)) {
        return jsonResponse({
          attempts: [],
          pagination: { page: 1, pageSize: 10, total: 0, pageCount: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAttempt();
    expect(await screen.findByText("Đúng 1/2 câu")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/submit"))).toHaveLength(1);
  });
});
