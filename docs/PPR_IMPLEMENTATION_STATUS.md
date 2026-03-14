# Статус реализации модуля ППР

## 1. Назначение документа

Этот документ фиксирует, что уже реализовано в модуле `ppr` по фактическому состоянию репозитория.

Документ нужен как краткая сводка:

- какие батчи уже закрыты
- какие внеплановые фиксы были сделаны
- какие ключевые сценарии уже работают
- на какой точке находится repo state сейчас

---

## 2. Текущий статус

По текущему состоянию репозитория реализованы:

- `Batch 1` — каркас модуля
- `Batch 2` — базовая структура БД и ранний RLS
- `Batch 3` — CRUD структуры
- `Batch 4` — оборудование и QR-данные
- `Batch 5` — шаблоны ППР
- `Batch 6` — назначения шаблонов на оборудование
- `Batch 7` — календарь и month plan
- `Batch 8` — materialization и task-layer
- `Batch 9` — task pages и read-only task UI
- `Batch 10` — lifecycle заявки
- `Batch 11` — storage layer и file policies
- `Batch 12` — comments и attachments
- `Batch 13` — архив
- `Batch 14` — QR-resolve
- `Batch 15` — финализация RLS
- `Batch 16` — cron и системная генерация

Итог:

- все батчи из `docs/PPR_EXECUTION_BATCHES.md` на текущем этапе реализованы
- модуль `ppr` существует как отдельный vertical slice внутри `unaittasks`
- модуль не смешан с текущим `tasks`

---

## 3. Внеплановые фиксы

Помимо плановых батчей были сделаны отдельные stabilization fixes:

- добавлен CRUD-экран справочника `ppr_system_groups`
- в navigation добавлен вход в `Группы систем ППР`
- исправлен `responsible_user_id` в `ppr_systems`:
  - допускаются `lead`, `engineer`, `object_engineer`
  - исключены `chief` и `tech`
  - добавлена object-scope фильтрация
- на `/ppr/systems` добавлен корректный empty state, если нет групп систем

---

## 4. Что реализовано по батчам

### Batch 1

Реализовано:

- базовый namespace `ppr`
- `types`, `validators`, `permissions`, `presentation`
- базовая dashboard page
- вход в PPR navigation

Работает:

- отдельная страница `/ppr`
- базовые типы и permission helpers

### Batch 2

Реализовано:

- миграция `0010_ppr_structure.sql`
- таблицы структуры:
  - `ppr_system_groups`
  - `ppr_systems`
  - `ppr_subsystems`
  - `ppr_rooms`
- ранние helper functions и ранний RLS

Работает:

- базовый object-scoped structure layer
- `chief` как глобальная роль ППР
- `object_engineer` как отдельная объектовая роль

### Batch 3

Реализовано:

- страницы структуры:
  - `/ppr/systems`
  - `/ppr/subsystems`
  - `/ppr/rooms`
- query-layer и server actions для CRUD структуры
- role-aware server-side защита

Работает:

- создание и редактирование систем
- создание и редактирование подсистем
- создание и редактирование помещений

### Batch 4

Реализовано:

- миграция `0011_ppr_equipment_qr.sql`
- оборудование ППР
- активный QR-токен на уровне оборудования
- equipment pages / actions / queries / components

Работает:

- `/ppr/equipment`
- `/ppr/equipment/[id]`
- создание и редактирование оборудования
- отображение активного QR-кода оборудования

### Batch 5

Реализовано:

- миграция `0012_ppr_templates_assignments.sql`
- слой шаблонов ППР
- checklist items
- template attachments table
- pages / actions / queries / components для шаблонов

Работает:

- `/ppr/templates`
- `/ppr/templates/[id]`
- создание и редактирование шаблонов
- snapshot-источник checklist для дальнейшей materialization

### Batch 6

Реализовано:

- assignment UI / queries / server actions
- назначение шаблонов на оборудование
- совместимость object/subsystem/equipment/template на сервере

Работает:

- `/ppr/assignments`
- создание и редактирование `ppr_equipment_work_assignments`

### Batch 7

Реализовано:

- миграция `0013_ppr_calendar.sql`
- `ppr_month_plans`
- `ppr_month_plan_items`
- календарный слой без создания задач на UI-этапе

Работает:

- `/ppr/calendar`
- генерация month plan по системе
- ручной перенос `planned_for` для `pending/carried_over`
- lifecycle `pending/materialized/carried_over/closed/cancelled`

### Batch 8

Реализовано:

- миграция `0014_ppr_tasks.sql`
- `ppr_tasks`
- `ppr_task_work_items`
- materialization rule `M:1`
- snapshot `responsible_user_id`
- snapshot work items

Работает:

- materialization по `(object_id, equipment_id, planned_for)`
- один `task_id` на группу plan items
- защита от дублей активных задач

### Batch 9

Реализовано:

- task pages
- active/my/archive views
- read-only task details
- task lists

Работает:

- `/ppr/my`
- `/ppr/tasks`
- `/ppr/tasks/[id]`
- `/ppr/archive`
- фильтр `На ознакомлении` внутри `/ppr/tasks`

### Batch 10

Реализовано:

- lifecycle API routes / server actions
- UI-действия lifecycle
- assign / start / done / close / cancel / reschedule

Работает:

- назначение исполнителя
- перевод в `in_progress`
- перевод в `done`
- закрытие
- отмена
- перенос `planned_for`
- синхронизация статусов и дат `ppr_month_plan_items`

### Batch 11

Реализовано:

- миграция `0015_ppr_files.sql`
- private storage bucket `ppr-files`
- storage policies для PPR files

Работает:

- отдельный bucket для PPR
- storage policies не смешиваются с existing `task-attachments`

### Batch 12

Реализовано:

- comments flow для `ppr_tasks`
- attachments flow для `ppr_tasks`
- signed URL access
- task detail UI для комментариев и фото

Работает:

- добавление комментариев
- загрузка фото
- server-side чтение через signed URLs
- проверка comment/photo перед переводом задачи в `done`

### Batch 13

Реализовано:

- архивный слой для ППР-заявок
- отдельная страница архива
- архивная выборка `closed/cancelled`

Работает:

- `/ppr/archive`
- архив не смешивается с обычным `/archive`

### Batch 14

Реализовано:

- `lib/ppr/qr.ts`
- `app/api/ppr/qr/[token]/route.ts`
- `app/(dashboard)/ppr/qr/[token]/page.tsx`
- QR state components

Работает:

- QR entry по безопасному `qr_token`
- редирект в активную PPR task
- fallback в карточку оборудования
- правило выбора одной активной задачи:
  - сначала просроченная
  - затем ближайшая по `planned_for`

### Batch 15

Реализовано:

- миграция `0016_ppr_rls.sql`
- финальная доводка helper functions
- финальная синхронизация SQL / RLS / query-layer

Работает:

- финальная role-aware модель для:
  - `admin`
  - `chief`
  - `lead`
  - `engineer`
  - `object_engineer`
  - `tech`
- финальные ограничения для:
  - structure
  - templates
  - assignments
  - calendar
  - tasks
  - comments
  - attachments
  - QR lookup

### Batch 16

Реализовано:

- миграция `0017_ppr_cron_rpc.sql`
- единый endpoint `POST /api/ppr/cron/run`
- SQL RPC для:
  - carryover
  - materialization
  - sync plan item statuses
- orchestration helpers в `lib/ppr/scheduler.ts`
- системный audit для cron run

Работает:

- единый orchestration cron-run
- `x-cron-secret`
- backfill по диапазону дат
- идемпотентный carryover
- идемпотентная materialization
- sync `ppr_month_plan_items` с финальными статусами задач
- audit events с:
  - `actor_id = null`
  - `meta.source = "cron"`
  - `meta.job`
  - `meta.run_id`

---

## 5. Итогово работающие сценарии

На текущем состоянии репозитория в модуле `ppr` реализованы:

- отдельный dashboard и navigation entry
- structure CRUD
- equipment CRUD
- QR token на оборудовании
- template CRUD
- equipment assignments
- calendar / month plan
- materialization в заявки
- task lifecycle
- comments
- attachments
- archive
- QR resolver
- финальный RLS
- cron orchestration и backfill

---

## 6. Ключевые зафиксированные архитектурные правила

В коде реализованы и зафиксированы следующие правила:

- `chief` имеет глобальный доступ ко всем объектам ППР
- `object_engineer` работает как отдельная объектовая управляющая роль
- `ppr_tasks.responsible_user_id` является snapshot и не live-sync
- `ppr_month_plan_items -> ppr_tasks` это `M:1`
- materialization идет по `(object_id, equipment_id, planned_for)`
- одна активная `ppr_task` на `(equipment_id, planned_for)`
- `checklist_snapshot` хранится в structured формате
- task attachments идут только через `ppr-files`
- QR использует `qr_token`, а не прямой UUID
- cron наружу опубликован только как один orchestration route

---

## 7. Что важно помнить при дальнейших изменениях

- не смешивать `ppr` с текущим модулем `tasks`
- не ломать snapshot-модель `responsible_user_id`
- не менять aggregation key materialization без отдельного архитектурного решения
- не возвращаться к старой схеме с несколькими cron routes
- не смешивать PPR files с existing task attachments
- любые новые изменения проверять на согласованность:
  - docs
  - SQL helper functions
  - RLS
  - query-layer
  - server actions / API routes

---

## 8. Фактическая контрольная точка repo state

На текущий момент repo state соответствует реализации батчей `1–16` и содержит:

- все основные PPR сущности
- RLS и helper functions
- UI для административных и task flows
- QR resolver
- archive
- comments / attachments
- cron orchestration

Этот файл следует обновлять, если дальше появятся:

- новые stabilization fixes
- новые post-batch исправления
- доработки сверх исходных батчей
