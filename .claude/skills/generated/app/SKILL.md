---
name: app
description: "Skill for the App area of zadachnik. 5 symbols across 3 files."
---

# App

5 symbols | 3 files | Cohesion: 80%

## When to Use

- Working with code in `lib/`
- Understanding how getSessionUser, requireAuth, getMyProfile work
- Modifying app-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `lib/auth.ts` | getSessionUser, requireAuth, getMyProfile |
| `app/page.tsx` | HomePage |
| `app/login/page.tsx` | LoginPage |

## Entry Points

Start here when exploring this area:

- **`getSessionUser`** (Function) — `lib/auth.ts:15`
- **`requireAuth`** (Function) — `lib/auth.ts:23`
- **`getMyProfile`** (Function) — `lib/auth.ts:29`
- **`HomePage`** (Function) — `app/page.tsx:3`
- **`LoginPage`** (Function) — `app/login/page.tsx:4`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getSessionUser` | Function | `lib/auth.ts` | 15 |
| `requireAuth` | Function | `lib/auth.ts` | 23 |
| `getMyProfile` | Function | `lib/auth.ts` | 29 |
| `HomePage` | Function | `app/page.tsx` | 3 |
| `LoginPage` | Function | `app/login/page.tsx` | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Actions | 2 calls |

## How to Explore

1. `gitnexus_context({name: "getSessionUser"})` — see callers and callees
2. `gitnexus_query({query: "app"})` — find related execution flows
3. Read key files listed above for implementation details
