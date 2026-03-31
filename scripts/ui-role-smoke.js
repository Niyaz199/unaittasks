const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("@playwright/test");

function loadEnv() {
  const content = fs.readFileSync(".env", "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = loadEnv();
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const PASSWORD = "UiSmokePass!2026";
const NOW = Date.now();
const TODAY = new Date().toISOString().slice(0, 10);

function dayOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const created = {
  authUserIds: [],
  objectIds: [],
  roomIds: [],
  taskIds: [],
  pprSystemIds: [],
  pprEquipmentIds: [],
  pprTaskIds: [],
};

const results = [];

function record(name, ok, details = "") {
  results.push({ name, ok, details });
  const prefix = ok ? "PASS" : "FAIL";
  console.log(`${prefix} ${name}${details ? ` :: ${details}` : ""}`);
}

async function runCheck(name, fn) {
  try {
    await fn();
    record(name, true);
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

async function createAuthUser(label, role) {
  const email = `ui.smoke.${NOW}.${label}@example.com`;
  const fullName = `UI ${label.toUpperCase()} ${NOW}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Не удалось создать пользователя ${label}`);
  created.authUserIds.push(data.user.id);

  const { error: profileError } = await service.from("profiles").insert({
    id: data.user.id,
    full_name: fullName,
    role,
  });
  if (profileError) throw profileError;

  return { id: data.user.id, email, password: PASSWORD, role, fullName };
}

async function insertRows(table, rows) {
  const { data, error } = await service.from(table).insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

async function login(page, user) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Пароль").fill(user.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/my(?:\?.*)?$/);
  await page.getByRole("heading", { name: "Мои задачи" }).waitFor();
}

async function logout(page) {
  await page.goto(`${BASE_URL}/profile`);
  const logoutButton = page.getByRole("button", { name: /выйти/i });
  if (await logoutButton.count()) {
    await logoutButton.click();
    await page.waitForURL(/\/login(?:\?.*)?$/);
  }
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor();
}

async function expectHeading(page, text) {
  await page.getByRole("heading", { name: text }).first().waitFor();
}

async function expectLink(page, text) {
  await page.getByRole("link", { name: new RegExp(text, "i") }).first().waitFor();
}

async function expectNoHref(page, href) {
  const count = await page.locator(`a[href="${href}"]`).count();
  if (count > 0) {
    throw new Error(`Нашёл лишнюю ссылку ${href}`);
  }
}

async function expectObjectLabel(page, objectName) {
  await page.locator("label").filter({ hasText: objectName }).first().waitFor();
}

async function expectNoObjectLabel(page, objectName) {
  const locator = page.locator("label").filter({ hasText: objectName }).first();
  try {
    await locator.waitFor({ timeout: 2500 });
    throw new Error(`Нашёл лишний object label: ${objectName}`);
  } catch (error) {
    if (String(error).includes("Нашёл лишний object label")) {
      throw error;
    }
  }
}

async function expectSelectContains(page, selector, expectedValues) {
  const values = await page.locator(`${selector} option`).allTextContents();
  const normalized = values.map((item) => item.trim()).filter(Boolean);
  const missing = expectedValues.filter((value) => !normalized.includes(value));
  if (missing.length) {
    throw new Error(`В select ${selector} нет опций: ${missing.join(", ")}. Есть: ${normalized.join(", ")}`);
  }
}

async function expectSelectExcludes(page, selector, deniedValues) {
  const values = await page.locator(`${selector} option`).allTextContents();
  const normalized = values.map((item) => item.trim()).filter(Boolean);
  const unexpected = deniedValues.filter((value) => normalized.includes(value));
  if (unexpected.length) {
    throw new Error(`В select ${selector} есть лишние опции: ${unexpected.join(", ")}. Есть: ${normalized.join(", ")}`);
  }
}

async function expectNoText(page, text) {
  const locator = page.getByText(text, { exact: false });
  await locator.first().waitFor({ state: "hidden", timeout: 3000 }).catch(async () => {
    if (await locator.count()) {
      throw new Error(`Нашёл нежелательный текст: ${text}`);
    }
  });
}

async function expectOptions(page, selector, expectedValues) {
  const values = await page.locator(`${selector} option`).allTextContents();
  const normalized = values.map((item) => item.trim()).filter(Boolean);
  const missing = expectedValues.filter((value) => !normalized.includes(value));
  if (missing.length) {
    throw new Error(`В селекте нет опций: ${missing.join(", ")}. Есть: ${normalized.join(", ")}`);
  }
}

async function expectOnlyOptions(page, selector, expectedValues) {
  const values = await page.locator(`${selector} option`).allTextContents();
  const normalized = values.map((item) => item.trim()).filter(Boolean);
  const unexpected = normalized.filter((value) => !expectedValues.includes(value));
  const missing = expectedValues.filter((value) => !normalized.includes(value));
  if (missing.length || unexpected.length) {
    throw new Error(
      `Селект не совпал. missing=[${missing.join(", ")}] unexpected=[${unexpected.join(", ")}] all=[${normalized.join(", ")}]`
    );
  }
}

async function expectResponseStatus(page, url, status) {
  const response = await page.goto(`${BASE_URL}${url}`);
  const actual = response?.status();
  if (actual !== status) {
    throw new Error(`Ожидал status ${status} для ${url}, получил ${actual}`);
  }
}

async function expectTaskVisible(page, taskId, title) {
  await page.goto(`${BASE_URL}/tasks/${taskId}`);
  await expectHeading(page, title);
}

async function expectTaskHidden(page, taskId, title) {
  await page.goto(`${BASE_URL}/tasks/${taskId}`);
  const locator = page.getByRole("heading", { name: title });
  try {
    await locator.waitFor({ timeout: 2500 });
    throw new Error(`Задача неожиданно открылась: ${title}`);
  } catch (error) {
    if (String(error).includes("неожиданно открылась")) {
      throw error;
    }
  }
}

async function expectPprTaskVisible(page, taskId) {
  const response = await page.goto(`${BASE_URL}/ppr/tasks/${taskId}`);
  if (response?.status() !== 200) {
    throw new Error(`Ожидал доступ к PPR task ${taskId}, получил ${response?.status()}`);
  }
  await expectHeading(page, "Карточка ППР-заявки");
}

async function expectPprTaskHidden(page, taskId) {
  await page.goto(`${BASE_URL}/ppr/tasks/${taskId}`);
  const locator = page.getByRole("heading", { name: "Карточка ППР-заявки" }).first();
  try {
    await locator.waitFor({ timeout: 2500 });
    throw new Error(`Ожидал отказ/404 для PPR task ${taskId}`);
  } catch (error) {
    if (String(error).includes("Ожидал отказ/404")) {
      throw error;
    }
  }
}

async function setupFixtures() {
  const users = {
    admin: await createAuthUser("admin", "admin"),
    chief: await createAuthUser("chief", "chief"),
    lead: await createAuthUser("lead", "lead"),
    engineer: await createAuthUser("engineer", "engineer"),
    objectEngineer: await createAuthUser("object-engineer", "object_engineer"),
    tech: await createAuthUser("tech", "tech"),
    targetTech: await createAuthUser("target-tech", "tech"),
    targetEngineer: await createAuthUser("target-engineer", "engineer"),
    targetLead: await createAuthUser("target-lead", "lead"),
  };

  const [objectA, objectB] = await insertRows("objects", [
    {
      name: `UI OBJECT A ${NOW}`,
      created_by: users.admin.id,
      object_engineer_id: users.objectEngineer.id,
    },
    {
      name: `UI OBJECT B ${NOW}`,
      created_by: users.admin.id,
      object_engineer_id: users.chief.id,
    },
  ]);
  created.objectIds.push(objectA.id, objectB.id);

  await insertRows("user_objects", [
    { user_id: users.engineer.id, object_id: objectA.id },
    { user_id: users.tech.id, object_id: objectA.id },
    { user_id: users.lead.id, object_id: objectA.id },
    { user_id: users.lead.id, object_id: objectB.id },
  ]);

  const [roomA, roomB] = await insertRows("object_rooms", [
    { object_id: objectA.id, name: `UI ROOM A ${NOW}`, floor: "1", is_active: true, rounds_enabled: true },
    { object_id: objectB.id, name: `UI ROOM B ${NOW}`, floor: "1", is_active: true, rounds_enabled: true },
  ]);
  created.roomIds.push(roomA.id, roomB.id);

  const [leadOwnTask, engineerTask, oeScopeTask, foreignTask] = await insertRows("tasks", [
    {
      title: `UI LEAD OWN TASK ${NOW}`,
      description: "ui smoke",
      object_id: objectA.id,
      status: "new",
      priority: "medium",
      created_by: users.lead.id,
      assigned_to: users.tech.id,
    },
    {
      title: `UI ENGINEER TASK ${NOW}`,
      description: "ui smoke",
      object_id: objectA.id,
      status: "new",
      priority: "medium",
      created_by: users.lead.id,
      assigned_to: users.engineer.id,
    },
    {
      title: `UI OE SCOPE TASK ${NOW}`,
      description: "ui smoke",
      object_id: objectA.id,
      status: "new",
      priority: "medium",
      created_by: users.lead.id,
      assigned_to: users.lead.id,
    },
    {
      title: `UI FOREIGN TASK ${NOW}`,
      description: "ui smoke",
      object_id: objectB.id,
      status: "new",
      priority: "medium",
      created_by: users.chief.id,
      assigned_to: users.chief.id,
    },
  ]);
  created.taskIds.push(leadOwnTask.id, engineerTask.id, oeScopeTask.id, foreignTask.id);

  const { data: groupRow, error: groupError } = await service.from("ppr_system_groups").select("id").limit(1).single();
  if (groupError) throw groupError;

  const [systemA, systemB] = await insertRows("ppr_systems", [
    {
      object_id: objectA.id,
      system_group_id: groupRow.id,
      name: `UI PPR SYSTEM A ${NOW}`,
      responsible_user_id: users.engineer.id,
      is_active: true,
    },
    {
      object_id: objectB.id,
      system_group_id: groupRow.id,
      name: `UI PPR SYSTEM B ${NOW}`,
      responsible_user_id: users.lead.id,
      is_active: true,
    },
  ]);
  created.pprSystemIds.push(systemA.id, systemB.id);

  const [equipmentA, equipmentB] = await insertRows("ppr_equipment", [
    {
      object_id: objectA.id,
      system_id: systemA.id,
      room_id: roomA.id,
      inventory_no: `UI-PPR-EQ-A-${NOW}`,
      name: `UI PPR EQUIPMENT A ${NOW}`,
      dispatch_name: `UI PPR EQUIPMENT A ${NOW}`,
      service_start_date: TODAY,
      status: "active",
    },
    {
      object_id: objectB.id,
      system_id: systemB.id,
      room_id: roomB.id,
      inventory_no: `UI-PPR-EQ-B-${NOW}`,
      name: `UI PPR EQUIPMENT B ${NOW}`,
      dispatch_name: `UI PPR EQUIPMENT B ${NOW}`,
      service_start_date: TODAY,
      status: "active",
    },
  ]);
  created.pprEquipmentIds.push(equipmentA.id, equipmentB.id);

  const [pprTechTask, pprLeadTask, pprOeTask, pprForeignTask] = await insertRows("ppr_tasks", [
    {
      object_id: objectA.id,
      system_id: systemA.id,
      equipment_id: equipmentA.id,
      responsible_user_id: users.engineer.id,
      assignee_id: users.tech.id,
      planned_for: dayOffset(0),
      status: "new",
      is_overdue: false,
      is_rescheduled: false,
      general_comment: "ui smoke tech task",
    },
    {
      object_id: objectA.id,
      system_id: systemA.id,
      equipment_id: equipmentA.id,
      responsible_user_id: users.lead.id,
      assignee_id: users.lead.id,
      planned_for: dayOffset(1),
      status: "new",
      is_overdue: false,
      is_rescheduled: false,
      general_comment: "ui smoke lead task",
    },
    {
      object_id: objectA.id,
      system_id: systemA.id,
      equipment_id: equipmentA.id,
      responsible_user_id: users.lead.id,
      assignee_id: users.objectEngineer.id,
      planned_for: dayOffset(2),
      status: "new",
      is_overdue: false,
      is_rescheduled: false,
      general_comment: "ui smoke oe task",
    },
    {
      object_id: objectB.id,
      system_id: systemB.id,
      equipment_id: equipmentB.id,
      responsible_user_id: users.lead.id,
      assignee_id: users.lead.id,
      planned_for: dayOffset(3),
      status: "new",
      is_overdue: false,
      is_rescheduled: false,
      general_comment: "ui smoke foreign task",
    },
  ]);
  created.pprTaskIds.push(pprTechTask.id, pprLeadTask.id, pprOeTask.id, pprForeignTask.id);

  return {
    users,
    objectA,
    objectB,
    roomA,
    roomB,
    leadOwnTask,
    engineerTask,
    oeScopeTask,
    foreignTask,
    pprTechTask,
    pprLeadTask,
    pprOeTask,
    pprForeignTask,
  };
}

async function checkLead(page, fx) {
  await login(page, fx.users.lead);
  await page.goto(`${BASE_URL}/my`);
  await expectText(page, fx.leadOwnTask.title);
  await expectNoText(page, fx.foreignTask.title);
  await expectTaskVisible(page, fx.leadOwnTask.id, fx.leadOwnTask.title);
  await expectTaskHidden(page, fx.foreignTask.id, fx.foreignTask.title);

  await page.goto(`${BASE_URL}/objects`);
  await expectHeading(page, "Объекты");
  await expectText(page, "+ Добавить объект");

  await page.goto(`${BASE_URL}/users`);
  await expectHeading(page, "Пользователи");
  await page.locator("tbody tr").filter({ hasText: fx.users.targetEngineer.fullName }).first().waitFor();
  await page.goto(`${BASE_URL}/users/create`);
  await expectOnlyOptions(page, 'select[name="role"]', ["admin", "chief", "lead", "engineer", "object_engineer", "tech"]);
  await page.selectOption('select[name="role"]', "engineer");
  await expectObjectLabel(page, fx.objectA.name);
  await expectObjectLabel(page, fx.objectB.name);

  await page.goto(`${BASE_URL}/ppr`);
  await expectHeading(page, "Модуль ППР");
  await expectText(page, "Все заявки");

  await page.goto(`${BASE_URL}/rounds`);
  await expectHeading(page, "Модуль Обходов");
  await expectText(page, "Сегодня");
  await expectText(page, "Архив");
  await expectText(page, "Конфигуратор");

  await logout(page);
}

async function checkEngineer(page, fx) {
  await login(page, fx.users.engineer);
  await page.goto(`${BASE_URL}/my`);
  await expectText(page, fx.engineerTask.title);
  await expectNoText(page, fx.foreignTask.title);
  await expectNoText(page, fx.leadOwnTask.title);
  await expectTaskVisible(page, fx.engineerTask.id, fx.engineerTask.title);
  await expectTaskHidden(page, fx.foreignTask.id, fx.foreignTask.title);

  await page.goto(`${BASE_URL}/tasks/${fx.engineerTask.id}`);
  await expectNoText(page, "В архив");

  await page.goto(`${BASE_URL}/users`);
  await page.locator("tbody tr").filter({ hasText: fx.users.targetTech.fullName }).first().waitFor();
  const techRow = page.locator("tbody tr").filter({ hasText: fx.users.targetTech.fullName }).first();
  const engineerRow = page.locator("tbody tr").filter({ hasText: fx.users.targetEngineer.fullName }).first();
  await techRow.getByRole("button", { name: "Изменить" }).click();
  await expectOnlyOptions(page, 'select[name="role"]', ["tech"]);
  await expectObjectLabel(page, fx.objectA.name);
  await expectNoObjectLabel(page, fx.objectB.name);
  await page.keyboard.press("Escape");
  if (await engineerRow.getByRole("button", { name: "Изменить" }).count()) {
    throw new Error("Engineer не должен видеть Edit для engineer target");
  }

  await page.goto(`${BASE_URL}/users/create`);
  await expectOnlyOptions(page, 'select[name="role"]', ["tech"]);
  await expectObjectLabel(page, fx.objectA.name);
  await expectNoObjectLabel(page, fx.objectB.name);

  await page.goto(`${BASE_URL}/rounds/config`);
  await expectText(page, "Конфигуратор обходов");
  await expectSelectContains(page, "select", [fx.objectA.name]);
  await expectSelectExcludes(page, "select", [fx.objectB.name]);

  await expectPprTaskVisible(page, fx.pprTechTask.id);
  await expectPprTaskHidden(page, fx.pprForeignTask.id);

  await page.goto(`${BASE_URL}/ppr/rooms`);
  await expectText(page, "Помещения объектов");
  await expectSelectContains(page, "select", [fx.objectA.name]);
  await expectSelectExcludes(page, "select", [fx.objectB.name]);

  await logout(page);
}

async function checkObjectEngineer(page, fx) {
  await login(page, fx.users.objectEngineer);
  await page.goto(`${BASE_URL}/my`);
  await expectText(page, fx.oeScopeTask.title);
  await expectText(page, fx.engineerTask.title);
  await expectNoText(page, fx.foreignTask.title);
  await expectTaskVisible(page, fx.oeScopeTask.id, fx.oeScopeTask.title);
  await expectTaskHidden(page, fx.foreignTask.id, fx.foreignTask.title);

  await page.goto(`${BASE_URL}/tasks/${fx.oeScopeTask.id}`);
  await expectNoText(page, "В архив");

  await page.goto(`${BASE_URL}/users`);
  const techRow = page.locator("tbody tr").filter({ hasText: fx.users.targetTech.fullName }).first();
  const engineerRow = page.locator("tbody tr").filter({ hasText: fx.users.targetEngineer.fullName }).first();
  const leadRow = page.locator("tbody tr").filter({ hasText: fx.users.targetLead.fullName }).first();
  const techEditCount = await techRow.locator("button").filter({ hasText: "Изменить" }).count();
  if (!techEditCount) {
    const rowText = await techRow.innerText().catch(() => "<row missing>");
    console.log(`DEBUG object_engineer tech row: ${rowText}`);
    throw new Error("Object engineer должен видеть Edit для tech");
  }
  await engineerRow.getByRole("button", { name: "Изменить" }).click();
  await expectOnlyOptions(page, 'select[name="role"]', ["engineer", "tech"]);
  await expectObjectLabel(page, fx.objectA.name);
  await expectNoObjectLabel(page, fx.objectB.name);
  await page.keyboard.press("Escape");
  if (await leadRow.getByRole("button", { name: "Изменить" }).count()) {
    throw new Error("Object engineer не должен видеть Edit для lead");
  }

  await page.goto(`${BASE_URL}/users/create`);
  await expectOnlyOptions(page, 'select[name="role"]', ["engineer", "tech"]);
  await page.selectOption('select[name="role"]', "engineer");
  await expectObjectLabel(page, fx.objectA.name);
  await expectNoObjectLabel(page, fx.objectB.name);

  await page.goto(`${BASE_URL}/rounds/config`);
  await expectSelectContains(page, "select", [fx.objectA.name]);
  await expectSelectExcludes(page, "select", [fx.objectB.name]);

  await expectPprTaskVisible(page, fx.pprOeTask.id);
  await expectPprTaskHidden(page, fx.pprForeignTask.id);

  await page.goto(`${BASE_URL}/ppr/rooms`);
  await expectSelectContains(page, "select", [fx.objectA.name]);
  await expectSelectExcludes(page, "select", [fx.objectB.name]);

  await logout(page);
}

async function checkTech(page, fx) {
  await login(page, fx.users.tech);
  await page.goto(`${BASE_URL}/my`);
  await expectText(page, fx.leadOwnTask.title);
  await expectNoText(page, fx.engineerTask.title);
  await expectTaskVisible(page, fx.leadOwnTask.id, fx.leadOwnTask.title);
  await expectTaskHidden(page, fx.engineerTask.id, fx.engineerTask.title);

  await page.goto(`${BASE_URL}/ppr`);
  await page.waitForURL(/\/ppr\/my(?:\?.*)?$/);
  await expectText(page, "Мои работы");
  await expectPprTaskVisible(page, fx.pprTechTask.id);
  await expectPprTaskHidden(page, fx.pprLeadTask.id);

  await page.goto(`${BASE_URL}/rounds`);
  await page.waitForURL(/\/rounds\/scan(?:\?.*)?$/);
  await expectNoHref(page, "/rounds/today");
  await expectNoHref(page, "/rounds/archive");
  await expectNoHref(page, "/rounds/config");

  await page.goto(`${BASE_URL}/rounds/today`);
  await page.waitForURL(/\/rounds\/scan(?:\?.*)?$/);
  await page.goto(`${BASE_URL}/rounds/archive`);
  await page.waitForURL(/\/rounds\/scan(?:\?.*)?$/);
  await page.goto(`${BASE_URL}/rounds/config`);
  await page.waitForURL(/\/rounds\/scan(?:\?.*)?$/);
  await page.goto(`${BASE_URL}/rounds/qr`);
  await page.waitForURL(/\/rounds\/scan(?:\?.*)?$/);

  await page.goto(`${BASE_URL}/users`);
  await expectText(page, "Доступ запрещен");
  await page.goto(`${BASE_URL}/objects`);
  await expectText(page, "Доступ запрещен");
  await page.goto(`${BASE_URL}/ppr/rooms`);
  await expectText(page, "справочнику помещений");

  await logout(page);
}

async function checkChiefAndAdmin(page, fx, user, roleLabel) {
  await login(page, user);
  await page.goto(`${BASE_URL}/objects`);
  await expectHeading(page, "Объекты");
  await expectText(page, "+ Добавить объект");

  await page.goto(`${BASE_URL}/users`);
  await expectHeading(page, "Пользователи");
  await expectText(page, "+ Добавить пользователя");

  await page.goto(`${BASE_URL}/ppr`);
  await expectHeading(page, "Модуль ППР");
  await expectLink(page, "Все заявки");
  await expectLink(page, "Календарь");

  await page.goto(`${BASE_URL}/rounds`);
  await expectHeading(page, "Модуль Обходов");
  await expectLink(page, "Сегодня");
  await expectLink(page, "Архив");
  await expectLink(page, "Конфигуратор");

  await page.goto(`${BASE_URL}/my`);
  await expectText(page, fx.foreignTask.title);
  await expectText(page, fx.engineerTask.title);

  await logout(page);
}

async function cleanup() {
  if (created.pprTaskIds.length) await service.from("ppr_tasks").delete().in("id", created.pprTaskIds);
  if (created.pprEquipmentIds.length) await service.from("ppr_equipment").delete().in("id", created.pprEquipmentIds);
  if (created.pprSystemIds.length) await service.from("ppr_systems").delete().in("id", created.pprSystemIds);
  if (created.taskIds.length) await service.from("tasks").delete().in("id", created.taskIds);
  if (created.roomIds.length) await service.from("object_rooms").delete().in("id", created.roomIds);
  if (created.objectIds.length) await service.from("objects").delete().in("id", created.objectIds);
  if (created.authUserIds.length) {
    await service.from("user_objects").delete().in("user_id", created.authUserIds);
    await service.from("profiles").delete().in("id", created.authUserIds);
    for (const userId of created.authUserIds) {
      await service.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  }
}

async function main() {
  const fx = await setupFixtures();
  const browser = await chromium.launch({ headless: true });

  try {
    await runCheck("lead browser walkthrough", async () => {
      const page = await browser.newPage();
      try {
        await checkLead(page, fx);
      } finally {
        await page.close();
      }
    });

    await runCheck("engineer browser walkthrough", async () => {
      const page = await browser.newPage();
      try {
        await checkEngineer(page, fx);
      } finally {
        await page.close();
      }
    });

    await runCheck("object_engineer browser walkthrough", async () => {
      const page = await browser.newPage();
      try {
        await checkObjectEngineer(page, fx);
      } finally {
        await page.close();
      }
    });

    await runCheck("tech browser walkthrough", async () => {
      const page = await browser.newPage();
      try {
        await checkTech(page, fx);
      } finally {
        await page.close();
      }
    });

    await runCheck("chief browser walkthrough", async () => {
      const page = await browser.newPage();
      try {
        await checkChiefAndAdmin(page, fx, fx.users.chief, "chief");
      } finally {
        await page.close();
      }
    });

    await runCheck("admin browser walkthrough", async () => {
      const page = await browser.newPage();
      try {
        await checkChiefAndAdmin(page, fx, fx.users.admin, "admin");
      } finally {
        await page.close();
      }
    });
  } finally {
    await browser.close();
  }

  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok).length;
  console.log(`SUMMARY passed=${passed} failed=${failed}`);
  if (failed) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
