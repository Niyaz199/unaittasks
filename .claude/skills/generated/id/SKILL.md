---
name: id
description: "Skill for the [id] area of zadachnik. 10 symbols across 4 files."
---

# [id]

10 symbols | 4 files | Cohesion: 72%

## When to Use

- Working with code in `app/`
- Understanding how getTaskByIdForProfile, getTaskHistoryForProfile, humanStatus work
- Modifying [id]-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `app/(dashboard)/tasks/[id]/page.tsx` | resolveAssigneeName, resolveTeamMembers, getInitials, formatDate, describeHistoryEvent (+1) |
| `lib/tasks.ts` | getTaskByIdForProfile, getTaskHistoryForProfile |
| `lib/task-presentation.ts` | humanStatus |
| `app/api/tasks/[id]/history/route.ts` | GET |

## Entry Points

Start here when exploring this area:

- **`getTaskByIdForProfile`** (Function) — `lib/tasks.ts:114`
- **`getTaskHistoryForProfile`** (Function) — `lib/tasks.ts:132`
- **`humanStatus`** (Function) — `lib/task-presentation.ts:13`
- **`TaskDetailsPage`** (Function) — `app/(dashboard)/tasks/[id]/page.tsx:91`
- **`GET`** (Function) — `app/api/tasks/[id]/history/route.ts:4`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getTaskByIdForProfile` | Function | `lib/tasks.ts` | 114 |
| `getTaskHistoryForProfile` | Function | `lib/tasks.ts` | 132 |
| `humanStatus` | Function | `lib/task-presentation.ts` | 13 |
| `TaskDetailsPage` | Function | `app/(dashboard)/tasks/[id]/page.tsx` | 91 |
| `GET` | Function | `app/api/tasks/[id]/history/route.ts` | 4 |
| `resolveAssigneeName` | Function | `app/(dashboard)/tasks/[id]/page.tsx` | 15 |
| `resolveTeamMembers` | Function | `app/(dashboard)/tasks/[id]/page.tsx` | 21 |
| `getInitials` | Function | `app/(dashboard)/tasks/[id]/page.tsx` | 29 |
| `formatDate` | Function | `app/(dashboard)/tasks/[id]/page.tsx` | 38 |
| `describeHistoryEvent` | Function | `app/(dashboard)/tasks/[id]/page.tsx` | 45 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `TaskDetailsPage → CreateSupabaseServerClient` | cross_community | 3 |
| `TaskDetailsPage → CanReadTaskByRole` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Actions | 3 calls |
| Attachments | 1 calls |
| Status | 1 calls |
| Tasks | 1 calls |
| Ppr | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getTaskByIdForProfile"})` — see callers and callees
2. `gitnexus_query({query: "[id]"})` — find related execution flows
3. Read key files listed above for implementation details
