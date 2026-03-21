---
name: actions
description: "Skill for the Actions area of zadachnik. 102 symbols across 34 files."
---

# Actions

102 symbols | 34 files | Cohesion: 72%

## When to Use

- Working with code in `app/`
- Understanding how listTasksForProfile, listObjectsForProfile, requireProfile work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `app/actions/task-actions.ts` | getTeamMemberIds, getObjectEngineerId, getTaskAccessRow, takeTaskInWork, updateTaskStatus (+13) |
| `app/actions/ppr-template-actions.ts` | requireTemplateManager, assertTemplateObjectAllowed, assertTemplateSystemBelongsToObject, parseChecklistItems, parseOptionalNumber (+9) |
| `app/actions/ppr-directory-actions.ts` | requireSystemGroupManager, requireStructureManager, assertObjectAllowed, assertResponsibleCandidate, assertSystemBelongsToObject (+7) |
| `lib/auth.ts` | requireProfile, canViewAudit, canManageObjects, canManageUsers, canManageTaskTeam (+1) |
| `app/actions/ppr-calendar-actions.ts` | todayIso, assertSamePlanMonth, revalidateCalendarTaskPaths, requireCalendarManager, assertCalendarSystemManageable (+1) |
| `app/actions/object-room-actions.ts` | assertObjectAllowed, requireObjectRoomManager, assertRoomManageable, createObjectRoomAction, updateObjectRoomAction |
| `lib/ppr/permissions.ts` | canBeResponsibleForSystem, canManagePprStructure, canManagePprTemplates, canManagePprAssignments |
| `app/actions/user-actions.ts` | buildCreateUserErrorRedirect, createUserAction, updateUserAction, deleteUserAction |
| `lib/ppr/queries.ts` | assertPprTaskQueryAccess, canAccessPprTaskScreens, listPprTasksForProfile |
| `components/tasks/create-task-form.tsx` | validate, focusFirstError, handleSubmit |

## Entry Points

Start here when exploring this area:

- **`listTasksForProfile`** (Function) — `lib/tasks.ts:17`
- **`listObjectsForProfile`** (Function) — `lib/objects.ts:3`
- **`requireProfile`** (Function) — `lib/auth.ts:42`
- **`canViewAudit`** (Function) — `lib/auth.ts:57`
- **`canManageObjects`** (Function) — `lib/auth.ts:61`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `listTasksForProfile` | Function | `lib/tasks.ts` | 17 |
| `listObjectsForProfile` | Function | `lib/objects.ts` | 3 |
| `requireProfile` | Function | `lib/auth.ts` | 42 |
| `canViewAudit` | Function | `lib/auth.ts` | 57 |
| `canManageObjects` | Function | `lib/auth.ts` | 61 |
| `canManageUsers` | Function | `lib/auth.ts` | 65 |
| `canManageTaskTeam` | Function | `lib/auth.ts` | 73 |
| `writeAudit` | Function | `lib/audit.ts` | 51 |
| `createSupabaseServerClient` | Function | `lib/supabase/server.ts` | 3 |
| `createSupabaseAdminClient` | Function | `lib/supabase/admin.ts` | 2 |
| `canAccessPprTaskScreens` | Function | `lib/ppr/queries.ts` | 150 |
| `listPprTasksForProfile` | Function | `lib/ppr/queries.ts` | 1014 |
| `canBeResponsibleForSystem` | Function | `lib/ppr/permissions.ts` | 21 |
| `canManagePprStructure` | Function | `lib/ppr/permissions.ts` | 30 |
| `createUserAction` | Function | `app/actions/user-actions.ts` | 33 |
| `updateUserAction` | Function | `app/actions/user-actions.ts` | 97 |
| `deleteUserAction` | Function | `app/actions/user-actions.ts` | 147 |
| `takeTaskInWork` | Function | `app/actions/task-actions.ts` | 110 |
| `updateTaskStatus` | Function | `app/actions/task-actions.ts` | 144 |
| `pauseTask` | Function | `app/actions/task-actions.ts` | 181 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PprTasksPage → CanAccessPprStructureScreens` | cross_community | 5 |
| `PprMyTasksPage → CanAccessPprStructureScreens` | cross_community | 5 |
| `PprArchivePage → CanAccessPprStructureScreens` | cross_community | 5 |
| `PprTaskDetailsPage → CanAccessPprTaskScreens` | cross_community | 4 |
| `POST → CanAccessPprTaskScreens` | cross_community | 4 |
| `POST → CanAccessPprTaskScreens` | cross_community | 4 |
| `POST → CanAccessPprTaskScreens` | cross_community | 4 |
| `POST → CanAccessPprTaskScreens` | cross_community | 4 |
| `POST → CanAccessPprTaskScreens` | cross_community | 4 |
| `POST → CanAccessPprTaskScreens` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ppr | 27 calls |
| Status | 5 calls |
| Comments | 2 calls |
| Attachments | 1 calls |

## How to Explore

1. `gitnexus_context({name: "listTasksForProfile"})` — see callers and callees
2. `gitnexus_query({query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
