# Задачник эксплуатации

## 1. О проекте

`Задачник эксплуатации` — это приложение на `Next.js` и `Supabase` для двух связанных сценариев:

- оперативные эксплуатационные задачи;
- планово-предупредительные работы (ППР).

Проект использует `App Router`, серверные компоненты, `server actions`, `route handlers`, роли пользователей, `RLS` в Supabase, приватные storage-bucket'ы, `PWA`-обвязку и частичную offline-поддержку.

Сейчас репозиторий уже не ограничивается только модулем задач: модуль ППР является отдельной крупной подсистемой со своими страницами, доменной логикой, API, календарём, QR-entry и набором миграций.

## 2. Основные возможности

- Классический модуль задач: списки, фильтры, статусы, карточка задачи, команда, комментарии, история, вложения.
- Справочники пользователей и объектов для эксплуатационного контура.
- Журнал действий (`audit_log`) для административного контроля.
- Модуль ППР: структура объектов, системы, помещения, оборудование, шаблоны работ, назначения, календарь, lifecycle ППР-заявок.
- QR-вход в ППР для оборудования и активных ППР-заявок.
- Web Push для назначений в обычном модуле задач.
- PWA-режим с `manifest`, `service worker` и установкой на устройство.
- Частичный offline-режим через очередь действий в `localforage`.

## 3. Модуль задач

Обычный модуль задач расположен вокруг страниц:

- `/my` — основной рабочий список;
- `/new` — новые задачи;
- `/archive` — архив;
- `/tasks/create` — создание задачи;
- `/tasks/[id]` — карточка задачи.

Что реализовано:

- Статусы `new -> accepted -> in_progress -> paused -> done`.
- Назначение ответственного и управление командой задачи.
- Фильтры по статусу, приоритету, объекту, исполнителю, участнику команды и срокам.
- Сортировка и клиентская группировка списка.
- Комментарии и история изменений в карточке задачи.
- Фото-вложения к задаче и к комментариям.
- Ручной архив для `admin/chief` и автоархив через RPC/cron после `36` часов для завершённых задач.
- Push-уведомление при назначении исполнителя.

Вложения обычных задач хранятся в приватном bucket `task-attachments`, а пользователю выдаются через signed URL.

## 4. Модуль ППР

Модуль ППР расположен под `/ppr` и уже разбит на несколько подслоёв.

### Структура и справочники

- `/ppr/system-groups` — глобальный справочник групп систем.
- `/ppr/systems` — системы ППР с объектом, группой и ответственным.
- `/ppr/rooms` — общий справочник помещений объектов.
- `/ppr/equipment` и `/ppr/equipment/[id]` — оборудование, карточка оборудования и QR-код.

### Планирование

- `/ppr/templates` и `/ppr/templates/[id]` — шаблоны периодических работ.
- `/ppr/assignments` — назначения шаблонов на конкретное оборудование.
- `/ppr/calendar` — годовой обзор, месячные планы и переносы внутри месяца.

В коде ППР есть отдельные сущности для:

- шаблонов работ с периодичностью, базовой датой, нормо-часами, методикой и чек-листом;
- месячных планов и позиций плана;
- materialization позиций плана в ППР-заявки;
- cron-оркестрации через `/api/ppr/cron/run` и RPC-функции Supabase.

### Исполнение ППР

- `/ppr/tasks` — общий реестр активных ППР-заявок;
- `/ppr/my` — ППР-заявки, где пользователь является исполнителем;
- `/ppr/archive` — архив закрытых и отменённых ППР-заявок;
- `/ppr/tasks/[id]` — карточка ППР-заявки.

Lifecycle ППР-заявки:

- `new -> in_progress -> done -> closed`;
- возможна отмена в `cancelled`;
- перенос допустим для `new` и `in_progress`;
- завершение в `done` требует минимум один комментарий и минимум одно фото.

Для ППР-заявки реализованы:

- назначение исполнителя;
- комментарии;
- фото-вложения;
- snapshot work items из шаблонов;
- синхронизация статусов с позициями месячного плана.

### QR-entry

Реализованы:

