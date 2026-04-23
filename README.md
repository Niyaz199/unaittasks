# Задачник эксплуатации

## 1. О проекте

`Задачник эксплуатации` — приложение на `Next.js 15` и `Supabase` для управления эксплуатацией объектов. Включает несколько связанных прикладных контуров:

- обычные эксплуатационные задачи и ежедневные чек-листы;
- модуль ППР (плановое техническое обслуживание);
- модуль обходов помещений;
- модуль склада и заявок на закупку.

Все контуры работают внутри общего dashboard-shell и переиспользуют единые роли, объекты, помещения, audit, auth, storage и PWA/offline-инфраструктуру.

---

## 2. Модули

### Задачи (`/my`, `/new`, `/archive`, `/tasks/[id]`)

- статусы `new → accepted → in_progress → paused → done`;
- назначение ответственного и управление командой;
- фильтры, сортировка и группировка;
- комментарии и история;
- фото-вложения к задаче и к комментариям;
- ручной архив для `admin`/`chief`;
- автоархив завершённых задач через cron/RPC;
- push-уведомления при назначении.

Вложения хранятся в приватном bucket `task-attachments`, читаются через signed URL.

### Ежедневные чек-листы (`/checklists`)

- персональные шаблоны для ролей `lead`, `engineer`, `object_engineer`;
- поддержка расписания: `daily`, `weekday`, `month_days`, `month_range`;
- ежедневный запуск по расписанию: `today`, `overdue`, `problems`;
- фото-вложения к пунктам чек-листа;
- эскалация проблемных пунктов в задачи;
- контроль выполнения для `admin`/`chief`/`lead` — `/checklists/control`;
- управление шаблонами для `admin`/`chief` — `/checklists/templates`;
- badge с количеством незавершённых пунктов в навигации.

### Склад (`/warehouse/items`, `/warehouse/locations`)

- каталог ТМЦ с атрибутами: вид (`zip`/`component`), единица, артикул, мин. остаток;
- места хранения с привязкой к объекту, системе и помещению;
- движения: приход, расход, корректировка;
- QR-коды для мест хранения + scan-flow `/warehouse/scan/[token]`;
- привязка ТМЦ к группам систем ППР и шаблонам ППР;
- автогенерация заявок на пополнение при падении ниже мин. остатка.

### Заявки на закупку (`/purchase-requests`)

- источники: ручная заявка, авто от склада (`warehouse_daily`), от ППР (`ppr`);
- жизненный цикл: `new → in_progress → fulfilled / cancelled`;
- типы: черновик (`draft`) и финальная (`final`);
- разграничение позиций по ролям-исполнителям: `engineer` и `procurement_manager`;
- корзина (`in_cart`): `procurement_manager` маркирует позиции для обработки;
- автоматический приход на склад при переводе заявки в `fulfilled`;
- роль `procurement_manager` видит только заявки, без доступа к задачам и остальным модулям.

### ППР (`/ppr`)

Структура:

- группы систем ППР — `/ppr/system-groups`;
- системы — `/ppr/systems`;
- оборудование — `/ppr/equipment`, `/ppr/equipment/[id]`;
- шаблоны работ — `/ppr/templates`, `/ppr/templates/[id]`;
- помещения (shared) — `/ppr/rooms`, `/ppr/rooms/[id]`.

Планирование:

- годовой и месячный календарь — `/ppr/calendar`;
- генерация месячного плана по системе;
- переносы внутри месяца;
- материализация позиций плана в ППР-заявки;
- cron-оркестрация через `/api/ppr/cron/run`.

ППР-заявки:

- список — `/ppr/tasks`, мои работы — `/ppr/my`, архив — `/ppr/archive`;
- карточка — `/ppr/tasks/[id]`;
- lifecycle: `new → in_progress → done → closed`, отмена в `cancelled`;
- завершение (`done`) требует минимум один комментарий (фото — опционально);
- назначения исполнителей — `/ppr/assignments`.

QR-entry:

- `/ppr/qr/[token]` — вход по QR на оборудование или активную заявку;
- `/ppr/rooms/qr/[token]` — вход по QR помещения.

### Обходы (`/rounds`)

- scanner flow: `/rounds/scan`, deep-link `/rounds/entry/[token]`;
- сегодняшние отметки: `/rounds/today`;
- архив обходов: `/rounds/archive`;
- конфигуратор (включить/выключить помещения): `/rounds/config`;
- печать QR: `/rounds/qr`;
- offline-поддержка: check-in с фото уходит в IndexedDB-очередь и синхронизируется при восстановлении связи;
- повторный check-in за день заменяет предыдущий только если `incoming.scanned_at_device >= existing.scanned_at_device`.

