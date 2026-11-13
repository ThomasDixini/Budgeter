---
id: 302
title: Web NoteItem component
status: in-progress
wave: 3
depends_on: [102, 104]
priority: high
estimate: M
files:
  - apps/web/src/app/pages/routines/notes/note-item/note-item.ts
  - apps/web/src/app/pages/routines/notes/note-item/note-item.html
  - apps/web/src/app/pages/routines/notes/note-item/note-item.css
  - apps/web/src/app/pages/routines/notes/note-item/note-item.spec.ts
prd_refs: [FR-3, FR-4, FR-7]
memory_refs: []
agent_ready: true
---

# 302 – Web NoteItem component

## Context (self-contained)
The Notes page (task 401) lists notes (goals, notes and ideas). This task is the presentational list item: no store, no gateway, inputs and outputs only. Types come from `core/routines/notes.ts` (task 102, BOARD.md "Web types"); texts are the keys of BOARD.md "Translation keys" (PT-BR added by task 104). Mirror the freshest sibling component of the same kind, `pages/finances/bills/sinking-funds/sinking-fund-list.{ts,html,css,spec.ts}`: standalone, `ChangeDetectionStrategy.OnPush`, `input()`/`output()` signals, the `t` pipe from `core/i18n/translate.pipe.ts` (interpolation: `{{ 'Falls due {date}' | t: { date: … } }}`), date text helpers from `core/calendar/date-label.ts` (see how `sinking-fund-list.ts` builds `dueDate(fund)`), shared CSS classes (`ui-button-ghost`, `ui-muted`, `ui-tabular`), page CSS variables, no new colors.

## Interfaces you must conform to
Selector `app-note-item`; input `note: Note`; outputs `edit: Note`, `statusChange: { note: Note; status: NoteStatus }`, `remove: Note`.

## Implementation plan
1. Markup (an `<article>`): a kind label — text from the keys `Goal` / `Note` / `Idea` plus a small inline SVG icon per kind (`aria-hidden`); the title (`<h3>`); when `status === 'done'` the title is struck through (CSS class) and the text "Marked as done" follows it; the body as a `<p class="body">` with `white-space: pre-line` and a 3-line clamp (`-webkit-line-clamp: 3`) rendered only when non-empty — plain text interpolation only (never `innerHTML`); "Last edited {date}" from `updatedAt`.
2. Actions, all `type="button"` with a visible label and an `aria-label` using the title:
   - "Edit" → `edit.emit(note)`, aria-label "Edit note {title}".
   - Done toggle, shown only when `note.kind !== 'note'` and `status !== 'archived'`: status `open` → button "Mark as done" (aria "Mark note {title} as done") emitting `statusChange` with `done`; status `done` → "Reopen" (aria "Reopen note {title}") emitting `open`.
   - Archive toggle: status `archived` → "Restore" (aria "Restore note {title}") emitting `open`; otherwise "Archive" (aria "Archive note {title}") emitting `archived`.
   - "Delete" (existing key) → `remove.emit(note)`, aria "Delete note {title}".
3. CSS: mobile first, no horizontal scroll at 360 px; long unbroken words wrap (`overflow-wrap: anywhere`); actions wrap; archived items are visually muted (opacity) but remain readable.
4. Spec (harness style of `sinking-fund-list.spec.ts`): a goal, a note and an idea show the right kind label; the body is clamped (class present) and shown literally (a body containing `<b>x</b>` appears as text, no element); an empty body renders no paragraph; done shows "Marked as done" and the strike-through class; the done toggle is absent for notes and for archived items; each button emits the right event and payload (`done`, `open`, `archived`, `open` again from restore, edit, remove); aria-labels contain the title.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Body of 4000 chars | clamped to 3 lines, no layout overflow |
| Title of 80 chars without spaces | wraps, no sideways scroll |
| Body containing HTML/`<script>` | displayed as text |
| Archived goal | no Done toggle, only Restore/Edit/Delete |

## Acceptance criteria
- [ ] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [ ] No file over 500 lines, no function over 20 lines.
- [ ] State is conveyed in text, not only by color.

## Out of scope
The form (303), store/page wiring (401), translations (104).
