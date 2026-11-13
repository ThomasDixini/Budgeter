---
id: 501
title: E2E test for notes and TODO ticks
status: backlog
wave: 5
depends_on: [301, 401]
priority: medium
estimate: S
files:
  - apps/web/e2e/notes.e2e.ts
  - apps/web/e2e/pages/notes.page.ts
  - TODO.md
prd_refs: [FR-2, FR-3, FR-4, FR-6, FR-7]
memory_refs: []
agent_ready: true
---

# 501 – E2E test for notes and TODO ticks

## Context (self-contained)
The full Notes feature (API, store, item, form, page at `/routines/notes`) is in place. AGENTS.md requires E2E coverage of critical flows. Playwright specs live in `apps/web/e2e/`, page objects in `e2e/pages/`, API helpers in `e2e/support/`. Read `e2e/sinking-funds.e2e.ts` + `e2e/pages/sinking-funds.page.ts` (freshest example), `e2e/routines.e2e.ts` and `e2e/pages/routines.page.ts` (routines navigation, the section tabs locator `sectionTabs`), and `e2e/support/test.ts`/`account.ts` (the signed-in account fixture; the whole run shares one account and database, tests run in parallel workers).

Lessons from earlier boards: locate tab links inside `getByRole('navigation', { name: 'Module sections' })`; the notes table is shared by all tests, so every test must use unique names (`uniqueName(test.info(), '…')` from `e2e/support/finances-api.ts` or the equivalent helper) and must not assert on global emptiness or totals; Routines specs freeze the clock in distinct "slots" — notes do not need a frozen clock, so do not freeze it unless a helper requires it.

## Implementation plan
1. `pages/notes.page.ts`: page object (`goto()` opens `/routines/notes`; locators for the quick idea input ("Jot down an idea") and "Add idea" button, the kind and status chip groups, the search input ("Search notes"), a note card by title, the "New note" button and the form fields by label, Save).
2. `notes.e2e.ts`:
   - the Notes tab opens the page from Routines & Goals (via the tabs navigation) and shows the heading;
   - quick idea: typing a unique title and pressing Enter shows the idea in the list and clears the field; it is still there after a reload;
   - creating a goal with a title and a two-line text through the form shows it with the Goal label; editing its title updates the card;
   - marking an idea done moves it out of the Open list and into the Done list (status chip), and Reopen brings it back; archiving a note moves it to Archived and Restore returns it;
   - search finds a note by a word in its text, accent-insensitively, and hides the others (search for the unique name);
   - deleting a note removes the card, also after a reload;
   - the page has no horizontal overflow on a phone screen with a note listed (copy the check from `sinking-funds.e2e.ts`).
   Create notes through the API (`PUT /api/notes/{id}`) where the UI is not the subject; use the API helpers/request fixture the other specs use.
3. `TODO.md`: mark the two "Goals & personal notes" items `[x]` (use a minimal line edit; prettier reformats the whole file, so do not run prettier on it).
4. Run the whole E2E suite once (`npx playwright test` in `apps/web`, long timeout) to confirm nothing else broke.

## Acceptance criteria
- [ ] `npm run e2e:typecheck`, `npx prettier --check .` (the e2e files) and `npm run lint` pass; the new spec passes on the desktop and mobile projects; the full suite stays green.
- [ ] The spec uses unique names and no global assertions.

## Out of scope
Application code changes (report a bug instead).
