# Implementation Blueprint модуля ППР

## 1. Назначение документа

Этот документ переводит утвержденные:

- `docs/PPR_ARCHITECTURE.md`
- `docs/PPR_DEVELOPMENT_PLAN.md`

в практический blueprint реализации.

Цель:

- определить точный порядок создания файлов
- зафиксировать состав файлов по слоям
- заранее разложить логику между `app/`, `components/`, `lib/`, `supabase/migrations/`
- исключить смешение ППР с текущим модулем `tasks`

---

## 2. Базовый принцип реализации

Модуль `ppr` реализуется как отдельный вертикальный доменный срез внутри текущего приложения.

Разделение слоев:

- `app/` — маршруты, страницы, route handlers, server actions
- `components/ppr/` — UI модуля ППР
- `lib/ppr/` — доменная логика, permissions, queries, scheduler, types
- `supabase/migrations/` — схема БД, helper functions, triggers, RLS

Правило:

- обычные `tasks` не используются
- таблицы `task_comments`, `task_attachments`, `task_team_members` не используются
- все рабочие сущности ППР используют свои `ppr_*` таблицы
- `ppr_month_plan_items -> ppr_tasks` — это связь `M:1`
- materialization идет по `(object_id, equipment_id, planned_for)`

---

## 3. Рекомендуемый порядок создания файлов

Реализация должна идти в следующем порядке:

1. `supabase/migrations/*` для структуры и базового RLS
2. `lib/ppr/types.ts`, `validators.ts`, `permissions.ts`
3. `lib/ppr/queries.ts`
4. `app/actions/ppr-directory-actions.ts`
5. страницы справочников `app/(dashboard)/ppr/*`
6. `components/ppr/*` для структуры и оборудования
7. шаблоны и назначения
8. календарь
9. заявки
10. QR и cron
11. финальная полировка navigation, filters, mobile UX

Такой порядок обязателен, потому что:

- UI не должен появляться раньше доменной схемы
- `queries` не должны писаться раньше стабильных типов
- заявки нельзя делать раньше календаря и назначений
- QR нельзя завершить раньше оборудования и активных заявок

---

## 4. Что создавать в `supabase/migrations/`

### 4.1 Общий принцип

Каждая миграция должна вводить логически завершенный кусок:

- таблицы
- ограничения
- индексы
- helper functions
- триггеры
- RLS-политики для уже введенных сущностей

Нельзя откладывать весь RLS на самый конец.

### 4.2 Что должно появиться в миграциях поэтапно

- структура и object-bound access
- оборудование и QR
- шаблоны и назначения
- календарь
- ППР-заявки вместе с attachment tables
- storage/bucket/policies
- финализация RLS
- cron/RPC

Подробный состав миграций вынесен в:

- `docs/PPR_DB_MIGRATIONS_PLAN.md`

---

## 5. Что создавать в `lib/ppr/`

### 5.1 `lib/ppr/types.ts`

Назначение:

- единый набор типов ППР
- типы для таблиц и UI DTO
- enum-like union types для статусов

Что должно быть внутри:

- `PprTaskStatus = "new" | "in_progress" | "done" | "closed" | "cancelled"`
- типы:
  - `PprSystemGroup`
  - `PprSystem`
  - `PprSubsystem`
  - `PprRoom`
  - `PprEquipment`
  - `PprWorkTemplate`
  - `PprEquipmentAssignment`
  - `PprMonthPlan`
  - `PprMonthPlanItem`
  - `PprTask`
  - `PprTaskWorkItem`
  - `PprTaskComment`
  - `PprTaskAttachment`

### 5.2 `lib/ppr/validators.ts`

Назначение:

- все Zod-схемы ППР

Что должно быть внутри:

- схемы для:
  - системы
  - подсистемы
  - помещения
  - оборудования
  - шаблона
  - назначения
  - календарного действия
  - назначения исполнителя
  - смены статуса
  - завершения
  - переноса
  - отмены
  - комментариев

### 5.3 `lib/ppr/permissions.ts`

Назначение:

- прикладной слой доступа на TypeScript-уровне
- зеркалирование ключевой логики RLS

Что должно быть внутри:

- функции:
  - `canReadPprObjectScope`
  - `canManagePprStructure`
  - `canManagePprTemplates`
  - `canManagePprAssignments`
  - `canManagePprCalendar`
  - `canAssignPprExecutor`
  - `canExecutePprTask`
  - `canClosePprTask`
  - `canCancelPprTask`
  - `canBeResponsibleForSystem`

Обязательные правила:

- `admin` — полный доступ
- `chief` — глобальный доступ ко всем объектам ППР
- `lead`, `engineer`, `object_engineer` — через `user_objects`, свои системы и свои заявки
- `tech` — только свои заявки

### 5.4 `lib/ppr/queries.ts`

Назначение:

- все серверные выборки для страниц и route handlers

Что должно быть внутри:

- выборки списков и карточек:
  - систем
  - подсистем
  - помещений
  - оборудования
  - шаблонов
  - назначений
  - календаря
  - активных ППР
  - архива
  - карточки ППР-заявки
  - представления `/ppr/tasks?view=review` для сценария "На ознакомлении"

Отдельно учитывать:

- `responsible_user_id` в `ppr_tasks` — это snapshot поля заявки
- UI и queries не должны ожидать live-sync с текущим `responsible_user_id` системы

### 5.5 `lib/ppr/scheduler.ts`

Назначение:

- orchestration-логика календаря и заявок на уровне приложения

Что должно быть внутри:

- подготовка аргументов для cron/RPC
- server-side glue logic для:
  - orchestration cron-run
  - materialization plan items
  - carryover
  - backfill по диапазону дат
  - синхронизации статусов plan items

### 5.6 `lib/ppr/qr.ts`

Назначение:

- резолв токена QR
- определение маршрута:
  - активная ППР-заявка
  - карточка оборудования

### 5.7 `lib/ppr/presentation.ts`

Назначение:

- UI metadata для модуля

Что должно быть внутри:

- мета статусов
- мета статусов оборудования
- мета признаков `is_overdue`, `is_rescheduled`
- подписи для экрана календаря и архива

---

## 6. Что создавать в `app/actions/`

### 6.1 `app/actions/ppr-directory-actions.ts`

Содержимое:

- CRUD для:
  - систем
  - подсистем
  - помещений
  - оборудования

Что должно быть внутри каждой action:

- `requireProfile()`
- `zod`-валидация
- permission check через `lib/ppr/permissions.ts`
- запрос в Supabase
- запись в `audit_log`
- `revalidatePath(...)`

### 6.2 `app/actions/ppr-template-actions.ts`

Содержимое:

- создание и редактирование шаблонов
- управление чек-листами
- назначение шаблонов на оборудование
- включение/отключение assignment

### 6.3 `app/actions/ppr-calendar-actions.ts`

Содержимое:

- ручное распределение работ по дням
- изменение даты в `ppr_month_plan_items`
- системные операции календаря, если не требуется отдельный API

### 6.4 `app/actions/ppr-task-actions.ts`

Содержимое:

- server actions для серверных форм карточки ППР
- закрытие заявки
- при необходимости быстрые server-only действия

Важно:

- upload файлов сюда не выносить
- cron сюда не выносить
- QR сюда не выносить

---

## 7. Что создавать в `app/api/ppr/`

### 7.1 `app/api/ppr/tasks/[id]/status/route.ts`

Назначение:

- смена статуса `new -> in_progress`
- смена статуса `in_progress -> done`

### 7.2 `app/api/ppr/tasks/[id]/assign/route.ts`

Назначение:

- назначение исполнителя на ППР-заявку

### 7.3 `app/api/ppr/tasks/[id]/reschedule/route.ts`

Назначение:

- перенос существующей заявки

### 7.4 `app/api/ppr/tasks/[id]/cancel/route.ts`

Назначение:

- отмена заявки
- фиксация `cancelled_at`
- фиксация `cancelled_by`

### 7.5 `app/api/ppr/tasks/[id]/comments/route.ts`

Назначение:

- общий комментарий по ППР-заявке

### 7.6 `app/api/ppr/tasks/[id]/attachments/route.ts`

Назначение:

- загрузка фото
- получение signed URLs

### 7.7 `app/api/ppr/qr/[token]/route.ts`

