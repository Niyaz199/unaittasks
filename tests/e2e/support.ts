import { expect, type Page } from "@playwright/test";

export function hasEnv(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

export function missingEnvMessage(...keys: string[]) {
  return `Пропущено: ${keys.filter((key) => !process.env[key]?.trim()).join(", ")}`;
}

export function requireEnv(key: string) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

export async function loginAsSmokeUser(page: Page) {
  await page.goto("/login");

  await page.getByPlaceholder("Email").fill(requireEnv("E2E_EMAIL"));
  await page.getByPlaceholder("Пароль").fill(requireEnv("E2E_PASSWORD"));
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL(/\/my(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Мои задачи" })).toBeVisible();
}

export function makeSmokeLabel(prefix: string) {
  return `${prefix} ${new Date().toISOString()}`;
}
