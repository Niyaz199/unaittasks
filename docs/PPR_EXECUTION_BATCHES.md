# Пачки реализации модуля ППР

## 1. Назначение документа

Этот документ разбивает реализацию модуля `ppr` на маленькие практические батчи.

Цель:

- делать работу по шагам
- после каждого шага иметь проверяемый результат
- не начинать следующий большой кусок, пока не стабилизирован предыдущий

Каждая пачка включает:

- создаваемые или изменяемые файлы
- новые миграции
- рабочие сценарии
- ручную проверку

---

## 2. Общий порядок батчей

Рекомендуемая последовательность:

1. Каркас модуля и базовые типы
2. Базовая структура БД и ранний RLS
3. Страницы и CRUD структуры
4. Оборудование и QR
5. Шаблоны ППР
6. Назначения на оборудование
7. Календарь
8. Таблицы и UI ППР-заявок
9. Lifecycle заявки
10. Комментарии и вложения
11. Архив и QR-резолв
12. Cron и финализация RLS

---

## 3. Batch 1: каркас модуля и базовые типы

### Что создается/меняется

- `app/(dashboard)/ppr/page.tsx`
- `lib/ppr/types.ts`
- `lib/ppr/validators.ts`
- `lib/ppr/permissions.ts`
- `lib/ppr/presentation.ts`
- `components/ppr/dashboard/`
- `components/dashboard/main-nav.tsx`

### Какие миграции добавляются

- нет

### Какие сценарии должны заработать

- в navigation появляется вход в модуль ППР
- открывается базовая страница `/ppr`
- модуль существует как отдельный namespace
- есть базовые типы и каркас permission helpers

### Что проверить вручную

- ссылка на `/ppr` видна там, где задумано
- dashboard layout не сломан
- модуль не смешан с `/tasks`
- базовая страница открывается только для авторизованного пользователя

---

## 4. Batch 2: базовая структура БД и ранний RLS

### Что создается/меняется

- `supabase/migrations/0010_ppr_structure.sql`

### Какие миграции добавляются

- `0010_ppr_structure.sql`

### Какие сценарии должны заработать

- существуют:
  - `ppr_system_groups`
  - `ppr_systems`
  - `ppr_subsystems`
  - `ppr_rooms`
- работают базовые helper functions:
  - `ppr_current_role()`
  - `ppr_has_object_access(...)`
  - `ppr_can_manage_object_scope(...)`
  - `ppr_can_be_system_responsible(...)`
- включен базовый RLS для структуры

### Что проверить вручную

- `chief` имеет глобальный доступ к структуре ППР
- `lead`, `engineer`, `object_engineer` ограничены объектами из `user_objects`
- `tech` не может управлять структурой
- `responsible_user_id` не принимает `tech`

---

## 5. Batch 3: UI и CRUD структуры

### Что создается/меняется

- `app/actions/ppr-directory-actions.ts`
- `lib/ppr/queries.ts`
- `app/(dashboard)/ppr/systems/page.tsx`
- `app/(dashboard)/ppr/subsystems/page.tsx`
- `app/(dashboard)/ppr/rooms/page.tsx`
- `components/ppr/systems/*`
- `components/ppr/subsystems/*`
- `components/ppr/rooms/*`

### Какие миграции добавляются

- нет

### Какие сценарии должны заработать

- создание и редактирование систем
- создание и редактирование подсистем
- создание и редактирование помещений
- выбор ответственного по системе

### Что проверить вручную

- `chief` видит все системы
- `object_engineer` видит только объекты из `user_objects`
- `tech` не может открыть CRUD сценарии
- дерево подсистем работает корректно

---

## 6. Batch 4: оборудование и QR

### Что создается/меняется

- `supabase/migrations/0011_ppr_equipment_qr.sql`
- `app/(dashboard)/ppr/equipment/page.tsx`
- `app/(dashboard)/ppr/equipment/[id]/page.tsx`
- `components/ppr/equipment/*`
- `app/actions/ppr-directory-actions.ts`

### Какие миграции добавляются

- `0011_ppr_equipment_qr.sql`

### Какие сценарии должны заработать

- создание оборудования
- генерация `inventory_no`
- генерация `qr_token`
- карточка оборудования
- существует таблица `ppr_equipment_attachments` как часть equipment-среза

### Что проверить вручную

- `inventory_no` уникален
- у каждой единицы оборудования создается активный QR
- объектовые права на оборудование соблюдаются
- `chief` видит оборудование глобально

---

## 7. Batch 5: шаблоны ППР

### Что создается/меняется

- `supabase/migrations/0012_ppr_templates_assignments.sql`
- `app/actions/ppr-template-actions.ts`
- `app/(dashboard)/ppr/templates/page.tsx`
- `app/(dashboard)/ppr/templates/[id]/page.tsx`
- `components/ppr/templates/*`

### Какие миграции добавляются

- `0012_ppr_templates_assignments.sql` целиком