### Помещения (shared, `/ppr/rooms`)

- общий справочник `object_rooms` для всех модулей;
- флаг `rounds_enabled` управляет участием в обходах;
- автосоздание room QR при создании помещения;
- импорт из `CSV` / `XLSX` с preview; режим `create only`, без обновления существующих.

### Справочники

- пользователи — `/users`;
- объекты — `/objects`;
- этажи — `/directories/floors`;
- типы помещений — `/directories/room-types`.

---

## 3. Роли и права доступа

Система поддерживает **7 ролей**:

| Роль | Описание |
|------|----------|
| `admin` | Суперпользователь, полный доступ ко всем модулям и операциям |
| `chief` | Полный рабочий доступ, без системных операций (`isSuperuser`) |
| `lead` | Руководитель направления, управляет командой и структурой |
| `engineer` | Инженер, работает с задачами и ППР в своих объектах |
| `object_engineer` | Инженер объекта, ограниченный скоупом своих объектов |
| `tech` | Техник, доступ только к исполнению задач и ППР-заявок |
| `procurement_manager` | Менеджер закупок, работает только с заявками на закупку |

Скоуп объектов:

| Роль | Скоуп |
|------|-------|
| `admin`, `chief`, `lead` | глобальный (все объекты) |
| `engineer`, `tech` | `user_objects` (привязанные объекты) |
| `object_engineer` | `object_engineer_objects` |
| `procurement_manager` | нет доступа к объектам |

### Задачи

| Роль | Создание | Команда | Удаление | Архив |
|------|----------|---------|----------|-------|
| `admin` | ✓ | ✓ | ✓ | ✓ |
| `chief` | ✓ | ✓ | ✓ | ✓ |
| `lead` | ✓ | ✓ | ✓ | — |
| `engineer` | ✓ | ✓ | — | — |
| `object_engineer` | ✓ | ✓ | — | — |
| `tech` | — | — | — | — |
| `procurement_manager` | — | — | — | — |

Матрица назначения: `admin`/`chief`/`lead`/`engineer`/`object_engineer` могут назначать на `lead`, `engineer`, `object_engineer`, `tech`.

### Ежедневные чек-листы

| Роль | Свой чек-лист | Контроль | Шаблоны |
|------|--------------|----------|---------|
| `admin` | — | ✓ | ✓ |
| `chief` | — | ✓ | ✓ |
| `lead` | ✓ | ✓ | — |
| `engineer` | ✓ | — | — |
| `object_engineer` | ✓ | — | — |
| `tech`, `procurement_manager` | — | — | — |

### Склад

| Роль | Просмотр | Управление каталогом |
|------|----------|---------------------|
| `admin`, `chief`, `lead`, `engineer`, `object_engineer` | ✓ | ✓ |
| `tech` | ✓ | — |
| `procurement_manager` | — | — |

### Заявки на закупку

| Роль | Доступ | Создание | Управление |
|------|--------|----------|-----------|
| `admin`, `chief`, `lead` | ✓ | ✓ | ✓ |
| `engineer`, `object_engineer` | ✓ | ✓ | `object_engineer` ✓ |
| `tech` | ✓ | ✓ | — |
| `procurement_manager` | ✓ | — | ✓ |

### ППР

| Роль | Структура | Группы систем | Шаблоны | Календарь | Заявки | QR |
|------|-----------|--------------|---------|-----------|--------|----|
| `admin`, `chief` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `lead` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `engineer`, `object_engineer` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `tech` | — | — | — | — | только свои | ✓ |
| `procurement_manager` | — | — | — | — | — | — |

### Обходы

| Роль | Сканер | Сегодня/Архив | Конфигуратор/QR |
|------|--------|--------------|----------------|
| `admin`, `chief`, `lead`, `engineer`, `object_engineer` | ✓ | ✓ | ✓ |
| `tech` | ✓ | — | — |
| `procurement_manager` | — | — | — |

### Справочники

| Роль | Пользователи | Объекты | Этажи | Типы помещений | Помещения |
|------|-------------|---------|-------|----------------|-----------|
| `admin` | ✓ | ✓ | ✓ | ✓ (управление) | ✓ |
| `chief` | ✓ | ✓ | ✓ | ✓ (управление) | ✓ |
| `lead` | ✓ | ✓ | ✓ | чтение | ✓ |
| `engineer` | ✓ | — | — | — | ✓ |
| `object_engineer` | ✓ | — | ✓ | чтение | ✓ |
| `tech` | — | — | — | — | — |
| `procurement_manager` | — | — | — | — | — |

