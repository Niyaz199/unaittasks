# План миграций БД для модуля ППР

## 1. Актуальная цепочка миграций

PPR-часть схемы развивается следующими файлами:

- `0010_ppr_structure.sql`
- `0011_ppr_equipment_qr.sql`
- `0012_ppr_templates_assignments.sql`
- `0013_ppr_calendar.sql`
- `0014_ppr_tasks.sql`
- `0015_ppr_files.sql`
- `0016_ppr_rls.sql`
- `0017_ppr_cron_rpc.sql`
- `0018_ppr_pgcrypto_fix.sql`
- `0019_object_rooms_and_ppr_system_refactor.sql`
- `0020_ppr_cleanup_legacy_structure.sql`
- `0033_ppr_system_template_rollout.sql`

## 2. Что меняется в refactor-миграциях

### `0019_object_rooms_and_ppr_system_refactor.sql`

- создается общий справочник `object_rooms`
- для `object_rooms` включается RLS на базе object access
- `ppr_has_object_access()` выравнивается с общей `has_object_access()`
- данные из `ppr_rooms` переносятся в `object_rooms`
- `ppr_equipment.room_id` перепривязывается к `object_rooms`
- `ppr_work_templates` получают `system_id`
- `system_id` backfill-ится из старой связи через `ppr_subsystems`
- SQL validation functions переводятся на модель без обязательного `subsystem_id`
- SQL materialization перестает использовать `subsystem_id`

### `0020_ppr_cleanup_legacy_structure.sql`

- удаляются индексы старой подсистемной модели
- удаляются `subsystem_id` из рабочих PPR-таблиц
- удаляются таблицы `ppr_subsystems` и `ppr_rooms`

## 3. Целевая модель после миграций

После применения всех миграций схема должна отражать модель:

- `ppr_system_groups -> ppr_systems -> ppr_equipment`
- `object_rooms -> ppr_equipment`
- `ppr_systems -> ppr_work_templates`
- `ppr_work_templates + ppr_equipment -> ppr_month_plan_items`
- `ppr_month_plan_items -> ppr_tasks`

## 4. Принципы безопасности

- shared rooms вводятся раньше удаления PPR-specific rooms
- backfill выполняется до cleanup
- SQL-функции сначала переводятся на новую модель, затем удаляются старые колонки
- схема остается пригодной как для пустого разворота, так и для обновления существующей БД ветки `feature/ppr`

## 5. Что нужно проверить после применения

- создание и редактирование помещений в `object_rooms`
- создание оборудования без `subsystem_id`
- создание шаблонов на уровне `system_id`
- генерацию month plan для всего активного оборудования системы
- генерацию month plan и materialization без подсистем
- работу task-layer, QR и cron после cleanup
