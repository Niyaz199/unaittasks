import { expect, test } from "@playwright/test";
import { hasEnv, loginAsSmokeUser, missingEnvMessage } from "./support";

test("redirects unauthenticated user from protected route to login", async ({ page }) => {
  await page.goto("/rounds/config");

  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Задачник эксплуатации" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
});

test.describe("authenticated auth smoke", () => {
  test.skip(!hasEnv("E2E_EMAIL", "E2E_PASSWORD"), missingEnvMessage("E2E_EMAIL", "E2E_PASSWORD"));

  test("logs in through the UI and lands on My tasks", async ({ page }) => {
    await loginAsSmokeUser(page);
  });
});
