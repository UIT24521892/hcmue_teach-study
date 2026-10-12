import { expect, test, type Page, type Route } from "@playwright/test";

type SessionRole = "teacher" | "student" | "self_learner";

function sessionFor(role: SessionRole = "teacher") {
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

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "http://127.0.0.1:5178",
      "access-control-allow-credentials": "true",
    },
    body: JSON.stringify(body),
  });
}

async function mockAnonymousAuth(page: Page) {
  await page.route("**/api/v1/auth/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/auth/refresh")) {
      await fulfillJson(
        route,
        {
          code: "UNAUTHENTICATED",
          message: "Chưa đăng nhập.",
          requestId: "e2e-anonymous",
        },
        401,
      );
      return;
    }

    await route.abort("failed");
  });
}

async function mockAuthenticatedAuth(page: Page, role: SessionRole) {
  const session = sessionFor(role);
  await page.route("**/api/v1/auth/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/auth/refresh")) {
      await fulfillJson(route, session);
      return;
    }

    await route.abort("failed");
  });
}

async function mockDocumentPipeline(page: Page) {
  const readyId = "18ea5220-111c-4143-a108-5ed19cbf5f76";
  const processingId = "d2873396-fe5d-487c-986e-eeaa6b805b91";
  const createdAt = "2026-09-20T01:00:00.000Z";
  await page.route("**/api/v1/documents**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/${processingId}/jobs`)) {
      await fulfillJson(route, {
        jobs: [
          {
            id: "2cdfb36f-4b86-4f19-917e-162f1be40973",
            documentId: processingId,
            status: "processing",
            progress: 55,
            attempt: 1,
            maxAttempts: 3,
            error: null,
            createdAt,
            startedAt: createdAt,
            completedAt: null,
            updatedAt: createdAt,
          },
        ],
      });
      return;
    }
    if (url.pathname.endsWith(`/${readyId}/questions`)) {
      await fulfillJson(route, {
        questions: [
          {
            id: "0709fc76-9c2e-4322-bbeb-27f6ec8f844e",
            documentId: readyId,
            type: "true_false",
            prompt: "Tài liệu nhấn mạnh việc luyện tập đều đặn.",
            options: null,
            correctAnswer: "true",
            explanation: "Ý này xuất hiện trực tiếp trong đoạn nguồn.",
            difficulty: "easy",
            reviewStatus: "pending_review",
            version: 1,
            createdAt,
            updatedAt: createdAt,
          },
        ],
        pagination: { page: 1, pageSize: 50, total: 1, pageCount: 1 },
      });
      return;
    }
    if (url.pathname.endsWith("/documents")) {
      const base = {
        mimeType: "text/plain",
        extension: "txt",
        byteSize: 1_024,
        checksum: "a".repeat(64),
        pageCount: null,
        processingError: null,
        createdAt,
        updatedAt: createdAt,
      };
      await fulfillJson(route, {
        documents: [
          {
            ...base,
            id: readyId,
            originalName: "daily-habits.txt",
            status: "ready",
            characterCount: 1_240,
          },
          {
            ...base,
            id: processingId,
            originalName: "reading-notes.txt",
            status: "processing",
            characterCount: null,
          },
        ],
        pagination: { page: 1, pageSize: 50, total: 2, pageCount: 1 },
      });
      return;
    }
    await route.abort("failed");
  });
}

test("all main pages render without horizontal overflow in both themes", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => localStorage.setItem("mach-theme", value), theme);
    for (const route of [
      "/",
      "/documents",
      "/classes",
      "/classes/class-1",
      "/practice",
      "/notes",
      "/progress",
      "/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `${route} in ${theme} should fit viewport`).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(`${route.replaceAll("/", "_") || "dashboard"}-${theme}.png`),
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});

