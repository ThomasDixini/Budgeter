# AGENTS.md

Mandatory entry file for every AI accessing this project. Read this file before any task.

## Project vision

Personal web application with two main modules:

1. **Routine and personal goals organizer** — tasks, routines, and goals.
2. **Financial organizer** — expenses, budget, and spending tracking.

**Current phase:** Simple MVP to solve personal problems. Do not build beyond MVP scope.

**Access points:**
- **Web (dashboard):** full view of everything (routine, goals, and finances).
- **Phone:** quick entry of daily tasks and expenses. Must work **offline**, queueing operations until the internet is back (offline queue / later sync).

**Infrastructure:** **Serverless** backend architecture (scales to zero → infrastructure cost near zero when not in use).

## Language (project-wide standard)

- **English is the project standard:** all code, identifiers, file names, commit messages, PRDs, task files, and documentation must be written in English.
- UI copy and comments follow English unless a task explicitly states otherwise.

## Architecture (mandatory)

- **Clean Architecture** everywhere in production code:
  - Business rules isolated from frameworks, UI, databases, and transports.
  - Dependencies always point inward (domain never knows about infrastructure).
  - Classic layering: entities/business rules → use cases → interfaces (adapters) → infrastructure.
- **Serverless** on the backend (ephemeral functions/endpoints; no long-running server).
- **Offline-first on mobile:** local mutations first, persistent queue, idempotent sync when online. Consider conflict resolution from the start.

## Quality and tests (mandatory gates)

No task can be considered done without passing the gates:

- **Unit tests** for business rules and pure logic (use cases, entities, utilities).
- **Integration tests** for adapters (API, database, offline queue/sync).
- **E2E tests** for critical user flows (submit task/expense, view dashboard).
- **QA gates:** lint, typecheck, and the test suite must pass before marking a task as done. If any gate fails, fix it before finishing.
- Test coverage is not optional for new code: every new use case is born with tests.

## Code style (mandatory)

### Functions and files
- Functions: 4–20 lines. Split if longer.
- Files: under 500 lines. Split by responsibility.
- One thing per function, one responsibility per module (SRP).
- Keep a single level of abstraction per function.
- Prefer small, cohesive classes.
- Eliminate duplication by extracting shared logic.
- Prefer early returns over nested conditionals. Max 2 levels of indentation.

### Naming
- Use meaningful, specific, searchable, and consistent names.
- Avoid abbreviations, misleading names, and generic names (`data`, `handler`, `manager`, `util`, `helper`).
- Classes use nouns. Functions use verbs.

### Types
- Types must be explicit. No `any`, `Dict`, or untyped functions.
- Exception messages must include the offending value and expected shape.

### Design
- Expose behavior, not data. Keep data encapsulated.
- Minimize coupling and maximize cohesion.
- Separate business logic from error handling.
- Avoid returning or accepting `null` when possible.
- Use SOLID principles for classes.

### Comments
- Keep existing comments unless they become incorrect.
- Write WHY, not WHAT.
- Prefer self-documenting code over comments.
- Add docstrings to public functions describing intent and one usage example.
- Reference issue numbers or commit SHAs when code exists because of a specific bug or upstream constraint.

### Tests
- Tests run with a single command: see Commands.
- Every new function gets a test.
- Every bug fix gets a regression test.
- Keep tests focused on a single behavior.
- Use Arrange–Act–Assert (AAA).
- Follow F.I.R.S.T. principles:
  - **F**ast
  - **I**ndependent
  - **R**epeatable
  - **S**elf-validating
  - **T**imely
- Mock external I/O (API, DB, filesystem) using named fake classes instead of inline stubs.

### Formatting
- Use the language's default formatter (prettier, black, gofmt, cargo fmt, etc.).
- Keep formatting consistent.
- Group related code together.
- Organize code to read like a narrative.

### Logging
- Use structured JSON for logs.
- Use plain text only for user-facing CLI output.

## Work conventions

- Follow the stack already established in the project; never introduce a new library without clear need and without checking if the repo already has a solution.
- Prefer small, self-contained changes; large changes must be split into smaller tasks.
- Never commit secrets, keys, or tokens. Sensitive variables only via environment.
- Do not create unsolicited documentation (*.md), except process files like this one.
- Respond to the user in Portuguese, unless asked otherwise.

## Pending decisions (define before coding the MVP)

- Frontend/backend stack and serverless provider.
- Database and offline sync strategy.
- Authentication (even if minimal).
