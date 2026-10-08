import { expect, test } from "@playwright/test";

test("the language toggle switches visible UI strings and is remembered", async ({ page }) => {
  await page.goto("/");
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveText("Lost something at school? Let’s get it back.");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Browse", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /I lost something/ })).toBeVisible();

  await page.getByRole("button", { name: "中文" }).click();
  await expect(title).toHaveText("在学校丢了东西？我们帮你找回来。");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("link", { name: "浏览", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /我丢了东西/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近拾到" })).toBeVisible();
  await expect(page.getByRole("button", { name: "中文" })).toHaveAttribute("aria-pressed", "true");

  // Category labels from /api/meta follow the language too.
  await page.goto("/browse");
  await expect(page.getByRole("heading", { name: "浏览", level: 1 })).toBeVisible();
  await expect(page.getByLabel("类别")).toContainText("全部类别");

  // The choice survives a reload (localStorage).
  await page.reload();
  await expect(page.getByRole("heading", { name: "浏览", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { name: "Browse", level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
