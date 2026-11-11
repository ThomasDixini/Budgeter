---
id: 103
title: Web PT-BR translations for sinking funds
status: done
wave: 1
depends_on: []
priority: medium
estimate: XS
files:
  - apps/web/src/app/core/i18n/translations/pt-br-finances.ts
prd_refs: [FR-1]
memory_refs: []
agent_ready: true
---

# 103 – Web PT-BR translations for sinking funds

## Context (self-contained)
The Angular app is in English (the key is the English text) with Brazilian Portuguese translations in `apps/web/src/app/core/i18n/translations/`. The Finances module's are in `pt-br-finances.ts`, a `Record<string, string>` grouped by comment headers (`// Overview`, `// Bills` ...). Strings with values use `{name}` placeholders, e.g. `'Received in {monthName}': 'Recebido em {monthName}'`. The new sinking-funds UI (tasks 302/303) uses the keys below; this task only adds them.

## Implementation plan
1. Open `pt-br-finances.ts`, find the bills section (search for `Add bill` or `To pay & receive`) and add a new `// Sinking funds` block right after it.
2. Add exactly the English → PT-BR pairs of the table in BOARD.md "Translation keys" (19 entries), keeping placeholders character-for-character. Quote keys containing apostrophes/punctuation with the file's existing quoting style.
3. Do not translate anything already present; if a key already exists with a different meaning, STOP and report.

## Acceptance criteria
- [x] All 19 keys exist once each, verified with `grep` for each.
- [x] `npm run lint`, `npx prettier --check .` and `npx ng test --no-watch` pass in `apps/web` (a spec checks translation coverage/placeholders).

## Out of scope
Any component or template; the English texts need no file.
