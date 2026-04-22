# Архитектура проекта

> Документ описывает фактическую архитектуру репозитория. Если код и документ расходятся — источником истины считается код.

## 1. Общая картина

Одно `Next.js 15` приложение с `App Router`, несколько прикладных контуров:

1. Эксплуатационные задачи + ежедневные чек-листы
2. Модуль ППР (плановое техническое обслуживание)
3. Модуль обходов помещений
4. Склад и заявки на закупку
5. Shared-слой: объекты, помещения, роли, auth, audit, storage, PWA/offline

## 2. Слои приложения

### UI-слой (`components/`, `app/`)

Страницы серверные по умолчанию. Клиентские компоненты — только там, где нужен браузерный API, локальное состояние, offline или scanner/photo flow.

```
components/
  tasks/          — списки, карточки, offline-aware task UI
  checklists/     — чек-лист, контроль, шаблоны
  warehouse/      — ТМЦ, места хранения, движения
  purchase-requests/ — заявки на закупку
  ppr/            — dashboard, структура, calendar, task details
  rounds/         — scanner, today/config/archive/qr
  dashboard/      — sidebar (MainNav), mobile (MobileTabs), nav-shell
  pwa/            — RegisterSW, push opt-in
  offline/        — OfflineSyncBootstrap
  ui/             — примитивы
```

### Transport/orchestration-слой (`app/`)

```
app/
  (dashboard)/    — авторизованный shell
    layout.tsx    — RegisterSW, OfflineSyncBootstrap, NavShell, MobileTabs
    my/, new/, archive/, tasks/
    checklists/
    warehouse/items/, warehouse/locations/, warehouse/scan/
    purchase-requests/
    ppr/          — system-groups, systems, equipment, templates, calendar,
                    tasks, my, archive, rooms, assignments
    rounds/       — scan, entry, today, archive, config, qr
    users/, objects/, directories/, profile/, audit/
  api/
    tasks/        — CRUD задач
    checklists/   — runs, items, today
    warehouse/locations/ — QR, CRUD
    purchase-requests/cron/daily — авто-заявки на пополнение
    ppr/          — tasks, attachments, comments, calendar, cron, qr
    rounds/       — checkins, resolve, config
    push/         — subscribe, unsubscribe
    cron/archive  — автоархив задач
  login/
  page.tsx        — redirect: procurement_manager → /purchase-requests, остальные → /my
```

Три механизма записи:
- **API routes** — интерактивные сценарии (PPR lifecycle, Rounds scanner, offline sync)
- **Server actions** — формы с revalidate, справочники, admin-операции
- На практике оба механизма используются в разных частях одного модуля

### Доменный слой (`lib/`)

```
lib/
  auth.ts                    — getRequestSession(), requireProfile()
  api-auth.ts                — getApiSession() для API routes
  capabilities.ts            — публичный API capability-проверок
  types.ts                   — Role, TaskStatus, StockItem, PurchaseRequest и т.д.
  object-access.ts           — единый shared object-scope access layer
  relation-normalization.ts  — нормализация relation payloads из Supabase
  audit.ts                   — запись в audit_log
  push.ts                    — отправка web-push уведомлений
  attachments.ts             — работа с приватными bucket-файлами

  access/
    matrix.ts                — все ролевые константы и функции-предикаты
    users.ts                 — управление пользователями
    tasks.ts                 — скоуп задач
    object-scope.ts          — listScopedObjectsForProfile()
    task-target-scope.ts

  tasks.ts                   — query/mutation задач
  task-create.ts             — создание задачи
  task-permissions.ts        — permission-checks задач
  task-sort.ts, task-presentation.ts

  daily-checklists/
    access.ts                — canAccessDailyChecklists, canManageTemplates, canReadControl
    queries.ts               — шаблоны, runs, today-данные, pending count
    scheduler.ts             — filterTemplateItemsForDate, normalizeOperationalDate
    files.ts                 — signed URLs для вложений

  warehouse/
    queries.ts               — ТМЦ, места хранения, движения, QR
    validators.ts            — Zod-схемы (stockItemFormSchema, movementSchema)
    presentation.ts          — форматирование отображения
    qr.ts                    — resolveWarehouseQrTokenForProfile()

  purchase-requests/
    queries.ts               — заявки, позиции, корзина
    validators.ts            — Zod-схемы
    presentation.ts

  ppr/
    access.ts                — canAccessPprStructureScreens и т.д. + listPprManageableObjects
    permissions.ts           — canManagePprStructure, canExecutePprTask и т.д.
    queries.ts               — barrel export поверх submodules
    structure-queries.ts
    calendar-queries.ts
    task-queries.ts
    task-read-models.ts
    task-lifecycle.ts
    scheduler.ts             — генерация и материализация планов
    types.ts, validators.ts, presentation.ts, qr.ts, files.ts

  rounds/
    permissions.ts           — canAccessRoundsModule, canReadRoundsReports, canManageRoundsConfig
    queries.ts
    date.ts, token.ts, qr.ts, client-photo.ts, files.ts, types.ts, constants.ts

  offline/
    queue.ts                 — task offline queue
    rounds-queue.ts          — rounds offline queue
    sync-coordinator.ts      — единый coordinator, запрет параллельного flush

  object-rooms.ts, floors.ts, room-types.ts
  object-room-qr.ts, object-room-import.ts

  supabase/
    server.ts                — SSR client (createSupabaseServerClient)
    browser.ts               — client-side client (createSupabaseBrowserClient)
    admin.ts                 — service role client (createSupabaseAdminClient)
```

