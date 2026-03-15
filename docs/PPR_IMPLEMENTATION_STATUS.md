# Статус реализации модуля ППР

## 1. Общий статус

PPR остается отдельным vertical slice внутри `unaittasks`, но доменная модель уже переведена на исправленную архитектуру:

- `group -> system -> equipment`
- shared rooms через `object_rooms`
- без `subsystem` в рабочем коде приложения

## 2. Что реализовано

- shared-layer помещений:
  - `lib/object-rooms.ts`
  - `app/actions/object-room-actions.ts`
  - страница `/ppr/rooms` использует общий справочник
- PPR directory layer:
  - оборудование привязано к `system` и `room`
  - подсистемный UI удален
- templates и assignments:
  - шаблоны работают на уровне системы
  - совместимость назначений проверяется по системе
- calendar и task-layer:
  - query, scheduler и UI больше не используют `subsystem`
- DB:
  - добавлены `0019_object_rooms_and_ppr_system_refactor.sql`
  - добавлены `0020_ppr_cleanup_legacy_structure.sql`
- docs:
  - базовые PPR-документы переписаны под новую модель

## 3. Что считается legacy

Старую модель нужно считать полностью устаревшей:

- `ppr_subsystems`
- `ppr_rooms`
- любые формы и экраны, требующие `subsystem_id`

## 4. Что важно для merge

- `main` не должен получать старую архитектуру ППР
- при merge нужно брать уже refactored вариант `feature/ppr`
- shared rooms следует рассматривать как часть ядра проекта, а не как PPR-specific таблицу