- `/ppr/qr/[token]` — безопасная точка входа по токену;
- `/api/ppr/qr/[token]` — серверный redirect;
- разрешение QR в карточку оборудования или активной ППР-заявки.

Примечание: инфраструктура `ppr-files` и миграции предусматривают хранение файлов ППР шире, чем только задачи, но в текущем UI явно задействованы именно фото-вложения ППР-заявок.

## 5. Роли и права

Общие роли в системе:

- `admin`
- `chief`
- `lead`
- `engineer`
- `object_engineer`
- `tech`

### Обычный модуль задач

| Роль | Права |
|------|-------|
| `admin` | полный доступ, включая пользователей, объекты, журнал и архив |
| `chief` | полный рабочий доступ к задачам, пользователям, объектам и журналу |
| `lead` | создание и назначение задач, управление командой |
| `engineer` | создание задач, работа со своими задачами и командой |
| `object_engineer` | работа с задачами своего объекта, управление командой в объектном скоупе |
| `tech` | доступ только к назначенным задачам и участию в команде |

### Модуль ППР

| Роль | Права в ППР |
|------|-------------|
| `admin` | полный доступ ко всем экранам и операциям |
| `chief` | полный доступ ко всем экранам и операциям |
| `lead` | группы систем, структура, шаблоны, назначения, календарь, ППР-заявки, QR |
| `engineer` | ППР-заявки, QR, участие в исполнении; календарь только для систем, где пользователь ответственен |
| `object_engineer` | структура, шаблоны, назначения, календарь и ППР-заявки в пределах доступных объектов |
| `tech` | только слой ППР-заявок и QR без доступа к структуре и планированию |

Отдельно:

- `audit`, пользователи и объекты доступны только `admin/chief`;
- группы систем ППР доступны `admin/chief/lead`;
- структура ППР доступна `admin/chief/lead/object_engineer`;
- шаблоны и назначения ППР доступны `admin/chief/lead/object_engineer`;
- календарь ППР доступен `admin/chief/lead/object_engineer`, а для `engineer` ограничен ответственностью по системе.

## 6. Архитектура проекта

Проект организован по доменным слоям.

### UI и маршруты

- `app/` содержит страницы `App Router`, `route handlers` и `server actions`;
- `app/(dashboard)` — основной авторизованный shell;
- `app/api/tasks/*` и `app/api/ppr/*` — HTTP API для операций из клиентских компонентов;
- `app/actions/*` — серверные действия для форм и административных сценариев.

### Доменные компоненты

- `components/tasks/*` — UI обычного модуля задач;
- `components/ppr/*` — UI модуля ППР;
- `components/dashboard/*`, `components/ui/*`, `components/pwa/*`, `components/offline/*` — общий shell и инфраструктурные компоненты.

### Бизнес-логика

- `lib/auth.ts`, `lib/api-auth.ts` — получение профиля, сессии и базовых проверок доступа;
- `lib/tasks.ts`, `lib/task-permissions.ts`, `lib/task-sort.ts`, `lib/task-presentation.ts` — логика обычных задач;
- `lib/ppr/*` — доменная модель ППР: выборки, права, lifecycle, scheduler, QR, presentation, validators;
- `lib/audit.ts` — запись действий в журнал;
- `lib/attachments.ts` и `lib/ppr/files.ts` — работа с storage и signed URLs;
- `lib/offline/queue.ts` — offline-очередь.

### Данные и инфраструктура

- `Supabase Auth` — аутентификация;
- `Postgres + RLS` — основное хранилище и разграничение доступа;
- `Supabase Storage` — вложения обычных задач и файлов ППР;
- `public/sw.js` + `public/manifest.webmanifest` — PWA-часть;
- `Dockerfile`, `docker-compose.yml`, `Caddyfile` — контейнерный запуск и reverse proxy.

### Потоки данных

Основной путь выглядит так:

1. Страница или server action получает профиль пользователя.
2. Доменный слой в `lib/*` проверяет права и формирует запросы к Supabase.
3. Изменения пишутся в БД и при необходимости в `audit_log`.
4. Для файлов используются приватные bucket'ы и signed URL.
5. Для части операций обычных задач клиент умеет ставить действия в offline-очередь.

