# Архитектура проекта

> Документ описывает фактическую архитектуру репозитория на текущем этапе и согласован с `README.md`. Если поведение в коде и в этом файле расходится, источником истины считается код.

## 1. Общая картина

Проект состоит из двух прикладных контуров:

- классический контур эксплуатационных задач;
- контур ППР с отдельной структурой объектов, планированием и lifecycle ППР-заявок.

Технически это одно приложение на `Next.js 15` с `App Router`, где:

- страницы и серверные компоненты живут в `app/`;
- интерактивный UI вынесен в `components/`;
- бизнес-правила и запросы к данным сосредоточены в `lib/`;
- `route handlers` и `server actions` параллельно используются как два механизма записи;
- источником данных выступает `Supabase` (`Auth`, `Postgres`, `RLS`, `Storage`);
- на клиенте есть `PWA`-обвязка и частичная offline-очередь.

Важно: проект уже не является “только задачником”. ППР-модуль сопоставим по размеру с основным контуром задач и имеет собственные страницы, API routes, server actions, доменную модель, миграции и сквозные процессы.

## 2. Архитектура по слоям

### 2.1 UI-слой

UI строится вокруг server-first подхода:

- страницы в `app/` по умолчанию серверные;
- клиентские компоненты используются только там, где нужен браузерный API, локальное состояние, drag-and-drop или offline-логика;
- единый dashboard-shell собирается в `app/(dashboard)/layout.tsx`.

Основные UI-пакеты:

- `components/tasks/*` — обычные задачи;
- `components/ppr/*` — ППР;
- `components/dashboard/*` — навигация и shell;
- `components/ui/*` — примитивы;
- `components/pwa/*` и `components/offline/*` — инфраструктурные клиентские компоненты.

### 2.2 Маршруты и orchestration-слой

`app/` совмещает три разных механизма:

- страницы и layouts;
- `app/api/*` для JSON/FormData API;
- `app/actions/*` для `server actions`.

Это означает, что orchestration-логика в проекте частично дублируется:

- классические задачи имеют и `server actions`, и `API routes` для похожих операций;
- ППР-структура и админские сценарии в основном опираются на `server actions`;
- ППР lifecycle в основном вынесен в `API routes`, но часть операций остаётся в `server actions`, например закрытие ППР-заявки и генерация календарного плана.

### 2.3 Доменный слой

Бизнес-логика в `lib/` разделена по доменам:

- `lib/tasks.ts`, `lib/task-permissions.ts`, `lib/task-sort.ts`, `lib/task-presentation.ts` — обычные задачи;
- `lib/ppr/*` — ППР-домен;
- `lib/auth.ts`, `lib/api-auth.ts` — аутентификация и роль/профиль;
- `lib/attachments.ts`, `lib/ppr/files.ts` — storage и signed URLs;
- `lib/offline/queue.ts` — offline queue;
- `lib/audit.ts`, `lib/push.ts` — сквозная инфраструктура.

Доменные модули используются и страницами, и API, и server actions, но не всегда одинаково глубоко: часть правил лежит в `lib/*`, а часть повторяется на уровне handlers.

### 2.4 Данные и интеграции

Хранилище построено на Supabase:

- `Auth` — сессии и пользователи;
- `profiles` — прикладной профиль пользователя и роль;
- `Postgres + RLS` — основная доменная модель;
- `Storage` — файлы обычных задач и ППР;
- `RPC` — pause/archive/PPR cron-операции.

Приложение использует три клиента Supabase:

- `lib/supabase/server.ts` — SSR и server actions;
- `lib/supabase/browser.ts` — клиентский доступ, когда он нужен;
- `lib/supabase/admin.ts` — service role для системных операций.

## 3. Назначение основных директорий

### `app/`

Содержит:

- `layout.tsx` — корневой layout с `RegisterSW`;
- `(dashboard)/layout.tsx` — авторизованный shell, `OfflineSyncBootstrap`, боковое меню и мобильные табы;
- страницы классического контура задач;
- страницы ППР под `/ppr`;
- `app/api/*` — API routes;
- `app/actions/*` — server actions.

Ключевая деталь: `OfflineSyncBootstrap` находится не в корневом layout, а в dashboard layout. Offline-синк работает только в авторизованном контуре приложения.

### `components/`