test("sidebar supports collapse or accessible mobile dialog", async ({ page }, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Mở menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu điều hướng" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mở menu" })).toBeFocused();
    await page.getByRole("button", { name: "Mở menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Ghi chú" }).click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } else {
    await page.getByRole("button", { name: "Thu gọn thanh bên" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Mở rộng thanh bên" })).toBeVisible();
    await page.getByRole("link", { name: "Ghi chú", exact: true }).click();
    await expect(page).toHaveURL(/\/notes$/);
  }
});

test("quiz autosaves, submits once, shows explanations and grows the tree", async ({
  page,
}, testInfo) => {
  await page.goto("/practice/everyday-english");
  await page.getByRole("radio", { name: "A. have" }).check();
  await page.screenshot({ path: testInfo.outputPath("quiz-room.png"), fullPage: true });
  await page.reload();
  await expect(page.getByRole("radio", { name: "A. have" })).toBeChecked();
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await page.getByLabel("Câu trả lời của bạn").fill("by");
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await page.getByRole("radio", { name: "A. True" }).check();
  await page.getByRole("button", { name: "Nộp bài", exact: true }).first().click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận nộp bài" }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByText("100", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Đáp án và giải thích" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("quiz-result.png"), fullPage: true });
  await page.reload();
  const count = await page.evaluate(
    () => JSON.parse(localStorage.getItem("mach-demo-v1")!).attempts.length,
  );
  expect(count).toBe(1);
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "13 buổi học, 1 cành hoàn chỉnh và 13 chiếc lá" }),
  ).toBeVisible();
});

test("growth milestones preserve accurate leaf counts and show the next tree", async ({
  page,
}, testInfo) => {
  await page.goto("/progress");
  await page.getByRole("button", { name: "Xem các mốc trưởng thành" }).click();
  const dialog = page.getByRole("dialog");
  for (const sessions of [0, 1, 10, 30, 50, 100, 101]) {
    await page.getByLabel("Mốc buổi học").selectOption(String(sessions));
    await expect(dialog.locator("[data-tree-leaf]")).toHaveCount(sessions === 101 ? 1 : sessions);
    await dialog.screenshot({ path: testInfo.outputPath(`tree-${sessions}.png`) });
  }
  await expect(dialog.getByText("1 cây trọn vẹn trong vườn · Cây 2: 1/100 lá")).toBeVisible();
  await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
  await expect(
    page.getByRole("img", { name: "12 buổi học, 1 cành hoàn chỉnh và 12 chiếc lá" }),
  ).toBeVisible();
});

test("an unfinished note survives switching dates and reloading without adding a leaf", async ({
  page,
}) => {
  await page.goto("/notes");
  await page.getByLabel("Hôm nay bạn học được gì?").fill("An unfinished thought to keep.");
  const today = await page.locator('button[aria-current="date"]').getAttribute("aria-label");
  const otherDate = page.locator('button[aria-pressed="false"]:not(:disabled)').first();
  if (await otherDate.count()) await otherDate.click();
  await page.getByRole("button", { name: today!, exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Hôm nay bạn học được gì?")).toHaveValue(
    "An unfinished thought to keep.",
  );
  await expect(page.getByText("Bản nháp chưa lưu", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "12 buổi học, 1 cành hoàn chỉnh và 12 chiếc lá" }),
  ).toBeVisible();
});

test("teacher can create a local class draft and reopen it", async ({ page }) => {
  await page.goto("/classes");
  await page.getByRole("button", { name: "Tạo lớp mới" }).click();
  await page.getByLabel("Tên lớp", { exact: true }).fill("Lớp thử nghiệm UI");
  await page.getByLabel("Mô tả ngắn").fill("Cùng đọc sách mỗi tuần.");
  await page.getByRole("button", { name: "Lưu lớp demo" }).click();
  await page.reload();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Lớp thử nghiệm UI" }) });
  await card.getByRole("link", { name: "Vào không gian lớp" }).click();
  await expect(page.getByRole("heading", { name: "Lớp học vừa nảy mầm" })).toBeVisible();
  await expect(page.getByText("Mã minh họa: CHƯA CẤP")).toBeVisible();
});

