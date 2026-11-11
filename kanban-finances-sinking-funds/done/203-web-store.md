---
id: 203
title: Web SinkingFundsStore
status: done
wave: 2
depends_on: [102]
priority: high
estimate: S
files:
  - apps/web/src/app/core/finances/sinking-funds-store.ts
  - apps/web/src/app/core/finances/sinking-funds-store.spec.ts
prd_refs: [FR-5, FR-6, FR-7, FR-8]
memory_refs: []
agent_ready: true
---

# 203 – Web SinkingFundsStore

## Context (self-contained)
The "To pay & receive" page (`pages/finances/bills`) gets a Sinking funds section. Its state lives in a store provided by the page (like `core/finances/bills-store.ts`: signals, `ErrorHandler`, `IdGenerator`, `Clock`, tests with fakes). The gateway port, types and `FakeSinkingFundsGateway` come from task 102 (BOARD.md "Web types"). Because the API is serverless, funds due today must be *rolled* into bills when the tab opens: the store calls `roll(today)` first, then `list(today)`.

## Interfaces you must conform to
`SinkingFundsStore` exactly as in BOARD.md "Web types". Read `bills-store.ts` for `today = isoDate(inject(Clock).now())`, `IdGenerator` usage and error handling (`hasLoadFailed`, `ErrorHandler.handleError`).

## Implementation plan
1. `@Injectable() export class SinkingFundsStore`: private signals `fundList`, `total`, `loaded`, `loadFailed`, `actionFailed`, `rolled`. `today` from `Clock`.
2. Constructor calls `load()`: `gateway.roll(today).pipe(switchMap(bills => { rolled.set(bills); return gateway.list(today); }))`; on success set funds/total/loaded; on error set `loadFailed`, call `errorHandler.handleError(error)`. A failed roll must still try the list: use `catchError` on the roll that records the failure and continues with `list` (the roll is retried on the next visit).
3. `reload()`: clears `loadFailed` and runs `load()` again.
4. `save(draft, id?)`: `const fundId = id ?? ids.next()` (use the same method `BillsStore` uses to make ids); `gateway.save(fundId, today, draft)`; on success call `refresh()` (list only, no roll); on error set `actionFailed(true)` and report the error. Clear `actionFailed` at the start of each save/remove.
5. `remove(id)`: `gateway.delete(id)`, then `refresh()`; same failure handling.
6. Not optimistic: the numbers (`savedCents`, `monthlyCents`) are calculated by the API, so the screen updates from the refreshed list.
7. Spec with `FakeSinkingFundsGateway`: loads roll then list in that order (`rolledDays`, `askedDays` both `[today]`); exposes funds, total and rolled bills; a failing list sets `hasLoadFailed`; reload recovers; save with and without id (a new id is generated), refreshes the list; remove calls delete and refreshes; failing save sets `hasActionFailed` and keeps the old list.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Roll fails, list works | funds shown, `rolledBills` stays `[]`, `hasLoadFailed` false |
| List fails | `hasLoadFailed` true, `isLoaded` false |
| Two refreshes overlap | the later answer wins (use `switchMap` on a trigger subject, or a request counter as `BillsStore.agendaRequest` does) |

## Acceptance criteria
- [x] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [x] The spec covers every row above.

## Out of scope
UI, page wiring (401), demo data.
