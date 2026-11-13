---
id: 303
title: Web NoteForm component
status: backlog
wave: 3
depends_on: [102, 104]
priority: high
estimate: M
files:
  - apps/web/src/app/pages/routines/notes/note-form/note-form.ts
  - apps/web/src/app/pages/routines/notes/note-form/note-form.html
  - apps/web/src/app/pages/routines/notes/note-form/note-form.css
  - apps/web/src/app/pages/routines/notes/note-form/note-form.spec.ts
prd_refs: [FR-1, FR-2, FR-3]
memory_refs: []
agent_ready: true
---

# 303 – Web NoteForm component

## Context (self-contained)
Form to create or edit a note (goal, note or idea), opened from the Notes page (wiring is task 401). Presentational: inputs and outputs only. Mirror `pages/finances/bills/sinking-funds/sinking-fund-form.{ts,html,css,spec.ts}` (the freshest sibling form: how it is built, validated, focused, how Escape cancels, inline errors with `aria-invalid`/`aria-describedby`) and, for a routines-module look, `pages/routines/routine-editor`'s forms. Types from `core/routines/notes.ts` (task 102, BOARD.md "Web types", incl. `NOTE_TITLE_MAX`, `NOTE_BODY_MAX`); texts are the keys of BOARD.md "Translation keys".

## Interfaces you must conform to
Selector `app-note-form`; input `note: Note | null` (null = new); outputs `saved: { id: string | null; draft: NoteDraft }` (id is the edited note's id, `null` for a new one) and `cancelled: void`.

## Implementation plan
1. Fields: "Note kind" (select with the options Goal, Note, Idea; default `idea` for a new note), "Note title" (text input, `maxlength` 80, required), "Note text" (`<textarea>`, `maxlength` 4000, 6 rows, resizable vertically) with a live counter "{count} / {max} characters" shown from 3500 characters on (and always announced politely via `aria-live="polite"` when it changes).
2. Heading: "New note" when `note` is null, otherwise "Edit note". Editing prefills kind, title and text. When editing a `done` note the kind select has no "Note" option (the API rejects it).
3. Save with valid data emits `saved` with `{ id: note?.id ?? null, draft: { kind, title: title.trim(), body } }` — the body is sent exactly as typed (not trimmed). Buttons: Cancel and Save (existing keys).
4. Validation (inline errors in the style of the sibling form, Save blocked and no emit while invalid): title non-blank after trimming (reuse an existing "required"-style message key if the sibling form uses one; otherwise show the existing generic key that form uses); title ≤ 80 and text ≤ 4000 are enforced by `maxlength`, plus a guard that blocks longer pasted values.
5. Cancel and Escape emit `cancelled`. The title field is focused after the first render.
6. Spec: new vs edit headings and prefill; default kind for a new note is Idea; a done note's kind select lacks "Note" while an open one has all three; valid emit payloads for a new note (id null) and an edit (id set), title trimmed and body untouched (leading newline kept); blank/whitespace title blocks; counter appears at 3500 and shows the count; cancel by button and Escape; kind change updates the emitted draft.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Title only spaces | blocked, error shown, nothing emitted |
| Body empty | allowed |
| Body with line breaks/emoji | emitted unchanged |
| Pasted text over 4000 chars | blocked/cut, never emitted over the limit |

## Acceptance criteria
- [ ] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [ ] Keyboard operable; every field has a label; phone width without sideways scrolling.

## Out of scope
The item (302), store and page wiring (401), translations (104).
