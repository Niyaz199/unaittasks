# Архитектурная карта: Задачник эксплуатации

> Версия: март 2026. Обновляй при добавлении новых модулей.

---

## 1. Что это за проект

**Задачник эксплуатации** (`ops-tasker-pwa`) — корпоративный PWA-таскменеджер для инженерных команд.
Система позволяет создавать и вести задачи по объектам инфраструктуры, назначать ответственных, ставить задачи на паузу с указанием причины и времени возобновления, добавлять комментарии и управлять командой задачи.
Ключевые модули: **задачи** (создание/статусы/приоритеты/пауза), **объекты** (привязка задач к инфраструктурным объектам), **команда задачи** (участники-наблюдатели), **push-уведомления** (Web Push через VAPID), **PWA/SW** (офлайн-работа, кэширование, установка на рабочий стол), **авторизация и роли** (6 ролей с разграничением прав через RLS).

---

## 2. Технологический стек

| Слой | Технология | Версия / Примечание |
|---|---|---|
| Frontend фреймворк | **Next.js 15**, App Router, Server Components, Server Actions | `output: "standalone"` |
| Язык | **TypeScript 5** | strict, typed routes |
| UI | React 19, собственные компоненты (без UI-библиотек) | |
| База данных | **Supabase** (PostgreSQL + Auth + RLS) | `@supabase/ssr`, `@supabase/supabase-js` |
| Push-уведомления | **Web Push / VAPID** | `web-push ^3.6.7` |
| Офлайн-хранилище | **localforage** (IndexedDB) | очередь `ops-tasker/pending_actions` |
| Валидация | **Zod** | схемы в Server Actions и API routes |
| PWA | Service Worker (`public/sw.js`), Web App Manifest | кэш `ops-tasker-v2` |
| Контейнеризация | **Docker** (multi-stage Dockerfile) + **Docker Compose** | `app` + `caddy` |
| Reverse proxy / TLS | **Caddy 2** | автоматический HTTPS, домен `unaittasks.tech` |

---

## 3. Структура репозитория

