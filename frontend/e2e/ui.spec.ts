import { expect, test } from "@playwright/test";

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
