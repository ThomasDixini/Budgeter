---
id: 102
title: Web model, gateway port, HTTP and fake gateways
status: in-progress
wave: 1
depends_on: []
priority: high
estimate: S
files:
  - apps/web/src/app/core/finances/sinking-funds.ts
  - apps/web/src/app/core/finances/sinking-funds-gateway.ts
  - apps/web/src/app/core/finances/http-sinking-funds-gateway.ts
  - apps/web/src/app/core/finances/http-sinking-funds-gateway.spec.ts
  - apps/web/src/app/core/finances/fake-sinking-funds-gateway.ts
  - apps/web/src/app/app.config.ts
prd_refs: [FR-1, FR-6]
memory_refs: []
agent_ready: true
---

# 102 – Web model, gateway port, HTTP and fake gateways

## Context (self-contained)
Orbit's Angular app (`apps/web`) talks to the API through *gateways*: an abstract class (port) in `src/app/core/finances/`, an HTTP adapter, a fake for tests and a demo adapter, bound in `src/app/app.config.ts`. A new feature, **sinking funds** (money set aside over months for an irregular bill), needs its own port. Study the bills equivalents and mirror them exactly: `bills.ts`, `bills-gateway.ts`, `http-bills-gateway.ts` (uses `HttpClient`, `/api/bills`, `encodeURIComponent` ids), `fake-bills-gateway.ts` (synchronous test double with a public `failure` field and recorded calls) and its spec pattern in `http-bills-gateway.spec.ts` if present, otherwise `http-transactions-gateway.spec.ts`.

## Interfaces you must conform to
Types and the `SinkingFundsGateway` abstract class exactly as in BOARD.md "Web types"; wire format as in BOARD.md "Wire format". `Bill` is imported from `./bills`.

## Implementation plan
1. `sinking-funds.ts`: the exported types and interfaces from BOARD.md with a doc comment each (state the unit: cents, `YYYY-MM-DD` local calendar days).
2. `sinking-funds-gateway.ts`: the abstract class, doc comments like `bills-gateway.ts`.
3. `http-sinking-funds-gateway.ts`: `@Injectable() export class HttpSinkingFundsGateway extends SinkingFundsGateway`, `SINKING_FUNDS_URL = '/api/sinking-funds'`.
   - `list(today)`: `GET` with `params: { today }`.
   - `save(id, today, draft)`: `PUT ${url}/${encodeURIComponent(id)}` with `params: { today }` and the draft as body.
   - `delete(id)`: `DELETE`.
   - `roll(today)`: `POST ${url}/roll` with body `{ today }`.
4. `fake-sinking-funds-gateway.ts`: `FakeSinkingFundsGateway` with `failure: Error | undefined`, `overviewToServe: SinkingFundsOverview` (default: one fund, `{ id: 'ipva', description: 'IPVA', categoryId: 'transport', amountCents: 120000, schedule: { kind: 'fixedDate', intervalMonths: 12, month: 1, day: 15, nextDueDate: '2027-01-15' }, savedCents: 90000, monthlyCents: 10000, cycleStart: '2026-01-15' }` and `totalMonthlyCents: 10000`), `billsToRoll: readonly Bill[] = []`, recorded arrays `saved: { id; today; draft }[]`, `deleted: string[]`, `askedDays: string[]`, `rolledDays: string[]`. `save` answers a `SinkingFund` built from the draft (savedCents 0, monthlyCents = ceil(amount / cycle), cycleStart = nextDueDate for everyMonths else `'2026-01-15'`) – a plain approximation is fine for tests. Each method answers via a private `answer()` that throws `failure` when set (copy from `fake-bills-gateway.ts`).
5. `http-sinking-funds-gateway.spec.ts`: with `HttpTestingController`, one test per method asserting method, URL, params and body.
6. `app.config.ts`: add `{ provide: SinkingFundsGateway, useClass: HttpSinkingFundsGateway }` next to the `BillsGateway` provider (keep imports sorted as the file does). Task 204 later turns it into the demo switch.

## Acceptance criteria
- [ ] `npm run lint`, `npx prettier --check .` and `npx ng test --no-watch` pass in `apps/web`.
- [ ] The HTTP spec covers list, save, delete and roll requests.
- [ ] Types and the gateway signatures match BOARD.md exactly.

## Out of scope
The store (203), demo gateway (204), UI, translations, any API code.
