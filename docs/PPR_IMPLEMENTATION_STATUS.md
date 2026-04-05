# Статус реализации модуля ППР

## 1. Общий статус

`PPR` остаётся отдельным vertical slice внутри проекта и уже работает на актуальной shared-архитектуре:

- `group -> system -> equipment`;
- shared rooms через `object_rooms`;
- без `subsystem` в рабочем коде;
- с room card и общим room QR;
- с разрезанным query layer и вынесенными shared helpers.

## 2. Что реализовано

- shared-layer помещений:
  - `lib/object-rooms.ts`
  - `lib/object-room-qr.ts`
  - `app/actions/object-room-actions.ts`
  - `/ppr/rooms`
  - `/ppr/rooms/[id]`
  - `/ppr/rooms/qr/[token]`
- PPR directory layer:
  - оборудование привязано к `system` и `room`
  - подсистемный UI удалён
- templates и calendar:
  - шаблоны работают на уровне системы
  - активный шаблон применяется ко всему активному оборудованию системы
  - новое оборудование подключается только к будущим циклам
- calendar и task-layer:
  - query, scheduler и UI больше не используют `subsystem`
  - календарь декомпозирован и облегчён
  - карточка ППР-заявки читает attachments через server-side read model
- query/helper layer:
  - `lib/ppr/queries.ts` сохранён как public barrel
  - внутри используются `access`, `structure-queries`, `calendar-queries`, `task-queries`, `task-read-models`
  - shared helpers вынесены в `lib/object-access.ts` и `lib/relation-normalization.ts`
- DB:
  - shared room layer, room QR и rounds-compatible room model уже применены
  - PPR продолжает работать поверх этой общей модели

## 3. Что считается legacy

Старую модель нужно считать полностью устаревшей:

- `ppr_subsystems`
- `ppr_rooms`
- любые формы и экраны, требующие `subsystem_id`
- предположение, что комнаты существуют только внутри ППР
- ручной assignment-layer между шаблоном и оборудованием

## 4. Что важно для текущего состояния

- shared rooms следует рассматривать как часть ядра проекта, а не как PPR-specific таблицу;
- room QR является общим QR помещения, а не отдельным “rounds only” сценарием;
- любые изменения в комнатах нужно проверять одновременно для `PPR` и `Rounds`;
- `PPR` и обычные `tasks` остаются независимыми доменами даже после общей архитектурной уборки.
