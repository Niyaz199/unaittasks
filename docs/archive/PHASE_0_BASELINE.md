# Фаза 0: Baseline и Critical Flows

> Документ фиксирует стартовое состояние только для шагов `0.1` и `0.2` из `docs/AUDIT_REMEDIATION_PLAN.md`.

## 1. Методика

Baseline зафиксирован по двум источникам:

- `npm run build`:
  `First Load JS` используется как proxy для initial payload.
- локальный `next dev` на `http://localhost:3001` в авторизованной сессии:
  `GET /route ... in Nms` используется как proxy для server response time на cold/warm открытии.

Дополнительные замечания:

- отдельного точного network waterfall по числу HTTP-запросов из MCP-браузера в этой сессии получить не удалось, поэтому ниже зафиксирован не raw-count из devtools, а практический request/fan-out estimate по коду и route orchestration;
- для client-side активности использован CPU profile как hydration/runtime proxy только на репрезентативных тяжелых экранах;
- baseline нужен как точка отсчета перед рефакторингом, а не как идеальный synthetic benchmark.

## 2. Performance Baseline

| Route | First Load JS | Dev runtime proxy | Request / fan-out estimate | Client / hydration note | Notes |
| --- | --- | --- | --- | --- | --- |
| `/ppr/calendar` | `117 kB` | cold `2784ms`, warm `1166ms` | 4 server-side выборки в `Promise.all`, затем доп. in-memory filtering по группе/системе | CPU profile: `1836` samples, active `11`, duration `2.88s` | Основной риск сейчас не в post-load CPU, а в SSR data shaping и тяжелом client calendar shell |
| `/ppr/tasks/[id]` | `106 kB` | dev open дал `500` за `1866ms` на `16d3ecca-4388-49b7-ab59-003bf80fab44` | 1 task read + `Promise.all` по work items / assignees / comments, затем client attachment fan-out `1 + N` fetch | CPU proxy не снимался из-за runtime error | В dev зафиксирована отдельная проблема: `MODULE_NOT_FOUND` по `.next/server/vendor-chunks/localforage.js`; это baseline-наблюдение, не входящее в текущую фазу |
| `/ppr/equipment` | `111 kB` | cold `1775ms` | 4 server-side выборки: objects + systems + rooms + equipment | client-heavy admin screen | Сразу сериализует крупные справочники в `PprEquipmentAdmin` |
| `/ppr/rooms` | `111 kB` | cold `1722ms` | 4 server-side выборки: objects + rooms + floors + roomTypes | client-heavy admin screen | Общий справочник помещений уже тянется целиком в client admin layer |
| `/rounds/config` | `108 kB` | cold `1815ms`, warm `1065ms`, `1021ms`, `1283ms` | 1 config read path + доп. запрос на active room QR map внутри query layer | CPU profile: `1637` samples, active `117`, duration `2.99s` | Нагрузка смешанная: SSR + client config UX; warm runtime все еще держится около `~1.0-1.3s` |
| `/rounds/scan` | `117 kB` | cold `1628ms`, warm `990ms` | scanner screen после открытия может пойти в `/api/rounds/config`, а confirm screen повторно дергает `/api/rounds/config` и fallback `/api/rounds/resolve/[token]` | client-heavy mobile-first flow | Это самый чувствительный к мобильному UX экран из текущего baseline |

## 3. Mobile / PWA Risk Notes

Отдельный mobile bundle size не отличается от desktop, но текущий риск выше именно на мобильных сценариях:

- `/rounds/scan`:
  QR/camera flow, deep-link token path, offline queue, photo compression и ручной sync.
- `/rounds/config`:
  длинные объектные списки, переключения по помещениям, сохранение пачками.
- `/ppr/calendar`:
  большой client shell даже при умеренном post-load CPU в коротком профиле.

Практический вывод для следующих фаз:

- главный runtime bottleneck пока выглядит как server/data orchestration и fan-out запросов, а не как чистая клиентская CPU-нагрузка после отрисовки;
- mobile pain сильнее всего сосредоточен в `Rounds`, а не в классических PPR справочниках.

## 4. Критические Execution Flows

### 4.1. `Rounds scan -> resolve -> confirm -> sync`

Entry points:

- `app/(dashboard)/rounds/scan/page.tsx`
- `components/rounds/rounds-scan-screen.tsx`
- `components/rounds/rounds-entry-form.tsx`
- `app/(dashboard)/rounds/entry/[token]/page.tsx`

Current flow:

1. Пользователь открывает `/rounds/scan`.
2. `RoundsScanner` или deep-link через `/rounds/entry/[token]` переводит в `RoundsEntryForm`.
3. `RoundsEntryForm` сначала пытается найти помещение в локальном snapshot.
4. Онлайн-путь дополнительно читает `/api/rounds/config`, обновляет snapshot и при необходимости вызывает `/api/rounds/resolve/[token]`.
5. При подтверждении:
   либо идет `POST /api/rounds/checkins`,
   либо запись уходит в offline queue и позже синхронизируется.

