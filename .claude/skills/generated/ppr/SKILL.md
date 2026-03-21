---
name: ppr
description: "Skill for the Ppr area of zadachnik. 144 symbols across 33 files."
---

# Ppr

144 symbols | 33 files | Cohesion: 67%

## When to Use

- Working with code in `lib/`
- Understanding how listPprActorAccessibleObjectIds, buildPprTaskActor, assertPprTaskAssigneeCandidate work
- Modifying ppr-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/ppr/queries.ts` | getPprTaskByIdForProfile, listPprTaskWorkItemsForProfile, listPprTaskCommentsForProfile, getPprTaskCompletionEvidenceForProfile, listPprTaskAssigneeCandidatesForProfile (+44) |
| `lib/ppr/task-lifecycle.ts` | listPprActorAccessibleObjectIds, buildPprTaskActor, assertPprTaskAssigneeCandidate, canAssignPprTaskExecutor, canClosePprTaskLifecycle (+10) |
| `lib/ppr/scheduler.ts` | toDateOnly, normalizePlanMonth, defaultPlannedFor, generateMonthPlanForSystem, firstDayOfMonth (+10) |
| `lib/ppr/permissions.ts` | isActivePprTaskStatus, canCancelPprTask, canAssignAsPprTaskExecutor, canReschedulePprTask, isChiefOrAdmin (+9) |
| `lib/ppr/files.ts` | validatePprAttachmentFile, buildPprTaskAttachmentPath, uploadPprTaskAttachmentFile, getPprSignedUrls |
| `app/(dashboard)/ppr/calendar/page.tsx` | currentYearValue, currentMonthInput, unwrapRelation, PprCalendarPage |
| `lib/object-rooms.ts` | canReadObjectRooms, listObjectScopedObjects, listObjectRoomReadableObjectsForProfile, listObjectRoomsForProfile |
| `components/ppr/tasks/ppr-task-lifecycle-controls.tsx` | roleLabel, PprTaskLifecycleControls, postJson |
| `app/api/ppr/tasks/[id]/attachments/route.ts` | revalidateTaskPaths, POST, GET |
| `app/api/ppr/tasks/[id]/reschedule/route.ts` | assertSamePlanMonth, revalidateTaskPaths, POST |

## Entry Points

Start here when exploring this area:

- **`listPprActorAccessibleObjectIds`** (Function) — `lib/ppr/task-lifecycle.ts:36`
- **`buildPprTaskActor`** (Function) — `lib/ppr/task-lifecycle.ts:52`
- **`assertPprTaskAssigneeCandidate`** (Function) — `lib/ppr/task-lifecycle.ts:76`
- **`canAssignPprTaskExecutor`** (Function) — `lib/ppr/task-lifecycle.ts:104`
- **`canClosePprTaskLifecycle`** (Function) — `lib/ppr/task-lifecycle.ts:128`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `listPprActorAccessibleObjectIds` | Function | `lib/ppr/task-lifecycle.ts` | 36 |
| `buildPprTaskActor` | Function | `lib/ppr/task-lifecycle.ts` | 52 |
| `assertPprTaskAssigneeCandidate` | Function | `lib/ppr/task-lifecycle.ts` | 76 |
| `canAssignPprTaskExecutor` | Function | `lib/ppr/task-lifecycle.ts` | 104 |
| `canClosePprTaskLifecycle` | Function | `lib/ppr/task-lifecycle.ts` | 128 |
| `canCancelPprTaskLifecycle` | Function | `lib/ppr/task-lifecycle.ts` | 132 |
| `canAddPprTaskComment` | Function | `lib/ppr/task-lifecycle.ts` | 142 |
| `canUploadPprTaskAttachment` | Function | `lib/ppr/task-lifecycle.ts` | 146 |
| `syncPprTaskPlanItemsStatus` | Function | `lib/ppr/task-lifecycle.ts` | 153 |
| `getPprTaskByIdForProfile` | Function | `lib/ppr/queries.ts` | 1055 |
| `listPprTaskWorkItemsForProfile` | Function | `lib/ppr/queries.ts` | 1091 |
| `listPprTaskCommentsForProfile` | Function | `lib/ppr/queries.ts` | 1112 |
| `getPprTaskCompletionEvidenceForProfile` | Function | `lib/ppr/queries.ts` | 1192 |
| `listPprTaskAssigneeCandidatesForProfile` | Function | `lib/ppr/queries.ts` | 1217 |
| `isActivePprTaskStatus` | Function | `lib/ppr/permissions.ts` | 56 |
| `canCancelPprTask` | Function | `lib/ppr/permissions.ts` | 85 |
| `canAssignAsPprTaskExecutor` | Function | `lib/ppr/permissions.ts` | 118 |
| `validatePprAttachmentFile` | Function | `lib/ppr/files.ts` | 7 |
| `buildPprTaskAttachmentPath` | Function | `lib/ppr/files.ts` | 17 |
| `uploadPprTaskAttachmentFile` | Function | `lib/ppr/files.ts` | 30 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `POST → IsChiefOrAdmin` | cross_community | 6 |
| `POST → IsChiefOrAdmin` | cross_community | 6 |
| `POST → IsChiefOrAdmin` | cross_community | 6 |
| `PprQrEntryPage → CanAccessPprStructureScreens` | cross_community | 6 |
| `GET → CanAccessPprStructureScreens` | cross_community | 6 |
| `PprTaskDetailsPage → CanAccessPprStructureScreens` | cross_community | 5 |
| `POST → CanAccessPprStructureScreens` | cross_community | 5 |
| `POST → CanAccessPprStructureScreens` | cross_community | 5 |
| `POST → IsChiefOrAdmin` | cross_community | 5 |
| `POST → CanAccessPprStructureScreens` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Actions | 40 calls |

## How to Explore

1. `gitnexus_context({name: "listPprActorAccessibleObjectIds"})` — see callers and callees
2. `gitnexus_query({query: "ppr"})` — find related execution flows
3. Read key files listed above for implementation details
