# PRD: Finances · Sinking funds

## 1. Overview

Some bills do not come every month: the vehicle tax (IPVA) once a year, a $100 dog grooming every 2 months. When they land they hurt the month's budget, because nothing was set aside for them. A **sinking fund** spreads the cost of such a bill over the months before it is due, so the user always knows how much should already be saved toward each one and how much to put aside this month.

This slice adds sinking funds to the **To pay & receive** tab. The saved amount is *calculated from time*, not recorded: no money moves between accounts. When a fund's due date arrives, it becomes a normal payable bill and the fund starts its next cycle from zero.

## 2. Goals

- Create, edit and delete a sinking fund: description, category, cost per cycle, and when it repeats.
- Repeat either **every N months** (from a next due date) or on a **fixed date each year** (a month and a day).
- Show, per fund: the cost, the next due date, how much should be saved so far, the progress, and the monthly amount to set aside.
- Show the total monthly amount to set aside across all funds.
- When a fund falls due, create a payable bill for it and begin the next cycle.

## 3. Non-Goals

- Recording real deposits, or transferring money to a reserve account (the saved amount is a calculation, not a balance).
- Reducing any account balance or creating transactions for the set-aside amounts.
- Receivable funds (money to be received); only payables.
- Per-fund investment returns, or an amount that changes between cycles (edit the fund to change it).
- Offline queue and sync for this slice (ids are client-generated, as for bills, so it can be added later).
- Notifications or reminders.

## 4. Target Users & Use Cases

The single owner of this personal app.

- **Planning on the desktop:** list every irregular bill with its yearly cost and see how much to set aside each month.
- **Checking in on the phone:** open To pay & receive and see how close the IPVA fund is to what it needs to be.
- **When the bill arrives:** find it in the agenda as a payable and settle it like any other bill.

## 5. User Stories

- As the user, I want to register "IPVA, $1,200, every January 15" so that I know to set aside $100 a month.
- As the user, I want to register "Dog grooming, $100, every 2 months" so that the cost does not surprise me.
- As the user, I want to see how much I should have saved so far for each fund so that I can compare it with what I actually set aside.
- As the user, I want the bill to appear as a payable on its due date so that I settle it through the usual flow.

## 6. Functional Requirements

1. **FR-1 Create/edit.** The user can save a fund with: description (1–80 chars, trimmed, same limit as bills), category (an existing expense category), cost per cycle (cents, above zero, same ceiling as bills) and a schedule. Invalid input → the same business errors the bills use (message includes the offending value and the expected shape).
2. **FR-2 Schedule, every N months.** `intervalMonths` in 1–60 plus `nextDueDate`. The cycle is the N months ending on `nextDueDate`. Edge cases: `nextDueDate` in the past is rejected on creation; a day that does not exist in a later month (the 31st) falls on the month's last day.
3. **FR-3 Schedule, fixed date.** `month` (1–12) and `day` (1–31). The cycle is the 12 months ending on the next occurrence of that date on or after today. Edge case: 29 Feb falls on 28 Feb in non-leap years.
4. **FR-4 Saved so far.** `saved = round(cost × elapsedMonths / cycleMonths)`, where `elapsedMonths` is the number of whole months from the cycle's start to today, capped at `cycleMonths`. At the cycle's start it is 0; on the due date it is the full cost. Cycle length is N, or 12 for a fixed date.
5. **FR-5 Monthly set-aside.** `ceil(cost / cycleMonths)` per fund, and their sum across funds shown as the total.
6. **FR-6 Roll.** A "roll" use case, idempotent, runs when the tab opens. For each fund whose `nextDueDate` is on or before today it creates a payable bill (same description, category and cost, due on that date) and advances `nextDueDate` by one cycle, repeating for each missed cycle (at most 12 per call). The bill id is derived from the fund id and due date, so running it twice creates nothing new.
7. **FR-7 Delete.** Deleting a fund keeps the bills it already created.
8. **FR-8 Editing.** Changing cost or schedule applies from the current cycle; bills already created are untouched.
9. **FR-9 Isolation.** Every fund belongs to a user: all rows carry `user_id` and repositories filter by the current user (AGENTS.md).

