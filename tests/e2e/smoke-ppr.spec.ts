import { expect, test } from "@playwright/test";
import { hasEnv, loginAsSmokeUser, makeSmokeLabel, missingEnvMessage, requireEnv } from "./support";

test.describe("ppr smoke", () => {
  test.skip(!hasEnv("E2E_EMAIL", "E2E_PASSWORD"), missingEnvMessage("E2E_EMAIL", "E2E_PASSWORD"));

  test("ppr task details render comments/photo section and allow adding a comment", async ({ page }) => {
    test.skip(!hasEnv("E2E_PPR_TASK_ID"), missingEnvMessage("E2E_PPR_TASK_ID"));

    const taskId = requireEnv("E2E_PPR_TASK_ID");
    const commentText = makeSmokeLabel("Smoke PPR comment");

    await loginAsSmokeUser(page);
    await page.goto(`/ppr/tasks/${taskId}`);

    await expect(page.getByRole("heading", { name: "Карточка ППР-заявки" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Комментарии и фото" })).toBeVisible();
    await expect(page.getByPlaceholder("Написать комментарий по ППР…")).toBeVisible();

    await page.getByPlaceholder("Написать комментарий по ППР…").fill(commentText);
    await page.getByRole("button", { name: "Отправить" }).click();

    await expect(page.getByText(commentText)).toBeVisible();
    await expect(page.getByText("Фото")).toBeVisible();
  });

  test("ppr calendar month route opens and shows month tools", async ({ page }) => {
    await loginAsSmokeUser(page);
    await page.goto("/ppr/calendar?tab=month");

    await expect(page.getByRole("heading", { name: "Календарь ППР" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Уровень 3" })).toBeVisible();
    await expect(page.getByText("План месяца")).toBeVisible();
    await expect(page.locator("summary").filter({ hasText: "Служебные действия месяца" })).toBeVisible();
  });

  test("ppr calendar can submit month generation for a prepared system", async ({ page }) => {
    test.skip(!hasEnv("E2E_PPR_CALENDAR_SYSTEM_NAME"), missingEnvMessage("E2E_PPR_CALENDAR_SYSTEM_NAME"));

    const systemName = requireEnv("E2E_PPR_CALENDAR_SYSTEM_NAME");

    await loginAsSmokeUser(page);
    await page.goto("/ppr/calendar?tab=month");

    await page.locator("summary").filter({ hasText: "Служебные действия месяца" }).click();
    const systemSelect = page.locator('select[name="system_id"]');
    await expect(systemSelect).toBeVisible();

    await systemSelect.selectOption({ label: systemName });
    await page.getByRole("button", { name: "Сформировать месяц" }).click();

    await expect(page.getByRole("heading", { name: "Календарь ППР" })).toBeVisible();
    await expect(page.getByText("Сформированные планы")).toBeVisible();
    await expect(page.getByText(systemName).first()).toBeVisible();
  });

  test("legacy assignments route redirects to templates and templates explain system-wide rollout", async ({ page }) => {
    await loginAsSmokeUser(page);
    await page.goto("/ppr/assignments");

    await expect(page).toHaveURL(/\/ppr\/templates$/);
    await expect(page.getByRole("heading", { name: "Шаблоны ППР" })).toBeVisible();
    await expect(page.getByText("Активный шаблон применяется ко всему активному оборудованию выбранной системы.")).toBeVisible();
  });
});