```
d:\zadachnik\
├── app/                            # Next.js App Router
│   ├── layout.tsx                  # Root layout (html/body, RegisterSW, OfflineSyncBootstrap)
│   ├── page.tsx                    # Корень → редирект /my или /login
│   ├── login/
│   │   └── page.tsx                # Страница входа
│   ├── (dashboard)/                # Route group: общий layout с навигацией
│   │   ├── layout.tsx              # Dashboard layout (MainNav, MobileTabs, auth-guard)
│   │   ├── my/page.tsx             # Мои задачи (фильтры, сортировка, KPI)
│   │   ├── new/page.tsx            # Новые задачи
│   │   ├── archive/page.tsx        # Архив задач
│   │   ├── tasks/
│   │   │   ├── [id]/page.tsx       # Карточка задачи
│   │   │   └── create/page.tsx     # Создание задачи
│   │   ├── objects/
│   │   │   ├── page.tsx            # Список объектов
│   │   │   └── create/page.tsx     # Создание объекта
│   │   ├── users/
│   │   │   ├── page.tsx            # Список пользователей
│   │   │   └── create/page.tsx     # Создание пользователя
│   │   ├── audit/page.tsx          # Журнал действий (admin/chief)
│   │   └── profile/page.tsx        # Профиль пользователя
│   ├── actions/                    # Server Actions
│   │   ├── task-actions.ts         # takeTaskInWork, createTaskAction, addTaskComment, pauseTask, управление командой ...
│   │   ├── user-actions.ts         # createUserAction, updateUserAction, deleteUserAction
│   │   └── auth-actions.ts         # signOutAction
│   └── api/                        # API Routes (Edge/Node handlers)
│       ├── tasks/[id]/
│       │   ├── status/route.ts     # POST: смена статуса
│       │   ├── pause/route.ts      # POST: пауза задачи (RPC pause_task)
│       │   ├── comments/route.ts   # POST: добавить комментарий + push наблюдателям
│       │   ├── history/route.ts    # GET: история из audit_log
│       │   └── team/route.ts       # POST/DELETE: управление командой
│       ├── push/
│       │   ├── subscribe/route.ts  # POST: сохранить push-подписку
│       │   ├── test/route.ts       # POST: тестовый push
│       │   └── send-assignment/route.ts  # POST: push при назначении задачи
│       └── cron/
│           └── archive/route.ts    # POST: архивировать done-задачи (x-cron-secret)
│
├── components/                     # React-компоненты
│   ├── auth/
│   │   └── login-form.tsx          # Форма входа (client)
│   ├── tasks/
│   │   ├── task-list.tsx           # Список задач с сортировкой
│   │   ├── task-filters.tsx        # Фильтры + KPI-виджет
│   │   ├── filters-drawer.tsx      # Мобильная панель фильтров
│   │   ├── task-action-menu.tsx    # Контекстное меню задачи
│   │   ├── status-control.tsx      # Переключатель статуса + модалка паузы (offline-aware)
│   │   ├── create-task-form.tsx    # Форма создания задачи
│   │   ├── comment-form.tsx        # Форма комментария (offline-aware, clientMsgId)
│   │   ├── task-team-manager.tsx   # Управление командой
│   │   └── team-members-picker.tsx # Пикер участников
│   ├── dictionaries/
│   │   ├── objects-admin-list.tsx  # CRUD объектов
│   │   └── users-admin-list.tsx    # CRUD пользователей
│   ├── dashboard/
│   │   ├── main-nav.tsx            # Боковое меню (desktop)
│   │   ├── nav-shell.tsx           # Обёртка nav (usePathname)
│   │   └── mobile-tabs.tsx         # Нижние табы (mobile)
│   ├── ui/                         # Базовые UI-примитивы
│   │   ├── badge.tsx               # Бейдж (tone: neutral/info/warning/success/danger/violet)
│   │   ├── modal.tsx               # Модальное окно
│   │   ├── data-table.tsx          # Таблица данных
│   │   ├── empty-state.tsx         # Пустое состояние
│   │   ├── page-header.tsx         # Заголовок страницы
│   │   ├── section-card.tsx        # Карточка-секция
│   │   └── assignee-combobox.tsx   # Комбобокс исполнителя
│   ├── pwa/
│   │   └── register-sw.tsx         # Регистрация SW + подписка Web Push (client)
│   └── offline/
│       └── offline-sync-bootstrap.tsx  # Слушает событие online → flushQueue()
│
├── lib/                            # Утилиты и бизнес-логика (серверные)
│   ├── types.ts                    # Все TS-типы: Role, TaskStatus, TaskItem, Profile ...
│   ├── auth.ts                     # getSessionUser, requireAuth, getMyProfile, canView* ...
│   ├── api-auth.ts                 # getApiSession — user+profile для API routes
│   ├── tasks.ts                    # listTasksForProfile, getTaskByIdForProfile, getTaskHistory*
│   ├── objects.ts                  # listObjectsForProfile (с учётом роли)
│   ├── task-permissions.ts         # canAssignRole, isTaskParticipant, canChangeTaskStatus ...
│   ├── audit.ts                    # writeAudit(actorId, action, entityType, entityId, meta)
│   ├── push.ts                     # sendPushToUser(userId, payload) — через admin-клиент
│   ├── task-presentation.ts        # taskStatusMeta, taskPriorityMeta — UI-метки и цвета
│   ├── task-sort.ts                # smartSortTasks, sortTasks, isOverdue, isDueToday
│   ├── offline/
│   │   └── queue.ts                # enqueueAction, flushQueue — IndexedDB-очередь
│   └── supabase/
│       ├── server.ts               # createSupabaseServerClient — SSR (cookies)
│       ├── browser.ts              # createSupabaseBrowserClient — клиентский
│       └── admin.ts                # createSupabaseAdminClient — service role
│
├── supabase/                       # SQL-миграции (порядок по номеру)
│   ├── 0001_initial.sql            # Все таблицы, функции, RLS, триггеры
│   ├── 0002_objects.sql            # object_engineer_id на таблице objects
│   ├── 0003_pause.sql              # resume_at на tasks, RPC pause_task
│   ├── 0004_audit_rls.sql          # Расширение RLS для audit_log
│   └── push_subscriptions.sql      # Таблица push_subscriptions (применена отдельно)
│
├── public/                         # Статические файлы
│   ├── sw.js                       # Service Worker (кэш + push handler)
│   ├── manifest.webmanifest        # PWA-манифест
│   └── icon.svg                    # Иконка приложения
│
├── docs/
│   ├── ARCHITECTURE.md             # ← этот файл
│   └── FEATURES.md                 # Описание фич
│
├── middleware.ts                   # Auth middleware: защищает /my, /tasks/*, /objects/*, ...
├── next.config.ts                  # output: standalone, заголовки sw.js
├── Dockerfile                      # Multi-stage build (Next.js standalone)
├── docker-compose.yml              # app (port 3000) + caddy (80/443)
├── Caddyfile                       # unaittasks.tech → reverse_proxy app:3000
├── .env.example                    # Шаблон переменных окружения
└── package.json
```

