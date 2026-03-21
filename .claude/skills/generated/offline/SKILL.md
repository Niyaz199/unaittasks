---
name: offline
description: "Skill for the Offline area of zadachnik. 9 symbols across 3 files."
---

# Offline

9 symbols | 3 files | Cohesion: 86%

## When to Use

- Working with code in `lib/`
- Understanding how enqueueAction, flushQueue, OfflineSyncBootstrap work
- Modifying offline-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/offline/queue.ts` | getQueue, setQueue, enqueueAction, runAction, flushQueue |
| `components/tasks/task-list.tsx` | TakeInWorkButton, handle |
| `components/offline/offline-sync-bootstrap.tsx` | OfflineSyncBootstrap, handleOnline |

## Entry Points

Start here when exploring this area:

- **`enqueueAction`** (Function) — `lib/offline/queue.ts:34`
- **`flushQueue`** (Function) — `lib/offline/queue.ts:62`
- **`OfflineSyncBootstrap`** (Function) — `components/offline/offline-sync-bootstrap.tsx:5`
- **`handleOnline`** (Function) — `components/offline/offline-sync-bootstrap.tsx:8`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `enqueueAction` | Function | `lib/offline/queue.ts` | 34 |
| `flushQueue` | Function | `lib/offline/queue.ts` | 62 |
| `OfflineSyncBootstrap` | Function | `components/offline/offline-sync-bootstrap.tsx` | 5 |
| `handleOnline` | Function | `components/offline/offline-sync-bootstrap.tsx` | 8 |
| `getQueue` | Function | `lib/offline/queue.ts` | 26 |
| `setQueue` | Function | `lib/offline/queue.ts` | 30 |
| `runAction` | Function | `lib/offline/queue.ts` | 40 |
| `TakeInWorkButton` | Function | `components/tasks/task-list.tsx` | 164 |
| `handle` | Function | `components/tasks/task-list.tsx` | 168 |

## How to Explore

1. `gitnexus_context({name: "enqueueAction"})` — see callers and callees
2. `gitnexus_query({query: "offline"})` — find related execution flows
3. Read key files listed above for implementation details
