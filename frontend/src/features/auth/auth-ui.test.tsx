import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { AuthSession, Document, Question, UserRole } from "@mach/contracts";

import { App } from "../../app";
import { createDemoData } from "../demo/fixtures";

function sessionFor(role: UserRole = "teacher"): AuthSession {
  return {
    user: {
      id: `user_${role}`,
      name: role === "teacher" ? "Cô Minh Anh" : "Lê Chi",
      email: `${role}@example.com`,
      role,
      timezone: "Asia/Ho_Chi_Minh",
      createdAt: "2026-09-18T00:00:00.000Z",
    },
    accessToken: `access-${role}`,
    accessTokenExpiresAt: "2026-09-18T01:00:00.000Z",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth UI", () => {
  it("does not accept credentials until bootstrap refresh finishes", async () => {
    let resolveRefresh: ((response: Response) => void) | undefined;
    const refresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => refresh),
    );

    renderApp("/login");

    expect(screen.getByRole("status")).toHaveTextContent("Đang kiểm tra phiên đăng nhập");
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();

    await act(async () => {
      resolveRefresh?.(jsonResponse({}, 401));
      await refresh;
    });

    expect(await screen.findByLabelText("Email")).toBeEnabled();
  });

  it("shows a recoverable bootstrap error and retries", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        calls += 1;
        if (calls === 1) throw new TypeError("offline");
        return jsonResponse({}, 401);
      }),
    );

    renderApp("/login");

    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể kiểm tra phiên");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByLabelText("Email")).toBeEnabled();
    expect(calls).toBe(2);
  });

  it("returns to an internal next route after login", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse({}, 401);
      if (url.endsWith("/auth/login")) return jsonResponse(sessionFor("student"));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/login?next=%2Fnotes");
    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "matkhau-rat-dai-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(
      await screen.findByRole("heading", { name: "Ghi lại điều nhỏ. Nuôi lớn tri thức." }),
    ).toBeInTheDocument();
  });

  it("loads a real document and lets its owner edit then approve an AI question", async () => {
    const document: Document = {
      id: "18ea5220-111c-4143-a108-5ed19cbf5f76",
      originalName: "daily-habits.txt",
      extension: "txt",
      mimeType: "text/plain",
      byteSize: 1_024,
      checksum: "a".repeat(64),
      status: "ready",
      characterCount: 120,
      pageCount: null,
      processingError: null,
      createdAt: "2026-09-20T01:00:00.000Z",
      updatedAt: "2026-09-20T01:00:01.000Z",
    };
    const question: Question = {
      id: "0709fc76-9c2e-4322-bbeb-27f6ec8f844e",
      documentId: document.id,
      type: "true_false",
      prompt: "Tài liệu nói về thói quen hằng ngày.",
      options: null,
      correctAnswer: "true",
      explanation: "Nội dung nguồn nhắc trực tiếp đến thói quen.",
      difficulty: "easy",
      reviewStatus: "pending_review",
      version: 1,
      createdAt: "2026-09-20T01:00:01.000Z",
      updatedAt: "2026-09-20T01:00:01.000Z",
    };
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse(sessionFor("teacher"));
      if (url.includes("/documents?page=")) {
        return jsonResponse({
          documents: [document],
          pagination: { page: 1, pageSize: 50, total: 1, pageCount: 1 },
        });
      }
      if (url.endsWith(`/documents/${document.id}/questions?page=1&pageSize=50`)) {
        return jsonResponse({
          questions: [question],
          pagination: { page: 1, pageSize: 50, total: 1, pageCount: 1 },
        });
      }
      if (url.endsWith(`/documents/${document.id}/questions/${question.id}/review`)) {
        expect(init?.method).toBe("POST");
        return jsonResponse({
          question: { ...question, reviewStatus: "approved", version: 3 },
        });
      }
      if (url.endsWith(`/documents/${document.id}/questions/${question.id}`)) {
        expect(init?.method).toBe("PATCH");
        return jsonResponse({
          question: { ...question, prompt: "Câu hỏi đã chỉnh sửa.", version: 2 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/documents");
    expect(await screen.findByRole("heading", { name: document.originalName })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem & duyệt câu hỏi" }));
    const prompt = await screen.findByLabelText("Câu hỏi");
    fireEvent.change(prompt, { target: { value: "Câu hỏi đã chỉnh sửa." } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu chỉnh sửa" }));
    await waitFor(() => expect(screen.getByText(/v2/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Duyệt" }));
    await waitFor(() => expect(screen.getByText("Đã duyệt")).toBeInTheDocument());
  });

  it("rejects an external next target after login", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse({}, 401);
      if (url.endsWith("/auth/login")) return jsonResponse(sessionFor("student"));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/login?next=https%3A%2F%2Fevil.example");
    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "matkhau-rat-dai-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("heading", { name: /Giữ nhịp học/i })).toBeInTheDocument();
  });

  it("validates registration before sending credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({}, 401));
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/register");
    fireEvent.change(await screen.findByLabelText("Tên hiển thị"), {
      target: { value: "Lê Chi" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "learner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(screen.getByText("Mật khẩu cần ít nhất 10 ký tự.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redirects an anonymous account route to login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => jsonResponse({}, 401)),
    );

    renderApp("/account");

    expect(
      await screen.findByRole("heading", { name: "Đăng nhập để tiếp tục." }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hồ sơ của bạn." })).not.toBeInTheDocument();
  });

  it("keeps the account visible and explains a failed server logout", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return jsonResponse(sessionFor());
      if (url.endsWith("/auth/logout")) {
        return jsonResponse(
          { code: "INTERNAL_ERROR", message: "Máy chủ chưa thể đăng xuất.", requestId: "req_1" },
          500,
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp("/account");
    expect(await screen.findByRole("heading", { name: "Hồ sơ của bạn." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Máy chủ chưa thể đăng xuất");
    expect(screen.getByRole("heading", { name: "Hồ sơ của bạn." })).toBeInTheDocument();
  });

  it("offers only the three self-registerable roles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => jsonResponse({}, 401)),
    );

    renderApp("/register");
    await screen.findByRole("radio", { name: "Giáo viên" });
    const roles = screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"));

    expect(roles).toEqual(["teacher", "student", "self_learner"]);
    expect(roles).not.toContain("admin");
  });

  it("uses the authenticated teacher role over a stored learner preview", async () => {
    localStorage.setItem(
      "mach-demo-v1",
      JSON.stringify({ ...createDemoData(), role: "self_learner" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => jsonResponse(sessionFor("teacher"))),
    );

    renderApp("/classes");

    expect(
      await screen.findByRole("heading", { name: "Mỗi lớp học, một hành trình." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo lớp mới" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lớp học" })).toBeInTheDocument();
  });

  it("uses the authenticated learner role over a stored teacher preview", async () => {
    localStorage.setItem("mach-demo-v1", JSON.stringify(createDemoData()));
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => jsonResponse(sessionFor("self_learner"))),
    );

    renderApp("/classes");

    expect(
      await screen.findByRole("heading", { name: "Không gian tự học của bạn" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Lớp học" })).not.toBeInTheDocument();
    });
  });
});