---

## 4. Модель данных

### Таблицы и ключевые поля

#### `profiles` — пользователи системы
```sql
id          uuid  PK, REFERENCES auth.users(id)
full_name   text  NOT NULL
role        text  CHECK ('admin','chief','lead','engineer','object_engineer','tech')
created_at  timestamptz
```
Роль хранится здесь. Нет отдельной таблицы ролей.

#### `objects` — объекты инфраструктуры
```sql
id                    uuid  PK
name                  text  UNIQUE NOT NULL
object_engineer_id    uuid  REFERENCES profiles(id)  -- ответственный инженер
created_by            uuid  REFERENCES profiles(id)
created_at            timestamptz
```

#### `user_objects` — доступ пользователей к объектам
```sql
user_id    uuid  REFERENCES profiles(id)
object_id  uuid  REFERENCES objects(id)
PRIMARY KEY (user_id, object_id)
```

#### `tasks` — задачи
```sql
id            uuid  PK
title         text  NOT NULL
description   text
object_id     uuid  REFERENCES objects(id) NOT NULL
status        text  CHECK ('new','in_progress','paused','done')  DEFAULT 'new'
priority      text  CHECK ('low','medium','high','critical')      DEFAULT 'medium'
due_at        timestamptz   -- срок выполнения
resume_at     timestamptz   -- время возобновления из паузы
created_by    uuid  REFERENCES profiles(id)
assigned_to   uuid  REFERENCES profiles(id)
accepted_at   timestamptz   -- авто: триггер при переходе в in_progress
completed_at  timestamptz   -- авто: триггер при переходе в done
archived_at   timestamptz   -- авто: cron-архивация
```
Статусы: `new` → `in_progress` → `done` (→ архив). Из любого состояния — `paused` (с `resume_at`).

#### `task_team_members` — команда задачи
```sql
task_id   uuid  REFERENCES tasks(id)
user_id   uuid  REFERENCES profiles(id)
added_by  uuid  REFERENCES profiles(id)
PRIMARY KEY (task_id, user_id)
```

#### `task_comments` — комментарии
```sql
id             uuid  PK
task_id        uuid  REFERENCES tasks(id) ON DELETE CASCADE
author_id      uuid  REFERENCES profiles(id)
body           text  NOT NULL
client_msg_id  text  -- дедупликация офлайн-сообщений
created_at     timestamptz
UNIQUE (task_id, author_id, client_msg_id) WHERE client_msg_id IS NOT NULL
```

#### `audit_log` — журнал действий
```sql
id           uuid  PK
actor_id     uuid  -- NULL для системных событий
action       text  -- 'create_task','status_change','comment','pause_task' и др.
entity_type  text  -- 'task'|'object'|'user'|'comment'
entity_id    uuid
meta         jsonb
created_at   timestamptz
```

#### `push_subscriptions` — Web Push подписки
```sql
id        uuid  PK
user_id   uuid  REFERENCES profiles(id) ON DELETE CASCADE
endpoint  text  NOT NULL
p256dh    text  NOT NULL
auth      text  NOT NULL
UNIQUE (user_id, endpoint)
```

