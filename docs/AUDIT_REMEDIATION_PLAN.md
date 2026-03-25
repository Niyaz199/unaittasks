# План исправлений по итогам аудита

> Документ фиксирует пошаговый remediation plan после архитектурного, performance, data-flow и PWA/offline аудита.  
> Это не список идей, а рекомендуемая очередность работ с учетом риска, влияния на пользователей и стоимости изменений.

## 1. Цель

Снизить:

- риск скрытых регрессий в `PPR`, `Rounds` и shared-слое помещений;
- время открытия тяжелых экранов;
- количество лишних запросов и лишней сериализации;
- хрупкость offline/PWA сценариев;
- связность между модулями и дублирование access/data logic.

## 2. Общая стратегия

Работы лучше выполнять не одним большим рефакторингом, а 5 фазами:

1. стабилизация критических рисков;
2. устранение самых дорогих bottleneck’ов по загрузке и данным;
3. декомпозиция тяжелых UI-модулей;
4. усиление offline/PWA слоя;
5. архитектурная уборка и страховка тестами.

Главный принцип:

- сначала чинить то, что может ломать данные, права доступа и синхронизацию;
- потом чинить то, что сильнее всего влияет на perceived performance;
- только после этого делать более глубокую архитектурную чистку.

## 3. Критерии успеха

План можно считать выполненным, когда:

- права доступа по `Rounds`, `object_rooms`, API и RLS перестанут расходиться;
- offline-очереди перестанут синхронизироваться параллельно и станут идемпотентными;
- тяжелые страницы перестанут тянуть крупные массивы в клиент без необходимости;
- карточка ППР-заявки и scanner flow перестанут создавать избыточные сетевые roundtrip’ы;
- календарь ППР станет проще по структуре и легче по initial load;
- появится базовый smoke/e2e safety net на критические сценарии.

## 4. Фаза 0. Базовая диагностика перед исправлениями

### Шаг 0.1. Зафиксировать baseline производительности

Проблема:

- Сейчас есть обоснованные признаки медленной загрузки, но нет зафиксированного baseline по ключевым экранам.

Почему это важно:

- Без baseline сложно понять, какие изменения действительно помогли.

Где:

- `app/(dashboard)/ppr/calendar/page.tsx`
- `app/(dashboard)/ppr/tasks/[id]/page.tsx`
- `app/(dashboard)/ppr/equipment/page.tsx`
- `app/(dashboard)/ppr/rooms/page.tsx`
- `app/(dashboard)/rounds/config/page.tsx`
- `app/(dashboard)/rounds/scan/page.tsx`

Что сделать:

- замерить TTFB, размер initial payload, hydration time и число запросов для desktop/mobile;
- отдельно замерить scanner flow и карточку ППР-заявки;
- завести простой markdown baseline в `docs/` или issue tracker.

Критерий готовности:

- есть таблица с baseline по ключевым маршрутам до начала рефакторинга.

### Шаг 0.2. Составить карту критических execution flows

Проблема:

- Критические пользовательские потоки уже затрагивают несколько модулей и shared-layer.

Что сделать:

- явно задокументировать 5 основных flow:
- `Rounds scan -> resolve -> confirm -> sync`
- `Rounds config -> save -> read -> print QR`
- `PPR task details -> comments -> attachments`
- `PPR calendar -> month plan -> materialization`
- `Room QR -> room card / rounds resolve`

Критерий готовности:

- есть короткая схема текущих flow и точек записи в БД.

## 5. Фаза 1. Критическая стабилизация

### Шаг 1.1. Выровнять матрицу доступа для `Rounds` и `object_rooms`

Приоритет:

- `Critical`

Проблема:

- UI/permission layer для `Rounds` и DB/RLS-уровень для записи `object_rooms.rounds_enabled` сейчас логически могут расходиться.

Почему это проблема:

- пользователь может видеть доступный сценарий, но фактически упираться в отказ на data layer;
- такие ошибки выглядят как “плавающие” и плохо диагностируются.

