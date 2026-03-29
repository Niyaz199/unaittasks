# Задачник эксплуатации

## 1. О проекте

`Задачник эксплуатации` — это приложение на `Next.js 15` и `Supabase` для трёх связанных прикладных контуров:

- обычные эксплуатационные задачи;
- модуль ППР;
- модуль обходов помещений.

Проект уже не является “только задачником”: `PPR` и `Rounds` живут как отдельные модульные разделы внутри общего dashboard-shell, но переиспользуют единые роли, объекты, помещения, audit, auth, storage и PWA/offline-инфраструктуру.

## 2. Что есть в системе сейчас

### Модули

- `Задачи` — обычные эксплуатационные задачи с lifecycle, комментариями, историей, командой и вложениями.
- `ППР` — структура, оборудование, шаблоны, назначения, календарь, ППР-заявки и QR-entry.
- `Обходы` — отдельный модуль с модульной главной страницей, scanner flow, `Сегодня`, `Архив`, `Конфигуратор` и `QR помещений`.
- `Справочники` — пользователи, объекты, этажи, типы помещений и общий справочник помещений.
- `Сервис` — профиль и журнал действий.

### Навигация

Desktop-навигация устроена по секциям:

- `Задачи`
- `ППР`
- `Обходы`
- `Справочники`
- `Сервис`

Клик по родительским пунктам `ППР` и `Обходы` открывает главную страницу модуля и одновременно оставляет раскрытым список реальных подразделов. Дублирующие подпункты вида “Модуль ППР” или “Модуль Обходов” удалены.

На мобильном:

- сохранён быстрый доступ к базовому модулю `Задачи`;
- добавлен отдельный launcher модулей `Задачи / ППР / Обходы`;
- нижняя мобильная навигация остаётся компактной и не перегружена модульными разделами.

## 3. Модуль задач

Основные маршруты:

- `/my`
- `/new`
- `/archive`
- `/tasks/create`
- `/tasks/[id]`

Что реализовано:

- статусы `new -> accepted -> in_progress -> paused -> done`;
- назначение ответственного и управление командой;
- фильтры, сортировка и группировка;
- комментарии и история;
- фото-вложения к задаче и к комментариям;
- ручной архив для `admin/chief`;
- автоархив завершённых задач через cron/RPC;
- push-уведомления для task-flow.

Вложения обычных задач хранятся в приватном bucket `task-attachments`, а на чтении выдаются через signed URL.

## 4. Помещения и общий QR

`object_rooms` — это общий справочник помещений объекта, который используется сразу несколькими модулями.

Сейчас для помещений реализовано:

- общий справочник `/ppr/rooms`;
- карточка помещения `/ppr/rooms/[id]`;
- QR-entry `/ppr/rooms/qr/[token]`;
- общий QR помещения, не привязанный только к обходам;
- автоматическое создание room QR при создании помещения;
- ручная регенерация QR из карточки помещения;
- отдельный флаг участия в обходах `object_rooms.rounds_enabled`.

Важно:

- QR помещения теперь считается shared-сущностью;
- он уже используется в `Rounds`, а архитектурно подготовлен и для других сценариев;
- участие помещения в обходах определяется не наличием QR, а отдельным флагом `rounds_enabled`.

## 5. Модуль ППР

Модуль ППР расположен под `/ppr`.

### Структура и справочники

- `/ppr`
- `/ppr/system-groups`
- `/ppr/systems`
- `/ppr/rooms`
- `/ppr/equipment`
- `/ppr/equipment/[id]`
- `/ppr/templates`
- `/ppr/templates/[id]`
- `/ppr/assignments`

### Календарь и планирование

- `/ppr/calendar` — годовой обзор и monthly operational-календарь;
- генерация month plan по системе;
- переносы внутри месяца;
- materialization позиций плана в ППР-заявки;
- cron orchestration через `/api/ppr/cron/run`.

После remediation календарь:

- декомпозирован на smaller UI units;
- переведён на более лёгкий server-first data shaping;
- получил route-level `loading.tsx` и module-level `error.tsx`;
- использует selective lazy loading для тяжёлых client частей.

### ППР-заявки

- `/ppr/tasks`
- `/ppr/my`
- `/ppr/archive`
- `/ppr/tasks/[id]`

Lifecycle ППР-заявки:

- `new -> in_progress -> done -> closed`
- возможна отмена в `cancelled`
- перенос допустим для `new` и `in_progress`
- завершение в `done` требует минимум один комментарий и минимум одно фото

Карточка ППР-заявки теперь использует server-side attachment read model вместо старого waterfall по комментариям.

### QR-entry

- `/ppr/qr/[token]`
- `/api/ppr/qr/[token]`

QR ППР по-прежнему ведёт в карточку оборудования или активной ППР-заявки. Отдельно от этого теперь существует room QR flow через карточку помещения.

### Архитектура PPR query layer

Публичный контракт `@/lib/ppr/queries` сохранён, но внутри слой разрезан на bounded submodules:

- `lib/ppr/access.ts`
- `lib/ppr/structure-queries.ts`
- `lib/ppr/calendar-queries.ts`
- `lib/ppr/task-queries.ts`
- `lib/ppr/task-read-models.ts`