### Матрица ролей

| Роль | Создаёт задачи | Видит задачи | Объекты / Пользователи | Аудит |
|---|---|---|---|---|
| `admin` | Всё | Всё | Полный CRUD | Полный |
| `chief` | Всё | Всё | Полный CRUD | Полный |
| `lead` | Да (assign до engineer) | Свои + командные | Только чтение | История своих задач |
| `engineer` | Нет | Своего объекта + командные | Нет | История своих задач |
| `object_engineer` | Нет | Задачи своего объекта | Нет | История своих задач |
| `tech` | Нет | Только назначенные / командные | Нет | Нет |

---

## 5. Потоки данных

### 5.1 Создание задачи

```
Пользователь (lead/admin/chief)
  → CreateTaskForm (components/tasks/create-task-form.tsx)
    → Server Action: createTaskAction (app/actions/task-actions.ts)
      → Supabase INSERT tasks (RLS: can_create_task())
      → writeAudit('create_task', ...)
      → sendPushToUser(assigned_to, { title, url })   ← lib/push.ts → web-push
      → redirect /tasks/[id]
```

### 5.2 Комментарий к задаче

```
Пользователь
  → CommentForm (offline-aware, clientMsgId)
    online:  POST /api/tasks/[id]/comments
    offline: enqueueAction('add_comment', ...) → IndexedDB
             при online: flushQueue() → POST ...
  → API route (app/api/tasks/[id]/comments/route.ts)
      → Supabase INSERT task_comments (уникальный client_msg_id → дедупликация)
      → writeAudit('comment', ...)
      → sendPushToUser(каждый участник команды + assigned_to, { title, url })
```

### 5.3 Смена статуса задачи

```
Пользователь
  → StatusControl (components/tasks/status-control.tsx)
    online:  POST /api/tasks/[id]/status
    offline: enqueueAction('update_status', ...)
  → API route: обновляет tasks.status
      → Триггер enforce_task_update_rules: авто-заполняет accepted_at / completed_at
      → writeAudit('status_change', ...)
      → sendPushToUser(created_by + team, { title })
```

### 5.4 Пауза задачи

```
Пользователь → StatusControl → модалка паузы (reason, resumeAt)
  → POST /api/tasks/[id]/pause
    → Supabase RPC pause_task(task_id, reason, resume_at)
       (атомарно: UPDATE tasks + INSERT task_comments + INSERT audit_log)
    → sendPushToUser(...)
```

### 5.5 PWA: регистрация и подписка

```
Браузер загружает app/layout.tsx
  → <RegisterSW /> (components/pwa/register-sw.tsx, client component)
    → navigator.serviceWorker.register('/sw.js')
    → pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
    → POST /api/push/subscribe { endpoint, p256dh, auth }
      → Supabase INSERT push_subscriptions (upsert по user_id+endpoint)
```

### 5.6 Доставка push-уведомления

```
API route / Server Action
  → lib/push.ts: sendPushToUser(userId, payload)
    → createSupabaseAdminClient()                   ← обходит RLS
    → SELECT push_subscriptions WHERE user_id = ...
    → webpush.sendNotification(subscription, payload)
sw.js: событие 'push'
  → self.registration.showNotification(title, { body, data.url })
sw.js: событие 'notificationclick'
  → clients.openWindow(data.url)
```

### 5.7 Cron-архивация

```
Внешний планировщик
  → POST /api/cron/archive  (заголовок x-cron-secret)
    → Supabase RPC archive_done_tasks(36)
       (архивирует done-задачи старше 36 часов)
```

---

## 6. Безопасность и права

### Middleware (защита маршрутов)
`middleware.ts` проверяет наличие cookie вида `*-auth-token` (Supabase сессия).
Защищены: `/my`, `/new`, `/archive`, `/tasks/:path*`, `/objects/:path*`, `/users/:path*`, `/audit`, `/profile`.
Незащищено: `/login`, `/api/*` (API routes проверяют авторизацию самостоятельно).