## 7. Структура каталогов

```text
app/
  (dashboard)/
    my, new, archive, tasks, users, objects, audit, profile
    ppr/
      system-groups, systems, rooms, equipment, templates
      assignments, calendar, tasks, my, archive, qr
  actions/
    auth-actions.ts
    task-actions.ts
    user-actions.ts
    object-room-actions.ts
    ppr-directory-actions.ts
    ppr-template-actions.ts
    ppr-calendar-actions.ts
    ppr-task-actions.ts
  api/
    tasks/*
    push/*
    cron/archive
    ppr/*

components/
  auth/
  dashboard/
  dictionaries/
  offline/
  ppr/
  pwa/
  tasks/
  ui/

lib/
  auth.ts
  api-auth.ts
  audit.ts
  attachments.ts
  objects.ts
  object-rooms.ts
  tasks.ts
  task-permissions.ts
  task-sort.ts
  task-presentation.ts
  offline/queue.ts
  ppr/
    files.ts
    permissions.ts
    presentation.ts
    qr.ts
    queries.ts
    scheduler.ts
    task-lifecycle.ts
    types.ts
    validators.ts
  supabase/
    admin.ts
    browser.ts
    server.ts

supabase/
  migrations/
    0001_init.sql
    ...
    0020_ppr_cleanup_legacy_structure.sql
  seed.sql
  push_subscriptions.sql

public/
  manifest.webmanifest
  sw.js
  icon.svg
```

## 8. Offline и PWA

Что есть сейчас:

- регистрация `service worker` в корневом layout;
- `manifest.webmanifest` и режим `standalone`;
- подписка на push через браузерный `PushManager`;
- queue на `localforage` с автосинком при событии `online`.

Что реально уходит в offline-очередь:

- `update_status` для обычных задач;
- `add_comment` для обычных задач.

Что важно понимать:

- offline-очередь не покрывает ППР, вложения, справочники и административные операции;
- `service worker` кэширует в основном статические ассеты (`manifest`, `icon`, `/_next/static/*`);
- полноценный offline-browse всех экранов сейчас не реализован.

## 9. Технологии

- `Next.js 15`
- `React 19`
- `TypeScript`
- `Supabase` (`Auth`, `Postgres`, `RLS`, `Storage`, `SSR client`)
- `Zod`
- `localforage`
- `web-push`
- `qrcode.react`
- `Docker` + `Caddy`

## 10. Запуск проекта

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

Репозиторий содержит миграции `supabase/migrations/0001_init.sql` ... `0020_ppr_cleanup_legacy_structure.sql`.

Рекомендуемый способ применения:

```bash
supabase db push
```

Если миграции применяются вручную через SQL Editor, их нужно запускать по порядку.

### Docker

В репозитории есть:

- `Dockerfile` c `next build` и `output: "standalone"`;
- `docker-compose.yml` для `app` и `caddy`.

Запуск:

```bash
docker compose up --build
```

### Cron и push

- `/api/cron/archive` архивирует завершённые обычные задачи;
- `/api/ppr/cron/run` запускает шаги ППР cron-оркестрации;
- для cron-маршрутов используется заголовок `x-cron-secret`;
- push начнёт работать только после настройки VAPID-переменных.

## 11. Текущие ограничения и заметки

- `offline` поддержка частичная и относится только к части операций обычных задач.
- `PWA` есть, но это не fully-offline приложение: большинство HTML/API-запросов всегда идут в сеть.
- Push-уведомления заведены для обычного модуля задач; отдельных push-сценариев для ППР в коде сейчас нет.
- В `middleware.ts` защищены маршруты обычного dashboard-контура, но `/ppr`-маршруты не входят в `matcher`; доступ к ППР всё равно проверяется на уровне страниц, API и server actions.
- Для обычных вложений есть поле `cleanup_after`, но автоматическое физическое удаление файлов пока не реализовано.
- Справочник помещений уже используется в ППР и явно подготовлен под будущий модуль обходов, которого в текущем репозитории ещё нет.
