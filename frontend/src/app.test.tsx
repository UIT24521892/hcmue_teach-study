import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "./app";

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("renders the dashboard shell", () => {
    renderApp();

    expect(screen.getByRole("heading", { name: /giữ nhịp học/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /điều hướng chính/i })).toBeInTheDocument();
  });

  it("changes the saved theme", () => {
    renderApp();
    const themeButton = screen.getByRole("button", { name: /chuyển sang giao diện/i });

    fireEvent.click(themeButton);

    expect(window.localStorage.getItem("mach-theme")).toBe(document.documentElement.dataset.theme);
  });

  it("collapses and expands the desktop sidebar", () => {
    renderApp();

    const collapseButton = screen.getByRole("button", { name: "Thu gọn thanh bên" });
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
  ])("renders route %s directly", (path, title) => {
    renderApp(path);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });

  it("navigates to a real page and marks the active link", () => {
    renderApp();
    fireEvent.click(screen.getByRole("link", { name: "Tài liệu" }));
    expect(
      screen.getByRole("heading", { name: "Một nơi cho mọi điều muốn học." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tài liệu" })).toHaveAttribute("aria-current", "page");
  });

  it("saves a note without counting edits as new sessions", () => {
    renderApp("/notes");
    fireEvent.change(screen.getByLabelText("Hôm nay bạn học được gì?"), {
      target: { value: "I learned a new word today." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    const data = JSON.parse(localStorage.getItem("mach-demo-v1") ?? "{}");
    expect(data.notes).toHaveLength(12);
    expect(data.notes.at(-1).content).toBe("I learned a new word today.");
    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    expect(JSON.parse(localStorage.getItem("mach-demo-v1") ?? "{}").notes).toHaveLength(12);
  });

  it("changes demo role and removes classes from the self-learner navigation", () => {
    renderApp("/settings");
    fireEvent.change(screen.getByLabelText("Xem giao diện theo vai trò"), {
      target: { value: "self_learner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(screen.queryByRole("link", { name: "Lớp học" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("mach-demo-v1") ?? "{}").role).toBe("self_learner");
  });

  it("shows a useful empty state for document search", () => {
    renderApp("/documents");
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm tài liệu" }), {
      target: { value: "no-match" },
    });
    expect(screen.getByRole("heading", { name: "Chưa tìm thấy tài liệu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ bộ lọc" }));
    expect(screen.getByRole("heading", { name: "Small habits, big changes" })).toBeInTheDocument();
  });

  it("does not crash on corrupted stored demo data", () => {
    localStorage.setItem("mach-demo-v1", "invalid-json");
    renderApp();
    expect(screen.getByRole("alert")).toHaveTextContent("Không đọc được dữ liệu đã lưu");
    expect(screen.getByRole("heading", { name: /giữ nhịp học/i })).toBeInTheDocument();
  });
});