### Серверная идентификация пользователя
- В **Server Components / Server Actions**: `lib/auth.ts` → `getSessionUser()` → `createSupabaseServerClient()` (читает cookie через `next/headers`).
- В **API Routes**: `lib/api-auth.ts` → `getApiSession()` — возвращает `{ user, profile }`.
- **Нельзя** доверять данным из тела запроса для определения actor_id — всегда берётся из сессии.

### RLS (Row Level Security)
Включён на всех таблицах. Ключевые функции безопасности в PostgreSQL:
- `can_read_task(task)` — видимость задачи по роли и участию
- `can_update_task(task)` — обновление задачи
- `can_change_status(task)` — смена статуса
- `can_manage_task_team(task)` — управление командой

### Service Role (обход RLS)
`lib/supabase/admin.ts` (`createSupabaseAdminClient`) используется **только** в:
- `lib/push.ts` — чтение push_subscriptions всех пользователей (по userId переданному от API)
- `app/api/push/subscribe/route.ts` — вставка подписки (upsert)
- `app/api/cron/archive/route.ts` — вызов архивирующей RPC
- `app/actions/user-actions.ts` — создание пользователей через `auth.admin`

Service Role **никогда** не передаётся клиенту и не попадает в Client Components.

### Авторизация API routes
Каждый route проверяет сессию через `getApiSession()`. При отсутствии сессии → `401 Unauthorized`.
Cron-эндпоинт `/api/cron/archive` дополнительно проверяет заголовок `x-cron-secret === process.env.CRON_SECRET`.

---

## 7. Производительность

### Server vs Client Components
По умолчанию все компоненты в `app/` — **Server Components** (данные фетчатся на сервере, HTML приходит готовым). Client Components (`"use client"`) только там, где нужна интерактивность или браузерное API:
- `components/tasks/status-control.tsx` — оптимистичные обновления, модалка
- `components/tasks/comment-form.tsx` — форма с состоянием
- `components/pwa/register-sw.tsx` — работа с navigator.serviceWorker
- `components/offline/offline-sync-bootstrap.tsx` — window.addEventListener('online', ...)
- `components/dashboard/nav-shell.tsx` — `usePathname`

### Loading / Skeleton
Каждая страница в `(dashboard)/` может иметь `loading.tsx` рядом — Next.js автоматически показывает его как Suspense-fallback во время загрузки Server Component.

### Кэширование статики (SW)
`public/sw.js` кэширует `/_next/static/**` и `manifest.webmanifest` (стратегия Cache First). HTML-страницы и RSC-запросы всегда идут в сеть (Network First).

---

## 8. Как добавить новый модуль

### 8.1 Новая страница

1. Создай файл `app/(dashboard)/<module>/page.tsx` (Server Component).
2. Если нужна загрузка — добавь `app/(dashboard)/<module>/loading.tsx`.
3. Если нужна защита по роли — в начале page.tsx вызови `requireProfile()` из `lib/auth.ts` и проверь `profile.role`.
4. Добавь ссылку в `components/dashboard/main-nav.tsx` и `components/dashboard/mobile-tabs.tsx`.

```typescript
// app/(dashboard)/reports/page.tsx
import { requireProfile } from '@/lib/auth'

export default async function ReportsPage() {
  const profile = await requireProfile()
  // ...
}
```

### 8.2 Новые компоненты

- **Серверные** (данные из БД, нет интерактивности) → `components/<module>/`.
- **Клиентские** (формы, состояние, анимации) → `components/<module>/`, добавить `"use client"` первой строкой.
- UI-примитивы (кнопки, карточки) → `components/ui/`.

### 8.3 API Route

Создай `app/api/<module>/route.ts`:

```typescript
import { getApiSession } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { user, profile } = await getApiSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // ...
}
```

### 8.4 Server Action

Добавь функцию в `app/actions/<module>-actions.ts`:

```typescript
'use server'
import { requireProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export async function createReportAction(data: FormData) {
  const profile = await requireProfile()
  // INSERT в БД ...
  await writeAudit(profile.id, 'create_report', 'report', newId, {})
  revalidatePath('/reports')
}
```

