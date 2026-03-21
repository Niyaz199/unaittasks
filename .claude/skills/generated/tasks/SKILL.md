---
name: tasks
description: "Skill for the Tasks area of zadachnik. 51 symbols across 15 files."
---

# Tasks

51 symbols | 15 files | Cohesion: 90%

## When to Use

- Working with code in `components/`
- Understanding how TaskFilters, buildQuickHref, canArchiveTask work
- Modifying tasks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `components/tasks/task-list.tsx` | getInitials, resolveAssignee, formatTime, urgencyLabel, TaskCard (+2) |
| `lib/task-sort.ts` | isOverdue, isDueToday, smartGroup, priorityWeight, smartSortTasks (+1) |
| `components/tasks/comment-form.tsx` | CommentForm, setError, setInfo, clearMessage, submit |
| `components/ppr/tasks/ppr-task-comment-form.tsx` | PprTaskCommentForm, setError, setInfo, clearMessage, submit |
| `components/tasks/task-action-menu.tsx` | TaskActionMenu, changeStatus, submitPause, archiveTask |
| `components/tasks/status-control.tsx` | StatusControl, submit, submitPause, submitArchive |
| `components/ppr/tasks/ppr-task-list.tsx` | unwrapRelation, formatDate, describeTask, PprTaskList |
| `components/ppr/tasks/ppr-task-details.tsx` | unwrapRelation, formatDate, formatDateTime, PprTaskDetails |
| `components/tasks/task-filters.tsx` | TaskFilters, buildQuickHref |
| `lib/task-permissions.ts` | canArchiveTask, getAllowedTaskTransitions |

## Entry Points

Start here when exploring this area:

- **`TaskFilters`** (Function) — `components/tasks/task-filters.tsx:46`
- **`buildQuickHref`** (Function) — `components/tasks/task-filters.tsx:83`
- **`canArchiveTask`** (Function) — `lib/task-permissions.ts:95`
- **`TaskActionMenu`** (Function) — `components/tasks/task-action-menu.tsx:15`
- **`changeStatus`** (Function) — `components/tasks/task-action-menu.tsx:42`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `TaskFilters` | Function | `components/tasks/task-filters.tsx` | 46 |
| `buildQuickHref` | Function | `components/tasks/task-filters.tsx` | 83 |
| `canArchiveTask` | Function | `lib/task-permissions.ts` | 95 |
| `TaskActionMenu` | Function | `components/tasks/task-action-menu.tsx` | 15 |
| `changeStatus` | Function | `components/tasks/task-action-menu.tsx` | 42 |
| `submitPause` | Function | `components/tasks/task-action-menu.tsx` | 75 |
| `archiveTask` | Function | `components/tasks/task-action-menu.tsx` | 101 |
| `POST` | Function | `app/api/tasks/[id]/archive/route.ts` | 5 |
| `smartSortTasks` | Function | `lib/task-sort.ts` | 41 |
| `sortTasks` | Function | `lib/task-sort.ts` | 68 |
| `TaskList` | Function | `components/tasks/task-list.tsx` | 241 |
| `getAllowedTaskTransitions` | Function | `lib/task-permissions.ts` | 79 |
| `StatusControl` | Function | `components/tasks/status-control.tsx` | 17 |
| `submit` | Function | `components/tasks/status-control.tsx` | 27 |
| `submitPause` | Function | `components/tasks/status-control.tsx` | 62 |
| `submitArchive` | Function | `components/tasks/status-control.tsx` | 101 |
| `CommentForm` | Function | `components/tasks/comment-form.tsx` | 7 |
| `setError` | Function | `components/tasks/comment-form.tsx` | 15 |
| `setInfo` | Function | `components/tasks/comment-form.tsx` | 20 |
| `clearMessage` | Function | `components/tasks/comment-form.tsx` | 25 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Offline | 3 calls |
| Status | 2 calls |
| Ppr | 1 calls |
| Actions | 1 calls |

## How to Explore

1. `gitnexus_context({name: "TaskFilters"})` — see callers and callees
2. `gitnexus_query({query: "tasks"})` — find related execution flows
3. Read key files listed above for implementation details
