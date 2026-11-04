# PRD: Finances · Transactions

## 1. Overview

The Finances module exists only as a "not built yet" slot on the home wheel. This PRD covers its first slice: the **Transactions** page, where the user records money coming in and going out and reviews the month's history. It also covers the module scaffold the later finance pages will reuse (route, shell, section tabs, wheel entry).

Transactions come first because every later finance page is derived from them. Account balances and card invoices, the budget's "planned vs actual", the overview and net worth are all computed from this data. Recording an expense is also one of the MVP's critical flows (AGENTS.md).

Design source: the "Design" canvas artifact (https://claude.ai/artifact/JDhpT4qeEvuETuuDUZDHr8), artboard **Finanças · Transações** (`project/Fin-Transacoes.dc.html`).

## 2. Goals

- Open the Finances module from the home wheel and the module dock, like Routines & Goals.
- Record a transaction (income or expense) with a date, description, category, account and amount.
- Edit and delete a transaction to fix mistakes.
- See a month's transactions grouped by day, newest first, with each day's total.
- See the month's income, expenses, net result and transaction count.
- Narrow the list by type (all / income / expenses), by account, and by searching description or category.
- Move between months.

## 3. Non-Goals

- Statement import (the design's "Importar extrato" button is not rendered).
- Credit-card invoice logic (closing date, due date, limit, paying the invoice).
- Account balances, and creating, renaming or deleting accounts or categories in the UI. That comes with the Bancos & Cartões slice; this slice seeds a starter set.
- The other finance pages: Overview, Income split, Bills, Investments and Net worth.
- Transfers between accounts, recurring or installment transactions, multiple currencies.
- Offline queue and sync. Ids are client-generated (see §9), so a queue can be added later without API changes, as for Routines.
- Sample transactions. Seeded fake money would distort the user's real totals.

## 4. Target Users & Use Cases

The single owner of this personal app.

- **On the phone, right after spending:** open Finances, tap "New transaction", type the amount and description, save.
- **On the desktop, end of the week or month:** review the month, filter by a card to see what went on it, search for "pharmacy", fix a wrong category.

## 5. User Stories

- As the user, I want to record an expense in a few taps so that I keep logging consistently.
- As the user, I want to record income (salary, freelance) so that the month's net result is right.
- As the user, I want my transactions grouped by day with daily totals so that I can see when the money went.
- As the user, I want to filter by account and type and to search so that I can answer "what did I spend on card X".
- As the user, I want to edit or delete a transaction so that a typo does not corrupt my totals.
- As the user, I want to go back to previous months so that I can compare.

## 6. Functional Requirements

### Module scaffold (web)

1. **FR-1:** The Finances entry in `APP_MODULES` must get `route: '/finances'`, so the home spotlight, picker and module dock link to it.
2. **FR-2:** `/finances` must lazy-load the Finances routes inside a `FinancesShell`: header with section tabs, the fire glow, the routed page, and the module dock with the Finances module as current. It mirrors `RoutinesShell`.
3. **FR-3:** Section tabs must list only built sections: for now, "Transactions" at `/finances/transactions`. `/finances` must redirect to `/finances/transactions` until the Overview exists, so Transactions keeps its URL when the Overview arrives. Page title: `Transactions · Finances`.

### Reference data (API)

4. **FR-4:** `GET /finance-categories` must return all finance categories `{ id, name }`, ordered by name. Finance categories are a separate entity from routine `Category`.
5. **FR-5:** `GET /accounts` must return all accounts `{ id, name, kind }` in creation order. `kind` is `"bankAccount"` or `"creditCard"`.
6. **FR-6:** A starter set must be seeded **once per database**, using its own marker rather than the existing `sample_seed` (that one is already set on the user's current database):
   - Categories: Housing, Food, Transport, Health, Leisure, Subscriptions, Education, Salary, Extra income, Investments, Other.
   - Accounts: "Checking account" (bankAccount) and "Credit card" (creditCard).
   - Edge case: a seeded item the user later deletes (in a future slice) must never come back.

### Transactions (API)

7. **FR-7:** `GET /transactions?month=YYYY-MM` must return that month's transactions, ordered by date descending, then most recently created first.
   - A missing or malformed `month` (e.g. `2026-13`, `2026-1`) → 400, with a message quoting the value and the expected `YYYY-MM` shape.
   - A month with no transactions → `[]`.
8. **FR-8:** `PUT /transactions/{id}` must create or replace a transaction. Saving the same body twice must leave the same state.
   - Body: `{ date, description, categoryId, accountId, amountCents }`.
   - Responds 200 with the stored transaction.
   - Validation (400 on failure, message quotes the offending value):
     - `id` follows `EntityId` rules.
     - `date` is `YYYY-MM-DD`.
     - `description` is trimmed and 1–80 characters.
     - `amountCents` is an integer with 1 ≤ |amountCents| ≤ 1,000,000,000. Positive is income, negative is expense, and zero is rejected.
   - An unknown `categoryId` or `accountId` → 404.
   - Editing a transaction must keep its place among its day's transactions.
9. **FR-9:** `DELETE /transactions/{id}` must remove the transaction and answer 204. An unknown id also answers 204.

### Transactions page (web)

10. **FR-10 — header:** shows the "Finances · {Month Year}" eyebrow, the "Transactions" title, previous/next month buttons, and a "New transaction" primary button.
    - The month starts at the clock's current month.
    - Changing month loads that month. A slow answer for a month no longer shown must be discarded.
11. **FR-11 — summary cards:** four cards: Income (sum of positive amounts), Expenses (sum of negative amounts, shown unsigned), Net (signed `+`/`−`) and Transactions (count).
    - They reflect the **filtered** list, as in the design.
    - Zero transactions → R$ 0.00 in each money card and a count of 0.
12. **FR-12 — filters:**
    - A search field matches the description or category name, case- and accent-insensitive ("farmacia" finds "Farmácia").
    - A type group offers All / Income / Expenses.
    - An account group offers "All accounts" plus one chip per account.
    - Filters combine (AND) and stay applied when the month changes.
    - Filter buttons expose `aria-pressed`.
13. **FR-13 — history list:** transactions grouped by day, newest day first.
    - Each day header shows the day label (e.g. "Saturday, October 31") and the signed day total of the filtered items.
    - Each row shows an in/out arrow, the description, the account name, a category chip and the signed amount ("+R$ 64.20" / "−R$ 286.40").
14. **FR-14 — create/edit form:** an inline form card, like the Today task form, opened by "New transaction" or by activating a row (edit).
    - Fields:
      - Type toggle (Expense by default).
      - Amount: positive; accepts `,` or `.` as decimal separator, up to 2 decimals, no thousands separators.
      - Description.
      - Category select.
      - Account select (defaults to the last account used in this session, else the first).
      - Date (defaults to today when the shown month is the current one, else the 1st of the shown month).
    - Save is disabled until the amount is > 0 and the description is not blank. Invalid amount text shows an inline error.
    - Saving closes the form, and the transaction shows immediately in its day.
    - A transaction dated outside the shown month is saved but not listed; a notice says which month it went to.
    - Edit mode adds a "Delete" button.
    - Escape and "Cancel" close the form without changes.
15. **FR-15 — optimistic writes:** add, edit and delete must apply locally first and roll back if the API rejects them.
    - A rollback must not undo other changes made in the meantime (same rules as `TasksStore`).
    - The failure surfaces through the app's notices.

## 7. Non-Functional Requirements

- **Money:** amounts are integer cents end to end, never floats. They are formatted with `Intl.NumberFormat` (currency BRL) and the app's `LOCALE_ID`.
- **Accessibility:**
  - Real `<button>`, `<label>` and `<input>` elements.
  - An `aria-label` on icon-only buttons (month arrows).
  - Arrows are `aria-hidden`, and the sign is in the text.
  - Text contrast ≥ 4.5:1.
  - Focus moves to the amount field when the form opens.
- **Responsive:** must work at 375 px width with no horizontal scroll. Filters and rows wrap, and summary cards reflow to two columns.
- **UI copy:** in English, per the project standard. The design's Portuguese labels map to English equivalents.
- **Quality gates:** lint, typecheck, unit, integration and E2E suites pass (AGENTS.md).

## 8. UX / Design Notes

Follow the artboard's layout: header → summary cards → search and type filter → account chips → history card. Use the existing violet Finances accent (`--color-violet`) where the design uses purple.

States:

- **Loading:** cards show placeholders and the list is empty with no "empty" message, so there is no flash of "no transactions".
- **Load failed:** `app-load-failed` with Retry, as in Routines.
- **Empty month (no filters):** "No transactions in {Month} yet.", with the "New transaction" button still in the header.
- **Filters match nothing:** "No transactions match these filters." (design copy).
- **Boundaries:**
  - A long description wraps and never pushes the amount off the row.
  - A day with one transaction still gets a header.
  - Very large amounts keep tabular alignment.
  - Special characters in descriptions are displayed as typed.

## 9. Technical Considerations

### Affected surface (API, `apps/api`)

- **Domain:** `Domain/Finances/MoneyTransaction.cs` (named so it never reads as a database transaction), `Account.cs`, `AccountKind.cs`, `FinanceCategory.cs`, `TransactionMonth.cs` (parses and validates `YYYY-MM`).
  - Each entity has `Create`, which applies the rules, and `Restore`, which applies none. Same pattern as `TaskItem`, reusing `EntityId` and `RequiredText`.
- **Application:** `Application/Finances/`:
  - Use cases: `ListTransactions`, `SaveTransaction` (checks the category and account exist), `DeleteTransaction`, `ListAccounts`, `ListFinanceCategories`.
  - Ports: `IMoneyTransactionRepository`, `IAccountRepository`, `IFinanceCategoryRepository`.
- **Endpoints:** `Endpoints/TransactionEndpoints.cs` and `Endpoints/FinanceReferenceEndpoints.cs` (accounts and categories). Register them in `Program.cs`.
- **Infrastructure:**
  - `Infrastructure/Sqlite/SqliteMoneyTransactionRepository.cs`, `SqliteAccountRepository.cs`, `SqliteFinanceCategoryRepository.cs`, `FinanceStarterSeed.cs`.
  - Tables go in `SqliteSchema.cs`, and the wiring in `SqlitePersistenceRegistration.cs`.
- **Tests:** domain, use case (with `InMemory*` fakes in `Fakes/`), SQLite integration and endpoint tests.

### Affected surface (web, `apps/web`)

- **`src/app/core/finances/`:**
  - Models: `transaction.ts` (`Transaction`, `TransactionDraft`), `account.ts`, `finance-category.ts`.
  - Pure logic, each with a spec: `transaction-month.ts` (month math, labels), `transaction-filters.ts` (type, account, accent-insensitive search), `transaction-summary.ts`, `transaction-days.ts` (grouping and day totals), `money.ts` (format and parse cents).
  - Gateways: `transactions-gateway.ts` and `finance-reference-gateway.ts` (abstract), plus `http-*` adapters and `fake-*` classes.
  - `transactions-store.ts`.
  - `finances-section.ts`.
- **`src/app/pages/finances/`:**
  - `finances.routes.ts`, `finances-shell/`.
  - `transactions/` with child components `transaction-summary/`, `transaction-filters/`, `transaction-history/`, `transaction-form/`.
- **Shared frame:** extract `components/section-tabs/` (from `RoutinesTabs`, taking `sections` as an input) and `components/module-frame/` (header, tabs, dock and the module accent, from `RoutinesShell`), and use them in both modules instead of copying them.
- **Wiring:** `app.routes.ts` (add `finances`), `app.config.ts` (bind the gateways), `core/modules/module-catalog.ts` (FR-1).
- **E2E:** `e2e/finances.e2e.ts` and `e2e/pages/finances.page.ts`.

### Contracts

```
FinanceCategory { id: string; name: string }                       // name 1–40
Account         { id: string; name: string; kind: 'bankAccount' | 'creditCard' }  // name 1–40
Transaction     { id: string; date: 'YYYY-MM-DD'; description: string;  // 1–80
                  categoryId: string; accountId: string; amountCents: number }    // integer, ≠ 0
```

```sql
CREATE TABLE IF NOT EXISTS finance_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES finance_categories (id),
    account_id TEXT NOT NULL REFERENCES accounts (id),
    amount_cents INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_transactions_date ON transactions (date);
CREATE TABLE IF NOT EXISTS finance_seed (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Constraints, dependencies & gotchas

- **Ordering (FR-7, FR-8):** "Newest first within a day" orders by `rowid DESC`. Saves must use `INSERT … ON CONFLICT (id) DO UPDATE`, as `SqliteTaskRepository` does. `INSERT OR REPLACE` deletes and re-inserts, which changes the rowid and would move an edited row.
- **Starter seed:** it needs its own `finance_seed` marker. `SampleData` marks `sample_seed` on databases that already exist, so reusing it would never seed the user's current database.
- **JSON enums:** they travel camelCase and integers are refused (`Program.cs`), so `kind` is `"bankAccount"`, not `0`.
- **Ids:** clients generate UUIDs through `IdGenerator`, which keeps writes idempotent for a future offline queue.
- **Tests that assume Finances is not built:** `module-spotlight.spec.ts` ("offers no link to Finances, which is not built yet") and `e2e/home.e2e.ts` must be updated in the same change as FR-1.
- **E2E isolation:** desktop and mobile projects run in parallel on one fresh database. Each finance test must pin the page clock to a month no other test or project uses (same idea as `ownDay`), so totals are deterministic.
- **Month race:** guard the month load the same way `TasksStore.loadDoneMarks` ignores a late answer for a day no longer shown.
- **Store writes:** don't apply the server's answer over the local list after a save, to avoid the slow-answer overwrite that `TasksStore` documents.

## 10. Success Metrics

- E2E flows pass on desktop and mobile:
  - Add an expense and see it in its day and in the summary.
  - Filter by type and account.
  - Edit, then delete.
- All QA gates green on the PR.
- Proposed target, to check by hand: recording an expense on a phone takes under 15 seconds from opening the module.

## 11. Milestones / Rollout

1. **API:** domain, use cases, SQLite tables, starter seed and endpoints, with tests.
2. **Web core:** models, pure logic, gateways and `TransactionsStore`, with specs.
3. **Web UI:** shared section tabs, Finances shell and routes, catalog route (FR-1, plus the home test updates), the Transactions page and form.
4. **E2E:** the finances flows.

No feature flag is needed. The module becomes reachable in step 3, once the page works.

## 12. Open Questions / Assumptions

- **Assumption: UI copy is English.** AGENTS.md says so and the Routines UI is English, although the design is Portuguese. Confirm if Finances should be Portuguese.
- **Assumption: currency formatting** follows the app's current `LOCALE_ID` (en-US today) with BRL, so "R$1,234.56" rather than the design's "R$ 1.234,56". Switching the app to `pt-BR` would be a separate, app-wide decision.
- **Assumption: edit, delete and month navigation are in scope,** although the artboard shows neither. Without them a typo would be permanent and past months unreachable.
- **Assumption: the starter accounts and categories are fixed** until the Bancos & Cartões slice adds management. Open question: is that acceptable, or should the form allow creating a category or account inline (the pattern `CategoryCreations` offers in Routines)?
- **Open question: categories are shared by income and expenses,** since the design uses "Investments" for both a dividend and a contribution. Should a category be restricted to one type?
- **Open question: the offline queue** for quick phone entry is deferred here, as in Routines. When should it be scheduled?
