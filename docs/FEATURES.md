# Функции системы

Список реализованных функций с указанием путей к коду.

---

## Страницы (роуты)

- **Главная, редирект** — `/` → `/login` (неавторизован) или `/my` (авторизован)
  - `app/page.tsx` — `HomePage`

- **Вход** — форма логина по email/паролю (Supabase Auth)
  - `app/login/page.tsx` — `LoginPage`
  - `components/auth/login-form.tsx` — `LoginForm`, `onSubmit` (signInWithPassword)

- **Мои задачи** — список задач с фильтрами (q, status, priority, object, assignee, team_member, due, sort) и поиском
  - `app/(dashboard)/my/page.tsx` — `MyTasksPage`
  - `lib/tasks.ts` — `listTasksForProfile` (kind: "my")
  - `components/tasks/task-filters.tsx` — `TaskFilters`
  - `components/tasks/task-list.tsx` — `TaskList`

- **Новые задачи** — список задач `status=new`, кнопка «В работу»
  - `app/(dashboard)/new/page.tsx` — `NewTasksPage`
  - `lib/tasks.ts` — `listTasksForProfile` (kind: "new")
  - `components/tasks/task-list.tsx` — `TaskList` (showTakeButton)

- **Архив** — список задач с `archived_at is not null`
  - `app/(dashboard)/archive/page.tsx` — `ArchivePage`
  - `lib/tasks.ts` — `listTasksForProfile` (kind: "archive")

- **Карточка задачи** — детали, статус, описание, команда, комментарии, история
  - `app/(dashboard)/tasks/[id]/page.tsx` — `TaskDetailsPage`
  - `lib/tasks.ts` — `getTaskByIdForProfile`, `getTaskHistoryForProfile`
  - `components/tasks/status-control.tsx` — `StatusControl`
  - `components/tasks/comment-form.tsx` — `CommentForm`
  - `components/tasks/task-team-manager.tsx` — `TaskTeamManager`

- **Создание задачи** — форма с объектом, приоритетом, сроком, исполнителем, командой
  - `app/(dashboard)/tasks/create/page.tsx` — `CreateTaskPage`
  - `components/tasks/create-task-form.tsx` — `CreateTaskForm`
  - `app/actions/task-actions.ts` — `createTaskAction`

- **Объекты** — справочник объектов эксплуатации
  - `app/(dashboard)/objects/page.tsx` — `ObjectsPage`
  - `components/dictionaries/objects-admin-list.tsx` — `ObjectsAdminList`

- **Создание объекта**
  - `app/(dashboard)/objects/create/page.tsx` — `CreateObjectPage`
  - `app/actions/task-actions.ts` — `createObjectAction`, `createObjectFormAction`

- **Редактирование/удаление объекта**
  - `app/actions/task-actions.ts` — `updateObjectAction`, `deleteObjectAction`
  - `components/dictionaries/objects-admin-list.tsx` — формы редактирования/удаления

- **Пользователи** — справочник учётных записей и ролей
  - `app/(dashboard)/users/page.tsx` — `UsersPage`
  - `components/dictionaries/users-admin-list.tsx` — `UsersAdminList`

- **Создание пользователя**
  - `app/(dashboard)/users/create/page.tsx` — `CreateUserPage`
  - `app/actions/user-actions.ts` — `createUserAction`

- **Редактирование/удаление пользователя**
  - `app/actions/user-actions.ts` — `updateUserAction`, `deleteUserAction`
  - `components/dictionaries/users-admin-list.tsx` — формы редактирования/удаления

- **Профиль** — ФИО, email, роль, подсказка по PWA
  - `app/(dashboard)/profile/page.tsx` — `ProfilePage`

- **Журнал действий (Audit)** — лента изменений с фильтрами по action и entity_type
  - `app/(dashboard)/audit/page.tsx` — `AuditPage`
  - `lib/auth.ts` — `canViewAudit` (admin, chief)

---

## API

- **POST** `/api/tasks/[id]/status` — смена статуса задачи (new/in_progress/done)
  - `app/api/tasks/[id]/status/route.ts` — `POST`
  - `lib/task-permissions.ts` — `canChangeStatus`
  - `lib/audit.ts` — `writeAudit` (action: status_change)

- **POST** `/api/tasks/[id]/pause` — поставить задачу на паузу (причина + дата возобновления)
  - `app/api/tasks/[id]/pause/route.ts` — `POST`
  - RPC `pause_task` (Supabase)

- **GET** `/api/tasks/[id]/history` — история задачи (audit_log по entity_type=task)
  - `app/api/tasks/[id]/history/route.ts` — `GET`
  - `lib/tasks.ts` — `getTaskHistoryForProfile`

- **POST** `/api/tasks/[id]/comments` — добавить комментарий (с дедупом по client_msg_id)
  - `app/api/tasks/[id]/comments/route.ts` — `POST`
  - `lib/audit.ts` — `writeAudit` (action: comment)

- **POST** `/api/tasks/[id]/team` — добавить участника в команду задачи
  - `app/api/tasks/[id]/team/route.ts` — `POST`
  - `lib/task-permissions.ts` — `canManageTaskTeam`
  - `lib/audit.ts` — `writeAudit` (action: team_add_member)

