# Возможности системы

> Документ фиксирует реализованные возможности и текущие ограничения. Он согласован с `README.md`, но подробнее делит систему по модулям и по уже завершённым remediation-улучшениям.

## 1. Что входит в систему

В репозитории сейчас есть три прикладных контура:

- обычные эксплуатационные задачи;
- модуль ППР;
- модуль обходов.

Поверх них работают:

- роли и object scope;
- shared rooms/directories;
- комментарии и вложения;
- audit;
- push;
- частичный offline/PWA;
- Playwright smoke/e2e baseline.

## 2. Навигация и shell

Реализовано:

- редирект `/` в `/login` или `/my` в зависимости от сессии;
- авторизованный dashboard layout;
- desktop sidebar с родительскими module entry points;
- mobile module launcher для `Задачи / ППР / Обходы`;
- профиль пользователя;
- login/logout через Supabase Auth.

Текущая логика навигации:

- клик по `ППР` открывает `/ppr` и раскрывает подразделы;
- клик по `Обходы` открывает `/rounds` и раскрывает подразделы;
- дублирующие подпункты “Модуль ...” удалены;
- мобильная навигация сохраняет быстрый доступ к базовому task-модулю.

## 3. Shared rooms и room QR

Реализовано:

- общий справочник помещений `object_rooms`;
- глобальные этажи `floors`;
- глобальные типы помещений `room_types`;
- страница `/ppr/rooms`;
- карточка помещения `/ppr/rooms/[id]`;
- общий room QR entry `/ppr/rooms/qr/[token]`;
- автоматическое создание room QR при создании помещения;
- ручная регенерация room QR из карточки помещения;
- отдельный флаг участия в обходах `rounds_enabled`.

Важно:

- QR помещения теперь общий, а не “только обходный”;
- room QR уже используется в `Rounds`, но не ограничен ими архитектурно;
- участие в обходах регулируется отдельным флагом, а не наличием QR.

## 4. Модуль задач

Реализовано:

- список `Мои задачи` с поиском, фильтрами, сортировкой и группировкой;
- список `Новые задачи`;
- `Архив`;
- создание задачи;
- карточка задачи;
- назначение ответственного;
- команда задачи;
- комментарии;
- история;
- вложения;
- ручной архив для `admin/chief`;
- автоархив выполненных задач через cron/RPC после `36` часов;
- push по task-сценариям.

Фактическая модель статусов:

- `new`
- `accepted`
- `in_progress`
- `paused`
- `done`

Особенности:

- “взять в работу” сначала переводит задачу в `accepted`;
- pause — отдельный сценарий через RPC;
- offline-поддержка есть только для части mutating действий.

## 5. Модуль ППР

Реализовано:

- отдельный dashboard `/ppr`;
- справочник групп систем;
- справочник систем;
- shared room directory `/ppr/rooms`;
- карточка помещения и room QR entry;
- справочник оборудования;
- карточка оборудования;
- QR оборудования и QR-entry;
- шаблоны периодических работ;
- чек-листы шаблонов;
- назначения шаблонов на оборудование;
- календарь ППР;
- генерация месячного плана;
- materialization позиций плана в ППР-заявки;
- реестр ППР-заявок;
- список `Мои ППР`;
- архив ППР;
- карточка ППР-заявки;
- назначение исполнителя;
- комментарии к ППР-заявке;
- фото-вложения к ППР-заявке;
- перенос ППР-заявки внутри месяца;
- отмена и закрытие ППР-заявки;
- cron-runner для carryover/materialization/sync.

Фактическая модель статусов ППР:

- `new`
- `in_progress`
- `done`
- `closed`
- `cancelled`

Отдельно:

- `done` требует минимум один комментарий и одно фото;
- карточка ППР-заявки больше не собирает attachments waterfall по комментариям;
- `lib/ppr/queries.ts` сохранён как публичный barrel, но внутри разрезан на bounded submodules.

## 6. Календарь ППР

Сейчас реализовано:

- yearly overview;
- monthly operational view;
- фильтры по объекту, группе и системе;
- drill-down по year -> system -> month;
- drag-and-drop переносы внутри месяца;
- fallback-формы для ручного переноса;
- route-level `loading.tsx`;
- module-level `error.tsx`;
- selective lazy loading тяжёлых monthly parts.

Календарь уже декомпозирован на отдельные части:

- `ppr-calendar-monthly-dnd`
- `ppr-calendar-year-view`
- `ppr-calendar-month-section`
- `filters-drawer`
- `item-drawers`

## 7. Модуль обходов

Реализовано:

- top-level модуль `/rounds`;
- модульная home page `/rounds`;
- `/rounds/scan` с mobile-first scanner flow;
- `/rounds/entry/[token]` как deep-link redirect;
- подтверждение помещения через `/rounds/scan?token=...`;
- `/rounds/today`;
- `/rounds/archive`;
- `/rounds/config`;
- `/rounds/qr`;
- room QR resolve flow;
- upsert check-in по `room_id + operational_date` с правилом newer-wins по `scanned_at_device`;
- отдельный scanner read model через RPC;
- офлайн-очередь обходов с фото;
- ручной sync status UI.

### Конфигуратор обходов

Реализовано:

- сохранение `object_rooms.rounds_enabled`;
- массовое включение и отключение помещений;
- partial-save error handling;
- `object -> floors -> rooms` UX;
- выбор объекта до загрузки длинного списка;
- быстрый переход к печати QR по выбранному объекту.

### Today / Archive

`Today`:

- работает по схеме `объект -> этажи -> помещения`;
- показывает статус, кто отметил, время, комментарий/фото flags;
- использует только помещения с `rounds_enabled = true`.

`Archive`:

- остаётся табличным экраном с фильтрами;
- показывает фото через signed URL.

### QR помещений

`/rounds/qr`:

- печатная форма;
- поштучная выгрузка;
- использует общий room QR;
- не генерирует новый “обходный” QR отдельно.

## 8. Роли и права

Реализованы роли:

- `admin`
- `chief`
- `lead`
- `engineer`
- `object_engineer`
- `tech`

Права проверяются на нескольких уровнях:

- page-level guards;
- API/session guards;
- query layer;
- RLS.

После remediation:

- `Rounds config` write-access выровнен между UI/API/query layer и SQL;
- shared object scope вынесен в единый helper layer `lib/object-access.ts`;
- часть relation-specific нормализации вынесена в `lib/relation-normalization.ts`.

## 9. Вложения и фото

Обычные задачи:

- фото к задаче;
- фото к комментарию;
- bucket `task-attachments`;
- signed URLs.

ППР:

- фото к ППР-заявке;
- фото к комментарию ППР-заявки;
- bucket `ppr-files`;
- signed URLs.

Обходы:

- одно фото к отметке обхода;
- bucket `rounds-files`;
- signed URLs в today/archive.

Для обходов дополнительно:

- фото готовится до submit;
- основной путь — background/worker prepare;
- есть fallback без worker;
- stale state при быстрой замене/удалении фото отсечён.

## 10. Offline и PWA

Реализовано:

- `manifest.webmanifest`;
- регистрация service worker в dashboard-контуре;
- раздельные cache buckets `shell/static/data`;
- более предсказуемый offline fallback для `Rounds`;
- push opt-in из профиля;
- queue в `localforage`;
- единый offline sync coordinator;
- отдельная rounds queue с delayed sync фото.

Offline-поддержка сейчас покрывает:

- `update_status` обычных задач;
- `add_comment` обычных задач;
- `rounds_checkin` для обходов, включая фото.

Синк запускается:

- при mount;
- при `online`;
- при `focus`;
- при `visibilitychange`;
- вручную из UI.

Не покрыто offline-механизмом:

- весь `PPR`;
- справочники;
- административные операции;
- универсальная offline-first data cache всего приложения.

## 11. Performance и remediation-изменения

Уже сделано:

- access alignment для `Rounds` и `object_rooms`;
- единый coordinator для offline sync;
- batch-safe стабилизация PPR scheduler;
- server-side attachment read model для карточки ППР;
- перенос тяжёлой фильтрации ближе к query/data layer;
- request-scoped reuse session/profile между `auth` и `api-auth`;
- reuse server Supabase client на тяжёлых SSR-экранах;
- scanner config dedupe;
- декомпозиция тяжёлого PPR calendar;
- object-scoped payload для тяжёлых screens;
- route-level `loading.tsx` и module-level `error.tsx`;
- selective lazy loading тяжёлых client-only частей;
- mobile navigation cleanup;
- shared access and normalization helpers.

## 12. Тестирование

Реализован минимальный `Playwright` smoke/e2e baseline.

Покрываются сценарии:

- auth redirect;
- UI login;
- `Rounds config` save/read;
- room QR resolve + scanner confirm flow;
- `PPR task details`;
- `PPR calendar` month route;
- optional/manual-only smoke на month generation.

Запуск:

```bash
npm run test:e2e:install
npm run test:e2e
npm run test:e2e:headed
```

Data-driven env:

- `E2E_EMAIL`
- `E2E_PASSWORD`
- `E2E_ROUNDS_OBJECT_NAME`
- `E2E_ROUNDS_ROOM_NAME`
- `E2E_ROUNDS_TOKEN`
- `E2E_PPR_TASK_ID`
- `E2E_PPR_CALENDAR_SYSTEM_NAME`

Детали — в `tests/e2e/README.md`.

## 13. Что реализовано частично

- Offline и PWA не делают систему fully-offline.
- Push не является универсальным уведомительным слоем для всех модулей.
- У `PPR` нет отдельного push-контура.
- Часть transport-логики всё ещё распределена между `API routes` и `server actions`.
- `middleware.ts` не является единственным auth-gate для всех модулей.

## 14. Краткий вывод

Система сейчас покрывает не только обычные задачи, но и полноценные модульные контуры `PPR` и `Rounds`, объединённые через shared rooms/object scope и общую инфраструктуру.

Наиболее зрелые части:

- обычные задачи;
- shared rooms/directories;
- room QR и room card;
- обходы;
- базовый lifecycle ППР;
- PPR calendar после remediation;
- PWA/mobile/offline слой для задач и обходов.

Наиболее частично завершённые части:

- fully-offline опыт;
- универсальный push across all modules;
- полный test data baseline для всех data-driven smoke сценариев.
