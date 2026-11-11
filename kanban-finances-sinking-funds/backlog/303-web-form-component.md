---
id: 303
title: Web SinkingFundForm component
status: backlog
wave: 3
depends_on: [102, 103]
priority: high
estimate: M
files:
  - apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-form.ts
  - apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-form.html
  - apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-form.css
  - apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-form.spec.ts
prd_refs: [FR-1, FR-2, FR-3, FR-8]
memory_refs: []
agent_ready: true
---

# 303 – Web SinkingFundForm component

## Context (self-contained)
Form to create or edit a sinking fund, opened from the To pay & receive page (wiring is task 401). Presentational: inputs and outputs only. Mirror `pages/finances/bills/bill-form/bill-form.{ts,html,css}` and its spec as closely as possible (Reactive/Signal forms approach, amount input parsing through `core/finances/money.ts`, category `<select>`, Cancel/Save buttons, validation messages, `t` pipe, shared CSS classes, how it focuses the first field). Types from `core/finances/sinking-funds.ts` (task 102); texts are the keys of BOARD.md "Translation keys".

## Interfaces you must conform to
Selector `app-sinking-fund-form`; inputs `fund: SinkingFund | null` (null = new), `categories` (type used by the bill form), `today: string`; outputs `saved: { id: string | null; draft: SinkingFundDraft }` (id is the edited fund's id, `null` for a new one) and `cancelled: void`.

## Implementation plan
1. Fields: Description (max 80), Category (select, required), "Cost per cycle (R$)" (reuse the existing "Amount (R$)" parsing; must be above zero), "Repeats" radio/select with "Every few months" (`everyMonths`) and "Every year on a fixed date" (`fixedDate`).
2. When `everyMonths`: "Every (months)" number 1–60 and "Next due date" date input (min = `today`). When `fixedDate`: "Month of the year (1-12)" number and "Day of the month" number 1–31. Show only the active kind's fields.
3. Heading: "New sinking fund" when `fund` is null, otherwise "Edit sinking fund". When editing, prefill from `fund` (everyMonths: interval and `schedule.nextDueDate`; fixedDate: `schedule.month` and `schedule.day`; amount formatted as the bill form does).
4. On Save with valid data emit `saved` with the draft: `{ description trimmed, categoryId, amountCents, schedule }` where the schedule is `{ kind: 'everyMonths', intervalMonths, nextDueDate }` or `{ kind: 'fixedDate', month, day }`.
5. Validation: show the same inline error style the bill form uses; Save is blocked while invalid (no emit). Rules: description non-blank, category chosen, amount > 0, interval integer 1–60, next due date not before `today`, month integer 1–12, day integer 1–31.
6. Cancel and Escape emit `cancelled` (same as the bill form).
7. Spec: new vs edit headings, prefill, each kind's fields shown/hidden, valid emit for both kinds (exact payloads incl. cents conversion: "1.200,00" in the app's input format as the bill form spec does), each validation rule blocks the emit, cancel emits.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Switching kind after typing | keeps description/category/amount; the other kind's fields are ignored |
| Next due date equal to `today` | accepted |
| Day 31 with fixed date | accepted (the API clamps short months) |
| Edit of a fixedDate fund | month/day prefilled, no due date field |

## Acceptance criteria
- [ ] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [ ] Keyboard operable; every input has a label.
- [ ] Works at phone width without sideways scrolling.

## Out of scope
The list (302), the store and page wiring (401), translations (103).