### Журнал и профиль

- Журнал (`/audit`): `admin`, `chief`.
- Профиль (`/profile`): все роли.

---

## 4. Навигация

### Desktop (sidebar)

Навигация секционирована. Секция открывается кликом по заголовку (переход + раскрытие).

**Задачи** — `!procurement_manager`
- Мои задачи
- Мой чек-лист *(badge: незавершённые)* — `lead`, `engineer`, `object_engineer`
- Контроль чек-листов — `admin`, `chief`, `lead`
- Шаблоны чек-листов — `admin`, `chief`
- Новые
- Архив

**Склад** — `admin`, `chief`, `lead`, `engineer`, `object_engineer`, `tech`, `procurement_manager` (кто имеет доступ хотя бы к одному подпункту)
- ТМЦ — все кроме `procurement_manager`
- Места хранения — все кроме `procurement_manager`
- Заявки на закупку — все роли

**ППР** — все кроме `procurement_manager`
- Группы систем ППР — `admin`, `chief`, `lead`
- Системы — все кроме `tech`, `procurement_manager`
- Оборудование — все кроме `tech`, `procurement_manager`
- Шаблоны — все кроме `tech`, `procurement_manager`
- Календарь — все кроме `tech`, `procurement_manager`
- Все заявки — все кроме `tech`, `procurement_manager`
- Мои работы — все кроме `procurement_manager`
- Архив работ — все кроме `tech`, `procurement_manager`

**Обходы** — все кроме `procurement_manager`
- Сканер — всегда
- Сегодня — все кроме `tech`
- Архив — все кроме `tech`
- Конфигуратор — все кроме `tech`
- QR помещений — все кроме `tech`

**Справочники** — все, кто имеет доступ хотя бы к одному разделу
- Пользователи, Объекты, Этажи, Типы помещений, Помещения

**Сервис** — все роли
- Профиль
- Журнал — `admin`, `chief`

Точка входа: `procurement_manager` → `/purchase-requests`, остальные → `/my`.

### Mobile (нижняя панель)

Нижняя панель адаптируется к активному модулю:

- **Основной режим**: иконки активных модулей + «Сервис»/«Профиль».
  - Лончер модулей (горизонтальный скролл): Задачи, Закупки, Чек-лист, ППР, Обходы — по ролям.
- **Режим чек-листов**: Мой день, Контроль, Шаблоны — по ролям.
- **Режим ППР**: Мои, Все, Архив + кнопки структуры.
- **Режим обходов**: Сканер, Сегодня, Архив, Конфигуратор, QR.

---

## 5. Архитектура

Проект — `Next.js 15` с `App Router`:

```
app/           — страницы, API routes, server actions
components/    — UI компоненты
lib/           — бизнес-логика, query/permission слой
supabase/      — 44 SQL-миграции, seed
public/        — manifest, service worker
```

Три клиента Supabase:
- `lib/supabase/server.ts` — SSR и server actions
- `lib/supabase/browser.ts` — клиентские компоненты
- `lib/supabase/admin.ts` — service role для системных операций

Ключевые shared-слои:
- `lib/auth.ts` — `getRequestSession()`, `requireProfile()`
- `lib/object-access.ts` — единый object-scope access layer
- `lib/relation-normalization.ts` — нормализация relation payloads
- `lib/access/matrix.ts` — матрица всех ролевых прав
- `lib/capabilities.ts` — публичный API capability-проверок
- `lib/offline/sync-coordinator.ts` — координатор offline sync

---

## 6. Offline, PWA и mobile

### Service worker (`public/sw.js`)

Раздельные cache buckets: `shell`, `static`, `data`. Shell-маршруты: `/my`, `/rounds`, `/rounds/scan`.

Условия сохранения shell: `response.ok`, без `redirected`, `content-type: text/html`, final URL совпадает с маршрутом. Это защищает от кэширования login-page под ключом `/my`.

Критичные data-пути возвращают `503 SW_OFFLINE` вместо stale-данных.

### Push-уведомления

Явный opt-in из `/profile` → `PushOptInCard` → `Notification.requestPermission()` → `/api/push/subscribe`. Работают только в task-контуре.

### Offline sync

Покрытие:
- `update_status`, `add_comment` — обычные задачи;
- `rounds_checkin` с фото — обходы.

