---
name: templates
description: "Skill for the Templates area of zadachnik. 7 symbols across 3 files."
---

# Templates

7 symbols | 3 files | Cohesion: 100%

## When to Use

- Working with code in `components/`
- Understanding how PprTemplateEditor, updateChecklistItem, removeChecklistItem work
- Modifying templates-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `components/ppr/templates/ppr-template-editor.tsx` | PprTemplateEditor, updateChecklistItem, removeChecklistItem |
| `components/ppr/templates/ppr-templates-admin.tsx` | resolveName, PprTemplatesAdmin |
| `components/ppr/templates/ppr-template-details.tsx` | resolveName, PprTemplateDetails |

## Entry Points

Start here when exploring this area:

- **`PprTemplateEditor`** (Function) — `components/ppr/templates/ppr-template-editor.tsx:51`
- **`updateChecklistItem`** (Function) — `components/ppr/templates/ppr-template-editor.tsx:80`
- **`removeChecklistItem`** (Function) — `components/ppr/templates/ppr-template-editor.tsx:88`
- **`PprTemplatesAdmin`** (Function) — `components/ppr/templates/ppr-templates-admin.tsx:36`
- **`PprTemplateDetails`** (Function) — `components/ppr/templates/ppr-template-details.tsx:36`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PprTemplateEditor` | Function | `components/ppr/templates/ppr-template-editor.tsx` | 51 |
| `updateChecklistItem` | Function | `components/ppr/templates/ppr-template-editor.tsx` | 80 |
| `removeChecklistItem` | Function | `components/ppr/templates/ppr-template-editor.tsx` | 88 |
| `PprTemplatesAdmin` | Function | `components/ppr/templates/ppr-templates-admin.tsx` | 36 |
| `PprTemplateDetails` | Function | `components/ppr/templates/ppr-template-details.tsx` | 36 |
| `resolveName` | Function | `components/ppr/templates/ppr-templates-admin.tsx` | 31 |
| `resolveName` | Function | `components/ppr/templates/ppr-template-details.tsx` | 31 |

## How to Explore

1. `gitnexus_context({name: "PprTemplateEditor"})` — see callers and callees
2. `gitnexus_query({query: "templates"})` — find related execution flows
3. Read key files listed above for implementation details
