# План миграций БД для модуля ППР

## 1. Назначение документа

Этот документ фиксирует точный состав migration-файлов для модуля `ppr`.

Цели:

- разбить БД-часть на управляемые миграции
- зафиксировать, что появляется в каждой миграции
- внедрять `helper functions` и `RLS` поэтапно
- исключить конфликты с текущей БД и текущим модулем `tasks`

---

## 2. Общие правила для миграций

### 2.1 Общие принципы

- все новые таблицы имеют префикс `ppr_`
- существующие таблицы `tasks`, `task_comments`, `task_attachments`, `task_team_members` не изменяются
- общие таблицы `profiles`, `objects`, `user_objects`, `audit_log` переиспользуются, но не ломаются
- каждая миграция должна быть идемпотентной там, где это возможно:
  - `create table if not exists`
  - `create index if not exists`
  - `drop policy if exists`
  - `create or replace function`

### 2.2 Что нужно внедрять рано

Нельзя делать все `RLS` и SQL-функции одной последней миграцией.

Рекомендуемое правило:

- базовые object access helper functions — в первой миграции
- базовые policies на структуру — в первой миграции
- helper functions и policies на шаблоны и назначения — в миграции шаблонов
- helper functions и policies на календарь — в миграции календаря
- helper functions и policies на заявки — в миграции заявок
- финальная миграция RLS — только для доводки и закрытия всех хвостов
- attachment tables — в тех же миграциях, где создаются их родительские сущности
- отдельная file/storage миграция — только для bucket/storage policies

### 2.3 Как избежать конфликтов с текущей БД

- не использовать существующие имена таблиц без `ppr_`
- не менять существующие RLS policy names модуля задач
- не переопределять текущие `current_role()`, `can_read_task(...)` и другие функции task-модуля
- для ППР использовать отдельный namespace имен функций:
  - `ppr_*`
- если нужен storage bucket, использовать отдельный bucket или отдельный path-prefix, а не переиспользовать `task-attachments`

---

## 3. Состав migration-файлов

### 3.1 `0010_ppr_structure.sql`

#### Что создаем

- `ppr_system_groups`
- `ppr_systems`
- `ppr_subsystems`
- `ppr_rooms`

#### Таблицы и ограничения

##### `ppr_system_groups`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `name text not null`
  - `code text not null`
  - `is_active boolean not null default true`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (name)`
  - `unique (code)`

##### `ppr_systems`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `system_group_id uuid not null references ppr_system_groups(id)`
  - `name text not null`
  - `description text null`
  - `responsible_user_id uuid null references profiles(id)`
  - `is_active boolean not null default true`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (object_id, name)`

##### `ppr_subsystems`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `system_id uuid not null references ppr_systems(id) on delete cascade`
  - `parent_id uuid null references ppr_subsystems(id) on delete cascade`
  - `name text not null`
  - `sort_order integer not null default 0`
  - `is_active boolean not null default true`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (system_id, parent_id, name)`

##### `ppr_rooms`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `name text not null`
  - `floor text null`
  - `description text null`
  - `is_active boolean not null default true`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (object_id, name)`

#### Индексы

- `idx_ppr_systems_object_id`
- `idx_ppr_systems_responsible_user_id`
- `idx_ppr_systems_system_group_id`
- `idx_ppr_subsystems_object_id`
- `idx_ppr_subsystems_system_id`
- `idx_ppr_subsystems_parent_id`
- `idx_ppr_rooms_object_id`

#### Helper functions

- `ppr_current_role()`
- `ppr_has_object_access(_object_id uuid)`
- `ppr_can_manage_object_scope(_object_id uuid)`
- `ppr_can_be_system_responsible(_user_id uuid)`

Рекомендуемая логика:

- `admin` всегда `true`
- `chief` всегда `true` для object access в ППР
- `lead`, `engineer`, `object_engineer` — через `user_objects`
- `tech` не получает object-scope manage access

#### Triggers

- trigger/validation function на `ppr_systems.responsible_user_id`
- допускаются только:
  - `lead`
  - `engineer`
  - `object_engineer`

#### RLS

Включить `RLS` на:

- `ppr_system_groups`
- `ppr_systems`
- `ppr_subsystems`
- `ppr_rooms`

#### Policies

##### `ppr_system_groups`