### Какие сценарии должны заработать

- создание шаблона ППР-работы
- добавление чек-листа
- редактирование шаблона
- существует таблица `ppr_work_template_attachments` как часть template-среза

### Что проверить вручную

- `period_months > 0`
- `checklist items` сохраняются в нужном порядке
- шаблон доступен только в рамках своего объекта
- `chief` может работать со всеми шаблонами ППР

---

## 8. Batch 6: назначения шаблонов на оборудование

### Что создается/меняется

- `app/(dashboard)/ppr/assignments/page.tsx`
- `components/ppr/assignments/*`
- `app/actions/ppr-template-actions.ts`

### Какие миграции добавляются

- нет

### Какие сценарии должны заработать

- назначение шаблона на оборудование
- изменение параметров назначения
- деактивация назначения

### Что проверить вручную

- нельзя создать дубль `equipment_id + template_id`
- object-bound доступ соблюдается
- неактивные назначения не участвуют в дальнейшем планировании

---

## 9. Batch 7: календарь

### Что создается/меняется

- `supabase/migrations/0013_ppr_calendar.sql`
- `lib/ppr/scheduler.ts`
- `app/actions/ppr-calendar-actions.ts`
- `app/(dashboard)/ppr/calendar/page.tsx`
- `components/ppr/calendar/*`

### Какие миграции добавляются

- `0013_ppr_calendar.sql`

### Какие сценарии должны заработать

- формирование месячного плана
- отображение `ppr_month_plans`
- отображение `ppr_month_plan_items`
- разнос работ по дням
- lifecycle `ppr_month_plan_items`

### Что проверить вручную

- если дата не задана, логика использует первое число месяца
- ответственный по системе видит свой календарь
- `object_engineer` ведет календарь только по своим объектам
- `chief` имеет глобальный доступ к календарю ППР
- `ppr_month_plan_items` еще не materialized и имеют `task_id = null`

---

## 10. Batch 8: таблицы ППР-заявок

### Что создается/меняется

- `supabase/migrations/0014_ppr_tasks.sql`
- `lib/ppr/queries.ts`
- `lib/ppr/permissions.ts`

### Какие миграции добавляются

- `0014_ppr_tasks.sql`

### Какие сценарии должны заработать

- существуют:
  - `ppr_tasks`
  - `ppr_task_work_items`
  - `ppr_task_comments`
- `ppr_task_attachments`
- работает partial unique index активных заявок
- работают helper functions доступа к заявкам
- связь `ppr_month_plan_items -> ppr_tasks` работает как `M:1`
- `responsible_user_id` в заявке фиксируется как snapshot на момент materialization

### Что проверить вручную

- нельзя создать две активные заявки на одно оборудование и дату
- `checklist_snapshot` хранится как `jsonb array`
- `cancelled_at` обязателен при `cancelled`
- `cancelled_by` корректно принимает профиль пользователя
- несколько `ppr_month_plan_items` могут ссылаться на один `ppr_task`
- изменение ответственного у системы не переписывает уже созданную заявку

---

## 11. Batch 9: списки и карточка ППР-заявки

### Что создается/меняется

- `app/(dashboard)/ppr/my/page.tsx`
- `app/(dashboard)/ppr/tasks/page.tsx`
- `app/(dashboard)/ppr/tasks/[id]/page.tsx`
- `components/ppr/tasks/*`
- `lib/ppr/presentation.ts`

### Какие миграции добавляются

- нет

### Какие сценарии должны заработать

- список моих ППР
- список активных ППР
- карточка ППР-заявки
- отображение work items по snapshot-данным

### Что проверить вручную

- `tech` видит только свои ППР
- `engineer` видит свои заявки и свои системы
- `chief` видит все ППР
- карточка читает snapshot, а не живой шаблон

---

## 12. Batch 10: lifecycle заявки

### Что создается/меняется

- `app/api/ppr/tasks/[id]/status/route.ts`
- `app/api/ppr/tasks/[id]/assign/route.ts`
- `app/api/ppr/tasks/[id]/reschedule/route.ts`
- `app/api/ppr/tasks/[id]/cancel/route.ts`
- `app/actions/ppr-task-actions.ts`
- `components/ppr/tasks/*`

### Какие миграции добавляются

- нет, если lifecycle logic уже поддержан таблицами и helper functions

### Какие сценарии должны заработать

- назначение исполнителя
- `new -> in_progress`
- `in_progress -> done`
- закрытие
- перенос
- отмена

### Что проверить вручную

- исполнитель не может закрыть заявку, если не имеет прав
- `done` не равно `closed`
- перенос меняет текущую заявку, а не создает новую
- отмена ставит `cancelled_at` и `cancelled_by`

---

## 13. Batch 11: storage и файловые политики

### Что создается/меняется

- `supabase/migrations/0015_ppr_files.sql`

### Какие миграции добавляются

- `0015_ppr_files.sql`

### Какие сценарии должны заработать

