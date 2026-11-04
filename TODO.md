# TODO

## General
- [x] Translate the app to PT-BR and EN-US
- [ ] Add animations when switching between modules
- [ ] Run the E2E (Playwright) tests again: they have not run since the language and page changes
- [ ] Names that come from the database (routines, blocks, goals, accounts, parts made from a template) are not translated

## Transactions
- [x] Bank statement import on the Transactions page
- [ ] Statement import: suggest categories from what the person chose before and from keywords (today it is only "Extra income" / "Other")

## To pay & receive
- [x] Cards
- [x] Filter

## Investments
- [x] Filter
- [ ] Cards (validate): "Return" is since purchase, not for the period as in the design
- [x] Charts
- [ ] Real month-end price history (today made up, see below): fetch quotes from a public source and keep one record per month

## Net worth
- [x] Charts
- [ ] Keep the net worth of each month so growth, average, best month, the chart and the table can fill in

## Placeholders to replace
- [ ] Investments history charts use made-up month-end values (core/finances/placeholder-history.ts, applied in HttpInvestmentsGateway); swap for real price history
