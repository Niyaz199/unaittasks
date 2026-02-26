# Задачник эксплуатации (PWA)

Система учёта эксплуатационных задач с ролями, RLS и офлайн-режимом.

## Что это

PWA на Next.js + Supabase. Задачи со статусами (new → in_progress → paused → done), карточки с комментариями и историей, команды задач, справочники объектов и пользователей. Audit log, Web Push, офлайн-очередь (LocalForage) с синком при восстановлении сети.

## Основные возможности

- **Мои / Новые / Архив** — списки задач с фильтрами, поиском, сортировкой; кнопка «В работу» для новых
- **Карточка задачи** — статус, пауза (причина + дата возобновления), команда, комментарии, история
- **Создание задачи** — объект, приоритет, срок, исполнитель, команда; push назначаемому
- **Объекты** — CRUD, привязка инженера объекта
- **Пользователи** — CRUD, роли, привязка инженеров к объектам
- **Журнал действий** — admin/chief
- **PWA** — Service Worker, manifest, установка на главный экран
- **Офлайн** — очередь `update_status` и `add_comment`; синк при `online`

## Быстрый старт

```bash
npm install
copy .env.example .env
npm run dev
```

Заполнить `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.  
Опционально: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.

Применить миграции `supabase/migrations/0001_init.sql` … `0004_*.sql` в Supabase.

→ http://localhost:3000

## Структура проекта

```
app/(dashboard)/    # Страницы: my, new, archive, tasks, audit, users, objects, profile
app/api/            # tasks (status, pause, comments, team), push, cron/archive
app/actions/        # Server actions (task, user, auth)
components/         # UI: task-list, status-control, comment-form, login-form и др.
lib/                # tasks, auth, task-permissions, audit, push, offline/queue
supabase/migrations # SQL (0001–0004)
public/             # PWA manifest, sw.js, иконки
```

## Роли и права

| Роль | Описание |
|------|----------|
| `admin` | Всё: пользователи, объекты, задачи, audit |
| `chief` | Всё, кроме супер-прав (users, objects, audit, задачи) |
| `lead` | Создание/назначение задач, управление командой |
| `engineer` | Свои задачи: статус, пауза, комментарии |
| `object_engineer` | Задачи своего объекта + управление командой по объекту |
| `tech` | Ограниченный доступ (по user_objects/назначению) |

- **Журнал действий:** `admin`, `chief`
- **Пользователи, объекты:** `admin`, `chief`
- **Создание/редактирование задач:** `admin`, `chief`, `lead`, `engineer`, `object_engineer`
- **Управление командой задачи:** `admin`, `chief`, `lead`, `engineer`, `object_engineer` (object_engineer — только свои объекты)