test("expired quiz locks answers and can still submit", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mach-quiz-everyday-english",
      JSON.stringify({
        id: "expired-test",
        deadline: Date.now() - 10_000,
        answers: { v1: "have" },
      }),
    ),
  );
  await page.goto("/practice/everyday-english");
  await expect(page.getByRole("radio", { name: "A. have" })).toBeDisabled();
  await page.getByRole("button", { name: "Nộp bài hết giờ" }).click();
  await expect(page).toHaveURL(/\/results\/expired-test$/);
});

test("file validation, local metadata and empty search states", async ({ page }) => {
  await page.goto("/documents?upload=1");
  await page.getByLabel("File tài liệu").setInputFiles({
    name: "invalid.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not a document"),
  });
  await page.getByRole("button", { name: "Thêm vào thư viện demo" }).click();
  await expect(page.getByRole("alert")).toContainText("Định dạng không hợp lệ");
  await page.getByLabel("File tài liệu").setInputFiles({
    name: "lesson.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("English lesson"),
  });
  await page.getByRole("button", { name: "Thêm vào thư viện demo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "lesson.txt" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Tìm tài liệu" }).fill("no-match");
  await expect(page.getByRole("heading", { name: "Chưa tìm thấy tài liệu" })).toBeVisible();
});

test("authenticated document pipeline is responsive in both themes", async ({ page }, testInfo) => {
  await mockAuthenticatedAuth(page, "teacher");
  await mockDocumentPipeline(page);

  for (const theme of ["light", "dark"]) {
    await page.goto("/documents");
    await page.evaluate((value) => localStorage.setItem("mach-theme", value), theme);
    await page.reload();
    await expect(page.getByRole("heading", { name: "daily-habits.txt" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: /reading-notes/i })).toHaveAttribute(
      "aria-valuenow",
      "55",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`document-pipeline-${theme}.png`),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Xem & duyệt câu hỏi" }).click();
    await expect(page.getByLabel("Câu hỏi")).toBeVisible();
    await page.getByRole("dialog").screenshot({
      path: testInfo.outputPath(`question-review-${theme}.png`),
    });
    await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
  }
});

test("notes persist and editing the same date does not farm leaves", async ({ page }) => {
  await page.goto("/notes");
  await page.getByLabel("Hôm nay bạn học được gì?").fill("Today I learned consistency.");
  await page.getByRole("button", { name: "Lưu ghi chú" }).click();
  await page.reload();
  await expect(page.getByLabel("Hôm nay bạn học được gì?")).toHaveValue(
    "Today I learned consistency.",
  );
  await page.getByRole("button", { name: "Lưu ghi chú" }).click();
  await expect(
    page.getByRole("img", { name: "12 buổi học, 1 cành hoàn chỉnh và 12 chiếc lá" }),
  ).toBeVisible();
});

test("role preview changes navigation without pretending to authenticate", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Xem giao diện theo vai trò").selectOption("self_learner");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page.reload();
  await expect(page.getByLabel("Xem giao diện theo vai trò")).toHaveValue("self_learner");
  await page.goto("/classes");
  await expect(page.getByRole("heading", { name: "Không gian tự học của bạn" })).toBeVisible();
  await expect(page.getByText("Bản trải nghiệm UI", { exact: true })).toBeVisible();
});

