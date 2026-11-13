---
id: 103
title: Web pure filter and search
status: in-progress
wave: 1
depends_on: []
priority: medium
estimate: S
files:
  - apps/web/src/app/core/routines/notes-filter.ts
  - apps/web/src/app/core/routines/notes-filter.spec.ts
prd_refs: [FR-7]
memory_refs: []
agent_ready: true
---

# 103 – Web pure filter and search

## Context (self-contained)
The Notes page (task 401) lists every note of the user and filters on the client: by kind, by status and by a text search over title and body. This task is the pure logic, with no Angular and no dependency on other new code. The `Note` types are being created by task 102 in `core/routines/notes.ts` (BOARD.md "Web types"); to keep this task independent, import only the type names `Note`, `NoteKind`, `NoteStatus` from `./notes` (assume they exist exactly as specified: `Note { id, kind: 'goal'|'note'|'idea', title, body, status: 'open'|'done'|'archived', createdAt, updatedAt }`).

Mirror the style of other pure helpers in `core/routines/` (`day-lanes.ts` + `day-lanes.spec.ts`): exported functions with a JSDoc `@example`, explicit types, specs in AAA.

## Interfaces you must conform to
```ts
export interface NoteFilter { readonly kind: NoteKind | 'all'; readonly status: NoteStatus; readonly query: string; }
export function filterNotes(notes: readonly Note[], filter: NoteFilter): readonly Note[];  // keeps the input order
export function matchesQuery(note: Note, query: string): boolean;
```

## Implementation plan
1. `matchesQuery(note, query)`: normalize both sides with `value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()`; a query that is blank after trimming matches everything; otherwise true when the normalized title or body contains the normalized, trimmed query. Put the normalizing in a private `fold(value: string): string`.
2. `filterNotes(notes, filter)`: `notes.filter(n => (filter.kind === 'all' || n.kind === filter.kind) && n.status === filter.status && matchesQuery(n, filter.query))`; split the predicate into a private function so each function stays ≤ 20 lines.
3. Spec: kind `all` vs one kind; status is always applied (an open filter hides done and archived); query matches title, body, ignores case ("CAMBLY" finds "Cambly"), ignores accents ("acao" finds "Ação", "café" finds "cafe"); blank and whitespace-only queries match all; the three filters combine; input order is preserved; an empty list gives an empty list; a query with regex characters (`(`, `.`, `*`) is matched literally.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Query `"  cambly  "` | trimmed before matching |
| Query `"a.c"` | literal text, not a pattern: does not match "abc" |
| Body empty | only the title is searched |

## Acceptance criteria
- [ ] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [ ] Every row of the spec list above has a test.

## Out of scope
UI, store, any Angular code, ordering of notes.
