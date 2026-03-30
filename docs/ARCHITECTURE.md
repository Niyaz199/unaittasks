# Архитектура проекта

> Документ описывает фактическую архитектуру репозитория на текущем этапе и согласован с `README.md`. Если код и документ расходятся, источником истины считается код.

## 1. Общая картина

Проект состоит из трёх прикладных контуров и одного shared-слоя:

- обычные эксплуатационные задачи;
- модуль ППР;
- модуль обходов помещений;
- shared-слой объектов, помещений, этажей, типов помещений, ролей, auth, audit, storage и PWA/offline-инфраструктуры.

Технически это одно приложение на `Next.js 15` с `App Router`, где:

- страницы и серверные компоненты живут в `app/`;
- интерактивный UI вынесен в `components/`;
- query/permission/data logic сосредоточены в `lib/`;
- запись идёт через комбинацию `route handlers` и `server actions`;
- источником данных выступает `Supabase` (`Auth`, `Postgres`, `RLS`, `Storage`, `RPC`);
- в авторизованном dashboard-контуре есть `PWA`, offline queue и mobile navigation.

## 2. Архитектура по слоям

### 2.1 UI-слой

UI строится вокруг server-first подхода:

- страницы в `app/` по умолчанию серверные;
- клиентские компоненты используются там, где нужен браузерный API, локальное состояние, drag-and-drop, offline-синк или scanner/photo flow;
- единый shell собирается в `app/(dashboard)/layout.tsx`.

Основные UI-пакеты:

- `components/tasks/*` — обычные задачи;
- `components/ppr/*` — ППР, room details, calendar, task details;
- `components/rounds/*` — scanner, today/config/archive/qr UI;
- `components/dashboard/*` — sidebar и mobile navigation;
- `components/ui/*` — примитивы;
- `components/pwa/*`, `components/offline/*` — service worker, push opt-in и sync bootstrap.

### 2.2 Transport/orchestration-слой

`app/` совмещает три механизма:

- страницы и layouts;
- `app/api/*` для JSON/FormData API;
- `app/actions/*` для `server actions`.

На практике:

- обычные задачи используют и `API routes`, и `server actions`;
- справочники и часть admin/PPR-форм опираются на `server actions`;
- интерактивные сценарии `PPR task lifecycle`, `Rounds scanner`, `Rounds config` идут через `API routes`;
- `PPR calendar` использует смешанный подход: page + actions + scheduler/API cron.

### 2.3 Доменный слой

Бизнес-логика в `lib/` разделена по доменам:

- `lib/tasks.ts`, `lib/task-permissions.ts`, `lib/task-sort.ts`, `lib/task-presentation.ts` — обычные задачи;
- `lib/ppr/*` — ППР;
- `lib/rounds/*` — обходы;
- `lib/object-rooms.ts`, `lib/floors.ts`, `lib/room-types.ts` — shared rooms/directories;
- `lib/object-access.ts` — единый shared object-scope access layer;
- `lib/relation-normalization.ts` — общий слой relation unwrap/name normalization;
- `lib/auth.ts`, `lib/api-auth.ts` — request-scoped auth/session helpers;
- `lib/offline/*` — очереди и sync coordinator;
- `lib/audit.ts`, `lib/push.ts` — сквозная инфраструктура.

### 2.4 Данные и интеграции

Хранилище построено на Supabase:

- `Auth` — сессии;
- `profiles` — прикладной профиль пользователя и роль;
- `Postgres + RLS` — основная доменная модель;
- `Storage` — `task-attachments`, `ppr-files`, `rounds-files`;
- `RPC` — pause/archive, calendar/materialization и rounds scanner/config logic.

Приложение использует три клиента Supabase:

- `lib/supabase/server.ts` — SSR и actions;
- `lib/supabase/browser.ts` — клиентский доступ, когда он нужен;
- `lib/supabase/admin.ts` — service role для системных операций.

## 3. Назначение основных директорий

### `app/`

Содержит:

- `(dashboard)/layout.tsx` — авторизованный shell, `RegisterSW`, `OfflineSyncBootstrap`, sidebar и mobile tabs;
- страницы модулей `Tasks`, `PPR`, `Rounds`, справочников и профиля;
- `app/api/*` — API routes;
- `app/actions/*` — server actions.

Ключевая деталь:

- `RegisterSW` и offline bootstrap подключены в dashboard layout;
- service worker и queue orchestration активируются только в авторизованном контуре.

### `components/`

- `tasks/` — списки, карточки, формы, offline-aware task UI;
- `ppr/` — dashboard, справочники, room/equipment details, calendar, task details;
- `rounds/` — scanner config provider, entry form, today/config boards, QR board;
- `dashboard/` — main nav и mobile launcher;
- `pwa/` — service worker registration и push opt-in;
- `offline/` — bootstrap синка.

### `lib/`

Главный слой прикладной логики.

Ключевые точки:

- `auth.ts` — `getRequestSession()`, `requireProfile()`, request-scoped reuse session/profile;
- `api-auth.ts` — reuse того же request session в API routes;
- `object-access.ts` — единый shared object-scope helper для `PPR`, `Rounds`, `object_rooms`;
- `relation-normalization.ts` — shared helper layer для relation payloads;
- `ppr/queries.ts` — barrel export поверх нескольких PPR query submodules;
- `offline/sync-coordinator.ts` — единый coordinator для task + rounds offline sync.

## 4. Реально используемые контуры

### Контур 1. Обычные задачи

Главные страницы:

- `/my`
- `/new`
- `/archive`
- `/tasks/create`
- `/tasks/[id]`

Данные и права обслуживаются через `lib/tasks.ts` и `lib/task-permissions.ts`.

### Контур 2. Shared rooms/directories

Главные страницы:

- `/directories/floors`
- `/directories/room-types`
- `/ppr/rooms`
- `/ppr/rooms/[id]`
- `/ppr/rooms/qr/[token]`

Shared rooms теперь обслуживают одновременно:

- room directory для ППР;
- room card;
- общий room QR flow;
- `Rounds config/today/archive/scanner`.

На `"/ppr/rooms"` также есть MVP-импорт помещений:

- через `CSV` или `XLSX`-шаблон;
- в два шага: `preview/validate` -> `commit`;
- только для доступных пользователю объектов из `object_rooms_manage`;
- без обновления существующих записей;
- с duplicate detection по `object_id + normalized(name)`, где `normalized(name)` = `trim + collapse spaces`;
- с единым server-side validation pipeline после parse-слоя независимо от формата файла.

### Контур 3. ППР

Главные подмодули:

- структура: `/ppr/system-groups`, `/ppr/systems`, `/ppr/equipment`, `/ppr/rooms`;
- планирование: `/ppr/templates`, `/ppr/assignments`, `/ppr/calendar`;
- исполнение: `/ppr/tasks`, `/ppr/my`, `/ppr/archive`, `/ppr/tasks/[id]`;
- QR-entry: `/ppr/qr/[token]`.

Внутри `lib/ppr/*` query layer уже не монолитный:

- `access.ts`
- `structure-queries.ts`
- `calendar-queries.ts`
- `task-queries.ts`
- `task-read-models.ts`

Публичный import `@/lib/ppr/queries` сохранён как barrel.

### Контур 4. Обходы

Главные подмодули:

- home: `/rounds`;
- scanner flow: `/rounds/scan`, `/rounds/entry/[token]`, `/rounds/scan?token=...`;
- отчётность: `/rounds/today`, `/rounds/archive`;
- конфигурация: `/rounds/config`, `/rounds/qr`.

Этот контур использует:

- shared `object_rooms`;
- shared room QR через `object_room_qr_codes`;
- доменный пакет `lib/rounds/*`;
- отдельную offline-очередь `lib/offline/rounds-queue.ts`.

## 5. Навигация и модульная модель

Desktop navigation организована секциями:

- `Задачи`
- `ППР`
- `Обходы`
- `Справочники`
- `Сервис`

Клик по родительскому пункту `ППР` или `Обходы`:

- открывает главную страницу модуля;
- одновременно раскрывает список подразделов;
- не требует отдельного дублирующего подпункта “Модуль ...”.

На мобильном:

- есть отдельный launcher `Задачи / ППР / Обходы`;
- сохранены быстрые табы `Мои / Новые / Архив / Справ. или Профиль`;
- доступ к базовому task-модулю не исчезает при наличии PPR/Rounds.

## 6. Связи между слоями

### Страница -> данные

Типичный путь чтения:

1. Страница вызывает `requireProfile()`.
2. Получает server Supabase client из `getRequestSession()`.
3. Вызывает query-layer из `lib/*`.
4. Передаёт данные в `components/*`.

### API / action -> данные

Handlers используют:

- `getApiSession()` для API routes;
- `requireProfile()` + server client для actions.

Дальше вызывается:

- query/permission logic из `lib/*`;
- либо RPC/SQL операции с локальной валидацией payload и scope.

### Shared object scope

Object-scoped access теперь централизован в `lib/object-access.ts`.

Этим пользуются:

- `object_rooms`;
- `PPR access`;
- `Rounds queries`;
- `PPR task lifecycle`.

Это уменьшило дублирование `user_objects`-логики и выровняло поведение между модулями.

### Relation normalization

Relation payloads из Supabase нормализуются через `lib/relation-normalization.ts`.

Этим пользуются:

- `Rounds query layer`;
- `object_rooms`;
- `PPR calendar/scheduler`;
- часть shared read models.

## 7. Ключевые сквозные процессы

### 7.1 Room QR -> room card / rounds scanner

Путь:

1. Помещение создаётся в `object_rooms`.
2. Для него автоматически появляется активный room QR в `object_room_qr_codes`.
3. `/ppr/rooms/qr/[token]` резолвит token в room card `/ppr/rooms/[id]`.
4. Тот же token может использоваться в `Rounds scanner`.
5. Scanner route уже проверяет состояние помещения для обходов: `enabled / disabled / inactive / configured / invalid`.

### 7.2 Rounds scan -> resolve -> confirm -> sync

Путь:

1. Пользователь открывает `/rounds/scan` или deep-link `/rounds/entry/[token]`.
2. `RoundsEntryForm` ищет помещение в локальном snapshot.
3. При необходимости делает fallback в `/api/rounds/resolve/[token]`.
4. При submit вызывает `/api/rounds/checkins` или ставит check-in в offline queue.
5. `runOfflineSync()` координирует отложенную отправку.

### 7.3 Rounds config -> save -> read -> print QR

Путь:

1. `/rounds/config` читает только доступные объекты.
2. После выбора объекта UI переключается в `object -> floors -> rooms`.
3. Сохранение идёт через `/api/rounds/config`.
4. Source of truth — `object_rooms.rounds_enabled`.
5. `/rounds/qr` строится уже по сохранённому состоянию.

### 7.4 PPR task details -> comments -> attachments

Путь:

1. Страница читает task, work items, assignee candidates, comments и attachment read model server-side.
2. `PprTaskDetails` рендерит карточку, lifecycle controls, comment form и galleries.
3. Комментарии пишутся через `/api/ppr/tasks/[id]/comments`.
4. Attachments пишутся через `/api/ppr/tasks/[id]/attachments`.

После remediation attachment waterfall из карточки убран.

### 7.5 PPR calendar -> month plan -> materialization

Путь:

1. `/ppr/calendar` читает systems, year overview, month plans и month plan items.
2. UI разбит на year view, month section, filters drawer и item drawers.
3. Месячный план генерируется через `generatePprMonthPlanAction`.
4. Carryover/materialization/sync статусов оркестрируются scheduler/cron слоем.

## 8. Performance и remediation-состояние

Уже внесены ключевые улучшения:

- выравнивание прав `Rounds config` и data layer;
- единый offline sync coordinator вместо параллельных запусков;
- server-side attachment read model для `PPR task details`;
- перенос части фильтрации ближе к data/query layer;
- request-scoped reuse сессии и профиля;
- reuse одного server Supabase client на тяжёлых SSR-экранах;
- dedupe scanner config fetch и более узкий payload;
- декомпозиция тяжёлого `PprCalendar`;
- object-scoped loading для тяжёлых screens `PPR rooms/equipment` и `Rounds config`;
- route-level `loading.tsx` для тяжёлых экранов;
- module-level `error.tsx` для `PPR` и `Rounds`;
- selective lazy loading тяжёлых client-only блоков.

## 9. PWA, offline и mobile

### Service worker

`public/sw.js` использует раздельные cache buckets:

- `shell`
- `static`
- `data`

Стратегии разделены для:

- HTML navigation;
- static assets;
- data/API requests.

Shell-маршруты сейчас ограничены `"/my"`, `"/rounds"` и `"/rounds/scan"`.

Для shell-кэша service worker сохраняет только валидный HTML-ответ:

- `response.ok`;
- без `redirected`;
- с `content-type: text/html`;
- с final URL, совпадающим с ожидаемым route.

Это нужно, чтобы не сохранить login-page или redirect fallback под ключом `"/my"` при защищённой навигации через `middleware.ts`.

Критичные data-paths возвращают явный `503 SW_OFFLINE`, а не молча stale cache.

Для offline navigation service worker сначала ищет точный cached shell, а для прочих маршрутов использует безопасный fallback на `"/my"` без подмены HTML чужого route под текущий URL.

### Push

Путь push-подписки теперь такой:

1. `RegisterSW` только регистрирует `sw.js`.
2. Явный opt-in происходит из `PushOptInCard` в профиле.
3. Только после действия пользователя запрашивается `Notification.requestPermission()`.
4. Подписка сохраняется в `/api/push/subscribe`.

Push сейчас реально используются в task-контуре. Для ППР и обходов отдельного push-контура нет.

### Offline sync

Offline queue покрывает:

- `update_status` и `add_comment` для обычных задач;
- `rounds_checkin` с фото для обходов.

`runOfflineSync()`:

- синхронизирует task queue и rounds queue;
- не допускает параллельный flush;
- умеет повторный запуск после in-flight цикла.

### Фото в обходах

В `Rounds` фото подготавливается до submit:

- основной путь — background prepare / worker;
- fallback — безопасный `passthrough`, если worker недоступен;
- stale state при быстрой замене/удалении фото отсечён на уровне sequence/key checks.

## 10. Тестовый контур

Добавлен минимальный `Playwright` smoke/e2e baseline:

- auth redirect;
- UI login;
- `Rounds config` save/read;
- room QR resolve + scanner confirm flow;
- `PPR task details`;
- `PPR calendar` month route;
- optional/manual-only smoke на month generation.

Тестовый слой живёт отдельно от production-кода:

- `playwright.config.ts`
- `tests/e2e/*`
- `tests/e2e/README.md`

## 11. Ограничения текущей архитектуры

- Обычные задачи и ППР используют похожие бизнес-концепции, но остаются двумя независимыми доменами.
- Часть прикладных операций по-прежнему размазана между `API routes` и `server actions`.
- `middleware.ts` защищает только часть приложения и не является универсальным gatekeeper для `PPR`/`Rounds`.
- Offline-поддержка не является универсальной для всех доменов.
- `service worker` не делает приложение fully-offline.
- Уже установленное PWA может стартовать офлайн на ранее подготовленных shell-маршрутах, но `App Router`/`RSC` и большинство server-driven экранов всё ещё ориентированы на сеть.
- Права доступа остаются многослойными: UI guards, page guards, API guards, query layer и RLS.

## 12. Практические правила для изменений

- Для interactive/offline-aware сценариев предпочтительнее `API routes`.
- Для форм с revalidate и server-first submit естественнее `server actions`.
- Любое изменение прав нужно проверять минимум в page-level guard, API/action entry point, query layer и RLS.
- Для изменений в `PPR` важно учитывать не только UI, но и `scheduler`, `task-lifecycle`, `month plan` и barrel `queries`.
- Для изменений в `Rounds` важно проверять вместе `config`, `scanner`, `today/archive`, room QR и offline queue.