test("login follows an internal next path and exposes the authenticated account", async ({
  page,
}) => {
  const session = sessionFor("student");
  await page.route("**/api/v1/auth/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/auth/refresh")) {
      await fulfillJson(
        route,
        {
          code: "UNAUTHENTICATED",
          message: "Chưa đăng nhập.",
          requestId: "e2e-login-bootstrap",
        },
        401,
      );
      return;
    }
    if (pathname.endsWith("/auth/login")) {
      await fulfillJson(route, session);
      return;
    }
    await route.abort("failed");
  });

  await page.goto("/login?next=%2Fnotes");
  await page.getByLabel("Email").fill("student@example.com");
  await page.getByLabel("Mật khẩu").fill("matkhau-rat-dai-123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  await expect(page).toHaveURL(/\/notes$/);
  await expect(
    page.getByRole("heading", { name: "Ghi lại điều nhỏ. Nuôi lớn tri thức." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Mở hồ sơ của Lê Chi" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});

test("registration reaches account and failed logout can be retried", async ({ page }) => {
  const session = sessionFor("self_learner");
  let logoutCalls = 0;
  await page.route("**/api/v1/auth/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/auth/refresh")) {
      await fulfillJson(
        route,
        {
          code: "UNAUTHENTICATED",
          message: "Chưa đăng nhập.",
          requestId: "e2e-register-bootstrap",
        },
        401,
      );
      return;
    }
    if (pathname.endsWith("/auth/register")) {
      await fulfillJson(route, session, 201);
      return;
    }
    if (pathname.endsWith("/auth/logout")) {
      logoutCalls += 1;
      if (logoutCalls === 1) {
        await fulfillJson(
          route,
          {
            code: "INTERNAL_ERROR",
            message: "Máy chủ chưa thể đăng xuất.",
            requestId: "e2e-logout-failure",
          },
          500,
        );
        return;
      }
      await fulfillJson(route, { success: true });
      return;
    }
    await route.abort("failed");
  });

  await page.goto("/register");
  await page.getByLabel("Tên hiển thị").fill("Lê Chi");
  await page.getByLabel("Email").fill("learner@example.com");
  await page.getByLabel("Mật khẩu").fill("matkhau-rat-dai-123");
  await page.getByRole("radio", { name: "Người tự học" }).check();
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();

  await page.getByRole("link", { name: "Mở hồ sơ của Lê Chi" }).click();
  await expect(page.getByRole("heading", { name: "Hồ sơ của bạn." })).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: "self_learner@example.com" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("alert")).toHaveText("Máy chủ chưa thể đăng xuất.");
  await expect(page.getByRole("heading", { name: "Hồ sơ của bạn." })).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập để tiếp tục." })).toBeVisible();
  expect(logoutCalls).toBe(2);
});

test("authenticated teacher overrides a stored self-learner preview across surfaces", async ({
  page,
}, testInfo) => {
  await mockAnonymousAuth(page);
  await page.goto("/settings");
  await page.getByLabel("Xem giao diện theo vai trò").selectOption("self_learner");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();

  await page.unroute("**/api/v1/auth/**");
  await mockAuthenticatedAuth(page, "teacher");
  await mockDocumentPipeline(page);
  await page.goto("/classes");
  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Mở menu" }).click();
    await expect(
      page.getByRole("dialog", { name: "Menu điều hướng" }).getByRole("link", { name: "Lớp học" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByRole("link", { name: "Lớp học" })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Tạo lớp mới" })).toBeVisible();

  await page.goto("/documents");
  await expect(page.getByRole("button", { name: "Thêm tài liệu" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("Vai trò tài khoản")).toHaveText("Giáo viên");
  await expect(page.getByLabel("Xem giao diện theo vai trò")).toHaveCount(0);
});

test("authenticated self-learner overrides the default teacher preview", async ({ page }) => {
  await mockAuthenticatedAuth(page, "self_learner");
  await page.goto("/classes");

  await expect(page.getByRole("heading", { name: "Không gian tự học của bạn" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lớp học" })).toHaveCount(0);

  await page.goto("/settings");
  await expect(page.getByLabel("Vai trò tài khoản")).toHaveText("Người tự học");
  await expect(page.getByText("Vai trò do máy chủ xác thực.", { exact: false })).toBeVisible();
});