Назначение:

- резолв QR-токена
- безопасный редирект в активную заявку или карточку оборудования

### 7.8 `app/api/ppr/cron/run/route.ts`

Назначение:

- единый orchestration cron endpoint
- поддерживает ежедневный запуск и backfill по диапазону дат
- последовательно запускает:
  - carryover
  - materialization
  - sync plan item statuses
- пишет системный audit для cron-событий

Общий шаблон для всех route handlers:

- `getApiSession()` или проверка `x-cron-secret`
- `zod`-валидация
- permission check
- Supabase query/RPC
- `writeAudit(...)`
- `NextResponse.json(...)`

---

## 8. Что создавать в `app/(dashboard)/ppr/`

### 8.1 Общие страницы

- `app/(dashboard)/ppr/page.tsx`
  - entry point модуля
  - краткая сводка и быстрые переходы

- `app/(dashboard)/ppr/my/page.tsx`
  - мои ППР-заявки исполнителя

- `app/(dashboard)/ppr/tasks/page.tsx`
  - общий список активных ППР-заявок

- `app/(dashboard)/ppr/tasks/[id]/page.tsx`
  - карточка ППР-заявки

- `app/(dashboard)/ppr/archive/page.tsx`
  - архив ППР

### 8.2 Справочники

- `systems/page.tsx`
- `subsystems/page.tsx`
- `rooms/page.tsx`
- `equipment/page.tsx`
- `equipment/[id]/page.tsx`
- `templates/page.tsx`
- `templates/[id]/page.tsx`
- `assignments/page.tsx`

### 8.3 Календарь

- `calendar/page.tsx`

### 8.4 QR

- `qr/[token]/page.tsx`
  - при необходимости thin-page над route resolver

Общее содержимое каждой страницы:

- `requireProfile()`
- server-side data loading через `lib/ppr/queries.ts`
- проверка роли и доступа
- рендер `PageHeader`
- рендер соответствующих `components/ppr/*`

---

## 9. Что создавать в `components/ppr/`

Рекомендуемая структура:

```text
components/ppr/
  dashboard/
  systems/
  subsystems/
  rooms/
  equipment/
  templates/
  assignments/
  calendar/
  tasks/
  qr/
```

### 9.1 `components/ppr/dashboard/*`

Содержимое:

- карточки summary
- быстрые ссылки
- role-aware shortcuts

### 9.2 `components/ppr/systems/*`

Содержимое:

- список систем
- форма создания/редактирования
- responsible picker

### 9.3 `components/ppr/subsystems/*`

Содержимое:

- древовидное отображение
- форма создания узла
- действия перемещения/редактирования

### 9.4 `components/ppr/rooms/*`

Содержимое:

- список помещений
- формы CRUD

### 9.5 `components/ppr/equipment/*`

Содержимое:

- список оборудования
- карточка оборудования
- блок QR
- блок истории ППР
- placeholder-блок "История ремонтов"
- блок активных заявок

### 9.6 `components/ppr/templates/*`

Содержимое:

- список шаблонов
- карточка шаблона
- редактор чек-листа

### 9.7 `components/ppr/assignments/*`

Содержимое:

- список назначений
- форма назначения шаблона на оборудование

### 9.8 `components/ppr/calendar/*`

Содержимое:

- месячный календарь
- список month plan items
- диалог выбора даты

### 9.9 `components/ppr/tasks/*`

Содержимое:

- список ППР-заявок
- карточка ППР-заявки
- action panel
- assign executor form
- comment form
- attachments gallery
- done review section
- filter/view для "На ознакомлении" внутри `/ppr/tasks`

### 9.10 `components/ppr/qr/*`

Содержимое:

- UI состояния QR-перехода
- ошибки токена
- промежуточный loading/redirect UI

---

## 10. Как разложить логику по слоям

### 10.1 Что должно быть только в `app/`

- Next.js pages
- route handlers
- server actions
- маршрутизация и redirect
- `revalidatePath`

### 10.2 Что должно быть только в `components/`

- UI
- client-side state
- формы
- mobile interactions
- локальная визуальная логика

### 10.3 Что должно быть только в `lib/ppr/`

