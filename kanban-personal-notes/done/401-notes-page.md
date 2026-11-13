---
id: 401
title: Notes page, route and tab
status: done
wave: 4
depends_on: [103, 203, 204, 302, 303]
priority: high
estimate: M
files:
  - apps/web/src/app/pages/routines/notes/notes.ts
  - apps/web/src/app/pages/routines/notes/notes.html
  - apps/web/src/app/pages/routines/notes/notes.css
  - apps/web/src/app/pages/routines/notes/notes.spec.ts
  - apps/web/src/app/pages/routines/routines.routes.ts
  - apps/web/src/app/core/routines/routines-section.ts
prd_refs: [FR-5, FR-6, FR-7, FR-8]
memory_refs: []
agent_ready: true
---

# 401 – Notes page, route and tab

## Context (self-contained)
Everything for Notes exists separately: `NotesStore` (core/routines/notes-store.ts, provided per page), `filterNotes` (core/routines/notes-filter.ts), `NoteItem` (`app-note-item`) and `NoteForm` (`app-note-form`) in `pages/routines/notes/`, gateway bindings, PT-BR keys — all as specified in BOARD.md "Web types" and "Translation keys". This task builds the page that puts them together, adds the route `/routines/notes` and the tab "Notes" after History in Routines & Goals.

Read first: `pages/routines/routines.routes.ts` (children of `RoutinesShell`, titles like `'History · Routines & Goals'`), `core/routines/routines-section.ts` (the tab list; the labels are English keys), `pages/routines/history/history.{ts,html,css,spec.ts}` for the page conventions of the module (`app-page-heading`, load-failed component with retry, `t` pipe, providers per page), and `pages/finances/bills/bills.{ts,html}` for how a page opens a form panel and closes it when `savedCount()` grows (`savesAtSend`/`closeFundFormAfterSave`). Mirror these.

## Interfaces you must conform to
- `NotesStore`, `filterNotes(notes, { kind, status, query })`, `NoteItem`, `NoteForm` exactly as in BOARD.md.
- Route: `{ path: 'notes', component: Notes, title: 'Notes · Routines & Goals' }` (class `Notes`, selector `app-notes`, provided `[NotesStore]`).
- Tab: `{ label: 'Notes', path: '/routines/notes', matchesChildren: false }` appended to `ROUTINES_SECTIONS`.

## Implementation plan
1. `routines-section.ts`: append the tab. `routines.routes.ts`: add the child route after `history`. Then find the existing specs that assert the tab list or route count (grep for `'History'` in `*.spec.ts` under `components/`, `core/` and `pages/routines/`, and `e2e/` is NOT yours) and update only those assertions inside files you own; if a spec outside your files needs a change, STOP and report which.
2. `notes.ts` (`Notes` component, OnPush): inject `NotesStore`; signals `kind` (`NoteKind | 'all'`, default `'all'`), `status` (`NoteStatus`, default `'open'`), `query` (string), `quickIdea` (string), `panel` (`{ kind: 'new' } | { kind: 'edit'; note: Note } | null`), `savesAtSend` (number | null). `visible = computed(() => filterNotes(store.notes(), { kind, status, query }))`. `hasFilters = computed(() => kind !== 'all' || status !== 'open' || query.trim() !== '')`. Methods: `addIdea()` (calls `store.addIdea(quickIdea())` then clears the field; blank does nothing), `setKind`, `setStatus`, `clearFilters()`, `openForm(panel)`, `saveNote(saved)` (records `store.savedCount()` in `savesAtSend` and calls `store.save(saved.draft, saved.id ?? undefined)`), an effect that closes the form once `store.savedCount()` is above `savesAtSend` (use `untracked`, like `Bills.closeFundFormAfterSave`), `changeStatus({ note, status })` → `store.setStatus(note.id, status)`, `removeNote(note)` → `store.remove(note.id)`.
3. `notes.html`: `app-page-heading` (eyebrow "Routines & Goals" as the sibling pages do, heading "Notes") with a ghost button "New note"; below it the **quick idea** form (`<form (submit)>` with a labelled input "Jot down an idea", `maxlength` 80, and a button "Add idea"; Enter submits); the filter row: kind chips (`All notes`, `Goals`, `Notes`, `Ideas`) in a `role="group"` labelled "Filter notes by kind" with `aria-pressed`; status chips (`Open notes`, `Done notes`, `Archived notes`) in a group labelled "Filter notes by status"; a search input labelled "Search notes" (`type="search"`); then the list of `<app-note-item>` (track by `note.id`) with outputs wired; then the form `<app-note-form>` when `panel()` is set (rendered like the bill form is in `bills.html`).
4. States: while `!store.isLoaded()` and not failed → render nothing but the heading (no empty-state flash); `store.hasLoadFailed()` → the module's load-failed component with retry → `store.reload()` and the text "Could not load the notes."; no notes at all (loaded, `store.notes().length === 0`) → "No notes yet. Write down a goal, a note or an idea." and the New note button; notes exist but `visible()` is empty → "Nothing matches these filters." with a "Clear filters" button (only when `hasFilters()`); `store.hasActionFailed()` → a `role="alert"` paragraph "Could not save the note." (and keep the form open: it closes only when the saved count grows). Failed status changes and deletes show "Could not update the note." — pick one alert: show "Could not save the note." while the form is open and "Could not update the note." otherwise.
5. `notes.css`: mobile first; the quick idea field sits above the list and is full width on phones; the chips wrap; no horizontal scroll at 360 px; reuse the page CSS variables and shared classes.
6. `notes.spec.ts` (harness like `history.spec.ts`, with `FakeNotesGateway` provided as `NotesGateway`): lists the open notes of `SAMPLE_NOTES` only; status chips switch the list (done, archived); kind chips filter; search filters by text; combined filters and "Nothing matches" with Clear filters restoring the list; quick idea adds an idea (gateway receives `{ kind: 'idea', title, body: '' }`), clears the field, ignores blank; New note opens the form, saving calls the gateway and closes the form; a failed save keeps the form open and shows the alert; edit passes the note id; done/reopen/archive/restore call `setStatus` with the right status; delete calls the gateway; load failure shows the retry and retry reloads; empty state with no notes; the tab "Notes" appears in the module header after History and the route renders the page.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Quick idea of spaces only | nothing happens, field keeps its text |
| Archived note while status chip is Open | not listed; shown under Archived |
| Save fails | form stays open with typed text; alert shown |
| Search matches only archived items | list under Open is empty → "Nothing matches" |

## Acceptance criteria
- [x] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [x] `notes.ts` stays under 500 lines and every function ≤ 20 lines.
- [x] The page works in DEMO mode (`/routines/notes?demo=on`): verify in the browser pane (list, quick idea, create, edit, mark done, archive, phone width 375 px) and report what you saw, or say explicitly that it was not possible.

## Out of scope
E2E tests (501), API changes, changes to the item/form components (report a needed change instead).