Где:

- `lib/rounds/permissions.ts`
- `lib/rounds/queries.ts`
- `lib/object-rooms.ts`
- `supabase/migrations/0019_object_rooms_and_ppr_system_refactor.sql`

Что сделать:

- определить единую policy matrix для чтения и записи;
- отдельно описать, кто может менять `rounds_enabled`;
- либо синхронизировать текущие роли между app-layer и RLS;
- либо перевести запись `rounds_enabled` на отдельный RPC с явной серверной проверкой scope/role;
- убрать ситуацию, где app разрешает то, что RLS запрещает.

Критерий готовности:

- одинаковый ответ на вопрос “кто может менять конфигурацию обходов” на уровне UI, API, query layer и SQL/RLS.

### Шаг 1.2. Ввести единый coordinator для offline sync

Приоритет:

- `Critical`

Проблема:

- offline sync запускается из нескольких мест и может идти параллельно.

Почему это проблема:

- возможны дубликаты, гонки состояний и неконсистентная очередь.

Где:

- `components/offline/offline-sync-bootstrap.tsx`
- `lib/offline/queue.ts`
- `lib/offline/rounds-queue.ts`
- `components/rounds/rounds-sync-status.tsx`

Что сделать:

- добавить единый in-memory mutex/in-flight guard;
- сделать один orchestration entry-point для синка обеих очередей;
- запретить параллельный запуск при `focus`, `online`, `visibilitychange`, manual sync;
- ввести backoff и нормальную стратегию retry;
- сделать state transitions очереди атомарными.

Критерий готовности:

- параллельный sync физически невозможен;
- очередь не дублирует одну и ту же отправку;
- повторный запуск не ломает статус элементов.

### Шаг 1.3. Перевести тяжелые bulk-операции календаря ППР на batch/RPC

Приоритет:

- `Critical`

Проблема:

- scheduler ППР пишет данные поштучно в циклах.

Почему это проблема:

- это медленно, нет хорошей transactional boundary, легко получить частично завершенный сценарий.

Где:

- `lib/ppr/scheduler.ts`
- связанный SQL-слой в `supabase/migrations/0013_ppr_calendar.sql`
- `app/api/ppr/cron/run/route.ts`

Что сделать:

- вынести generation/materialization в SQL/RPC или в явные batch-операции;
- минимизировать per-row `insert/update/select`;
- использовать UPSERT и ключи идемпотентности;
- определить rollback-safe/partial-safe стратегию.

Критерий готовности:

- генерация месяца и materialization не зависят от длинных JS-циклов с большим количеством roundtrip’ов.

## 6. Фаза 2. Самые дорогие проблемы загрузки и data layer

### Шаг 2.1. Убрать waterfall вложений на карточке ППР-заявки

Приоритет:

- `High`

Проблема:

- карточка задачи делает отдельный запрос вложений для root и для каждого комментария.

Почему это проблема:

- число запросов растет вместе с количеством комментариев;
- страница замедляется на сервере и на клиенте.

Где:

- `app/(dashboard)/ppr/tasks/[id]/page.tsx`
- `components/ppr/tasks/ppr-task-details.tsx`
- `components/ppr/tasks/ppr-task-attachments-gallery.tsx`
- `app/api/ppr/tasks/[id]/attachments/route.ts`

Что сделать:

- грузить все attachments для task одним server-side запросом;
- группировать их по `comment_id`;
- передавать готовую структуру в UI;
- убрать nested fetch из gallery-компонентов.

Критерий готовности:

- карточка ППР-заявки открывается с одним data-fetch для attachments вместо fan-out запросов.

### Шаг 2.2. Перенести текстовые фильтры и narrow-scope фильтрацию ближе к БД

Приоритет:

- `High`

Проблема:

- часть экранов тянет широкие выборки и фильтрует уже в TypeScript.

Почему это проблема:

- лишний трафик, лишняя сериализация, лишний CPU.

Где:

