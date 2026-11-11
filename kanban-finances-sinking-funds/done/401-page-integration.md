---
id: 401
title: Integrate sinking funds into the To pay & receive page
status: done
wave: 4
depends_on: [203, 204, 302, 303]
priority: high
estimate: M
files:
  - apps/web/src/app/pages/finances/bills/bills.ts
  - apps/web/src/app/pages/finances/bills/bills.html
  - apps/web/src/app/pages/finances/bills/bills.css
  - apps/web/src/app/pages/finances/bills/bills.spec.ts
  - apps/web/src/app/core/finances/bills-store.ts
  - apps/web/src/app/core/finances/bills-store.spec.ts
prd_refs: [FR-1, FR-6, FR-7, FR-8, FR-9]
memory_refs: []
agent_ready: true
---

# 401 – Integrate sinking funds into the To pay & receive page

## Context (self-contained)
Everything for sinking funds exists separately: `SinkingFundsStore` (provided per page; rolls due funds into bills on load), `SinkingFundList` and `SinkingFundForm` components, gateway bindings (BOARD.md "Web types"). This task puts them on the page `pages/finances/bills` (component in `bills.ts`, `providers: [BillsStore]` at ~line 43, template `bills.html`). The page already opens a bill form/settle form through `open({ kind: 'new' })`-style state; read `bills.ts` and `bills.html` fully and mirror how the bill form is opened and closed.

A roll creates bills on the server *after* `BillsStore` may already have loaded the agenda, so the agenda must be refreshed when the roll created bills.

## Interfaces you must conform to
- `SinkingFundsStore` (add to the page's `providers`), `SinkingFundList` (`app-sinking-fund-list`), `SinkingFundForm` (`app-sinking-fund-form`) exactly as in BOARD.md.
- New public method on `BillsStore`: `refreshAgenda(): void` — reloads the agenda from the gateway (reusing the private loader and its request counter, so an older answer cannot overwrite a newer one), keeping the current items on screen until the new answer arrives.

## Implementation plan
1. `bills-store.ts`: add `refreshAgenda()` (doc comment with `@example store.refreshAgenda()`), spec in `bills-store.spec.ts`: calling it asks the gateway for the agenda again and shows new bills; a failure keeps the previous bills.
2. `bills.ts`: `inject(SinkingFundsStore)`; add a signal for the open sinking-fund form (`{ kind: 'new' } | { kind: 'edit', fund: SinkingFund } | null`); an `effect` that calls `billsStore.refreshAgenda()` once when `sinkingFunds.rolledBills().length > 0` (guard so it fires only once); handlers for `add`, `edit`, `remove`, `saved` (call `sinkingFunds.save(draft, id ?? undefined)` and close the form) and `cancelled`.
3. `bills.html`: below the agenda groups add `<app-sinking-fund-list [funds]="sinkingFunds.funds()" [totalMonthlyCents]="sinkingFunds.totalMonthlyCents()" [categories]="…" (add)=… (edit)=… (remove)=…/>`; render the form the same way the bill form is rendered (modal/panel) when its signal is open. States: while `!isLoaded()` show the same loading treatment the agenda uses; if `hasLoadFailed()` show "Could not load the sinking funds."; if `hasActionFailed()` show "Could not save the sinking fund." as a `role="status"`/alert like the page's other errors, with the rest of the page still usable.
4. `bills.css`: spacing for the new section only; no change to existing rules.
5. `bills.spec.ts`: renders the section with the fake gateway funds; opening the form, saving a new fund calls the gateway with the draft and a generated id; editing passes the fund id; delete calls the gateway; a roll that creates bills makes the agenda load a second time (`FakeBillsGateway.askedDays` length 2) and not otherwise; failure messages show. The spec needs `SinkingFundsGateway` provided with `FakeSinkingFundsGateway` (as it already does for `BillsGateway`).
6. Check other specs that render the whole bills page or the overview still pass (`app.spec`, routes).

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Roll returns no bills | agenda is not reloaded |
| Roll returns bills | agenda reloaded exactly once |
| Save fails | message shown, form content not lost silently (the form is closed only on success: keep it open until the store reports success, or reopen it with the draft — pick keep-open) |
| No funds | empty state from the list component |

## Acceptance criteria
- [x] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [x] `bills.ts` stays under 500 lines (extract a helper if needed within the files you own).
- [x] The page works in DEMO mode (`?demo=on`): funds show with the demo gateway; verify in the browser pane.

## Out of scope
E2E tests (501), API changes, changes to the list/form components (report a needed change instead).
