import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { apiLogin, createLostReport, DESK, STUDENT } from "./helpers";

// Product screenshots for docs/screenshots (desktop 1440×900, mobile 390×844), in English.
const VIEWPORTS = [
  { name: "desktop", use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false } },
  { name: "mobile", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
] as const;

function outDir(rootDir: string) {
  const dir = resolve(rootDir, "../../../docs/screenshots");
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

for (const vp of VIEWPORTS) {
  test.describe(`screenshots · ${vp.name}`, () => {
    test.use({ ...vp.use, locale: "en-US", timezoneId: "Asia/Shanghai" });

    test(`${vp.name}: home, browse, report, item, admin stats, quick add`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const dir = outDir(testInfo.config.rootDir);
      const shot = async (name: string, fullPage = false) => {
        if (fullPage) await page.evaluate(() => window.scrollTo({ top: 0 }));
        await settle(page);
        await page.screenshot({ path: resolve(dir, `${vp.name}-${name}.png`), fullPage });
      };

      // Home (anonymous)
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('a[href^="/items/"]').first()).toBeVisible();
      await shot("home");

      // Browse (anonymous)
      await page.goto("/browse");
      await expect(page.getByRole("region", { name: "Results" }).locator('a[href^="/items/"]').first()).toBeVisible();
      await shot("browse");

      // Report form with live detected chips
      await apiLogin(page, STUDENT);
      await page.goto("/report/lost");
      await page.getByLabel("What did you lose?").fill("Black Hydro Flask with a dinosaur sticker, dented at the bottom — left in the gym after PE");
      await expect(page.getByTestId("detected-chips")).toContainText("Hydro Flask");
      await expect(page.getByTestId("noticed-chips")).toContainText("dinosaur");
      await page.locator("#sec-describe").evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16 }));
      await shot("report-detected-chips");

      // Item page with matches (a fresh lost report, opened as just posted)
      const itemId = await createLostReport(page, {
        description: "White AirPods case engraved J.W., lost near the hallway lockers",
        category: "earbuds",
        colors: "white",
        locations: "hallway_lockers",
        marks_text: "engraved J.W.",
        days: 4,
      });
      await page.goto(`/items/${itemId}?new=1`);
      await expect(page.getByTestId("match-card").first()).toBeVisible();
      await shot("item-matches");

      // Front desk: stats and quick add
      await page.context().clearCookies();
      await apiLogin(page, DESK);
      await page.goto("/admin?tab=stats");
      await expect(page.getByRole("img", { name: /Reports by category/ })).toBeVisible();
      await shot("admin-stats", true);

      await page.goto("/admin/quick-add");
      await page.getByRole("button", { name: "Water bottle" }).click();
      await page.getByRole("button", { name: "Black" }).click();
      await page.getByLabel("Where was it found?").selectOption("lower_gym");
      await expect(page.getByText("Black water bottle")).toBeVisible();
      await shot("quick-add", true);
    });
  });
}
