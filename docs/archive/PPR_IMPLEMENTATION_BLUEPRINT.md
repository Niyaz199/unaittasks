# PPR Implementation Blueprint

## 1. Архитектурный срез

PPR реализуется как отдельный модуль внутри общего dashboard-приложения:

- страницы в `app/(dashboard)/ppr/*`
- actions в `app/actions/ppr-*.ts`
- API в `app/api/ppr/*`
- доменная логика в `lib/ppr/*`

Общие помещения вынесены из PPR:

- shared queries в `lib/object-rooms.ts`
- shared actions в `app/actions/object-room-actions.ts`

## 2. Целевая модель

- `ppr_system_groups`
- `ppr_systems`
- `object_rooms`
- `ppr_equipment`
- `ppr_work_templates`
- `ppr_month_plan_items`
- `ppr_tasks`

## 3. Правила реализации

- никакого `subsystem` в новом коде
- никакого `ppr_rooms` в новом коде
- оборудование всегда связано напрямую с системой
- шаблон всегда связан напрямую с системой
- month plan строится напрямую из шаблона системы и оборудования этой системы
- помещение всегда является shared object-scoped сущностью

## 4. Обязательные места проверки

При любом следующем изменении PPR нужно проверить:

- миграции и RLS
- `lib/ppr/queries.ts`
- `lib/ppr/scheduler.ts`
- формы оборудования и шаблонов
- карточки оборудования и заявок
- cron/materialization

## 5. Ограничение на дальнейшее развитие

Новый функционал ППР нельзя строить поверх legacy-модели. Если появляется новая фича:

- она должна использовать `system`
- она должна использовать `object_rooms`
- она не должна восстанавливать `subsystem` как промежуточную сущность
