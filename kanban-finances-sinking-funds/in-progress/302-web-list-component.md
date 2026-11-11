---
id: 302
title: Web SinkingFundList component
status: in-progress
wave: 3
depends_on: [102, 103]
priority: high
estimate: M
files:
  - apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-list.ts
  - apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-list.html
  - apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-list.css
  - apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-list.spec.ts
prd_refs: [FR-4, FR-5, FR-7]
memory_refs: []
agent_ready: true
---

# 302 – Web SinkingFundList component

## Context (self-contained)
The To pay & receive page gets a Sinking funds section. This task is the presentational list: no store, no gateway, inputs and outputs only (page wiring is task 401). Types come from `core/finances/sinking-funds.ts` (task 102, BOARD.md "Web types"); texts are the keys of BOARD.md "Translation keys" (PT-BR already added by task 103). Mirror the existing sibling components `bills/bill-group/bill-group.{ts,html,css}` and its spec: standalone component, `ChangeDetectionStrategy.OnPush`, `input()`/`output()` signals, the `t` pipe from `core/i18n/translate.pipe.ts` (interpolation syntax: copy from a template that already passes `{monthName}`-style params), money formatting from `core/finances/money.ts`, date text from `core/calendar/date-label.ts`, shared button/chip CSS classes (`ui-button-ghost`, `ui-muted`, `ui-tabular`). Read `bill-group.html` first for markup and CSS conventions, including category names lookup (`namesById` in `finance-references`).

## Interfaces you must conform to
Selector `app-sinking-fund-list`; inputs `funds: readonly SinkingFund[]`, `totalMonthlyCents: number`, `categories` (same type `BillGroup`/the bill form receive); outputs `add: void`, `edit: SinkingFund`, `remove: SinkingFund`.

## Implementation plan
1. Section markup: `<section [attr.aria-label]="'Sinking funds' | t">` with an `<h2>` "Sinking funds" and a ghost button "New sinking fund" (`(click)="add.emit()"`).
2. Empty state (no funds): a `ui-muted` paragraph with "No sinking funds yet. Add one for a bill you pay from time to time, like a yearly tax." and no total.
3. Each fund as a list item: description, category name, "Falls due {date}" (`nextDueDate`), "Saved so far {savedCents} of {amountCents}", a progress bar (`<div role="progressbar" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="percent">`, percent = `min(100, round(saved/amount*100))`, with the same information as text next to it), "Set aside {amountCents} per month" with `monthlyCents`, and Edit / Delete buttons (`aria-label` for delete uses "Delete sinking fund {description}"; edit reuses the existing "Edit {description}" key if it exists, else the visible label "Edit").
4. Footer when there is at least one fund: "Total to set aside per month: {amountCents}".
5. CSS: mobile first, no horizontal scroll at 360 px; long descriptions truncate with `text-overflow: ellipsis` and carry the full text in `title`; reuse the page's CSS variables; no new colors.
6. Spec (render with the component test harness the sibling spec uses): empty state; rows show description, due text, saved text, monthly text; progress `aria-valuenow` for 0 %, 50 %, 100 %; saved above cost caps at 100; total footer; `add`, `edit` and `remove` outputs emit the right fund.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Zero funds | empty state, no footer total |
| `savedCents` equals `amountCents` | 100 % and still readable as text |
| Very long description | truncated visually, complete in `title` |
| Category id unknown | falls back like `bill-group` does |

## Acceptance criteria
- [ ] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.
- [ ] No file over 500 lines; no function over 20 lines.
- [ ] Progress is exposed as text and as `role="progressbar"`.

## Out of scope
The form (303), store/page wiring (401), translations (103).
