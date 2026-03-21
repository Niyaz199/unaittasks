---
name: attachments
description: "Skill for the Attachments area of zadachnik. 8 symbols across 3 files."
---

# Attachments

8 symbols | 3 files | Cohesion: 76%

## When to Use

- Working with code in `lib/`
- Understanding how canReadTaskByRole, buildStoragePath, uploadAttachmentFile work
- Modifying attachments-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/attachments.ts` | buildStoragePath, uploadAttachmentFile, saveAttachmentMeta, getSignedUrls |
| `app/api/tasks/[id]/attachments/route.ts` | getTaskRow, POST, GET |
| `lib/task-permissions.ts` | canReadTaskByRole |

## Entry Points

Start here when exploring this area:

- **`canReadTaskByRole`** (Function) — `lib/task-permissions.ts:53`
- **`buildStoragePath`** (Function) — `lib/attachments.ts:19`
- **`uploadAttachmentFile`** (Function) — `lib/attachments.ts:33`
- **`saveAttachmentMeta`** (Function) — `lib/attachments.ts:53`
- **`getSignedUrls`** (Function) — `lib/attachments.ts:79`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `canReadTaskByRole` | Function | `lib/task-permissions.ts` | 53 |
| `buildStoragePath` | Function | `lib/attachments.ts` | 19 |
| `uploadAttachmentFile` | Function | `lib/attachments.ts` | 33 |
| `saveAttachmentMeta` | Function | `lib/attachments.ts` | 53 |
| `getSignedUrls` | Function | `lib/attachments.ts` | 79 |
| `POST` | Function | `app/api/tasks/[id]/attachments/route.ts` | 32 |
| `GET` | Function | `app/api/tasks/[id]/attachments/route.ts` | 107 |
| `getTaskRow` | Function | `app/api/tasks/[id]/attachments/route.ts` | 22 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `TaskDetailsPage → CanReadTaskByRole` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ppr | 2 calls |

## How to Explore

1. `gitnexus_context({name: "canReadTaskByRole"})` — see callers and callees
2. `gitnexus_query({query: "attachments"})` — find related execution flows
3. Read key files listed above for implementation details
