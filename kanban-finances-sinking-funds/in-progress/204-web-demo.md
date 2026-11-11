---
id: 204
title: Web demo gateway and binding
status: in-progress
wave: 2
depends_on: [102]
priority: medium
estimate: S
files:
  - apps/web/src/app/core/finances/demo/demo-sinking-funds.ts
  - apps/web/src/app/core/finances/demo/demo-sinking-funds.spec.ts
  - apps/web/src/app/app.config.ts
prd_refs: [FR-1]
memory_refs: []
agent_ready: true
---

# 204 – Web demo gateway and binding

## Context (self-contained)
The app has a DEMO mode (header DEMO button or `?demo=on`) that serves sample data for every Finances tab through *demo gateways* instead of HTTP ones (`core/finances/demo/demo-gateways.ts`, `DemoBillsGateway` at ~line 126, helpers in `demo-dates.ts`, `demo-finances.ts`). The sinking-funds gateway port exists from task 102 (BOARD.md "Web types"). Read `DemoBillsGateway` and `demo-gateways.spec`-style tests (`demo-gateways.spec.ts`) and mirror: in-memory state, dates relative to the demo clock (never hard-coded years), no network.

## Implementation plan
1. `demo-sinking-funds.ts`: `DemoSinkingFundsGateway extends SinkingFundsGateway` (`@Injectable()`), state seeded with two funds relative to `today`: "Vehicle tax (IPVA)" 120000 cents, `fixedDate` (month/day = a date about 5 months ahead), and "Dog grooming" 10000 cents `everyMonths` 2 starting about 3 weeks ahead. Use the demo categories' real ids (read `demo-data.ts` and `demo-finances.ts` for the expense category ids; pick transport/health-like ones that exist).
2. Calculations in the gateway: implement the BOARD.md "Calculations" in a small pure function `summarize(fund, today)` inside the same file (months arithmetic with clamped due day). Keep it consistent with the API; the spec checks the two seeded funds.
3. `list(today)` summarizes all funds; `save` upserts (fixedDate computes the next occurrence from `today`), `delete` removes, `roll(today)` returns `[]` (demo bills are not created).
4. `app.config.ts`: change the provider written by task 102 to `{ provide: SinkingFundsGateway, useClass: isDemo ? DemoSinkingFundsGateway : HttpSinkingFundsGateway }` (import the demo class from its own file).
5. Spec: seeded list totals, saving a fixed-date fund picks the next occurrence, delete removes, results are relative to the clock.

## Acceptance criteria
- [ ] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [ ] Demo data is relative to the demo clock.

## Out of scope
Editing `demo-gateways.ts`, the store, UI.
