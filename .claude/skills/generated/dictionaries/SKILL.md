---
name: dictionaries
description: "Skill for the Dictionaries area of zadachnik. 5 symbols across 2 files."
---

# Dictionaries

5 symbols | 2 files | Cohesion: 100%

## When to Use

- Working with code in `components/`
- Understanding how UsersAdminList, ObjectsAdminList work
- Modifying dictionaries-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `components/dictionaries/users-admin-list.tsx` | roleTone, roleLabel, UsersAdminList |
| `components/dictionaries/objects-admin-list.tsx` | resolveObjectEngineerName, ObjectsAdminList |

## Entry Points

Start here when exploring this area:

- **`UsersAdminList`** (Function) — `components/dictionaries/users-admin-list.tsx:44`
- **`ObjectsAdminList`** (Function) — `components/dictionaries/objects-admin-list.tsx:21`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `UsersAdminList` | Function | `components/dictionaries/users-admin-list.tsx` | 44 |
| `ObjectsAdminList` | Function | `components/dictionaries/objects-admin-list.tsx` | 21 |
| `roleTone` | Function | `components/dictionaries/users-admin-list.tsx` | 26 |
| `roleLabel` | Function | `components/dictionaries/users-admin-list.tsx` | 35 |
| `resolveObjectEngineerName` | Function | `components/dictionaries/objects-admin-list.tsx` | 16 |

## How to Explore

1. `gitnexus_context({name: "UsersAdminList"})` — see callers and callees
2. `gitnexus_query({query: "dictionaries"})` — find related execution flows
3. Read key files listed above for implementation details