Write points:

- `rounds_checkins`
- `rounds-files` storage bucket для фото
- localforage stores:
  `rounds_pending_checkins`, `rounds_snapshot`

Primary code paths:

- `app/api/rounds/checkins/route.ts`
- `lib/rounds/queries.ts`
- `lib/offline/rounds-queue.ts`

### 4.2. `Rounds config -> save -> read -> print QR`

Entry points:

- `app/(dashboard)/rounds/config/page.tsx`
- `app/api/rounds/config/route.ts`
- `app/(dashboard)/rounds/qr/page.tsx`

Current flow:

1. Конфигуратор читает `listRoundsConfigRoomsForProfile`.
2. Пользователь сохраняет single-object или batch payload через `POST /api/rounds/config`.
3. Query layer валидирует объект и список комнат.
4. После сохранения идет revalidate для `/rounds`, `/rounds/config`, `/rounds/today`, `/rounds/archive`, `/rounds/qr`.
5. QR-печатная форма читает уже сохраненное состояние через `getRoundsPrintRowsForProfile`.

Write points:

- `object_rooms.rounds_enabled`

Primary code paths:

- `lib/rounds/queries.ts`
- `app/api/rounds/config/route.ts`
- `app/(dashboard)/rounds/qr/page.tsx`

### 4.3. `PPR task details -> comments -> attachments`

Entry points:

- `app/(dashboard)/ppr/tasks/[id]/page.tsx`
- `components/ppr/tasks/ppr-task-details.tsx`
- `app/api/ppr/tasks/[id]/comments/route.ts`
- `app/api/ppr/tasks/[id]/attachments/route.ts`

Current flow:

1. Страница карточки читает task.
2. Затем делает `Promise.all` по work items, assignee candidates и comments.
3. `PprTaskDetails` рендерит root gallery и gallery для каждого комментария.
4. Каждая `PprTaskAttachmentsGallery` отдельно дергает `GET /api/ppr/tasks/[id]/attachments`.
5. Комментарии пишутся отдельным `POST`, фото пишутся отдельным `POST` в attachments route.

Write points:

- `ppr_task_comments`
- `ppr_task_attachments`
- storage bucket для PPR attachments
- audit log через `writeAudit()`

Primary code paths:

- `app/(dashboard)/ppr/tasks/[id]/page.tsx`
- `components/ppr/tasks/ppr-task-details.tsx`
- `components/ppr/tasks/ppr-task-attachments-gallery.tsx`

### 4.4. `PPR calendar -> month plan -> materialization`

Entry points:

- `app/(dashboard)/ppr/calendar/page.tsx`
- `app/api/ppr/cron/run/route.ts`
- `lib/ppr/scheduler.ts`

Current flow:

1. Calendar page читает systems, year overview, month plans и month plan items.
2. Планирование месяца завязано на `generateMonthPlanForSystem`.
3. Materialization идет через `materializePlanItemsInRange`.
4. Cron endpoint оркестрирует carryover, materialization и sync статусов.

Write points:

- `ppr_month_plans`
- `ppr_month_plan_items`
- `ppr_tasks`
- `ppr_task_work_items`
- audit log для cron-run

Primary code paths:

- `lib/ppr/scheduler.ts`
- `app/api/ppr/cron/run/route.ts`
- `lib/ppr/queries.ts`

### 4.5. `Room QR -> room card / rounds resolve`

Entry points:

- `app/(dashboard)/ppr/rooms/qr/[token]/page.tsx`
- `lib/object-room-qr.ts`
- `app/(dashboard)/ppr/rooms/[id]/page.tsx`
- `app/api/rounds/resolve/[token]/route.ts`

Current flow:

1. Постоянный QR помещения резолвится через `object_room_resolve_qr_token`.
2. Если помещение доступно, entry page редиректит в `/ppr/rooms/[id]`.
3. Для обходов тот же room token может попасть в scanner flow и резолвиться через rounds-specific route.

Write points:

- в normal room-card flow записи нет;
- записи появляются только если из дальнейшего scanner flow пользователь подтверждает отметку обхода.

Primary code paths:

- `lib/object-room-qr.ts`
- `lib/object-rooms.ts`
- `app/(dashboard)/ppr/rooms/[id]/page.tsx`
- `app/api/rounds/resolve/[token]/route.ts`

## 5. Baseline Conclusions For Phase 1

Что уже видно до следующей фазы:

- `Rounds` и `PPR` основные проблемы создают не bundle size сами по себе, а orchestration данных и лишние roundtrip’ы.
- `Rounds scan` и `Rounds config` остаются самыми чувствительными экранами для мобильного UX.
- `PPR task details` уже на baseline подтверждает высокий риск из-за attachment fan-out и отдельной dev runtime аномалии.
- `PPR calendar` тяжел по серверной сборке данных и по размеру client shell, даже если короткий post-load CPU профиль не выглядит критичным.
