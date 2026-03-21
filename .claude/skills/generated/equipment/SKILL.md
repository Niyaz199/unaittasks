---
name: equipment
description: "Skill for the Equipment area of zadachnik. 4 symbols across 2 files."
---

# Equipment

4 symbols | 2 files | Cohesion: 100%

## When to Use

- Working with code in `components/`
- Understanding how PprEquipmentDetails, PprEquipmentAdmin work
- Modifying equipment-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `components/ppr/equipment/ppr-equipment-details.tsx` | resolveName, PprEquipmentDetails |
| `components/ppr/equipment/ppr-equipment-admin.tsx` | resolveName, PprEquipmentAdmin |

## Entry Points

Start here when exploring this area:

- **`PprEquipmentDetails`** (Function) — `components/ppr/equipment/ppr-equipment-details.tsx:35`
- **`PprEquipmentAdmin`** (Function) — `components/ppr/equipment/ppr-equipment-admin.tsx:52`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PprEquipmentDetails` | Function | `components/ppr/equipment/ppr-equipment-details.tsx` | 35 |
| `PprEquipmentAdmin` | Function | `components/ppr/equipment/ppr-equipment-admin.tsx` | 52 |
| `resolveName` | Function | `components/ppr/equipment/ppr-equipment-details.tsx` | 28 |
| `resolveName` | Function | `components/ppr/equipment/ppr-equipment-admin.tsx` | 40 |

## How to Explore

1. `gitnexus_context({name: "PprEquipmentDetails"})` — see callers and callees
2. `gitnexus_query({query: "equipment"})` — find related execution flows
3. Read key files listed above for implementation details