- `lib/rounds/queries.ts`
- `lib/ppr/queries.ts`

Что сделать:

- проверить и сузить:
- `getRoundsArchiveForProfile()`
- `listRoundsConfigRoomsForProfile()`
- `listPprMonthPlanItemsForProfile()`
- крупные list-функции ППР, которые сначала читают много строк, а потом режут в памяти;
- where возможно, использовать DB-level filtering и limit/pagination.

Критерий готовности:

- большинство экранов получают уже narrowed dataset, а не “почти всё, а потом фильтр в памяти”.

### Шаг 2.3. Сократить повторные auth/profile/object-scope запросы

Приоритет:

- `High`

Проблема:

- профиль и scope по объектам многократно читаются повторно в page/API/query слоях.

Почему это проблема:

- лишняя латентность почти на каждом маршруте.

Где:

- `lib/auth.ts`
- `lib/api-auth.ts`
- `lib/object-rooms.ts`
- `lib/ppr/queries.ts`
- `lib/rounds/queries.ts`

Что сделать:

- сделать request-scoped helper для `{ supabase, user, profile }`;
- централизовать reusable object-scope helpers;
- убрать повторный fetch одних и тех же `objects/user_objects` в одном запросном сценарии.

Критерий готовности:

- основные SSR/API сценарии не делают повторных reads профиля и object scope без необходимости.

### Шаг 2.4. Схлопнуть дублирующие запросы scanner flow

Приоритет:

- `High`

Проблема:

- scanner и confirm screen в обходах повторно тянут конфигурацию.

Почему это проблема:

- лишние network roundtrip’ы на самом частом mobile flow.

Где:

- `components/rounds/rounds-scanner.tsx`
- `components/rounds/rounds-entry-form.tsx`
- `app/api/rounds/config/route.ts`
- `app/api/rounds/resolve/[token]/route.ts`

Что сделать:

- ввести единый cached scanner-config provider;
- использовать snapshot/config как shared state между scan и confirm;
- `resolve/[token]` оставить только как targeted fallback, а не второй обязательный путь;
- проверить размер payload у `/api/rounds/config`.

Критерий готовности:

- scan -> confirm не дублирует полную загрузку конфигурации без необходимости.

## 7. Фаза 3. Декомпозиция тяжелых экранов и payload reduction

### Шаг 3.1. Разбить `PprCalendar` на smaller units

Приоритет:

- `High`

Проблема:

- текущий календарь ППР слишком большой, client-heavy и трудно поддерживаемый.

Где:

- `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx`
- `components/ppr/calendar/ppr-calendar-workbench.tsx`
- `components/ppr/calendar/ppr-calendar-admin.tsx`
- `app/(dashboard)/ppr/calendar/page.tsx`

Что сделать:

- выделить чистые selector/helper modules;
- разделить filters, overview, monthly grid, monthly list, details drawer;
- вынести drag/drop и month-specific interactions в отдельный chunk;
- удалить или архивировать неиспользуемые альтернативные реализации.

Критерий готовности:

- календарь состоит из нескольких понятных компонентов, а не из одного giant client file.

### Шаг 3.2. Уменьшить initial payload для страниц-справочников

Приоритет:

- `High`

Проблема:

- экраны ППР и обходов сериализуют крупные массивы для client-side фильтрации.

Где:

- `app/(dashboard)/ppr/equipment/page.tsx`
- `app/(dashboard)/ppr/rooms/page.tsx`
- `app/(dashboard)/rounds/config/page.tsx`
- соответствующие admin-компоненты в `components/`

Что сделать:

- перейти на server-filtered/object-scoped initial dataset;
- вводить pagination или progressive loading;
- lazy-load больших модалок и вспомогательных редакторов;
- уменьшить количество справочных массивов, приходящих сразу в клиент.

Критерий готовности:

- initial props у этих страниц существенно уже, чем сейчас.

### Шаг 3.3. Добавить `loading.tsx` и `error.tsx` на тяжелые маршруты

Приоритет:

- `Medium`

Проблема:

- долгие запросы сейчас воспринимаются как “страница подвисла”.

Где:

- `app/(dashboard)/ppr/*`
- `app/(dashboard)/rounds/*`

Что сделать:

- добавить module-level loading states для:
- `/ppr/calendar`
- `/ppr/tasks/[id]`
- `/ppr/equipment`
- `/ppr/rooms`
- `/rounds/config`
- `/rounds/archive`
- `/rounds/scan`
- добавить `error.tsx` хотя бы на уровне модульных сегментов.

Критерий готовности:

- тяжелые экраны всегда имеют понятный skeleton/loading/error UX.

### Шаг 3.4. Расширить selective lazy loading

Приоритет:

- `Medium`

Проблема:

- паттерн dynamic import есть локально, но не масштабирован на новые тяжелые модули.

Где:

- `components/ppr/*`
- `components/rounds/*`

Что сделать:

- lazy-load:
- QR boards
- heavy modals
- details drawers
- large galleries
- month-specific DnD/grid UI

Критерий готовности:

- JS bundle для ключевых страниц уменьшается без потери UX.

## 8. Фаза 4. Усиление offline/PWA и mobile сценариев

### Шаг 4.1. Отложить push subscription до авторизованного и явного opt-in

Приоритет:

- `Medium`

Проблема:

- регистрация SW и попытка подписки на push запускаются слишком рано.

Где:

- `app/layout.tsx`
- `components/pwa/register-sw.tsx`

Что сделать:

- не подписывать пользователя на push до появления сессии;
- лучше вынести подписку в авторизованный контур;
- по возможности сделать явный opt-in вместо автоматического permission prompt.

Критерий готовности:

- push permission не запрашивается слишком рано и не срабатывает для анонимного пользователя.

### Шаг 4.2. Переделать cache strategy service worker

Приоритет:

- `Medium`

Проблема:

- service worker сейчас кеширует shell по слишком простой схеме и слабо управляет freshness данных.

Где:

- `public/sw.js`

Что сделать:

- разделить shell/static/data cache;
- пересмотреть fallback для HTML navigation;
- не держать критически важные data screens в stale-режиме без контроля;
- ввести versioning и более явную стратегию invalidation.

Критерий готовности:

- offline-поведение предсказуемо, а stale-контент не маскирует устаревшие данные.

### Шаг 4.3. Убрать main-thread лаги от обработки фото на телефонах

Приоритет:

- `Medium`

Проблема:

- компрессия фото для обходов идет на главном потоке.

Где:

- `lib/rounds/client-photo.ts`
- `components/rounds/rounds-entry-form.tsx`

Что сделать:

- либо переносить компрессию в worker;
- либо вводить adaptive compression;
- либо уменьшать исходный input-size раньше, еще до canvas resize;
- проверить memory pressure на слабых Android.

Критерий готовности:

- добавление фото в обходах не вызывает заметного UI-freeze на телефоне.

### Шаг 4.4. Улучшить mobile navigation для модульной структуры

Приоритет:

- `Medium`

Проблема:

- mobile entry points для модулей несимметричны, особенно для `PPR`.

Где:

- `components/dashboard/mobile-tabs.tsx`
- `app/(dashboard)/layout.tsx`

Что сделать:

- добавить понятный мобильный вход в `PPR`;
- либо сделать mobile module launcher;
- проверить, что все основные роли могут быстро попасть в оба новых модуля на телефоне.

Критерий готовности:

- мобильный пользователь не теряет доступность модульной навигации из-за скрытой sidebar.

## 9. Фаза 5. Архитектурная уборка и снижение связности

### Шаг 5.1. Разрезать `lib/ppr/queries.ts` на подмодули

Приоритет:

- `Medium`

Проблема:

- один файл держит слишком много responsibility.

Что сделать:

- выделить:
- `ppr/structure-queries`
- `ppr/calendar-queries`
- `ppr/task-queries`
- `ppr/task-read-models`
- `ppr/access` или `ppr/scopes`

