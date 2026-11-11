---
id: 501
title: E2E test for sinking funds and TODO tick
status: done
wave: 5
depends_on: [301, 401]
priority: medium
estimate: S
files:
  - apps/web/e2e/sinking-funds.e2e.ts
  - apps/web/e2e/pages/sinking-funds.page.ts
  - TODO.md
prd_refs: [FR-1, FR-4, FR-5, FR-6, FR-7]
memory_refs: []
agent_ready: true
---

# 501 – E2E test for sinking funds and TODO tick

## Context (self-contained)
The full feature (API + web) is in place. AGENTS.md requires E2E coverage of critical flows. Playwright specs live in `apps/web/e2e/`, with page objects in `e2e/pages/` and API helpers in `e2e/support/finances-api.ts` (`createAccount`, `createTransaction`, `ownMonth`, `uniqueName`, ...). Read `e2e/bills.e2e.ts`, `e2e/pages/` for the bills page object and `e2e/accounts.e2e.ts` (slot rules: each spec owns months by "slot" so totals never collide; use a slot number not used by other specs — grep `FIRST_SLOT`). Specs freeze the browser clock with `page.clock.setFixedTime(ownMonth(...))`.

Lesson from this branch's history: a new hint on Transactions linked to other pages, so locate tab links inside `getByRole('navigation', { name: 'Module sections' })`.

## Implementation plan
1. `pages/sinking-funds.page.ts`: page object (`goto()` opens `/finances/bills`; locators for the section by heading "Sinking funds", the "New sinking fund" button, form fields by label, Save, fund rows by description).
2. `sinking-funds.e2e.ts`:
   - creating an every-months fund (e.g. "Grooming", 100,00 every 2 months, next due 2 months after the frozen day) shows "Set aside R$50.00 per month" and the footer total;
   - creating a fixed-date fund (month/day ahead) shows its monthly amount (cost/12 rounded up) and "Due" date;
   - editing the cost updates the monthly amount; deleting removes the row and the empty state returns when none are left;
   - a fund due on the frozen day is rolled into a payable: after opening the page the bill appears in the agenda (create the fund through the API with `PUT /api/sinking-funds/{id}?today=` using a due date equal to the frozen day, then open the page);
   - the page fits a phone screen without sideways scrolling with a fund listed (copy the check from `accounts.e2e.ts`).
   Create categories/funds through API helpers where the UI is not the subject; use a unique name per test (`uniqueName`).
3. `TODO.md`: mark the "Sinking funds ..." item `[x]`.
4. Run the whole E2E suite once (`npx playwright test` in `apps/web`) to confirm nothing else broke.

## Acceptance criteria
- [x] `npm run e2e:typecheck`, `npx prettier --check .` and `npm run lint` pass; the new spec passes on desktop and mobile projects; the full suite stays green.
- [x] The new spec uses its own slot/month and unique names.

## Out of scope
Application code changes (report instead).