- правила доступа
- доменные выборки
- преобразования данных
- orchestration для cron / QR / календаря
- shared business logic

### 10.4 Что должно быть только в `supabase/migrations/`

- таблицы
- foreign keys
- check constraints
- unique constraints
- partial unique indexes
- triggers
- SQL helper functions
- RLS policies
- RPC functions

---

## 11. Минимальный file-by-file стартовый набор

Сначала создаются следующие файлы:

### 11.1 База и типы

- `supabase/migrations/0010_ppr_structure.sql`
- `lib/ppr/types.ts`
- `lib/ppr/validators.ts`
- `lib/ppr/permissions.ts`
- `lib/ppr/queries.ts`

### 11.2 Справочники

- `app/actions/ppr-directory-actions.ts`
- `app/(dashboard)/ppr/page.tsx`
- `app/(dashboard)/ppr/systems/page.tsx`
- `app/(dashboard)/ppr/subsystems/page.tsx`
- `app/(dashboard)/ppr/rooms/page.tsx`
- `app/(dashboard)/ppr/equipment/page.tsx`
- `app/(dashboard)/ppr/equipment/[id]/page.tsx`
- `components/ppr/systems/*`
- `components/ppr/subsystems/*`
- `components/ppr/rooms/*`
- `components/ppr/equipment/*`

### 11.3 Шаблоны и назначения

- `supabase/migrations/0012_ppr_templates_assignments.sql`
- `app/actions/ppr-template-actions.ts`
- `app/(dashboard)/ppr/templates/page.tsx`
- `app/(dashboard)/ppr/templates/[id]/page.tsx`
- `app/(dashboard)/ppr/assignments/page.tsx`
- `components/ppr/templates/*`
- `components/ppr/assignments/*`

Правило применения:

- `0012_ppr_templates_assignments.sql` применяется целиком на этом шаге
- следующий шаг по назначениям не создает новую миграцию, а только добавляет UI/actions/queries поверх уже введенной схемы

### 11.4 Календарь

- `supabase/migrations/0013_ppr_calendar.sql`
- `app/actions/ppr-calendar-actions.ts`
- `app/(dashboard)/ppr/calendar/page.tsx`
- `components/ppr/calendar/*`
- `lib/ppr/scheduler.ts`

### 11.5 Заявки

- `supabase/migrations/0014_ppr_tasks.sql`
- `app/actions/ppr-task-actions.ts`
- `app/api/ppr/tasks/[id]/status/route.ts`
- `app/api/ppr/tasks/[id]/assign/route.ts`
- `app/api/ppr/tasks/[id]/reschedule/route.ts`
- `app/api/ppr/tasks/[id]/cancel/route.ts`
- `app/api/ppr/tasks/[id]/comments/route.ts`
- `app/api/ppr/tasks/[id]/attachments/route.ts`
- `app/(dashboard)/ppr/my/page.tsx`
- `app/(dashboard)/ppr/tasks/page.tsx`
- `app/(dashboard)/ppr/tasks/[id]/page.tsx`
- `app/(dashboard)/ppr/archive/page.tsx`
- `components/ppr/tasks/*`

### 11.6 QR и cron

- `supabase/migrations/0015_ppr_files.sql`
- `supabase/migrations/0017_ppr_cron_rpc.sql`
- `app/api/ppr/qr/[token]/route.ts`
- `app/api/ppr/cron/run/route.ts`
- `lib/ppr/qr.ts`

---

## 12. Что должно заработать по итогам blueprint

После реализации по этому blueprint должны появиться следующие рабочие контуры:

- структура ППР
- оборудование и QR
- шаблоны и назначения
- календарь месяца
- ППР-заявки
- перенос, отмена, закрытие
- комментарии и фото
- archive flow
- role-aware доступ с учетом:
  - `admin`
  - `chief` как глобальной роли ППР
  - `object_engineer` как отдельной объектовой роли

---

## 13. Границы blueprint

Этот документ не заменяет:

- детальный состав SQL миграций
- практическое разбиение на маленькие батчи реализации

Для этого использовать:

- `docs/PPR_DB_MIGRATIONS_PLAN.md`
- `docs/PPR_EXECUTION_BATCHES.md`