Рядом вынесены shared helpers:

- `lib/object-access.ts` — единый object-scope access layer;
- `lib/relation-normalization.ts` — общий слой relation unwrap/name normalization.

## 6. Модуль обходов

Модуль обходов расположен под `/rounds` и имеет собственную главную страницу `/rounds`.

Основные разделы:

- `/rounds`
- `/rounds/scan`
- `/rounds/entry/[token]` -> redirect в `/rounds/scan?token=...`
- `/rounds/today`
- `/rounds/archive`
- `/rounds/config`
- `/rounds/qr`

### Scanner flow

Scanner flow mobile-first:

- открытие `/rounds/scan`;
- deep-link по токену через `/rounds/scan?token=...` или `/rounds/entry/[token]`;
- сначала попытка разрешить помещение из локального snapshot;
- fallback через `/api/rounds/resolve/[token]`, если snapshot ещё не знает токен;
- подтверждение отметки с комментарием и опциональным фото;
- online submit в `/api/rounds/checkins` или уход в offline-очередь.

Для room QR resolve сервер различает несколько состояний:

- помещение найдено и доступно;
- помещение найдено, но не включено в обходы;
- помещение неактивно;
- scanner config устарела;
- токен не найден.

### Today / Archive

`/rounds/today` и `/rounds/config` работают по общей UX-логике:

- выбор объекта;
- затем переключение по этажам;
- затем список помещений только выбранного этажа.

`Today` показывает:

- помещение;
- статус отметки;
- кто отметил;
- время;
- наличие комментария и фото.

`Archive` остаётся табличным экраном с фильтрами по объекту, периоду, технику и помещению.

### Конфигуратор обходов

`/rounds/config`:

- читает только доступные объекты;
- до выбора объекта не грузит длинный cross-object список;
- сохраняет `rounds_enabled` через `/api/rounds/config`;
- поддерживает single-object и batch payload;
- показывает partial-save ошибки, если часть объектов не сохранилась;
- использует те же сохранённые данные как source of truth для `Today`, `Archive`, `Scanner` и `QR`.

### QR помещений

`/rounds/qr`:

- печатная форма и поштучная выгрузка общих QR-кодов;
- использует только помещения с `rounds_enabled = true`;
- отдельный endpoint “сгенерировать QR для обходов” больше не является рабочим сценарием: QR создаётся автоматически на уровне комнаты.

### Бизнес-правила

- помещения участвуют в обходах через `object_rooms.rounds_enabled`;
- факт обхода хранится в `rounds_checkins`;
- повторный check-in за день заменяет предыдущий только если `incoming.scanned_at_device >= existing.scanned_at_device`;
- scanner flow использует shared room QR, но право на отметку и видимость помещений ограничены объектным скоупом и ролью.

## 7. Роли и права

Поддерживаются роли:

- `admin`
- `chief`
- `lead`
- `engineer`
- `object_engineer`
- `tech`

### Задачи

| Роль | Права |
|------|-------|
| `admin` | полный доступ, включая пользователей, объекты, журнал и архив |
| `chief` | полный рабочий доступ к задачам, пользователям, объектам и журналу |
| `lead` | создание и назначение задач, управление командой |
| `engineer` | создание задач, работа со своими задачами и командой |
| `object_engineer` | работа с задачами своего объекта, управление командой в объектном скоупе |
| `tech` | доступ только к назначенным задачам и участию в команде |

### ППР

| Роль | Права в ППР |
|------|-------------|
| `admin` | полный доступ ко всем экранам и операциям |
| `chief` | полный доступ ко всем экранам и операциям |
| `lead` | структура, шаблоны, назначения, календарь, ППР-заявки, QR |
| `engineer` | ППР-заявки, QR, участие в исполнении; календарь только для систем, где пользователь ответственен |
| `object_engineer` | структура, шаблоны, назначения, календарь и ППР-заявки в пределах доступных объектов |
| `tech` | только слой ППР-заявок и QR без доступа к структуре и планированию |

### Обходы

| Роль | Права в обходах |
|------|------------------|
| `admin` | полный доступ ко всем экранам и QR |
| `chief` | полный доступ ко всем экранам и QR |
| `lead` | `today`, `archive`, `config`, `qr` в доступных объектах |
| `engineer` | `today`, `archive`, `config`, `qr` в доступных объектах |
| `object_engineer` | `today`, `archive`, `config`, `qr` в доступных объектах |
| `tech` | scanner flow и сохранение собственных отметок |

## 8. Архитектура и уже внесённые улучшения

Проект организован по доменным слоям:

- `app/` — страницы, `route handlers`, `server actions`;
- `components/` — UI;
- `lib/` — бизнес-логика и query layer;
- `supabase/` — миграции, SQL и seed;
- `public/` — `manifest` и `service worker`.

Ключевые изменения после remediation:

