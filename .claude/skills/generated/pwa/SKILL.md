---
name: pwa
description: "Skill for the Pwa area of zadachnik. 4 symbols across 3 files."
---

# Pwa

4 symbols | 3 files | Cohesion: 100%

## When to Use

- Working with code in `components/`
- Understanding how createSupabaseBrowserClient, run, onSubmit work
- Modifying pwa-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `components/pwa/register-sw.tsx` | urlBase64ToUint8Array, run |
| `lib/supabase/browser.ts` | createSupabaseBrowserClient |
| `components/auth/login-form.tsx` | onSubmit |

## Entry Points

Start here when exploring this area:

- **`createSupabaseBrowserClient`** (Function) — `lib/supabase/browser.ts:4`
- **`run`** (Function) — `components/pwa/register-sw.tsx:16`
- **`onSubmit`** (Function) — `components/auth/login-form.tsx:11`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createSupabaseBrowserClient` | Function | `lib/supabase/browser.ts` | 4 |
| `run` | Function | `components/pwa/register-sw.tsx` | 16 |
| `onSubmit` | Function | `components/auth/login-form.tsx` | 11 |
| `urlBase64ToUint8Array` | Function | `components/pwa/register-sw.tsx` | 5 |

## How to Explore

1. `gitnexus_context({name: "createSupabaseBrowserClient"})` — see callers and callees
2. `gitnexus_query({query: "pwa"})` — find related execution flows
3. Read key files listed above for implementation details
