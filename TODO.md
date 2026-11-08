# TODO

## General
- [x] Translate the app to PT-BR and EN-US
- [x] Animation when switching between modules (a slide in the direction of the move; none for people who prefer less motion)
- [x] Run the E2E (Playwright) tests again: they have not run since the language and page changes
- [x] Names the database starts with (accounts, routine categories, routines, blocks, tasks) are translated; names the person typed stay as typed

## Transactions
- [x] Bank statement import on the Transactions page
- [x] Statement import: suggest categories from what the person chose before and from keywords (today it is only "Extra income" / "Other")

## To pay & receive
- [x] Cards
- [x] Filter

## Investments
- [x] Filter
- [x] Cards: "Return" and the CDI follow the chosen period (since purchase only while no month-end history covers it)
- [x] Demo data for every Finances tab (turn on with the DEMO button in the header or ?demo=on)
- [x] Demo data for every Routines & Goals screen too (Today, routine editor, categories, goals, history), under the same DEMO button
- [x] Charts
- [ ] Real month-end price history (today made up, see below): fetch quotes from a public source and keep one record per month

## Net worth
- [x] Charts

## Placeholders to replace
- [ ] Investments history charts use made-up month-end values (core/finances/placeholder-history.ts, applied in HttpInvestmentsGateway); swap for real price history
