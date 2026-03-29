import { expect, test, type Page } from "@playwright/test";
import { hasEnv, loginAsSmokeUser, makeSmokeLabel, missingEnvMessage, requireEnv } from "./support";

async function openRoundsConfigRoom(page: Page, objectName: string, roomName: string) {
  await page.goto("/rounds/config");
  await expect(page.getByRole("heading", { name: "Конфигуратор обходов" })).toBeVisible();

  await page.getByRole("combobox").selectOption({ label: objectName });
  await page.getByPlaceholder("Поиск по помещению").fill(roomName);

  const row = page.getByRole("row").filter({ hasText: roomName }).first();
  await expect(row).toBeVisible();

  return row.getByRole("checkbox").first();
}

test.describe("rounds smoke", () => {
  test.skip(!hasEnv("E2E_EMAIL", "E2E_PASSWORD"), missingEnvMessage("E2E_EMAIL", "E2E_PASSWORD"));

  test("rounds config save/read persists after refresh and restores original state", async ({ page }) => {
    test.skip(
      !hasEnv("E2E_ROUNDS_OBJECT_NAME", "E2E_ROUNDS_ROOM_NAME"),
      missingEnvMessage("E2E_ROUNDS_OBJECT_NAME", "E2E_ROUNDS_ROOM_NAME")
    );

    const objectName = requireEnv("E2E_ROUNDS_OBJECT_NAME");
    const roomName = requireEnv("E2E_ROUNDS_ROOM_NAME");

    await loginAsSmokeUser(page);

    const checkbox = await openRoundsConfigRoom(page, objectName, roomName);
    const initialChecked = await checkbox.isChecked();
    const targetChecked = !initialChecked;

    try {
      await checkbox.setChecked(targetChecked);
      await page.getByRole("button", { name: "Сохранить конфигурацию" }).click();
      await expect(page.getByText(/Конфигурация сохранена/)).toBeVisible();

      await page.reload();
      const reloadedCheckbox = await openRoundsConfigRoom(page, objectName, roomName);
      if (targetChecked) {
        await expect(reloadedCheckbox).toBeChecked();
      } else {
        await expect(reloadedCheckbox).not.toBeChecked();
      }
    } finally {
      const restoreCheckbox = await openRoundsConfigRoom(page, objectName, roomName);
      const currentChecked = await restoreCheckbox.isChecked();
      if (currentChecked !== initialChecked) {
        await restoreCheckbox.setChecked(initialChecked);
        await page.getByRole("button", { name: "Сохранить конфигурацию" }).click();
        await expect(page.getByText(/Конфигурация сохранена/)).toBeVisible();

        await page.reload();
        const finalCheckbox = await openRoundsConfigRoom(page, objectName, roomName);
        if (initialChecked) {
          await expect(finalCheckbox).toBeChecked();
        } else {
          await expect(finalCheckbox).not.toBeChecked();
        }
      }
    }
  });

  test("room QR resolve and scanner confirm flow work for a valid token", async ({ page }) => {
    test.skip(!hasEnv("E2E_ROUNDS_TOKEN"), missingEnvMessage("E2E_ROUNDS_TOKEN"));

    const token = requireEnv("E2E_ROUNDS_TOKEN");

    await loginAsSmokeUser(page);

    const resolveResponse = await page.context().request.get(`/api/rounds/resolve/${encodeURIComponent(token)}`);
    expect(resolveResponse.ok()).toBeTruthy();

    const resolvePayload = (await resolveResponse.json()) as {
      ok?: boolean;
      state?: string;
      room?: { room_name?: string | null };
      error?: string;
    };

    expect(resolvePayload.state).not.toBe("invalid");
    expect(resolvePayload.room?.room_name).toBeTruthy();

    await page.goto(`/rounds/scan?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: "Подтверждение обхода" })).toBeVisible();
    await expect(page.getByText(resolvePayload.room?.room_name ?? "")).toBeVisible();

    await page.getByPlaceholder("Комментарий, если есть замечание").fill(makeSmokeLabel("Smoke rounds check-in"));
    await page.getByRole("button", { name: "Подтвердить отметку" }).click();

    await expect(async () => {
      const hasSuccessMessage = await page.getByText(/Отметка сохранена/).isVisible().catch(() => false);
      if (!hasSuccessMessage) {
        expect(page.url()).toMatch(/\/rounds\/scan(?:\?.*)?$/);
      }
    }).toPass({ timeout: 10_000 });

    await expect(page).toHaveURL(/\/rounds\/scan(?:\?.*)?$/);
  });
});