`runOfflineSync()` не допускает параллельный flush. Запускается при mount, `online`, `focus`, `visibilitychange`.

---

## 7. База данных

44 миграции, `0001`–`0044`. Последняя: `0044_stock_item_ppr_templates`.

Ключевые группы таблиц:

| Группа | Таблицы |
|--------|---------|
| Core | `profiles`, `objects`, `user_objects` |
| Справочники | `floors`, `room_types`, `object_rooms`, `object_room_qr_codes` |
| Задачи | `tasks`, `task_comments`, `task_team_members`, `task_attachments` |
| Чек-листы | `daily_checklist_templates`, `daily_checklist_template_items`, `daily_checklist_runs`, `daily_checklist_item_runs`, `daily_checklist_attachments` |
| ППР | `ppr_system_groups`, `ppr_systems`, `ppr_subsystems`, `ppr_rooms`, `ppr_equipment`, `ppr_equipment_components`, `ppr_equipment_work_assignments`, `ppr_work_templates`, `ppr_work_checklist_items`, `ppr_work_template_attachments`, `ppr_tasks`, `ppr_task_comments`, `ppr_task_work_items`, `ppr_task_attachments`, `ppr_month_plans`, `ppr_month_plan_items` |
| Обходы | `rounds_checkins` |
| Склад | `stock_items`, `stock_locations`, `stock_movements`, `stock_balances`, `stock_item_ppr_templates` |
| Заявки | `purchase_requests`, `purchase_request_items` |
| Инфраструктура | `audit_log`, `push_subscriptions` |

Все таблицы: UUID PK, `timestamptz` для временных меток, RLS-политики.

---

## 8. Cron-задачи

| Endpoint | Расписание | Назначение |
|----------|-----------|-----------|
| `/api/cron/archive` | 02:05 МСК | Автоархив завершённых задач |
| `/api/ppr/cron/monthly` | 00:05, 1-е число | Генерация месячного плана ППР |
| `/api/ppr/cron/run` | 00:20 ежедневно | Просроченные позиции, материализация, синхронизация статусов |
| `/api/purchase-requests/cron/daily` | ежедневно | Авто-генерация заявок на пополнение склада |

Авторизация cron-маршрутов: заголовок `x-cron-secret`.

---

## 9. Тестирование

Минимальный Playwright smoke/e2e baseline:

- auth redirect и UI login;
- Rounds config save/read;
- room QR resolve и scanner confirm flow;
- PPR task details с комментариями;
- PPR calendar month route;
- optional/manual smoke на month generation.

```bash
npm run test:e2e:install
npm run test:e2e
npm run test:e2e:headed
```

Переменные окружения для smoke: `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_ROUNDS_OBJECT_NAME`, `E2E_ROUNDS_ROOM_NAME`, `E2E_ROUNDS_TOKEN`, `E2E_PPR_TASK_ID`, `E2E_PPR_CALENDAR_SYSTEM_NAME`.

---

## 10. Запуск проекта

### Локально

```bash
npm install
copy .env.example .env
npm run dev
```

### Переменные окружения

Обязательные:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Опциональные (push-уведомления):
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`

### База данных

```bash
supabase db push
```

При ручном применении через SQL Editor — строго по порядку (`0001` → `0044`).

### Docker

```bash
docker compose up --build
```

---

## 11. Технологии

- `Next.js 15` + `React 19` + `TypeScript 5.7`
- `Supabase` (`Auth`, `Postgres`, `RLS`, `Storage`, `RPC`)
- `Zod` — валидация
- `localforage` — IndexedDB offline queue
- `web-push` — push-уведомления
- `qrcode.react`, `jsqr` — генерация и чтение QR
- `csv-parse`, `xlsx` — импорт данных
- `Playwright` — E2E тесты
- `Docker` + `Caddy`

---

## 12. Ограничения

- PWA не является fully-offline: большинство страниц ориентированы на сеть. Shell-маршруты: `/my`, `/rounds`, `/rounds/scan`.
- Offline sync покрывает только задачи и обходы; ППР, склад и чек-листы — только online.
- Push работает только в task-контуре; отдельных push-контуров для ППР, обходов и чек-листов нет.
- `middleware.ts` не включает `/ppr/*`, `/rounds/*`, `/checklists/*`, `/warehouse/*` в `matcher`; защита обеспечивается server-side guards и RLS.
- Импорт помещений работает только в режиме `create only`; обновление существующих — не поддерживается.
