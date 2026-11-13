---
id: 102
title: Web model, gateway port, HTTP and fake gateways
status: backlog
wave: 1
depends_on: []
priority: high
estimate: S
files:
  - apps/web/src/app/core/routines/notes.ts
  - apps/web/src/app/core/routines/notes-gateway.ts
  - apps/web/src/app/core/routines/http-notes-gateway.ts
  - apps/web/src/app/core/routines/http-notes-gateway.spec.ts
  - apps/web/src/app/core/routines/fake-notes-gateway.ts
  - apps/web/src/app/app.config.ts
prd_refs: [FR-1, FR-2, FR-3, FR-4, FR-5]
memory_refs: []
agent_ready: true
---

# 102 – Web model, gateway port, HTTP and fake gateways

## Context (self-contained)
The Angular app (`apps/web`) talks to the API through *gateways*: an abstract class (port) in `src/app/core/<area>/`, an HTTP adapter, a fake for tests and a demo adapter, bound in `src/app/app.config.ts`. A new **Notes** feature (goals, notes and ideas written as free text, with a status) needs its own port under `core/routines/`. Study and mirror: `core/routines/tasks-gateway.ts`, `http-tasks-gateway.ts` (+ `http-gateways.spec.ts` or `http-tasks-gateway.spec.ts` for the HttpTestingController pattern), `fake-tasks-gateway.ts` (synchronous double with a public `failure` field and recorded calls) and, as the freshest example of the same shape, `core/finances/sinking-funds-gateway.ts`, `http-sinking-funds-gateway.ts` and `fake-sinking-funds-gateway.ts`.

## Interfaces you must conform to
Types and `NotesGateway` exactly as in BOARD.md "Web types" (notes.ts and notes-gateway.ts blocks); wire format as in BOARD.md "Wire format".

## Implementation plan
1. `notes.ts`: `NoteKind`, `NoteStatus`, `Note`, `NoteDraft`, `NOTE_TITLE_MAX = 80`, `NOTE_BODY_MAX = 4000`, with a doc comment each (timestamps are UTC ISO-8601 set by the API).
2. `notes-gateway.ts`: the abstract class with doc comments (`list`: most recently updated first).
3. `http-notes-gateway.ts`: `@Injectable() export class HttpNotesGateway extends NotesGateway`, `NOTES_URL = '/api/notes'`. `list()`: GET. `save(id, draft)`: `PUT ${url}/${encodeURIComponent(id)}` with the draft as body. `setStatus(id, status)`: `PUT ${url}/${encodeURIComponent(id)}/status` with `{ status }`. `delete(id)`: DELETE.
4. `fake-notes-gateway.ts`: `FakeNotesGateway` with `failure: Error | undefined`, `notesToServe: readonly Note[]` (default `SAMPLE_NOTES`: one goal "Leave the comfort zone" open, one note "Cambly" open with a two-line body, one idea "Sales call script" open, one done idea, one archived note; fixed timestamps `2026-11-0xT10:00:00Z` with different `updatedAt`), recorded arrays `saved: { id; draft }[]`, `statusChanges: { id; status }[]`, `deleted: string[]`, `listCalls: number`. `save` answers a `Note` built from the draft (status `open`, timestamps `2026-11-12T10:00:00Z`); `setStatus` answers the served note with the status changed (or a note with that id when unknown). Each method answers through a private `answer()` that throws `failure` when set (copy from `fake-sinking-funds-gateway.ts`). Export `SAMPLE_NOTES`.
5. `http-notes-gateway.spec.ts`: with `HttpTestingController`, one test per method asserting method, URL (use an id with a space to check the encoding in one of them) and body.
6. `app.config.ts`: add `{ provide: NotesGateway, useClass: HttpNotesGateway }` next to the `TasksGateway` provider (keep imports sorted as the file does). Task 204 later turns it into the demo switch.

## Acceptance criteria
- [ ] `npm run lint`, `npx prettier --check .` and `npx ng test --no-watch` pass in `apps/web`.
- [ ] The HTTP spec covers list, save, setStatus and delete.
- [ ] Types and gateway signatures match BOARD.md exactly.

## Out of scope
The store (203), filter (103), demo gateway (204), UI, translations, any API code.
