# PRD: Routines & Goals · Notes

## 1. Overview

Two items of the TODO ("Goals & personal notes") ask for a place to write things down: goals and important notes for oneself (leaving the comfort zone, Cambly, sales ...) and a place for ideas and tasks that have no scope or date yet "just so they are recorded". The existing Goals of Routines & Goals are measured (frequency or objective inside a period, with progress); they do not hold free text, and a task needs a date or a routine. Today an idea with neither has nowhere to go.

This slice adds a **Notes** tab to Routines & Goals: one list of short written items, each a *goal*, a *note* or an *idea*, with free text, a status and a quick-capture field for ideas. It is deliberately a plain notebook, not a second goal tracker.

## 2. Goals

- Write down an item with a title and free text, and choose what it is: goal, note or idea.
- Capture an idea in one step (title only), also from the phone.
- Read, edit and delete items.
- Mark a goal or an idea as done, and archive any item to get it out of the way without losing it.
- Find items: filter by kind and by status, and search title and text.

## 3. Non-Goals

- Progress, targets, periods or streaks (that is what the existing Goals do).
- Turning an idea into a task or routine block (later, if the notebook proves useful).
- Rich text, attachments, images, tags, folders, pinning, reminders and due dates.
- Sharing, or notes visible to anyone but their owner.
- Offline queue and sync for this slice (ids are client-generated, as everywhere, so it can be added later without API changes).
- Linking a note to a finance investment (a separate TODO item).

## 4. Target Users & Use Cases

The single owner of this personal app.

- **On the phone, an idea comes up:** open Routines & Goals → Notes, type a title in the quick idea field, done.
- **On the desktop, writing down a goal:** "Leave the comfort zone", a few paragraphs about why and first steps; come back later to reread and edit it.
- **Reviewing:** filter to open ideas, tick the ones that were done, archive the rest.

## 5. User Stories

- As the user, I want to jot an idea in one field so that I do not lose it before I have time to plan it.
- As the user, I want to keep long-form goals and notes about myself so that I can reread them.
- As the user, I want to mark an idea or a goal as done so that the open list shows only what is left.
- As the user, I want to archive an item so that it leaves the list without being deleted.
- As the user, I want to search my notes so that I find "Cambly" without scrolling.

## 6. Functional Requirements

1. **FR-1 Item.** A note has an id (client-generated, 1–64 letters, digits or dashes), a kind (`goal`, `note`, `idea`), a title (1–80 chars, trimmed, required), a body (free text, 0–4000 chars, may be empty), a status (`open`, `done`, `archived`) and two timestamps set by the API (`createdAt`, `updatedAt`, UTC ISO-8601). Invalid input → a business error that names the offending value and the expected shape (same style as bills and goals).
2. **FR-2 Create and edit.** Saving an id that does not exist creates the note (`open`); saving an existing id replaces title, body and kind and refreshes `updatedAt`, keeping `createdAt` and status. Changing the kind of an item that is `done` to `note` is rejected (see FR-3).
3. **FR-3 Status.** `done` is allowed only for kinds `goal` and `idea` (a note has nothing to complete): marking a note done → a business error naming the kind. Any kind can be `archived`. A done or archived item can be reopened (status back to `open`). Status changes refresh `updatedAt`.
4. **FR-4 Delete.** An item can be deleted for good; an unknown id is ignored.
5. **FR-5 List.** The API returns all the user's notes, most recently updated first (then by id). Filtering and search are done on the client (a personal notebook stays small).
6. **FR-6 Quick idea.** A single-line field at the top of the page creates an `idea` from the title alone on Enter or a button, and the field clears; an empty or blank title does nothing.
7. **FR-7 Filters.** Kind chips (All, Goals, Notes, Ideas), a status toggle (Open by default, Done, Archived) and a text search over title and body (case- and accent-insensitive).
8. **FR-8 Isolation.** Every note belongs to a user; all rows carry `user_id` and repositories filter by the current user (AGENTS.md).

## 7. Non-Functional Requirements

- All user-visible text exists in EN-US and PT-BR; user-typed text is never translated.
- Accessible: filters are buttons with `aria-pressed`, every input has a label, status changes are announced in text, not only by color.
- Works at phone width without sideways scrolling; the quick idea field is reachable without scrolling past the list.
- A body is shown with its line breaks and no HTML interpretation (text only, escaped by the framework).

## 8. UX / Design Notes

