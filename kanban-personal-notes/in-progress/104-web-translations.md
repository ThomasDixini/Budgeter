---
id: 104
title: Web PT-BR translations for notes
status: in-progress
wave: 1
depends_on: []
priority: medium
estimate: XS
files:
  - apps/web/src/app/core/i18n/translations/pt-br-routines.ts
prd_refs: [FR-7]
memory_refs: []
agent_ready: true
---

# 104 – Web PT-BR translations for notes

## Context (self-contained)
The Angular app's texts are English (the key is the English text) with Brazilian Portuguese translations in `apps/web/src/app/core/i18n/translations/`. The Routines & Goals module's live in `pt-br-routines.ts` (a `Record<string, string>` grouped by comment headers such as `// History`). Strings with values use `{name}` placeholders, e.g. `'Received in {monthName}': 'Recebido em {monthName}'`. The new Notes UI (tasks 302/303/401) uses the keys of the table below; this task only adds them. Other translation files (`pt-br.ts`, `pt-br-finances.ts`, `pt-br-sentences.ts`) are merged into one dictionary, so a key may already exist elsewhere.

## Implementation plan
1. Open `pt-br-routines.ts` and add a `// Notes` block right after the `// History` block.
2. Add exactly the English → PT-BR pairs of BOARD.md "Translation keys" (39 entries), keeping placeholders character-for-character. Quote keys containing apostrophes or punctuation the way the file already does.
3. Before adding each key, search ALL files under `core/i18n/translations/` (grep for `'<key>'` / `<key>:`): if it already exists with the same PT-BR value, skip it; if it exists with a different value, STOP and report that key (do not add or change it).
4. Run the full web test suite. If `translator.spec.ts` (or any spec) fails because a new `{placeholder}` key now shadows an existing sentence, rename only that new key by changing its wording slightly (e.g. `Last edited {date}` → `Edited on {date}`), report the rename so the board and the UI tasks can follow, and re-run.

## Acceptance criteria
- [ ] Every key of the table exists exactly once across the translations folder (or was skipped as an identical existing one), checked with grep.
- [ ] `npm run lint`, `npx prettier --check .`, `npx ng test --no-watch` pass in `apps/web`.

## Out of scope
Any component or template; English texts need no file.