- request-scoped auth/session reuse через `getRequestSession()` и `getApiSession()`;
- единый shared object-scope слой `lib/object-access.ts`;
- единый relation normalization helper layer `lib/relation-normalization.ts`;
- разрезание `lib/ppr/queries.ts` на подмодули при сохранении barrel contract;
- server-side attachment read model для карточки ППР-заявки;
- dedupe scanner config fetch и более узкий payload `/api/rounds/config`;
- object-scoped загрузка тяжёлых экранов `PPR rooms/equipment` и `Rounds config`;
- route-level `loading.tsx`, module-level `error.tsx` и selective lazy loading на тяжёлых маршрутах.

## 9. Offline, PWA и mobile

### Service worker и push

- `RegisterSW` подключён в `app/(dashboard)/layout.tsx`, а не в публичном layout;
- `sw.js` использует раздельные cache buckets для `shell`, `static`, `data`;
- shell-маршруты сейчас включают `"/my"`, `"/rounds"` и `"/rounds/scan"`;
- HTML navigation, static assets и data/API имеют разные стратегии кэширования;
- shell кэшируется только для валидного HTML-ответа без redirect, с совпадающим final URL;
- `sw.js` не сохраняет login/redirect fallback под ключом `"/my"`;
- для offline navigation используется точный cached shell, а для прочих маршрутов безопасный fallback ведёт на `"/my"` без подмены HTML чужого route;
- критичные data-paths не получают “тихий” stale fallback;
- push не подписывается автоматически;
- push opt-in вынесен в профиль и запускается только по явному действию пользователя.

### Offline

Offline-поддержка сейчас покрывает:

- `update_status` и `add_comment` в обычных задачах;
- `rounds_checkin` в модуле обходов, включая фото.

Синхронизация:

- координируется через единый `lib/offline/sync-coordinator.ts`;
- запускается при mount, `online`, `focus`, `visibilitychange` и вручную;
- параллельный sync не должен идти одновременно.

### Фото в обходах

Фото в `Rounds` подготавливается в фоне:

- основной путь — через worker / background prepare;
- есть безопасный fallback без worker;
- submit не делает повторную полную компрессию;
- форма защищена от stale state при быстрой замене или удалении фото.

### Mobile navigation

- быстрый вход в `Задачи`, `ППР` и `Обходы`;
- нижняя навигация остаётся компактной;
- модульные entry points не ломают доступ к обычным задачам.

## 10. Тестирование

В проекте добавлен минимальный `Playwright` smoke/e2e baseline.

Покрываются сценарии:

- auth redirect и UI login;
- `Rounds config` save/read;
- room QR resolve и scanner confirm flow;
- `PPR task details` с комментариями;
- `PPR calendar` month route;
- optional/manual-only smoke на month generation.

Команды:

```bash
npm run test:e2e:install
npm run test:e2e
npm run test:e2e:headed
```

Data-driven env для smoke:

- `E2E_EMAIL`
- `E2E_PASSWORD`
- `E2E_ROUNDS_OBJECT_NAME`
- `E2E_ROUNDS_ROOM_NAME`
- `E2E_ROUNDS_TOKEN`
- `E2E_PPR_TASK_ID`
- `E2E_PPR_CALENDAR_SYSTEM_NAME`

Детали описаны в `tests/e2e/README.md`.

## 11. Технологии

- `Next.js 15`
- `React 19`
- `TypeScript`
- `Supabase` (`Auth`, `Postgres`, `RLS`, `Storage`, `RPC`)
- `Zod`
- `localforage`
- `web-push`
- `qrcode.react`
- `Playwright`
- `Docker` + `Caddy`

## 12. Запуск проекта

### Локально

```bash
npm install
copy .env.example .env
npm run dev
```

Обязательные переменные окружения:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Опциональные:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`

### База данных

Репозиторий содержит миграции обычного task-контра, PPR, shared room layer, room QR и модуля обходов, включая доступ/QR-fix миграции `0022`–`0026`.

Рекомендуемый способ применения:

```bash
supabase db push
```

Если миграции применяются вручную через SQL Editor, их нужно запускать по порядку.

### Docker

```bash
docker compose up --build
```

### Cron и push

- `/api/cron/archive` архивирует завершённые обычные задачи;
- `/api/ppr/cron/run` запускает carryover/materialization/sync для ППР;
- для cron-маршрутов используется заголовок `x-cron-secret`;
- push реально активируется только после настройки VAPID и явного opt-in на устройстве.

## 13. Текущие ограничения

- `PWA` и offline есть, но приложение не является fully-offline: большинство HTML/API-запросов по-прежнему ориентированы на сеть.
- Уже установленное PWA может открываться офлайн на ранее подготовленных shell-маршрутах `"/my"`, `"/rounds"` и `"/rounds/scan"`, но это не означает universal offline для всех страниц App Router.
- Offline-поддержка не покрывает весь `PPR`, справочники и административные операции.
- Push-сценарии сейчас в основном относятся к обычному модулю задач; отдельного PPR push-контура нет.
- `middleware.ts` по-прежнему не включает `/ppr/*` и `/rounds/*` в `matcher`, поэтому доступ в эти модули обеспечивается server-side guards, query layer и RLS.
- В `object_rooms` временно сохранено legacy-поле `floor` как fallback для безопасной миграции и обратной совместимости.
