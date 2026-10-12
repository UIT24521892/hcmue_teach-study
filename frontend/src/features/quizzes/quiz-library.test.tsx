import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { AuthSession, Document, Question, QuizDetail, UserRole } from "@mach/contracts";

import { App } from "../../app";

function sessionFor(role: UserRole): AuthSession {
  return {
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
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const document: Document = {
  id: "18ea5220-111c-4143-a108-5ed19cbf5f76",
  originalName: "unit-3.txt",
  extension: "txt",
  mimeType: "text/plain",
  byteSize: 1_024,
  checksum: "a".repeat(64),
  status: "ready",
  characterCount: 120,
  pageCount: null,
  processingError: null,
  createdAt: "2026-10-12T01:00:00.000Z",
  updatedAt: "2026-10-12T01:00:01.000Z",
};

const question: Question = {
  id: "0709fc76-9c2e-4322-bbeb-27f6ec8f844e",
  documentId: document.id,
  type: "true_false",
  prompt: "The text is about daily habits.",
  options: null,
  correctAnswer: "true",
  explanation: "The first line mentions daily habits.",
  difficulty: "easy",
  reviewStatus: "approved",
  version: 2,
  createdAt: "2026-10-12T01:00:01.000Z",
  updatedAt: "2026-10-12T01:00:01.000Z",
};

const draft: QuizDetail = {
  id: "6f5c3f0e-2f0d-4b8e-9a51-3c1d2a7e9b10",
  title: "Unit 3 check",
  description: null,
  timeLimitMinutes: 10,
  status: "draft",
  version: 1,
  questionCount: 1,
  publishedAt: null,
  archivedAt: null,
  createdAt: "2026-10-12T02:00:00.000Z",
  updatedAt: "2026-10-12T02:00:00.000Z",
  items: [
    {
      position: 1,
      sourceQuestionId: question.id,
      sourceVersion: 2,
      type: question.type,
      prompt: question.prompt,
      options: null,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      difficulty: question.difficulty,
    },
  ],
};

function renderPractice() {
  return render(
    <MemoryRouter initialEntries={["/practice"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("quiz library", () => {
  it("lets a teacher build a draft from approved questions and publish it", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse(sessionFor("teacher"));
      if (url.includes("/quizzes?page=")) {
        return jsonResponse({
          quizzes: [],
          pagination: { page: 1, pageSize: 50, total: 0, pageCount: 0 },
        });
      }
      if (url.includes("/documents?page=")) {
        return jsonResponse({
          documents: [document],
          pagination: { page: 1, pageSize: 50, total: 1, pageCount: 1 },
        });
      }
      if (url.endsWith(`/documents/${document.id}/questions?page=1&pageSize=50&status=approved`)) {
        return jsonResponse({
          questions: [question],
          pagination: { page: 1, pageSize: 50, total: 1, pageCount: 1 },
        });
      }
      if (url.endsWith("/quizzes") && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({
          title: "Unit 3 check",
          timeLimitMinutes: 10,
          questionIds: [question.id],
        });
        return jsonResponse({ quiz: draft }, 201);
      }
      if (url.endsWith(`/quizzes/${draft.id}/publish`)) {
        expect(JSON.parse(String(init?.body))).toEqual({ version: 1 });
        return jsonResponse({
          quiz: {
            ...draft,
            status: "published",
            version: 2,
            publishedAt: "2026-10-12T03:00:00.000Z",
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPractice();
    expect(await screen.findByRole("heading", { name: "Chưa có quiz nào" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Soạn quiz mới" }));

    const dialog = await screen.findByRole("dialog", { name: "Soạn quiz mới" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo bản nháp" }));
    expect(await within(dialog).findByText("Quiz cần có tên.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Tên quiz/), {
      target: { value: "Unit 3 check" },
    });
    fireEvent.change(within(dialog).getByLabelText("Thời gian làm bài (phút)"), {
      target: { value: "10" },
    });
    fireEvent.click(await within(dialog).findByRole("checkbox", { name: /daily habits/ }));
    expect(within(dialog).getByText("Thứ tự trong quiz · 1/50")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo bản nháp" }));

    expect(await screen.findByRole("heading", { name: "Unit 3 check" })).toBeInTheDocument();
    expect(screen.getByText("Nháp")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Công bố" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Công bố quiz này?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Công bố" }));

    await waitFor(() => expect(screen.getByText("Đã công bố")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Xem câu hỏi" })).toBeInTheDocument();
  });

  it("keeps quiz authoring away from students", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse(sessionFor("student"));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPractice();
    expect(
      await screen.findByRole("heading", { name: "Học một chút. Tiến một bước." }),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Quiz của bạn" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/quizzes"))).toBe(false);
  });
});
