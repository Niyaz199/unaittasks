---
name: comments
description: "Skill for the Comments area of zadachnik. 6 symbols across 4 files."
---

# Comments

6 symbols | 4 files | Cohesion: 53%

## When to Use

- Working with code in `app/`
- Understanding how sendPushToUser, POST, POST work
- Modifying comments-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/push.ts` | ensureConfigured, sendPushToUser |
| `app/api/tasks/[id]/comments/route.ts` | POST, sendCommentPushes |
| `app/api/push/test/route.ts` | POST |
| `app/api/push/send-assignment/route.ts` | POST |

## Entry Points

Start here when exploring this area:

- **`sendPushToUser`** (Function) — `lib/push.ts:26`
- **`POST`** (Function) — `app/api/push/test/route.ts:4`
- **`POST`** (Function) — `app/api/push/send-assignment/route.ts:13`
- **`POST`** (Function) — `app/api/tasks/[id]/comments/route.ts:13`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `sendPushToUser` | Function | `lib/push.ts` | 26 |
| `POST` | Function | `app/api/push/test/route.ts` | 4 |
| `POST` | Function | `app/api/push/send-assignment/route.ts` | 13 |
| `POST` | Function | `app/api/tasks/[id]/comments/route.ts` | 13 |
| `ensureConfigured` | Function | `lib/push.ts` | 5 |
| `sendCommentPushes` | Function | `app/api/tasks/[id]/comments/route.ts` | 125 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `POST → EnsureConfigured` | intra_community | 4 |
| `POST → CreateSupabaseAdminClient` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Actions | 3 calls |
| Ppr | 3 calls |
| Attachments | 1 calls |

## How to Explore

1. `gitnexus_context({name: "sendPushToUser"})` — see callers and callees
2. `gitnexus_query({query: "comments"})` — find related execution flows
3. Read key files listed above for implementation details
