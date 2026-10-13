import { test, type Route } from "@playwright/test";

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "http://127.0.0.1:5178",
      "access-control-allow-credentials": "true",
    },
    body: JSON.stringify(body),
  });
}
for (const theme of ["light", "dark"]) {
  test(`sun ${theme}`, async ({ page }, info) => {
    const empty = { page: 1, pageSize: 50, total: 0, pageCount: 0 };
    await page.route("**/api/v1/auth/**", (r) =>
      json(r, {
        user: {
          id: "u1",
          name: "GV Kiểm tra UI",
          email: "t@example.com",
          role: "teacher",
          timezone: "Asia/Ho_Chi_Minh",
          createdAt: "2026-09-18T00:00:00.000Z",
        },
        accessToken: "a",
        accessTokenExpiresAt: "2026-09-18T01:00:00.000Z",
      }),
    );
    await page.route("**/api/v1/documents**", (r) => json(r, { documents: [], pagination: empty }));
    await page.route("**/api/v1/quizzes**", (r) => json(r, { quizzes: [], pagination: empty }));
    await page.route("**/api/v1/notes/progress", (r) =>
      json(r, {
        progress: {
          timezone: "Asia/Ho_Chi_Minh",
          today: "2026-10-13",
          completedSessions: 12,
          streakDays: 3,
        },
      }),
    );
    await page.route("**/api/v1/notes?**", (r) => json(r, { notes: [] }));
    await page.route("**/api/v1/attempts?**", (r) => json(r, { attempts: [], pagination: empty }));
    await page.addInitScript((t) => localStorage.setItem("mach-theme", t), theme);
    await page.goto("/");
    const tag = `${process.env.SHOT_TAG ?? "x"}-${info.project.name}-${theme}`;
    const garden = page.getByRole("group", { name: /Khu vườn của bạn: cây/ });
    await garden.waitFor();
    const sun = page.getByRole("button", { name: /Mặt trời/ });
    await sun.scrollIntoViewIfNeeded();
    const hero = page.locator("main section").first();
    await page.waitForTimeout(1200);
    await hero.screenshot({ path: info.outputPath(`sun-idle-${tag}.png`) });
    await sun.click();
    for (const ms of [150, 350, 700]) {
      await page.waitForTimeout(ms === 150 ? 150 : ms === 350 ? 200 : 350);
      await hero.screenshot({ path: info.outputPath(`sun-shine${ms}-${tag}.png`) });
    }
  });
}