- `select`:
  - authenticated users, которые имеют доступ к модулю
- `insert/update/delete`:
  - `admin`
  - `chief`
  - `lead`

##### `ppr_systems`, `ppr_subsystems`, `ppr_rooms`

- `select`:
  - по `ppr_has_object_access(object_id)`
- `insert/update/delete`:
  - по `ppr_can_manage_object_scope(object_id)`

#### Что внедряем сразу

- таблицы
- уникальности
- индексы
- базовый object access
- базовый RLS

#### Что еще не внедряем

- заявки
- календарь
- QR
- шаблоны

---

### 3.2 `0011_ppr_equipment_qr.sql`

#### Что создаем

- `ppr_equipment`
- `ppr_equipment_attachments`
- `ppr_equipment_qr_codes`

#### Таблицы и ограничения

##### `ppr_equipment`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `system_id uuid not null references ppr_systems(id) on delete restrict`
  - `subsystem_id uuid not null references ppr_subsystems(id) on delete restrict`
  - `room_id uuid not null references ppr_rooms(id) on delete restrict`
  - `inventory_no text not null`
  - `name text not null`
  - `dispatch_name text not null`
  - `service_start_date date not null`
  - `status text not null`
  - `serial_no text null`
  - `manufacturer text null`
  - `model text null`
  - `description text null`
  - `comment text null`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (inventory_no)`
  - `check (status in ('active','repair','out_of_service','archived'))`

##### `ppr_equipment_qr_codes`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `equipment_id uuid not null references ppr_equipment(id) on delete cascade`
  - `qr_token text not null`
  - `is_active boolean not null default true`
  - `generated_at timestamptz not null default now()`
- constraints:
  - `unique (qr_token)`

##### `ppr_equipment_attachments`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `equipment_id uuid not null references ppr_equipment(id) on delete cascade`
  - `storage_path text not null`
  - `file_name text not null`
  - `mime_type text not null`
  - `size_bytes bigint not null`
  - `uploaded_by uuid null references profiles(id)`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (storage_path)`

#### Индексы

- `idx_ppr_equipment_object_id`
- `idx_ppr_equipment_system_id`
- `idx_ppr_equipment_subsystem_id`
- `idx_ppr_equipment_room_id`
- `idx_ppr_equipment_status`
- `idx_ppr_equipment_qr_codes_object_id`
- partial unique index на `equipment_id where is_active = true`
- `idx_ppr_equipment_attachments_object_id`
- `idx_ppr_equipment_attachments_equipment_id`
- `idx_ppr_equipment_attachments_uploaded_by`

#### Helper functions

- `ppr_generate_inventory_no(_object_id uuid)`
- `ppr_generate_qr_token()`

#### Triggers

- before insert trigger на `ppr_equipment`, если `inventory_no` не передан явно
- after insert trigger на `ppr_equipment` для создания QR-записи

#### RLS

Включить `RLS` на:

- `ppr_equipment`
- `ppr_equipment_attachments`
- `ppr_equipment_qr_codes`

#### Policies

- `select` для `ppr_equipment`:
  - `ppr_has_object_access(object_id)`
- `insert/update/delete`:
  - `ppr_can_manage_object_scope(object_id)`

Для `ppr_equipment_qr_codes`:

- `select`:
  - `ppr_has_object_access(object_id)`
- `insert/update/delete`:
  - только управляющие роли по объекту, `chief`, `admin`

Для `ppr_equipment_attachments`:

- `select`:
  - `ppr_has_object_access(object_id)`
- `insert/update/delete`:
  - `ppr_can_manage_object_scope(object_id)`

#### Что внедряем сразу

- оборудование
- QR
- базовый RLS для оборудования

#### Что внедряем позже

- резолв QR в route handler
- связь QR с активной ППР-заявкой

---

### 3.3 `0012_ppr_templates_assignments.sql`

#### Что создаем

- `ppr_work_templates`
- `ppr_work_checklist_items`
- `ppr_equipment_work_assignments`
- `ppr_work_template_attachments`

#### Таблицы и ограничения