- создан приватный bucket `ppr-files`
- есть storage policies
- доступны path prefixes:
  - `equipment/`
  - `templates/`
  - `tasks/`

### Что проверить вручную

- upload в неправильный path запрещен
- signed URLs генерируются только сервером
- bucket не конфликтует с `task-attachments`

---

## 14. Batch 12: комментарии и вложения

### Что создается/меняется

- `app/api/ppr/tasks/[id]/comments/route.ts`
- `app/api/ppr/tasks/[id]/attachments/route.ts`
- `components/ppr/tasks/*`

### Какие миграции добавляются

- нет, так как `ppr_task_attachments` уже созданы вместе с `ppr_tasks`

### Какие сценарии должны заработать

- комментарии по ППР-заявке
- upload фото
- signed URLs

### Что проверить вручную

- комментарии доступны только тем, кто видит заявку
- фото доступны только через signed URL
- `tech` может завершить задачу только при наличии комментария и фото

---

## 15. Batch 13: архив

### Что создается/меняется

- `app/(dashboard)/ppr/archive/page.tsx`
- `components/ppr/tasks/*`
- `lib/ppr/queries.ts`

### Какие миграции добавляются

- нет

### Какие сценарии должны заработать

- архив `closed` и `cancelled`
- фильтры по объекту, системе, оборудованию, ответственному, исполнителю, периоду

### Что проверить вручную

- `closed` и `cancelled` корректно попадают в архив
- `cancelled_at` участвует в отображении отмен
- архив не смешивается с текущим `/archive` модуля обычных задач

---

## 16. Batch 14: QR-резолв

### Что создается/меняется

- `lib/ppr/qr.ts`
- `app/api/ppr/qr/[token]/route.ts`
- `app/(dashboard)/ppr/qr/[token]/page.tsx`
- `components/ppr/qr/*`

### Какие миграции добавляются

- нет, если структура QR уже введена в `0011_ppr_equipment_qr.sql`

### Какие сценарии должны заработать

- переход по QR
- редирект в активную ППР-заявку
- редирект в карточку оборудования, если активной заявки нет

### Что проверить вручную

- некорректный токен обрабатывается безопасно
- при наличии активной заявки открывается именно она
- правило агрегации не позволяет QR уводить в дублирующие активные заявки

---

## 17. Batch 15: финализация RLS и полировка

### Что создается/меняется

- `supabase/migrations/0016_ppr_rls.sql`
- `lib/ppr/permissions.ts`
- `lib/ppr/queries.ts`
- `components/ppr/*`
- `components/dashboard/main-nav.tsx`
- при необходимости `components/dashboard/mobile-tabs.tsx`

### Какие миграции добавляются

- `0016_ppr_rls.sql`

### Какие сценарии должны заработать

- финальные role-aware ограничения
- глобальная роль `chief`
- отдельная роль `object_engineer`
- mobile-first UX исполнителя

### Что проверить вручную

- `admin` видит все
- `chief` видит все объекты ППР без `user_objects`
- `lead` ограничен `user_objects`
- `object_engineer` ограничен `user_objects`, но может управлять объектом в рамках ППР
- `tech` видит только свои заявки

---

## 18. Batch 16: cron и системная генерация

### Что создается/меняется

- `supabase/migrations/0017_ppr_cron_rpc.sql`
- `app/api/ppr/cron/run/route.ts`
- `lib/ppr/scheduler.ts`

### Какие миграции добавляются

- `0017_ppr_cron_rpc.sql`

### Какие сценарии должны заработать

- единый orchestration cron-run
- carryover по диапазону дат
- materialization по диапазону дат
- sync statuses plan items
- backfill по диапазону дат

### Что проверить вручную

- cron endpoints доступны только по `x-cron-secret`
- заявки создаются пачкой без дублей
- carryover не создает новую заявку поверх существующей
- системные audit events пишутся с `actor_id = null`
- `meta.source = "cron"`, `meta.job`, `meta.run_id` заполнены
- navigation не перегружена

---

## 18. Как использовать батчи на практике

Рекомендуемое правило работы:

- выполнять только один batch за раз
- после завершения batch:
  - прогонять ручную проверку
  - фиксировать найденные проблемы
  - только потом переходить к следующему batch

Не рекомендуется:

- объединять 3-4 батча в один коммит
- писать cron раньше lifecycle заявок
- писать финальный RLS до появления реальных таблиц и сценариев

---

## 19. Минимальный рабочий путь до первого демо

Если нужен самый ранний демонстрационный срез, достаточно дойти до:

1. Batch 1
2. Batch 2
3. Batch 3
4. Batch 4
5. Batch 5
6. Batch 6
7. Batch 7
8. Batch 8
9. Batch 9

После этого уже можно показать:

- структуру
- оборудование
- шаблоны
- назначения
- календарь
- карточку ППР-заявки

Полный рабочий lifecycle ППР появляется после Batch 10-16.
