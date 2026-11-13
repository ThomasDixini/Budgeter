---
id: 203
title: Web NotesStore
status: in-progress
wave: 2
depends_on: [102]
priority: high
estimate: S
files:
  - apps/web/src/app/core/routines/notes-store.ts
  - apps/web/src/app/core/routines/notes-store.spec.ts
prd_refs: [FR-2, FR-3, FR-4, FR-5, FR-6]
memory_refs: []
agent_ready: true
---

# 203 – Web NotesStore

## Context (self-contained)
The Notes page (task 401) shows the user's notes. Its state lives in a store provided by the page. The gateway port, types and `FakeNotesGateway` (with `SAMPLE_NOTES`) come from task 102 (BOARD.md "Web types"). Mirror the most recent store of the same kind: `core/finances/sinking-funds-store.ts` and its spec (signals, `ErrorHandler`, `IdGenerator`, a `savedCount` signal, a request counter against overlapping answers) — read both fully first; the file layout, error handling and spec helpers (`createStore`, fake `ErrorHandler`, `SequentialIdGenerator`) are the pattern to copy.

## Interfaces you must conform to
`NotesStore` exactly as in BOARD.md "Web types".

## Implementation plan
1. `@Injectable() export class NotesStore` with private signals `noteList`, `loaded`, `loadFailed`, `actionFailed`, `saves`; public readonly `notes` (the `noteList` as read-only), `isLoaded`, `hasLoadFailed`, `hasActionFailed`, `savedCount`.
2. Constructor calls `load()`: `gateway.list()` → `this.noteList.set(sorted(notes))`, `loaded.set(true)`; on error `loadFailed.set(true)` and `errorHandler.handleError(error)`. Guard overlapping loads with a request counter. `reload()` clears `loadFailed` and loads again.
3. `sorted(notes)`: a pure module-level function returning a copy ordered by `updatedAt` descending (ISO strings compare correctly), then by `id`.
4. `save(draft, id?)`: `const noteId = id ?? this.ids.next()`; `gateway.save(noteId, draft)`; on success `upsert(note)` and `saves.update(n => n + 1)`; on error `failAction`.
5. `addIdea(title)`: `const clean = title.trim()`; return when blank; otherwise `this.save({ kind: 'idea', title: clean.slice(0, NOTE_TITLE_MAX), body: '' })`.
6. `setStatus(id, status)`: `gateway.setStatus(id, status)`; success → `upsert`; error → `failAction`. `remove(id)`: `gateway.delete(id)`; success → remove it from the list; error → `failAction`.
7. `upsert(note)`: replace the note with the same id or add it, then re-sort. `failAction(error)`: `actionFailed.set(true)` and `errorHandler.handleError(error)`. Clear `actionFailed` at the start of every save/setStatus/remove.
8. Not optimistic: the timestamps are decided by the API, so the screen follows the answers.
9. Spec with `FakeNotesGateway`: loads and sorts (most recent first, ties by id); a failing list sets `hasLoadFailed`, `isLoaded` stays false and `reload` recovers; save without id generates one and adds the returned note at the top; save with an id replaces the note; `savedCount` grows per accepted save and not on failures or status changes; `addIdea` with `"  Call Ana  "` saves `{ kind: 'idea', title: 'Call Ana', body: '' }`, with blank text does nothing, with 100 chars is cut to 80; `setStatus` updates the note in the list; `remove` removes it; failures set `hasActionFailed`, keep the list, and the flag clears on the next action; overlapping loads: the later answer wins.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Save fails | `hasActionFailed` true, list unchanged, `savedCount` unchanged |
| Delete of an id not in the list | no error, list unchanged |
| Two notes with the same `updatedAt` | ordered by id |

## Acceptance criteria
- [ ] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [ ] The spec covers every row above and every item of step 9.

## Out of scope
UI, page wiring (401), demo data, the filter (103).
