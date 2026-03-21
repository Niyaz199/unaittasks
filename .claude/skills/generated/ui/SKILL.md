---
name: ui
description: "Skill for the Ui area of zadachnik. 6 symbols across 3 files."
---

# Ui

6 symbols | 3 files | Cohesion: 100%

## When to Use

- Working with code in `components/`
- Understanding how AssigneeCombobox, selectOption, PprModal work
- Modifying ui-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `components/ui/assignee-combobox.tsx` | AssigneeCombobox, selectOption |
| `components/ppr/ui/ppr-modal.tsx` | PprModal, handleClose |
| `components/ppr/ui/ppr-drawer.tsx` | PprDrawer, handleClose |

## Entry Points

Start here when exploring this area:

- **`AssigneeCombobox`** (Function) — `components/ui/assignee-combobox.tsx:20`
- **`selectOption`** (Function) — `components/ui/assignee-combobox.tsx:54`
- **`PprModal`** (Function) — `components/ppr/ui/ppr-modal.tsx:13`
- **`handleClose`** (Function) — `components/ppr/ui/ppr-modal.tsx:16`
- **`PprDrawer`** (Function) — `components/ppr/ui/ppr-drawer.tsx:13`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `AssigneeCombobox` | Function | `components/ui/assignee-combobox.tsx` | 20 |
| `selectOption` | Function | `components/ui/assignee-combobox.tsx` | 54 |
| `PprModal` | Function | `components/ppr/ui/ppr-modal.tsx` | 13 |
| `handleClose` | Function | `components/ppr/ui/ppr-modal.tsx` | 16 |
| `PprDrawer` | Function | `components/ppr/ui/ppr-drawer.tsx` | 13 |
| `handleClose` | Function | `components/ppr/ui/ppr-drawer.tsx` | 16 |

## How to Explore

1. `gitnexus_context({name: "AssigneeCombobox"})` — see callers and callees
2. `gitnexus_query({query: "ui"})` — find related execution flows
3. Read key files listed above for implementation details
