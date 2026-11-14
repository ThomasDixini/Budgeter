---
id: 204
title: Web demo gateway and binding
status: done
wave: 2
depends_on: [102]
priority: medium
estimate: S
files:
  - apps/web/src/app/core/routines/demo/demo-notes.ts
  - apps/web/src/app/core/routines/demo/demo-notes.spec.ts
  - apps/web/src/app/app.config.ts
prd_refs: [FR-1]
memory_refs: []
agent_ready: true
---

# 204 – Web demo gateway and binding

## Context (self-contained)
The app has a DEMO mode (header DEMO button or `?demo=on`) that serves sample data through *demo gateways* instead of HTTP ones. Routines & Goals demo gateways live in `core/routines/demo/` (`demo-routines-gateways.ts`, helpers in `demo-routines.ts`), and the finance equivalents in `core/finances/demo/` — the freshest example is `demo-sinking-funds.ts` (+ spec). The notes gateway port exists from task 102 (BOARD.md "Web types"). Read `demo-routines-gateways.ts` for how the module's demo gateways are written (in-memory state, relative dates, no network) and `demo-sinking-funds.ts` for a stand-alone demo gateway file.

## Implementation plan
1. `demo-notes.ts`: `DemoNotesGateway extends NotesGateway` (`@Injectable()`), in-memory state seeded with five notes whose `createdAt`/`updatedAt` are relative to the demo clock (find how `demo-sinking-funds.ts` / `DemoFinances` gets "today"; use that, never a hard-coded year): goal "Leave the comfort zone" (open, a 3-line body), note "Cambly" (open, body about practicing English twice a week), idea "Sales call script" (open), idea "Try a cold shower week" (done), note "Old reading list" (archived). Timestamps differ by days so the order is visible.
2. `list()` returns a copy ordered by `updatedAt` desc then id. `save(id, draft)` creates (open) or edits keeping `createdAt` and status and refreshes `updatedAt` with the demo "now"; `setStatus` changes the status and `updatedAt`; `delete` removes. Mirror the API rules for done notes only enough to not crash: marking a `note` done is ignored (returns the note unchanged).
3. `app.config.ts`: change the provider written by task 102 to `{ provide: NotesGateway, useClass: isDemo ? DemoNotesGateway : HttpNotesGateway }` (import the demo class from its own file).
4. Spec: seeded list order and kinds/statuses; save a new note and edit one (created stays, updated moves); set status; delete; dates are relative to the clock (run with another demo clock year and check the seeded `updatedAt` follow it).

## Acceptance criteria
- [x] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [x] Demo data is relative to the demo clock.

## Out of scope
Editing `demo-routines-gateways.ts`, the store, UI.