Слой UI-компонентов.

- `tasks/` — формы, карточки, списки, фильтры, offline-aware status/comment UI;
- `ppr/` — dashboard, каталоги, календарь, QR, карточки ППР-заявок;
- `dashboard/` — навигация;
- `ui/` — базовые примитивы;
- `pwa/` — регистрация service worker и push-подписки;
- `offline/` — bootstrap синка очереди.

### `lib/`

Главный слой прикладной логики.

- `auth.ts` — получение профиля, role guards, базовые capability-функции;
- `api-auth.ts` — унифицированное получение `{ user, profile, supabase }` для API routes;
- `tasks.ts` — списки и чтение задач;
- `task-permissions.ts` — матрица доступа и допустимых переходов по обычным задачам;
- `ppr/queries.ts` — основной query-layer ППР;
- `ppr/permissions.ts` — права доступа по слоям ППР;
- `ppr/task-lifecycle.ts` — lifecycle ППР-заявок;
- `ppr/scheduler.ts` — генерация и cron-оркестрация планирования;
- `offline/queue.ts` — IndexedDB/localforage очередь.

### `supabase/`

Содержит SQL-миграции и seed.

Важно: фактический набор миграций уже включает не только базовые задачи, но и большой пакет миграций ППР вплоть до `0020_ppr_cleanup_legacy_structure.sql`.

### `public/`

PWA-ассеты:

- `manifest.webmanifest`;
- `sw.js`;
- `icon.svg`.

### `docs/`

Текущие проектные документы. `README.md` даёт общий обзор, а этот файл фиксирует более прикладную архитектурную модель.

## 4. Реально используемые контуры

### Контур 1. Обычные задачи

Главные страницы:

- `/my`
- `/new`
- `/archive`
- `/tasks/create`
- `/tasks/[id]`

Данные и права обслуживаются через `lib/tasks.ts` и `lib/task-permissions.ts`.

### Контур 2. ППР

Главные подмодули:

- структура: `/ppr/system-groups`, `/ppr/systems`, `/ppr/rooms`, `/ppr/equipment`;
- планирование: `/ppr/templates`, `/ppr/assignments`, `/ppr/calendar`;
- исполнение: `/ppr/tasks`, `/ppr/my`, `/ppr/archive`, `/ppr/tasks/[id]`;
- QR-entry: `/ppr/qr/[token]`.

Этот контур использует свой доменный пакет `lib/ppr/*`, свои API routes и собственную модель таблиц/миграций.

### Контур 3. Справочники и администрирование

- `/users`
- `/objects`
- `/audit`
- `/profile`

Это не отдельный домен, а обслуживающий контур вокруг двух основных модулей.

## 5. Где есть дублирование логики

### Обычные задачи

Для обычных задач существует двойной путь записи:

- `server actions` в `app/actions/task-actions.ts`;
- `API routes` в `app/api/tasks/*`.

На практике:

- формы создания и часть административных сценариев опираются на `server actions`;
- интерактивные и offline-aware действия клиента чаще идут через `API routes`;
- статус, комментарии и часть team-операций существуют в обоих представлениях.

Следствие: документация и изменения должны учитывать, что часть правил поддерживается в двух местах.

### ППР

У ППР разделение более выражено:

- справочники, шаблоны, назначения и часть календаря идут через `server actions`;
- lifecycle ППР-заявок в основном живёт в `app/api/ppr/tasks/*`;
- закрытие ППР-заявки осталось `server action` (`closePprTaskAction`).

То есть ППР не полностью “API-first” и не полностью “actions-first”.

### Права

Права частично распределены между:

- `lib/auth.ts`;
- `lib/task-permissions.ts`;
- `lib/ppr/permissions.ts`;
- `lib/ppr/queries.ts` с access-gates на уровне выборок;
- RLS-политиками в Supabase.

Это осознанное многослойное ограничение, но из-за него важно синхронно обновлять код и документацию.

## 6. Связи между слоями

### Страница -> данные

Типичный путь чтения:

1. Страница вызывает `requireProfile()`.
2. Получает серверный Supabase client.
3. Вызывает query-layer из `lib/*`.
4. Передаёт данные в `components/*`.

### Клиентский UI -> запись

Есть два варианта:

1. Через `server action` из формы.
2. Через `fetch` в `app/api/*`.