- **DELETE** `/api/tasks/[id]/team` — удалить участника из команды
  - `app/api/tasks/[id]/team/route.ts` — `DELETE`
  - `lib/audit.ts` — `writeAudit` (action: team_remove_member)

- **POST** `/api/push/subscribe` — регистрация push-подписки устройства
  - `app/api/push/subscribe/route.ts` — `POST`
  - вставка в `push_subscriptions`

- **POST** `/api/push/send-assignment` — отправка push при назначении задачи (для lead/chief/admin)
  - `app/api/push/send-assignment/route.ts` — `POST`
  - `lib/push.ts` — `sendPushToUser`
  - `lib/auth.ts` — `canEditTasks`

- **POST** `/api/cron/archive` — автоархив выполненных задач (36 ч)
  - `app/api/cron/archive/route.ts` — `POST`
  - проверка заголовка `x-cron-secret`
  - RPC `archive_done_tasks` (Supabase)

---

## Server Actions

- **Выход** — `app/actions/auth-actions.ts` — `signOutAction`

- **Взять задачу в работу** — `app/actions/task-actions.ts` — `takeTaskInWork`
  - смена статуса на in_progress, accepted_at

- **Смена статуса** — `app/actions/task-actions.ts` — `updateTaskStatus`
  - new, in_progress, done (без paused)

- **Поставить на паузу** — `app/actions/task-actions.ts` — `pauseTask`
  - RPC `pause_task`

- **Добавить комментарий** — `app/actions/task-actions.ts` — `addTaskComment`

- **Создать задачу** — `app/actions/task-actions.ts` — `createTaskAction`
  - push назначаемому, добавление команды

- **Добавить/удалить участника команды** — `app/actions/task-actions.ts` — `addTaskTeamMemberAction`, `removeTaskTeamMemberAction`

- **Создать/изменить/удалить объект** — `app/actions/task-actions.ts` — `createObjectAction`, `createObjectFormAction`, `updateObjectAction`, `deleteObjectAction`

- **Создать/изменить/удалить пользователя** — `app/actions/user-actions.ts` — `createUserAction`, `updateUserAction`, `deleteUserAction`
  - `createSupabaseAdminClient`, `admin.auth.admin.createUser` / `deleteUser`
  - `profiles`, `user_objects`

---

## Офлайн

- **Очередь действий** — LocalForage, storeName: `pending_actions`
  - `lib/offline/queue.ts` — `enqueueAction`, `flushQueue`, `runAction`
  - типы: `update_status`, `add_comment`
  - при online — отправка в `/api/tasks/[id]/status` и `/api/tasks/[id]/comments`

- **Запись в очередь при офлайне**
  - `components/tasks/status-control.tsx` — при `!navigator.onLine` вызывает `enqueueAction` (update_status)
  - `components/tasks/comment-form.tsx` — при `!navigator.onLine` вызывает `enqueueAction` (add_comment)
  - пауза (pause) не поддерживается офлайн — требуется сеть

- **Синк при восстановлении сети**
  - `components/offline/offline-sync-bootstrap.tsx` — `OfflineSyncBootstrap`
  - `useEffect`: `flushQueue()` при mount + `window.addEventListener("online", flushQueue)`

---

## PWA и Push

- **Регистрация Service Worker** — `components/pwa/register-sw.tsx` — `RegisterSW`
  - `navigator.serviceWorker.register("/sw.js")`
  - запрос разрешения Notification
  - подписка на push (PushManager.subscribe, VAPID)
  - отправка подписки на `/api/push/subscribe`

- **Отправка push** — `lib/push.ts` — `sendPushToUser`
  - web-push, VAPID
  - чтение подписок из `push_subscriptions`
  - вызов из `createTaskAction` и `/api/push/send-assignment`

---

## Middleware и Auth

- **Middleware** — `middleware.ts`
  - обновление сессии Supabase (getUser)
  - matcher: всё кроме `_next/static`, `_next/image`, `favicon.ico`, `sw.js`, `manifest.webmanifest`

- **Авторизация API** — `lib/api-auth.ts` — `getApiSession`
  - использует `createSupabaseServerClient`, `getUser`, профиль из `profiles`

- **Права** — `lib/auth.ts` — `requireProfile`, `canManageUsers`, `canManageObjects`, `canEditTasks`, `canManageTaskTeam`, `canViewAudit`, `getSessionUser`

- **Права задач** — `lib/task-permissions.ts` — `canChangeStatus`, `canReadTaskByRole`, `canManageTaskTeam`, `canCreateOrAssignTask`

---

## Audit

- **Запись в журнал** — `lib/audit.ts` — `writeAudit`
  - вставка в `audit_log` (actor_id, action, entity_type, entity_id, meta)
  - вызывается из actions и API при status_change, comment, team_add/remove, create/update/delete object/user, create_task, assign_task, accept, pause_task

---

## Справочники

- **Типы статусов и приоритетов** — `lib/task-presentation.ts` — `taskStatusMeta`, `taskPriorityMeta`
- **Типы** — `lib/types.ts` — Profile, TaskItem, TaskStatus, TaskPriority и др.