##### `ppr_work_templates`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `subsystem_id uuid not null references ppr_subsystems(id) on delete cascade`
  - `name text not null`
  - `description text null`
  - `period_months integer not null`
  - `base_start_date date not null`
  - `norm_hours numeric(10,2) null`
  - `methodology text null`
  - `is_active boolean not null default true`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (object_id, subsystem_id, name)`
  - `check (period_months > 0)`

##### `ppr_work_checklist_items`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `template_id uuid not null references ppr_work_templates(id) on delete cascade`
  - `sort_order integer not null`
  - `title text not null`
  - `description text null`
- constraints:
  - `unique (template_id, sort_order)`

##### `ppr_equipment_work_assignments`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `equipment_id uuid not null references ppr_equipment(id) on delete cascade`
  - `template_id uuid not null references ppr_work_templates(id) on delete cascade`
  - `start_date date not null`
  - `period_months integer not null`
  - `is_active boolean not null default true`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (equipment_id, template_id)`
  - `check (period_months > 0)`

##### `ppr_work_template_attachments`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `template_id uuid not null references ppr_work_templates(id) on delete cascade`
  - `storage_path text not null`
  - `file_name text not null`
  - `mime_type text not null`
  - `size_bytes bigint not null`
  - `uploaded_by uuid null references profiles(id)`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (storage_path)`

#### Индексы

- `idx_ppr_work_templates_object_id`
- `idx_ppr_work_templates_subsystem_id`
- `idx_ppr_work_templates_is_active`
- `idx_ppr_work_checklist_items_object_id`
- `idx_ppr_work_checklist_items_template_id`
- `idx_ppr_equipment_work_assignments_object_id`
- `idx_ppr_equipment_work_assignments_equipment_id`
- `idx_ppr_equipment_work_assignments_template_id`
- `idx_ppr_equipment_work_assignments_is_active`
- `idx_ppr_work_template_attachments_object_id`
- `idx_ppr_work_template_attachments_template_id`
- `idx_ppr_work_template_attachments_uploaded_by`

#### Helper functions

- `ppr_can_manage_templates(_object_id uuid)`
- `ppr_can_manage_assignments(_object_id uuid)`

#### RLS

Включить `RLS` на:

- `ppr_work_templates`
- `ppr_work_checklist_items`
- `ppr_work_template_attachments`
- `ppr_equipment_work_assignments`

#### Policies

- `select`:
  - `ppr_has_object_access(object_id)`
- `insert/update/delete`:
  - `ppr_can_manage_templates(object_id)` для шаблонов
  - `ppr_can_manage_assignments(object_id)` для назначений

Для `ppr_work_template_attachments`:

- `select`:
  - `ppr_has_object_access(object_id)`
- `insert/update/delete`:
  - `ppr_can_manage_templates(object_id)`

#### Что внедряем сразу

- шаблоны
- чек-листы
- назначения
- RLS на шаблоны и назначения

#### Что позже

- сложная UI-работа с вложениями шаблонов, если она не нужна в первой волне интерфейса

---

### 3.4 `0013_ppr_calendar.sql`

#### Что создаем

- `ppr_month_plans`
- `ppr_month_plan_items`

#### Таблицы и ограничения

##### `ppr_month_plans`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `system_id uuid not null references ppr_systems(id) on delete cascade`
  - `plan_month date not null`
  - `generated_at timestamptz not null default now()`
- constraints:
  - `unique (object_id, system_id, plan_month)`

##### `ppr_month_plan_items`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `month_plan_id uuid not null references ppr_month_plans(id) on delete cascade`
  - `system_id uuid not null references ppr_systems(id) on delete cascade`
  - `subsystem_id uuid not null references ppr_subsystems(id) on delete cascade`
  - `equipment_id uuid not null references ppr_equipment(id) on delete cascade`
  - `assignment_id uuid not null references ppr_equipment_work_assignments(id) on delete cascade`
  - `template_id uuid not null references ppr_work_templates(id) on delete cascade`
  - `planned_for date not null`
  - `source_due_date date not null`
  - `is_overdue boolean not null default false`
  - `is_carried_over boolean not null default false`
  - `task_id uuid null`
  - `status text not null default 'pending'`
- constraints:
  - `unique (month_plan_id, assignment_id, source_due_date)`
  - `check (status in ('pending','materialized','carried_over','closed','cancelled'))`

#### Индексы

- `idx_ppr_month_plans_object_id`
- `idx_ppr_month_plans_system_id`
- `idx_ppr_month_plans_plan_month`
- `idx_ppr_month_plan_items_object_id`
- `idx_ppr_month_plan_items_month_plan_id`
- `idx_ppr_month_plan_items_system_id`
- `idx_ppr_month_plan_items_equipment_id`
- `idx_ppr_month_plan_items_planned_for`
- `idx_ppr_month_plan_items_task_id`

#### Helper functions

- `ppr_can_manage_calendar(_system_id uuid)`
- `ppr_plan_default_planned_for(_plan_month date)`
- `ppr_materialize_plan_items(_date_from date, _date_to date, _run_id uuid)`
- `ppr_carryover_plan_items(_date_from date, _date_to date, _run_id uuid)`
- `ppr_sync_plan_item_statuses(_date_from date, _date_to date, _run_id uuid)`

#### RLS

Включить `RLS` на:

- `ppr_month_plans`
- `ppr_month_plan_items`

#### Policies

- `select`:
  - по object access
  - дополнительно для `engineer`, если он `responsible_user_id` соответствующей системы
- `insert/update/delete`:
  - `admin`
  - `chief`
  - `lead` в рамках `user_objects`
  - `object_engineer` в рамках `user_objects`
  - `engineer`, если он ответственный по системе

#### Что внедряем сразу

- календарные таблицы
- helper functions календаря
- RLS календаря
- lifecycle `ppr_month_plan_items`
- правило связи `M:1` от `ppr_month_plan_items` к `ppr_tasks`

#### Lifecycle `ppr_month_plan_items`

Фиксируем состояния:

- `pending`
- `materialized`
- `carried_over`
- `closed`
- `cancelled`

Правила:

- `task_id is null` в `pending`
- `task_id` заполняется только на этапе materialization/create-tasks
- несколько `ppr_month_plan_items` могут ссылаться на одну `ppr_task`
- materialization агрегирует позиции по `(object_id, equipment_id, planned_for)`

---

### 3.5 `0014_ppr_tasks.sql`

#### Что создаем

- `ppr_tasks`
- `ppr_task_work_items`
- `ppr_task_comments`
- `ppr_task_attachments`

#### Таблицы и ограничения

##### `ppr_tasks`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `system_id uuid not null references ppr_systems(id) on delete restrict`
  - `subsystem_id uuid not null references ppr_subsystems(id) on delete restrict`
  - `equipment_id uuid not null references ppr_equipment(id) on delete restrict`
  - `responsible_user_id uuid not null references profiles(id)`
  - `assignee_id uuid null references profiles(id)`
  - `planned_for date not null`
  - `completed_at timestamptz null`
  - `closed_at timestamptz null`
  - `cancelled_at timestamptz null`
  - `cancelled_by uuid null references profiles(id)`
  - `status text not null default 'new'`
  - `is_overdue boolean not null default false`
  - `is_rescheduled boolean not null default false`
  - `general_comment text null`
  - `cancel_reason text null`
  - `created_at timestamptz not null default now()`
- constraints:
  - `check (status in ('new','in_progress','done','closed','cancelled'))`
  - `check ((status <> 'cancelled') or cancelled_at is not null)`

`responsible_user_id` в `ppr_tasks` — это snapshot на момент materialization/create-tasks.

Правило:

- значение берется из системы в момент создания заявки
- изменение `ppr_systems.responsible_user_id` не должно переписывать существующие `ppr_tasks`
- изменения ответственности системы влияют только на будущие заявки
- отдельный перенос открытых заявок на нового ответственного допускается только явным backend flow

##### `ppr_task_work_items`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `task_id uuid not null references ppr_tasks(id) on delete cascade`
  - `assignment_id uuid not null references ppr_equipment_work_assignments(id) on delete restrict`
  - `template_id uuid not null references ppr_work_templates(id) on delete restrict`
  - `plan_item_id uuid null references ppr_month_plan_items(id) on delete set null`
  - `title_snapshot text not null`
  - `description_snapshot text null`
  - `methodology_snapshot text null`
  - `checklist_snapshot jsonb not null`
  - `norm_hours_snapshot numeric(10,2) null`
  - `sort_order integer not null`
- constraints:
  - `unique (task_id, assignment_id)`
  - `unique (task_id, sort_order)`
  - `check (jsonb_typeof(checklist_snapshot) = 'array')`

##### `ppr_task_comments`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `task_id uuid not null references ppr_tasks(id) on delete cascade`
  - `author_id uuid not null references profiles(id)`
  - `body text not null`
  - `created_at timestamptz not null default now()`

##### `ppr_task_attachments`

- поля:
  - `id uuid primary key default gen_random_uuid()`
  - `object_id uuid not null references objects(id) on delete cascade`
  - `task_id uuid not null references ppr_tasks(id) on delete cascade`
  - `comment_id uuid null references ppr_task_comments(id) on delete cascade`
  - `storage_path text not null`
  - `file_name text not null`
  - `mime_type text not null`
  - `size_bytes bigint not null`
  - `uploaded_by uuid null references profiles(id)`
  - `created_at timestamptz not null default now()`
- constraints:
  - `unique (storage_path)`

#### Индексы

- `idx_ppr_tasks_object_id`
- `idx_ppr_tasks_system_id`
- `idx_ppr_tasks_equipment_id`
- `idx_ppr_tasks_responsible_user_id`
- `idx_ppr_tasks_assignee_id`
- `idx_ppr_tasks_status`
- `idx_ppr_tasks_planned_for`
- `idx_ppr_tasks_closed_at`
- `idx_ppr_tasks_cancelled_at`
- partial unique index:
  - `unique (equipment_id, planned_for) where status in ('new','in_progress','done')`
- `idx_ppr_task_work_items_object_id`
- `idx_ppr_task_work_items_task_id`
- `idx_ppr_task_work_items_assignment_id`
- `idx_ppr_task_work_items_plan_item_id`
- `idx_ppr_task_comments_object_id`
- `idx_ppr_task_comments_task_id`
- `idx_ppr_task_comments_author_id`
- `idx_ppr_task_comments_created_at`
- `idx_ppr_task_attachments_object_id`
- `idx_ppr_task_attachments_task_id`
- `idx_ppr_task_attachments_comment_id`
- `idx_ppr_task_attachments_uploaded_by`

#### Helper functions

- `ppr_is_active_task_status(_status text)`
- `ppr_validate_task_aggregation(_equipment_id uuid, _planned_for date, _task_id uuid default null)`
- `ppr_can_read_task(_task ppr_tasks)`
- `ppr_can_assign_executor(_task ppr_tasks)`
- `ppr_can_close_task(_task ppr_tasks)`
- `ppr_can_execute_task(_task ppr_tasks)`

#### Triggers

- before insert/update trigger на `ppr_tasks`
  - валидация агрегации
  - валидация `cancelled_at/cancelled_by`
- trigger на `ppr_tasks.status`
  - автозаполнение `completed_at` при `done`
  - автозаполнение `closed_at` при `closed`

#### RLS

Включить `RLS` на:

- `ppr_tasks`
- `ppr_task_work_items`
- `ppr_task_comments`
- `ppr_task_attachments`

#### Policies

##### `ppr_tasks`

- `select`:
  - через `ppr_can_read_task(_task)`
- `insert`:
  - через сервисную серверную логику / cron RPC / допустимый backend path
- `update`:
  - через совокупность:
    - assign executor
    - execute
    - close
    - cancel

##### `ppr_task_work_items`

- `select`:
  - если видна родительская заявка
- `insert/update/delete`:
  - только системный backend flow создания заявки

##### `ppr_task_comments`

- `select`:
  - если видна заявка
- `insert`:
  - если пользователь видит заявку и имеет право комментировать

##### `ppr_task_attachments`

- `select`:
  - если видна родительская заявка
- `insert`:
  - если пользователь имеет право работать с родительской заявкой
- `delete`:
  - только управляющие роли или системная серверная логика

#### Что внедряем сразу

- заявки
- work items
- comments
- attachments
- status lifecycle
- partial unique index агрегации
- snapshots

#### Что позже

- cron materialization/create-tasks orchestration

---

### 3.6 `0015_ppr_files.sql`

#### Что создаем

- storage/bucket/policies для файлов ППР

#### Storage

Рекомендуемое решение:

- отдельный bucket `ppr-files`
- приватный доступ
- выдача только через signed URLs
- отдельные path prefixes:
  - `equipment/`
  - `templates/`
  - `tasks/`

#### Что внедряем сразу

- storage policies
- bucket configuration
- правила доступа для signed URLs и upload path-ов

#### Что позже

- дополнительные cleanup jobs и housekeeping, если понадобятся

---

### 3.7 `0016_ppr_rls.sql`

#### Что делаем

Финализируем весь слой `RLS` и недостающие helper functions.

#### Что должно быть внутри

- `drop policy if exists ...`
- финальные `create policy ...` для всех `ppr_*` таблиц
- недостающие `create or replace function ...`
- финальная синхронизация правил для:
  - `admin`
  - `chief`
  - `lead`
  - `engineer`
  - `object_engineer`
  - `tech`

#### Что именно закрываем

- `chief` как глобальная роль ППР без `user_objects`
- `object_engineer` как отдельная объектовая роль по `user_objects`
- `tech` только на свои заявки
- `engineer` на свои заявки и свои системы
- разрешения на закрытие
- разрешения на назначение исполнителя
- разрешения на календарь
- разрешения на structure/templates/assignments

#### Что внедряем

- доводка политик
- устранение расхождений между ранними миграциями

#### Что не должно происходить в этой миграции

- создание базовых таблиц с нуля
- появление основной предметной схемы

---

### 3.8 `0017_ppr_cron_rpc.sql`

#### Что создаем

- RPC / SQL functions для идемпотентных внутренних шагов orchestration cron

#### Функции

- `ppr_materialize_plan_items(_date_from date, _date_to date, _run_id uuid)`
- `ppr_carryover_plan_items(_date_from date, _date_to date, _run_id uuid)`
- `ppr_sync_plan_item_statuses(_date_from date, _date_to date, _run_id uuid)`

#### Что должно быть внутри логики

##### `ppr_materialize_plan_items`

- ищет `ppr_month_plan_items` в диапазоне дат
- берет только позиции со статусами `pending` и `carried_over`
- группирует по:
  - `object_id`
  - `equipment_id`
  - `planned_for`
- создает одну активную `ppr_task`
- создает набор `ppr_task_work_items`
- уважает partial unique index
- пишет один и тот же `task_id` во все вошедшие `ppr_month_plan_items`
- переводит такие позиции в `materialized`

##### `ppr_carryover_plan_items`

- переносит незавершенные позиции и связанные открытые задачи в новый диапазон
- не создает дубли plan items
- переводит позиции в `carried_over`

##### `ppr_sync_plan_item_statuses`

- синхронизирует `ppr_month_plan_items.status` с финальным состоянием `ppr_tasks`
- если задача `closed`, то связанные позиции становятся `closed`
- если задача `cancelled`, то связанные позиции становятся `cancelled`

#### Что внедряем сразу

- idempotent SQL logic для внутренних cron-шагов
- поддержка backfill по диапазону дат

#### Внешняя cron-архитектура

- наружу публикуется один orchestration route `/api/ppr/cron/run`
- route валидирует:
  - `x-cron-secret`
  - `date_from`
  - `date_to`
  - `run_id`
- route последовательно вызывает внутренние SQL-шаги
- каждый запуск пишет системный audit с конвенцией:
  - `actor_id = null`
  - `meta.source = "cron"`
  - `meta.job`
  - `meta.run_id`
  - `action` с префиксом `system_*`

---

## 4. Что внедрять сразу, а что позже

### Сразу

- базовые таблицы структуры
- базовые object access functions
- базовый RLS
- таблицы оборудования
- шаблоны и назначения
- календарь
- таблицы заявок
- partial unique index агрегации
- snapshot-поля
- `cancelled_at` и `cancelled_by`

### Позже

- финальная доводка RLS
- RPC для cron
- дополнительные вложения оборудования, если они не нужны в первой пользовательской волне

---

## 5. Проверка на отсутствие конфликтов с текущей БД

Перед выполнением миграций нужно соблюдать правила:

- не трогать существующие `tasks`-policy names
- не менять старые task-related helper functions
- не переиспользовать bucket `task-attachments`
- не добавлять столбцы в текущие task-таблицы ради ППР
- не строить ППР через join на `tasks`

---

## 6. Результат реализации по этому плану

После применения всех миграций БД должна содержать:

- отдельную схему сущностей ППР
- отдельный набор helper functions `ppr_*`
- отдельный набор RLS policies
- защиту от дублей активных заявок
- snapshot-модель work items
- корректную поддержку ролей:
  - `admin`
  - `chief`
  - `lead`
  - `engineer`
  - `object_engineer`
  - `tech`