### Данные (`supabase/`)

- **Auth** — сессии
- **Postgres + RLS** — доменная модель (44 миграции)
- **Storage buckets** — `task-attachments`, `ppr-files`, `rounds-files`
- **RPC** — pause/archive задач, materialization ППР, rounds scanner/config logic

---

## 3. Роли и матрица доступа

Все константы — в `lib/access/matrix.ts`. Публичный API — в `lib/capabilities.ts`.

**7 ролей**: `admin`, `chief`, `lead`, `engineer`, `object_engineer`, `tech`, `procurement_manager`.

Скоуп объектов (функция `getObjectScopeSource(role)`):

| Роль | Источник |
|------|----------|
| `admin`, `chief`, `lead` | `"global"` |
| `engineer`, `tech` | `"user_objects"` |
| `object_engineer` | `"object_engineer_objects"` |
| `procurement_manager` | `"none"` |

`procurement_manager` — особый случай: нет доступа к задачам, ППР, обходам, чек-листам. Только заявки на закупку.

Управление пользователями (`listManageableUserRoles`):
- `admin`/`chief`/`lead` → все 7 ролей
- `engineer` → только `tech`
- `object_engineer` → `engineer`, `tech`
- остальные → ничего

---

## 4. Ключевые сквозные процессы

### 4.1 Room QR → card / rounds scanner

1. Помещение создаётся в `object_rooms`.
2. Автоматически появляется активный QR в `object_room_qr_codes`.
3. `/ppr/rooms/qr/[token]` → резолв → `/ppr/rooms/[id]`.
4. Тот же токен используется в Rounds scanner.
5. Scanner проверяет: `enabled / disabled / inactive / stale_config / invalid`.

### 4.2 Rounds scan → confirm → sync

1. Открытие `/rounds/scan` или deep-link `/rounds/entry/[token]`.
2. `RoundsEntryForm` ищет помещение в локальном snapshot.
3. Fallback: `/api/rounds/resolve/[token]`.
4. Submit: `/api/rounds/checkins` или offline queue.
5. `runOfflineSync()` — отложенная отправка при восстановлении.

### 4.3 PPR calendar → month plan → materialization

1. `/ppr/calendar` читает systems, year overview, month plans.
2. Месячный план генерируется через `generatePprMonthPlanAction`.
3. Materialization, carryover, синхронизация статусов — через scheduler/cron.

### 4.4 PPR task details → comments → attachments

1. Страница читает task, work items, comments и attachment read model — server-side.
2. Комментарии: `/api/ppr/tasks/[id]/comments`.
3. Attachments: `/api/ppr/tasks/[id]/attachments`.

### 4.5 Склад → авто-заявка на закупку

1. Ежедневный cron `/api/purchase-requests/cron/daily`.
2. Находит ТМЦ с `current_qty < min_qty`.
3. Создаёт заявку с `source = "warehouse_daily"`.
4. При переводе заявки в `fulfilled` → автоматический приход на склад.