### 8.5 Новая таблица и RLS

1. Создай файл `supabase/0005_<name>.sql`:

```sql
-- Новая таблица
CREATE TABLE reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES profiles(id),
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Включить RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Политики
CREATE POLICY "Авторизованные видят отчёты"
  ON reports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Создаёт автор"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = created_by);
```

2. Применить к Supabase: `supabase db push` или выполнить SQL вручную через дашборд.

### 8.6 Push-уведомления для нового события

В API route или Server Action после совершения действия вызови `sendPushToUser`:

```typescript
import { sendPushToUser } from '@/lib/push'

await sendPushToUser(recipientUserId, {
  title: 'Новый отчёт',
  body: 'Создан новый отчёт: ...',
  url: `/reports/${reportId}`,
})
```

Уведомление отобразится через `sw.js` (обработчик `push` уже реализован).

### 8.7 Не сломать PWA

- **Не добавляй** статические файлы с изменяемым содержимым в список кэша `sw.js` без инвалидации версии кэша (`ops-tasker-v2` → `ops-tasker-v3`).
- Заголовки для файлов, которые должны обновляться без перезагрузки SW, настраивай в `next.config.ts`.
- Если добавляешь новый файл в `public/`, который должен работать офлайн — добавь его в `STATIC_ASSETS` внутри `sw.js`.
- `register-sw.tsx` — единственное место регистрации SW; не регистрируй SW повторно из других компонентов.

---

## 9. Переменные окружения

| Переменная | Где используется | Обязательна |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Везде (browser + server) | Да |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-клиент, SSR-клиент | Да |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts` (только server) | Да |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `components/pwa/register-sw.tsx` (browser) | Да |
| `VAPID_PUBLIC_KEY` | `lib/push.ts` (server) | Да |
| `VAPID_PRIVATE_KEY` | `lib/push.ts` (server) | Да |
| `VAPID_SUBJECT` | `lib/push.ts` (server, mailto:) | Да |
| `CRON_SECRET` | `/api/cron/archive` (server) | Да |

> `NEXT_PUBLIC_*` переменные попадают в клиентский бандл. Никогда не помечай `SUPABASE_SERVICE_ROLE_KEY` или `VAPID_PRIVATE_KEY` префиксом `NEXT_PUBLIC_`.

---

## 10. Технический долг и точки для улучшения

### 10.1 Дублирование VAPID ключа
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` и `VAPID_PUBLIC_KEY` содержат одно и то же значение — публичный VAPID-ключ. Это вынуждено разделением browser/server контекста в Next.js, но стоит добавить в документацию `.env.example` явный комментарий об этом, чтобы новые разработчики не терялись.

### 10.2 Миграции применяются вручную
`push_subscriptions.sql` применена отдельно от нумерованных файлов `0001–0004`. Лучше перенести её содержимое в `0005_push_subscriptions.sql` и применять только через нумерованный пайплайн.

### 10.3 Нет автоматического запуска cron
`/api/cron/archive` требует внешнего вызова (curl/cron-сервис). Не задокументирован способ настройки — стоит добавить пример в `docs/` или `README.md` (например, конфиг для Vercel Cron или systemd-timer).

### 10.4 Нет миграционного инструмента
Миграции — обычные `.sql` файлы без инструмента версионирования (Flyway, supabase CLI migrations). Стоит перейти на `supabase migrations` (`supabase/migrations/`) и отслеживать применённые версии через таблицу `supabase_migrations`.

### 10.5 Отсутствует обработка истёкших push-подписок
`lib/push.ts` не удаляет подписки, вернувшие HTTP 410 (Gone) от push-сервиса. Со временем таблица `push_subscriptions` будет копить мёртвые записи — стоит добавить обработку ошибок `410` с удалением записи.

### 10.6 `loading.tsx` не реализованы для всех страниц
Skeleton-loading есть не везде. Рекомендуется добавить для страниц с тяжёлыми запросами (`/audit`, `/tasks/[id]`).