## 7. Non-Functional Requirements

- Amounts are integer cents; no floating point in the domain.
- All user-visible text is translated for EN-US and PT-BR (the app's two languages).
- Accessible: progress is conveyed in text as well as a bar; the form is keyboard operable.
- Works at phone width without sideways scrolling.

## 8. UX / Design Notes

A **Sinking funds** section on the To pay & receive page, below the agenda, with a "New sinking fund" button that opens a form like the bill form.

- **Empty:** a short explanation and the button; no total.
- **Loading:** the section shows the same loading state as the agenda.
- **Error:** the same error message pattern the agenda uses; the rest of the page still works.
- **Fund row:** description, category, cost, next due date, "saved so far of cost", a progress bar with text, and "set aside X per month".
- **Footer:** total set aside per month.
- **Boundaries:** a fund due today shows 100 % and is rolled into a bill; a fund with a very long description truncates with the full text available; 60-month cycles show the monthly amount rounded up.
- **Demo mode:** the DEMO button shows a few funds (yearly tax, 2-month grooming) like every other tab.

## 9. Technical Considerations

- **Affected surface (API):**
  - Domain: `Domain/Finances/SinkingFund.cs`, `SinkingFundSchedule.cs` (pure calculation: cycle bounds, saved, monthly amount, next due), unit-tested.
  - Application: `SaveSinkingFund`, `DeleteSinkingFund`, `ListSinkingFunds`, `RollSinkingFunds`, `ISinkingFundRepository`.
  - Infrastructure: `SqliteSinkingFundRepository`, table `sinking_funds` in `SqliteSchema.cs` with a migration in `SqliteMigrations.cs`; the table is added to the per-user table list.
  - Endpoints: `SinkingFundEndpoints.cs`.
- **Contracts:**
  - `PUT /sinking-funds/{id}` with `{ description, categoryId, amountCents, schedule: { kind: "everyMonths", intervalMonths, nextDueDate } | { kind: "fixedDate", month, day } }`.
  - `GET /sinking-funds?today=YYYY-MM-DD` returns each fund with `savedCents`, `monthlyCents`, `nextDueDate`, `cycleStart`.
  - `DELETE /sinking-funds/{id}`, `POST /sinking-funds/roll` (body: today) returns the bills created.
- **Table:** `sinking_funds(user_id, id, description, category_id, amount_cents, schedule_kind, interval_months, next_due_date, fixed_month, fixed_day)`; primary key `(user_id, id)`, foreign key to the category by `(user_id, category_id)`.
- **Today:** the API takes today from the caller, as the bills agenda does, so tests and the E2E clock stay deterministic.
- **Affected surface (web):** `core/finances/sinking-funds-gateway.ts`, `http-sinking-funds-gateway.ts`, `fake-sinking-funds-gateway.ts`, a store, and `pages/finances/bills/sinking-funds/` with a list and a form component; translations in the finances files; demo data under `core/finances/demo`.
- **Constraint:** serverless, so no background job rolls funds: the roll runs when the tab opens.

## 10. Success Metrics

- The user can reproduce both examples (IPVA yearly, grooming every 2 months) and read the right monthly amount.
- Opening the tab on or after a due date shows exactly one new payable per cycle, never duplicates.

## 11. Milestones / Rollout

1. Domain calculation and persistence (API).
2. Endpoints and roll use case.
3. Web: gateway, store, list and form, translations, demo data.
4. E2E: create a fund, see the monthly amount, see the bill appear on the due date.

No feature flag; a new table only, so no data migration.

## 12. Open Questions / Assumptions

- Assumption: fixed date means a yearly date; monthly-on-a-day is already covered by monthly bills.
- Assumption: the category of a fund must be an expense category.
- Open: should the monthly set-aside also be shown in the Overview or the income split? Left out for now.
- Open: when several cycles were missed, one bill per cycle is created (up to 12); confirm this is wanted rather than a single bill.
