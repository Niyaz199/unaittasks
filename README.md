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

## Enable Web Push (Production)

Web Push уведомления отправляются при назначении задачи исполнителю. Без VAPID-ключей приложение работает в штатном режиме, пуши просто не отправляются.

### Шаг 1 — Сгенерировать VAPID-ключи (один раз на проект)

```bash
npx web-push generate-vapid-keys
```

Вывод примерно такой:

```
Public Key:
BG...long_base64_string...

Private Key:
abc...short_base64...
```

### Шаг 2 — Прописать ключи

**Локально** — в `.env.local` (не коммитить в git):

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BG...   # публичный ключ из шага 1
VAPID_PUBLIC_KEY=BG...               # та же строка, для серверного webpush
VAPID_PRIVATE_KEY=abc...             # приватный ключ из шага 1
VAPID_SUBJECT=mailto:your@email.com  # ваш контактный адрес
```

**На VPS / Docker Compose** — добавить те же переменные в `.env` рядом с `docker-compose.yml` или в секцию `environment:` сервиса:

```yaml
environment:
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BG..."
  VAPID_PUBLIC_KEY: "BG..."
  VAPID_PRIVATE_KEY: "abc..."
  VAPID_SUBJECT: "mailto:your@email.com"
```

**Vercel** — Settings → Environment Variables, добавить все четыре переменные для Production.

> ⚠️ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` и `VAPID_PUBLIC_KEY` должны содержать **одно и то же** значение.  
> `VAPID_PRIVATE_KEY` — только серверная переменная, никогда не добавлять `NEXT_PUBLIC_` префикс.

### Шаг 3 — Применить SQL в Supabase

Таблица `push_subscriptions` уже включена в `supabase/migrations/0001_init.sql`.  
Если применяете миграции через Supabase CLI:

```bash
supabase db push
```

Если таблица отсутствует или нужно пересоздать — выполнить вручную через Supabase SQL Editor:

```bash
# содержимое файла:
cat supabase/push_subscriptions.sql
```

Вставить содержимое файла `supabase/push_subscriptions.sql` в SQL Editor Supabase и нажать Run.

### Шаг 4 — Проверить

1. Открыть приложение в браузере, войти в систему.
2. Браузер запросит разрешение на уведомления — нажать «Разрешить».
3. Проверить, что подписка сохранилась в Supabase:
   ```sql
   select user_id, endpoint, created_at from push_subscriptions;
   ```
4. Отправить тестовое уведомление себе:
   ```bash
   curl -X POST https://your-domain.com/api/push/test \
     -H "Cookie: <скопировать из браузера>" \
     -H "Content-Type: application/json"
   ```
   Ожидаемый ответ:
   ```json
   { "ok": true, "message": "Sent 1 of 1 notification(s).", "result": { "total": 1, "sent": 1, "failed": 0, "cleaned": 0, "errors": [] } }
   ```
5. На устройстве должно появиться push-уведомление «Тест уведомлений».

### Платформенные ограничения

| Платформа | Требование |
|-----------|-----------|
| iOS Safari | iOS 16.4+, PWA добавлена на экран домой («Add to Home Screen») |
| Android Chrome | Работает без установки на экран домой |
| Desktop Chrome/Firefox/Edge | Работает при открытом браузере |
| HTTP (не HTTPS) | Не работает нигде, кроме `localhost` |

---

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
