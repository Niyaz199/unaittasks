# Батчи выполнения PPR-refactor

## Batch 1. Shared rooms

- создать `object_rooms`
- перенести room CRUD в shared-layer
- переключить `/ppr/rooms` на общий справочник

## Batch 2. System-based templates

- добавить `system_id` в `ppr_work_templates`
- переписать шаблоны на уровень системы
- обновить UI шаблонов

## Batch 3. Equipment and assignments

- убрать `subsystem` из оборудования
- перевести назначения на совместимость по системе
- обновить equipment/assignment forms

## Batch 4. Calendar and scheduler

- убрать `subsystem` из query-layer календаря
- переписать `lib/ppr/scheduler.ts`
- переписать SQL materialization и validation functions

## Batch 5. Task layer cleanup

- убрать `subsystem` из task summary и task details
- проверить lifecycle, comments, attachments, QR

## Batch 6. Legacy cleanup

- удалить `ppr_subsystems`
- удалить `ppr_rooms`
- удалить старые индексы и obsolete route `/ppr/subsystems`

## Batch 7. Documentation and merge readiness

- синхронизировать архитектурные документы
- зафиксировать итоговую модель для merge в `main`
