import { expect, test } from "@playwright/test";
import { apiLogin, createLostReport, DESK, STUDENT } from "./helpers";

// The front desk's feedback (2026-10): where finders leave things, the open canteen shelf, look-alike cups,
// closing a report with a reason, and the desk's own tools (daily check, staff list).
test.describe.configure({ mode: "serial" });

test("a finder is told where a plain cup goes and where a phone goes", async ({ page }) => {
  await apiLogin(page, STUDENT);
  await page.goto("/report/found");
  await page.getByLabel("What did you find?").fill("plain black water bottle");
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("water_bottle");
  await expect(page.getByTestId("dropoff-advice")).toContainText("open shelf");
  await expect(page.getByRole("radio", { name: /Canteen 1F open shelf/ })).toBeChecked();

  await page.getByLabel("Category", { exact: true }).selectOption("phone");
  await expect(page.getByTestId("dropoff-advice")).toContainText("front desk");
  await expect(page.getByRole("radio", { name: "5th-floor front desk" })).toBeChecked();
});

test("look-alike cups on the shelf: one card, no claim, the owner marks one taken", async ({ page }) => {
  await apiLogin(page, STUDENT);
  const lostId = await createLostReport(page, { description: "black water bottle", category: "water_bottle", colors: "black" });
  await page.goto(`/items/${lostId}`);
  const lookAlikes = page.getByTestId("look-alikes");
  await expect(lookAlikes).toContainText("look-alike");
  await expect(lookAlikes).toContainText("Canteen 1F open shelf");
  for (const card of await page.getByTestId("match-card").all()) await expect(card).not.toContainText("没什么特征");

  await lookAlikes.getByRole("link", { name: /没什么特征/ }).click();
  const panel = page.getByTestId("shelf-panel");
  await expect(panel).toContainText("No claim needed");
  await expect(page.getByRole("button", { name: "This is mine" })).toHaveCount(0);
  await panel.getByRole("button", { name: "I took it" }).click();
  await page.getByRole("alertdialog", { name: "Mark it as taken?" }).getByRole("button", { name: "Yes, I took it" }).click();
  await expect(page.getByText("Marked as taken.")).toBeVisible();
  await expect(page.getByText("Someone has already taken this item from the shelf.")).toBeVisible();
});

test("a student closes a lost report and says why", async ({ page }) => {
  await apiLogin(page, STUDENT);
  const lostId = await createLostReport(page, { description: "red umbrella with a duck handle", category: "umbrella", colors: "red" });
  await page.goto(`/items/${lostId}`);
  await page.getByRole("button", { name: "Close this report" }).click();
  const dialog = page.getByRole("dialog", { name: "Close this report?" });
  await dialog.getByRole("button", { name: "Close report" }).click();
  await expect(dialog.getByText("Choose a reason.")).toBeVisible();
  await dialog.getByRole("radio", { name: "I found it myself" }).check();
  await dialog.getByRole("button", { name: "Close report" }).click();
  await expect(page.getByText("Report closed.")).toBeVisible();
  await expect(page.locator("article")).toContainText("I found it myself");
});

test("the super admin adds a desk colleague, and the daily check stamps an item", async ({ page }) => {
  await apiLogin(page, DESK);
  await page.goto("/admin?tab=staff");
  await expect(page.getByTestId("staff-row").first()).toContainText(DESK);
  await page.getByLabel("School email").fill("helen.demo@findmy.local");
  await page.getByLabel("Desk", { exact: true }).selectOption("desk_library");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Added helen.demo@findmy.local.")).toBeVisible();
  const helen = page.getByTestId("staff-row").filter({ hasText: "helen.demo" });
  await expect(helen).toContainText("Hasn’t signed in yet");
  await expect(helen.getByLabel("Desk for helen.demo@findmy.local")).toHaveValue("desk_library");

  await page.getByRole("tab", { name: "Daily check" }).click();
  await page.getByLabel("Check", { exact: true }).selectOption("desk_library");
  const row = page.getByTestId("check-row").first();
  await expect(row).toContainText("Not checked yet");
  await row.getByRole("button", { name: /^Still here/ }).click();
  await expect(page.getByText("Marked as still here.")).toBeVisible();
  await expect(page.getByTestId("check-row").last()).toContainText(/Checked/);

  // Helen signs in and lands on her own desk.
  await page.context().clearCookies();
  await apiLogin(page, "helen.demo@findmy.local");
  await page.goto("/admin?tab=check");
  await expect(page.getByLabel("Check", { exact: true })).toHaveValue("desk_library");
  await expect(page.getByRole("tab", { name: "Staff" })).toHaveCount(0);
});
