---
name: status
description: "Skill for the Status area of zadachnik. 6 symbols across 3 files."
---

# Status

6 symbols | 3 files | Cohesion: 52%

## When to Use

- Working with code in `lib/`
- Understanding how isTaskParticipant, canChangeTaskStatus, canTransitionTaskStatus work
- Modifying status-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/task-permissions.ts` | isTaskParticipant, canChangeTaskStatus, canTransitionTaskStatus, canChangeStatus |
| `app/api/tasks/[id]/status/route.ts` | POST |
| `app/api/tasks/[id]/pause/route.ts` | POST |

## Entry Points

Start here when exploring this area:

- **`isTaskParticipant`** (Function) — `lib/task-permissions.ts:49`
- **`canChangeTaskStatus`** (Function) — `lib/task-permissions.ts:74`
- **`canTransitionTaskStatus`** (Function) — `lib/task-permissions.ts:83`
- **`canChangeStatus`** (Function) — `lib/task-permissions.ts:87`
- **`POST`** (Function) — `app/api/tasks/[id]/status/route.ts:10`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `isTaskParticipant` | Function | `lib/task-permissions.ts` | 49 |
| `canChangeTaskStatus` | Function | `lib/task-permissions.ts` | 74 |
| `canTransitionTaskStatus` | Function | `lib/task-permissions.ts` | 83 |
| `canChangeStatus` | Function | `lib/task-permissions.ts` | 87 |
| `POST` | Function | `app/api/tasks/[id]/status/route.ts` | 10 |
| `POST` | Function | `app/api/tasks/[id]/pause/route.ts` | 10 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `POST → IsTaskParticipant` | intra_community | 4 |
| `POST → IsTaskParticipant` | intra_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ppr | 2 calls |
| Actions | 1 calls |

## How to Explore

1. `gitnexus_context({name: "isTaskParticipant"})` — see callers and callees
2. `gitnexus_query({query: "status"})` — find related execution flows
3. Read key files listed above for implementation details