Для интерактивных операций второй вариант используется чаще, особенно там, где нужен offline fallback или немедленный JSON-ответ.

### API routes / actions -> Supabase

Handlers используют:

- `getApiSession()` для API routes;
- `requireProfile()` + `createSupabaseServerClient()` для server actions.

Дальше вызывается:

- либо query/permission-логика из `lib/*`;
- либо прямой запрос к таблицам/RPC с локальной проверкой условий.

### Файлы

Для файлов путь такой:

1. Клиент отправляет `FormData`.
2. Handler валидирует тип/размер/количество.
3. Файл уходит в приватный bucket.
4. Метаданные пишутся в таблицу.
5. На чтении пользователю выдаётся signed URL.

Buckets:

- `task-attachments` — обычные задачи;
- `ppr-files` — ППР.

### Offline и PWA

`RegisterSW` включён глобально, а offline queue подключается только в dashboard layout.

Итог:

- PWA-обвязка доступна всему приложению;
- offline sync фактически относится к авторизованному контуру обычных задач.

## 7. Ключевые сквозные процессы

### 7.1 Смена статуса обычной задачи

Основной интерактивный путь:

1. `StatusControl` или `TaskActionMenu`.
2. Если сети нет, действие ставится в `offline/queue.ts`.
3. Если сеть есть, вызывается `POST /api/tasks/[id]/status`.
4. API route проверяет сессию, читает задачу, сверяет права через `canChangeStatus`.
5. Проверяет допустимость перехода через `canTransitionTaskStatus`.
6. Обновляет `tasks`, пишет `audit_log`.

Отдельная ветка:

- переход в `paused` идёт не через `/status`, а через `/pause`;
- переход `new -> accepted` также существует как `takeTaskInWork` server action.

Вывод: lifecycle обычных задач размазан между несколькими entry points.

### 7.2 Комментарий к обычной задаче

Основной путь:

1. `CommentForm`.
2. При офлайне — `enqueueAction(type: "add_comment")`.
3. При онлайне — `POST /api/tasks/[id]/comments`.
4. Route проверяет право чтения задачи.
5. Вставляет комментарий, пишет audit, запускает push наблюдателям.
6. Вложения при наличии отправляются отдельным запросом в `/attachments`.

Замечание: комментарий может быть создан без текста только в составе API-схемы? Нет. Для обычных задач API сейчас принимает `body` как строку и затем `trim()`, поэтому бизнес-ожидание “комментарий только с фото” зависит от текущего поведения формы и обработчика вложений, а не от отдельной доменной модели комментария.

### 7.3 Смена статуса ППР-заявки

Путь:

1. Клиент вызывает `POST /api/ppr/tasks/[id]/status`.
2. Route получает задачу через `getPprTaskByIdForProfile`.
3. Формируется PPR-actor через `buildPprTaskActor`.
4. Проверяются `canStartPprTask` или `canCompletePprTask`.
5. При переходе в `done` дополнительно проверяются evidence: минимум 1 комментарий и 1 фото.
6. Обновляется `ppr_tasks`, пишется audit.

### 7.4 Закрытие и отмена ППР-заявки

- отмена идёт через `POST /api/ppr/tasks/[id]/cancel`;
- закрытие идёт через `closePprTaskAction`.

Обе операции синхронизируют статусы с `ppr_month_plan_items`.

Это важная архитектурная особенность: финализация ППР lifecycle не сосредоточена в одном transport-слое.

### 7.5 Права доступа

Проверки идут в несколько слоёв:

1. `middleware.ts` защищает часть dashboard-маршрутов по cookie.
2. Страницы вызывают `requireProfile()` и дополнительно фильтруют доступ.
3. API routes вызывают `getApiSession()`.
4. Доменный слой применяет `can*`-проверки.
5. На данных работает RLS.

Критичная деталь:

- `middleware.ts` не включает `/ppr` в `matcher`;
- доступ к ППР обеспечивается не middleware, а server-side проверками в страницах, API и actions.

### 7.6 Offline sync

Сейчас offline queue покрывает только:

- `update_status` обычных задач;
- `add_comment` обычных задач.

`OfflineSyncBootstrap`:

- запускает `flushQueue()` при mount;
- слушает событие `online`;
- повторно отправляет отложенные запросы.

Очередь не покрывает:

- ППР;
- файлы;
- паузу;
- team management;
- справочники;
- админские операции.

### 7.7 PWA и push

Путь push-подписки:

1. `RegisterSW` регистрирует `sw.js`.
2. При наличии VAPID-ключа запрашивает push subscription.
3. Отправляет подписку в `/api/push/subscribe`.
4. Route сохраняет её в `push_subscriptions`.

Путь отправки push:

1. Код вызывает `sendPushToUser`.
2. Используется admin client.
3. `web-push` отправляет уведомления по подпискам.
4. `sw.js` показывает notification и открывает URL.

Push сейчас реально используются в контуре обычных задач. Для ППР выделенных push-сценариев нет.

## 8. API routes и server actions

### Основные API routes

Обычные задачи:

- `/api/tasks/[id]/status`
- `/api/tasks/[id]/pause`
- `/api/tasks/[id]/comments`
- `/api/tasks/[id]/history`
- `/api/tasks/[id]/team`
- `/api/tasks/[id]/attachments`
- `/api/tasks/[id]/archive`

Push и cron:

- `/api/push/subscribe`
- `/api/push/test`
- `/api/push/send-assignment`
- `/api/cron/archive`

ППР:

- `/api/ppr/tasks/[id]/status`
- `/api/ppr/tasks/[id]/assign`
- `/api/ppr/tasks/[id]/cancel`
- `/api/ppr/tasks/[id]/comments`
- `/api/ppr/tasks/[id]/attachments`
- `/api/ppr/tasks/[id]/reschedule`
- `/api/ppr/qr/[token]`
- `/api/ppr/cron/run`

### Основные server actions

Обычные задачи:

- `takeTaskInWork`
- `updateTaskStatus`
- `pauseTask`
- `addTaskComment`
- `createTaskAction`
- `addTaskTeamMemberAction`
- `removeTaskTeamMemberAction`

Справочники и auth:

- `signOutAction`
- user/object actions

ППР:

- directory actions;
- template actions;
- calendar actions;
- `closePprTaskAction`.

## 9. Модель данных на уровне доменов

### Общий контур

Базовые сущности:

- `profiles`
- `objects`
- `user_objects`
- `tasks`
- `task_team_members`
- `task_comments`
- `task_attachments`
- `audit_log`
- `push_subscriptions`

### ППР-контур

Ключевые сущности по миграциям и query-layer:

- `ppr_system_groups`
- `ppr_systems`
- `object_rooms`
- `ppr_equipment`
- `ppr_equipment_qr_codes`
- `ppr_work_templates`
- `ppr_work_checklist_items`
- `ppr_equipment_work_assignments`
- `ppr_month_plans`
- `ppr_month_plan_items`
- `ppr_tasks`
- `ppr_task_work_items`
- `ppr_task_comments`
- `ppr_task_attachments`

Отдельно есть file-слой ППР через bucket `ppr-files` и таблицы вложений для оборудования, шаблонов и ППР-задач, но в текущем UI наиболее явно задействованы именно вложения ППР-заявок.

## 10. Ограничения текущей архитектуры

- Обычные задачи и ППР используют похожие концепции, но реализованы разными контурами без общего абстрактного доменного слоя.
- Часть прикладных операций дублируется между `API routes` и `server actions`.
- `middleware.ts` защищает только часть приложения и не является универсальным gatekeeper для всех авторизованных экранов.
- Offline-поддержка ограничена только частью обычного task-flow.
- `service worker` не делает приложение fully-offline и в основном кэширует статику.
- Права доступа распределены между UI, handlers, `lib/*` и RLS, поэтому изменение одной точки без остальных может привести к рассинхрону.

## 11. Практические правила для изменений

- Для UI-форм с полноценным submit и revalidate естественнее использовать `server actions`.
- Для интерактивных операций, offline fallback и JSON-ответов естественнее использовать `API routes`.
- Любое изменение прав нужно проверять минимум в `lib/auth.ts`, `lib/task-permissions.ts` или `lib/ppr/permissions.ts`, а также в реальных entry points.
- Изменения в lifecycle задач и ППР нужно смотреть не только в transport-слое, но и в query/permission/helpers.
- Для PPR-изменений важно учитывать связь с `ppr_month_plan_items`, календарём и cron-оркестрацией.
