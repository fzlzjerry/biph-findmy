import { expect, type Page } from "@playwright/test";

export const STUDENT = "student.demo@findmy.local";
export const DESK = "desk.demo@findmy.local";
const CSRF = { "X-Requested-With": "findmy" };

/** Fast login through the API (dev codes are returned because DEV_SHOW_CODE=true). Shares cookies with `page`. */
export async function apiLogin(page: Page, email: string) {
  const request = await page.request.post("/api/auth/request-code", { headers: CSRF, data: { email } });
  expect(request.ok(), await request.text()).toBeTruthy();
  const { dev_code: code } = (await request.json()) as { dev_code: string };
  const verify = await page.request.post("/api/auth/verify", { headers: CSRF, data: { email, code } });
  expect(verify.ok(), await verify.text()).toBeTruthy();
}

/** Login through the real UI: email → dev code banner (prefilled) → verify → redirected to `next`. */
export async function uiLogin(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("School email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByTestId("dev-code-banner")).toBeVisible();
  await expect(page.getByLabel("6-digit code")).toHaveValue(/^\d{6}$/);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === next.split("?")[0]);
}

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function createLostReport(
  page: Page,
  fields: { description: string; category: string; colors?: string; locations?: string; marks_text?: string; days?: number },
): Promise<string> {
  const response = await page.request.post("/api/items", {
    headers: CSRF,
    multipart: {
      kind: "lost",
      description: fields.description,
      category: fields.category,
      colors: fields.colors ?? "",
      locations: fields.locations ?? "",
      marks_text: fields.marks_text ?? "",
      time_from: isoDaysAgo(fields.days ?? 3),
      time_to: new Date().toISOString(),
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { item: { id: string } };
  return body.item.id;
}