### 4.6 ТМЦ ↔ шаблон ППР

1. `stock_item_ppr_templates` связывает ТМЦ с `ppr_work_templates`.
2. При генерации ППР-заявки за месяц включается расчёт потребности в ТМЦ.
3. Создаётся заявка с `source = "ppr"` и `ppr_plan_month`.

---

## 5. Навигация

### Desktop (MainNav)

Секции: **Задачи**, **Склад**, **ППР**, **Обходы**, **Справочники**, **Сервис**.

- Клик по заголовку секции с `href` → переход + раскрытие.
- Клик по заголовку без `href` → только раскрытие/схлопывание.
- `tech` входит в ППР через `/ppr/my`, в Обходы через `/rounds/scan`.
- `procurement_manager` видит только секцию Склад (пункт «Заявки»).

### Mobile (MobileTabs)

Нижняя панель адаптируется к активному разделу:

- **Основной**: горизонтальный лончер модулей (Задачи/Закупки/Чек-лист/ППР/Обходы по ролям) + таб «Сервис».
- **Режим /checklists**: Мой день / Контроль / Шаблоны (по ролям).
- **Режим /ppr**: модульные вкладки ППР.
- **Режим /rounds**: Сканер / Сегодня / Архив / Конфигуратор / QR.

---

## 6. Offline, PWA и push

### Service worker (`public/sw.js`)

Три cache bucket: `shell`, `static`, `data`.

Shell-маршруты: `/my`, `/rounds`, `/rounds/scan`. Сохраняется только при:
- `response.ok && !response.redirected`
- `content-type: text/html`
- `finalUrl === expectedRoute`

Это исключает кэширование login-redirect под ключом `/my`.

Для offline navigation: точный cached shell или безопасный fallback на `/my` (без подмены HTML).

Критичные data-пути → `503 SW_OFFLINE` (не stale).

### Push

`RegisterSW` только регистрирует SW. Opt-in — только явным действием из `/profile`. Работает только для task-контура.

### Offline sync

Покрыты: задачи (`update_status`, `add_comment`) и обходы (`rounds_checkin` с фото).

`sync-coordinator.ts`:
- запрет параллельного flush;
- запуск при mount, `online`, `focus`, `visibilitychange`;
- поддержка повторного запуска после in-flight цикла.

---

## 7. База данных

44 миграции: `0001_init` → `0044_stock_item_ppr_templates`.

| Диапазон | Тема |
|----------|------|
| 0001–0009 | Базовые задачи, роли, вложения |
| 0010–0020 | Структура ППР, оборудование, шаблоны, календарь, RLS |
| 0021–0028 | Общий справочник помещений, модуль обходов, room QR |
| 0029–0036 | Матрица доступа, ППР lifecycle, шаблоны систем |
| 0037 | Модуль ежедневных чек-листов |
| 0038–0043 | Склад, заявки на закупку, procurement_manager |
| 0044 | Связь ТМЦ с шаблонами ППР |

Все таблицы: UUID PK, RLS-политики, `timestamptz`.

---

## 8. Практические правила для изменений

- Изменение прав — проверить в 4 местах: UI guard, page/action entry point, query layer, RLS.
- Новые capability-проверки — добавлять через `lib/access/matrix.ts` + `lib/capabilities.ts`.
- Interactive/offline сценарии → API routes; submit форм с revalidate → server actions.
- Изменения в ППР → проверить scheduler, task-lifecycle, month plan, barrel `queries.ts`.
- Изменения в Rounds → проверить config, scanner, today/archive, room QR и offline queue.
- Изменения в Складе → проверить связи с ППР-шаблонами и авто-заявки.
- Изменение скоупа объектов → обновить `getObjectScopeSource()` и RLS-политики.

---

## 9. Ограничения

- `middleware.ts` защищает не все пути (`/ppr/*`, `/rounds/*`, `/checklists/*`, `/warehouse/*` без matcher); защита — server-side guards + RLS.
- Offline не покрывает ППР, склад, чек-листы и административные операции.
- Push только для task-контура.
- PWA не является fully-offline: большинство экранов требуют сеть.
- Импорт помещений — только `create only`, без обновления существующих.
- `object_rooms` содержит legacy-поле `floor` для обратной совместимости.