Route `/routines/notes`, a new section tab "Notes" after History. Page heading "Notes" with a "New note" button.

- **Quick idea field** at the top, then the filter row, then the list.
- **List item:** kind label (text plus icon), title, the first lines of the body (clamped), last update date, and actions: Edit, Done/Reopen (goals and ideas), Archive/Restore, Delete. Done items show the title struck through plus the word "Done".
- **Form** (create/edit): Kind (select), Title, Text (textarea, with a character counter near the limit), Cancel and Save; mirrors the existing forms of the module.
- **Empty:** no notes at all → a short explanation and the "New note" button; notes exist but none match the filter → "Nothing matches" with a clear-filters button.
- **Loading / error:** the module's usual loading state and the "could not load" retry component.
- **Save/delete error:** an inline alert; the form stays open and keeps what was typed.
- **Boundaries:** a 4000-character body scrolls inside the card; a title of 80 characters wraps; special characters and emoji are kept as typed; `<script>` text is shown literally.
- **Demo mode:** the DEMO button shows a few sample notes (one of each kind).

## 9. Technical Considerations

- **Affected surface (API):**
  - Domain: `apps/api/Domain/Notes/Note.cs`, `NoteKind.cs`, `NoteStatus.cs` (rules in FR-1 to FR-3, pure, unit-tested).
  - Application: `Application/Notes/INoteRepository.cs`, `SaveNote.cs`, `SetNoteStatus.cs`, `DeleteNote.cs`, `ListNotes.cs`.
  - Infrastructure: `Infrastructure/Sqlite/SqliteNoteRepository.cs`, table in `SqliteSchema.cs`, registration in `SqlitePersistenceRegistration.cs`.
  - Endpoints: `Endpoints/NoteEndpoints.cs`, registered in `Program.cs`.
- **Contracts:**
  - `GET /api/notes` → `NoteResponse[]`.
  - `PUT /api/notes/{id}` body `{ kind, title, body }` → `NoteResponse`.
  - `PUT /api/notes/{id}/status` body `{ status }` → `NoteResponse`.
  - `DELETE /api/notes/{id}` → 204.
  - `NoteResponse = { id, kind, title, body, status, createdAt, updatedAt }`; enums as camelCase strings (`goal|note|idea`, `open|done|archived`).
  - Table: `notes(user_id, id, kind, title, body, status, created_at, updated_at)`, primary key `(user_id, id)`, foreign key `user_id → users(id) ON DELETE CASCADE`, index on `(user_id, updated_at)`; add `"notes"` to `SqliteSchema.UserTables`. A new table only: created by `CREATE TABLE IF NOT EXISTS`, no version bump (the same approach sinking funds used).
  - Time comes from `TimeProvider` (the clock the app already registers), not from the client, so a phone with a wrong clock cannot misorder notes.
- **Affected surface (web):** `core/routines/notes.ts` (types), `notes-gateway.ts` (port), `http-notes-gateway.ts`, `fake-notes-gateway.ts`, `notes-store.ts` (+ specs), `core/routines/demo/` (demo gateway) and the binding in `app.config.ts`; `core/routines/routines-section.ts` (new tab); `pages/routines/notes/` (page, list item and form components); `routines.routes.ts`; PT-BR keys in `pt-br-routines.ts`.
- **Constraints and gotchas:** the web specs run in a shared jsdom (browser storage is cleared after each test, see PR 64); a bill/fund-style store provided by the page; keep functions ≤ 20 lines and files < 500 lines (AGENTS.md); the existing "Goals" screens are untouched and the word "goal" in the notebook must not be confused with them (label the kind "Goal" and the tab "Notes").

## 10. Success Metrics

- Writing down an idea takes one field and one key press (FR-6).
- A goal written on the desktop is readable on the phone, and the open list shows only what is not done or archived.

## 11. Milestones / Rollout

1. API: domain, persistence, use cases, endpoints.
2. Web: gateways, store, tab and page, list item and form, translations, demo data.
3. E2E: quick idea, create a goal, mark done, archive, search.

No feature flag; a new table only.

## 12. Open Questions / Assumptions

- Assumption: a single flat list is enough; tags and folders can come if the list grows.
- Assumption: no limit on how many notes a user keeps.
- Open: should archived and done items also be hidden from search by default? (Assumed: search applies inside the selected status.)
- Open: PT-BR kind names, assumed "Meta", "Nota" and "Ideia".
