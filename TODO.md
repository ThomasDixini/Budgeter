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
- [ ] Sinking funds for recurring bills that are paid from time to time (example: IPVA once a year, dog grooming of $100 every 2 months): set aside money during the period and see how much has been saved so far toward each one

## Investments
- [x] Filter
- [x] Cards: "Return" and the CDI follow the chosen period (since purchase only while no month-end history covers it)
- [x] Demo data for every Finances tab (turn on with the DEMO button in the header or ?demo=on)
- [x] Demo data for every Routines & Goals screen too (Today, routine editor, categories, goals, history), under the same DEMO button
- [x] Charts
- [x] Real month-end price history: the API fetches monthly closes from brapi.dev (token in Quotes__Token) for B3 tickers (stocks and real estate funds named by their ticker) and keeps one record per month
- [x] Current prices: the API takes the latest price of B3 tickers from brapi.dev (at most once a day per ticker) and stores it as the investment price

- [ ] Store fundamental analyses of each investment
- [ ] Store period rates (Selic, IPCA, income tax, etc.) so returns can be compared against them (example: in October the Selic was 13%, which is why it yielded X)
- [ ] Notes for important events and facts (market analyses, macroeconomics, market potential, etc.)
- [ ] Flag an investment as high, moderate or low risk according to my own principles

## Net worth
- [x] Charts

## Goals & personal notes
- [ ] Write down goals and important notes for myself (examples: leaving the comfort zone, Cambly, sales, etc.)
- [ ] A place to keep ideas and tasks that have no defined scope or date yet, just so they are recorded

