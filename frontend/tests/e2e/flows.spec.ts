import { expect, test } from "@playwright/test";
import { apiLogin, DESK, STUDENT, uiLogin } from "./helpers";

// These three flows build on each other (the student's report → their claim → the desk's decision),
// so they run in order against the freshly seeded demo database.
test.describe.configure({ mode: "serial" });

test("anonymous visitors can browse found items and search finds the dinosaur thermos", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByRole("heading", { name: "Browse", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();

  const results = page.getByRole("region", { name: "Results" });
  const cards = results.locator('a[href^="/items/"]');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(12);
  await expect(results).toContainText(/\d+ items/);

  await page.getByRole("searchbox", { name: "Search reports" }).fill("dinosaur");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=dinosaur/);
  await expect(results).toContainText(/results? for “dinosaur”/);
  const thermos = results.getByRole("link", { name: /green dinosaur sticker/i });
  await expect(thermos).toBeVisible();
  await expect(thermos).toContainText("Water bottle");
  await expect(thermos).toContainText("Lower Gym");
});

test("a student reports a lost thermos and gets a strong match with reasons", async ({ page }) => {
  await uiLogin(page, STUDENT, "/report/lost");
  await expect(page.getByRole("heading", { name: "Report something lost", level: 1 })).toBeVisible();

  await page.getByLabel("What did you lose?").fill("黑色保温杯 贴了恐龙贴纸");
  const detected = page.getByTestId("detected-chips");
  await expect(detected).toContainText("Water bottle");
  await expect(detected).toContainText("Black");
  await expect(page.getByTestId("noticed-chips")).toContainText("sticker");
  await expect(page.getByTestId("noticed-chips")).toContainText("dinosaur");
  // Untouched fields are prefilled from the description.
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("water_bottle");
  await expect(page.getByRole("button", { name: "Black", pressed: true })).toBeVisible();

  await page.getByLabel("Area", { exact: true }).selectOption("sports");
  await page.getByRole("group", { name: "Places in Gyms & sports" }).getByRole("button", { name: "Lower Gym" }).click();
  await page.getByRole("button", { name: "A few days ago" }).click();
  await page.getByRole("button", { name: "Post lost report" }).click();

  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}\?new=1$/);
  await expect(page.getByText("Report posted")).toBeVisible();
  const best = page.getByTestId("match-card").first();
  await expect(best).toHaveAttribute("data-band", "strong");
  await expect(best).toContainText("Strong match");
  await expect(best).toContainText(/green dinosaur sticker/);
  const reasons = best.getByRole("list", { name: "Why we think so" });
  await expect(reasons).toContainText("Shared details: sticker, dinosaur");
  await expect(reasons).toContainText("Same place: Lower Gym");
});

test("claim → front desk approves → item handed back and marked returned", async ({ page }) => {
  await apiLogin(page, STUDENT);
  await page.goto("/browse?q=dinosaur");
  await page.getByRole("link", { name: /green dinosaur sticker/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("dinosaur sticker");

  await page.getByRole("button", { name: "This is mine" }).click();
  const dialog = page.getByRole("dialog", { name: "Claim this item" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("How can the front desk tell it’s yours?").fill("Green dinosaur sticker on the side and K.L. under the lid.");
  const linkSelect = dialog.getByLabel("Link one of your lost reports");
  const lostOption = linkSelect.locator("option", { hasText: "恐龙" }).first();
  await expect(lostOption).toBeAttached();
  await linkSelect.selectOption((await lostOption.getAttribute("value"))!);
  await dialog.getByRole("button", { name: "Send claim" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Your claim is being reviewed")).toBeVisible();
  const itemPath = new URL(page.url()).pathname;

  // Log out through the account menu.
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();

  // The front desk approves the claim, then hands the item over.
  await uiLogin(page, DESK, "/admin");
  await expect(page.getByRole("heading", { name: "Front desk", level: 1 })).toBeVisible();
  const review = page.getByTestId("claim-review").filter({ hasText: "green dinosaur sticker" });
  await expect(review).toContainText("Demo Student");
  await expect(review).toContainText("student.demo@findmy.local");
  await expect(review).toContainText("K.L. under the lid");
  await expect(review).toContainText("Strong match");
  await review.getByLabel(/Note to the student/).fill("Bring your student ID to reception.");
  await review.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Claim approved.")).toBeVisible();

  const pickup = page.getByTestId("pickup-row").filter({ hasText: "green dinosaur sticker" });
  await pickup.getByRole("button", { name: "Mark returned" }).click();
  await page.getByRole("alertdialog", { name: "Mark as returned?" }).getByRole("button", { name: "Yes, mark returned" }).click();
  await expect(page.getByText("Marked as returned.")).toBeVisible();
  await expect(pickup).toHaveCount(0);

  await page.goto(itemPath);
  const article = page.locator("article").first();
  await expect(article.getByText("Returned", { exact: true }).first()).toBeVisible();

  // The student sees the happy ending too.
  await page.context().clearCookies();
  await apiLogin(page, STUDENT);
  await page.goto(itemPath);
  await expect(page.getByText("Returned to you")).toBeVisible();
});