Критерий готовности:

- PPR query layer разбит по bounded responsibility, а не по историческому накоплению.

### Шаг 5.2. Централизовать shared object-scope access layer

Приоритет:

- `Medium`

Проблема:

- логика доступа к объектам повторяется в `PPR`, `Rounds`, `object_rooms`.

Где:

- `lib/object-rooms.ts`
- `lib/ppr/queries.ts`
- `lib/rounds/queries.ts`
- `lib/ppr/task-lifecycle.ts`

Что сделать:

- вынести shared helper для scoped object access;
- использовать одну и ту же модель object access во всех доменах.

Критерий готовности:

- правила “какие объекты доступны роли/пользователю” описаны в одном месте.

### Шаг 5.3. Унифицировать relation normalization / read models

Приоритет:

- `Nice to have`

Проблема:

- однотипные helper’ы для relation unwrap/resolve names размазаны по проекту.

Что сделать:

- сделать shared read-model normalization helpers;
- сократить дублирование `unwrapRelation`, `resolveName`, `resolveFloorName` и аналогов.

Критерий готовности:

- relation payloads приводятся к UI-friendly DTO единообразно.

### Шаг 5.4. Удалить исторические UI-хвосты

Приоритет:

- `Nice to have`

Проблема:

- в репозитории лежат параллельные и частично дублирующие реализации крупных экранов.

Где:

- в первую очередь `components/ppr/calendar/*`

Что сделать:

- оставить одну каноничную реализацию;
- убрать неиспользуемые/устаревшие варианты после проверки импорта и маршрутов.

Критерий готовности:

- нет конкурирующих реализаций одного и того же большого экрана.

## 10. Страховка тестами

### Шаг 10.1. Добавить минимальный smoke/e2e набор

Приоритет:

- `High`

Проблема:

- сейчас у проекта почти нет автоматической страховки на критические сценарии.

Что сделать:

- покрыть smoke/e2e:
- login/auth redirect
- rounds config save/read
- rounds scanner confirm flow
- room QR resolve flow
- PPR task details with comments/attachments
- PPR calendar month generation happy path

Критерий готовности:

- базовые критические потоки проверяются автоматически до ручного QA.

### Шаг 10.2. Добавить targeted unit/integration tests на pure logic

Приоритет:

- `Medium`

Где:

- `lib/ppr/scheduler.ts`
- `lib/ppr/task-lifecycle.ts`
- `lib/rounds/date.ts`
- `lib/rounds/token.ts`
- shared permission helpers

Критерий готовности:

- чистая доменная логика перестает проверяться только руками.

## 11. Рекомендуемая очередность выполнения

Если делать максимально практично, порядок такой:

1. `Шаг 0.1` и `Шаг 0.2`
2. `Шаг 1.1`
3. `Шаг 1.2`
4. `Шаг 1.3`
5. `Шаг 2.1`
6. `Шаг 2.2`
7. `Шаг 2.3`
8. `Шаг 2.4`
9. `Шаг 3.1`
10. `Шаг 3.2`
11. `Шаг 3.3`
12. `Шаг 4.1`
13. `Шаг 4.2`
14. `Шаг 4.3`
15. `Шаг 4.4`
16. `Шаг 5.1`
17. `Шаг 5.2`
18. `Шаг 5.3`
19. `Шаг 5.4`
20. `Шаг 10.1`
21. `Шаг 10.2`

## 12. Что даст наибольший эффект быстрее всего

Самый большой practical impact дадут первые 6 направлений:

1. выравнивание access/RLS для `Rounds`
2. sync coordinator для offline-очередей
3. batch/RPC refactor для scheduler ППР
4. устранение attachment waterfall в карточке ППР
5. перенос фильтрации ближе к БД
6. схлопывание дублирующих scanner-config запросов

Именно они сильнее всего влияют одновременно на:

- стабильность;
- скорость;
- поддержку;
- предсказуемость поведения для пользователя.

