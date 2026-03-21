---
name: calendar
description: "Skill for the Calendar area of zadachnik. 72 symbols across 3 files."
---

# Calendar

72 symbols | 3 files | Cohesion: 72%

## When to Use

- Working with code in `components/`
- Understanding how PprCalendarAdmin, handleTabChange, handleMoveRequest work
- Modifying calendar-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx` | resolveTask, formatDate, formatHours, canRescheduleFromCalendar, monthMetricTone (+26) |
| `components/ppr/calendar/ppr-calendar-workbench.tsx` | resolveTask, formatDate, formatHours, canRescheduleFromCalendar, monthMetricTone (+19) |
| `components/ppr/calendar/ppr-calendar-admin.tsx` | resolveRelation, resolveName, resolveEquipment, resolveTemplate, resolveTask (+12) |

## Entry Points

Start here when exploring this area:

- **`PprCalendarAdmin`** (Function) — `components/ppr/calendar/ppr-calendar-admin.tsx:341`
- **`handleTabChange`** (Function) — `components/ppr/calendar/ppr-calendar-admin.tsx:383`
- **`handleMoveRequest`** (Function) — `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx:1007`
- **`submitReschedule`** (Function) — `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx:981`
- **`handleMaterializedConfirm`** (Function) — `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx:1023`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PprCalendarAdmin` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 341 |
| `handleTabChange` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 383 |
| `handleMoveRequest` | Function | `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx` | 1007 |
| `submitReschedule` | Function | `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx` | 981 |
| `handleMaterializedConfirm` | Function | `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx` | 1023 |
| `PprCalendarAdmin` | Function | `components/ppr/calendar/ppr-calendar-workbench.tsx` | 648 |
| `handleTabChange` | Function | `components/ppr/calendar/ppr-calendar-workbench.tsx` | 695 |
| `PprCalendarAdmin` | Function | `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx` | 854 |
| `handleTabChange` | Function | `components/ppr/calendar/ppr-calendar-monthly-dnd.tsx` | 911 |
| `resolveRelation` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 85 |
| `resolveName` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 89 |
| `resolveEquipment` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 93 |
| `resolveTemplate` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 99 |
| `resolveTask` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 103 |
| `formatMonthLabel` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 113 |
| `formatDate` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 120 |
| `formatHours` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 124 |
| `buildCalendarHref` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 128 |
| `canRescheduleFromCalendar` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 145 |
| `monthMetricTone` | Function | `components/ppr/calendar/ppr-calendar-admin.tsx` | 153 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PprCalendarAdmin → ResolveRelation` | cross_community | 4 |
| `PprCalendarAdmin → ResolveRelation` | intra_community | 4 |
| `PprCalendarAdmin → ResolveRelation` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Actions | 1 calls |

## How to Explore

1. `gitnexus_context({name: "PprCalendarAdmin"})` — see callers and callees
2. `gitnexus_query({query: "calendar"})` — find related execution flows
3. Read key files listed above for implementation details
