---
id: 202
title: SQLite table and repository for sinking funds
status: done
wave: 2
depends_on: [101]
priority: high
estimate: M
files:
  - apps/api/Infrastructure/Sqlite/SqliteSchema.cs
  - apps/api/Infrastructure/Sqlite/SqliteSinkingFundRepository.cs
  - apps/api/Infrastructure/Sqlite/SqlitePersistenceRegistration.cs
  - apps/api/tests/Orbit.Api.Tests/Infrastructure/SqliteSinkingFundRepositoryTests.cs
prd_refs: [FR-9]
memory_refs: []
agent_ready: true
---

# 202 – SQLite table and repository for sinking funds

## Context (self-contained)
Orbit's API stores data in SQLite. Every user table has `user_id` in its primary and foreign keys and repositories filter by `connections.UserId` (AGENTS.md "Decided"). The `ISinkingFundRepository` port and the `SinkingFund` / `SinkingFundSchedule` domain types come from task 101 (see BOARD.md "Server types"). Mirror `Infrastructure/Sqlite/SqliteBillRepository.cs` (`LeaseAsync`, `SqliteCommands.QueryAsync/ExecuteAsync`, dates as `yyyy-MM-dd` text, upsert with `ON CONFLICT (user_id, id) DO UPDATE` instead of `INSERT OR REPLACE`) and its tests `tests/.../Infrastructure/SqliteBillRepositoryTests.cs` (shared setup helpers; copy how they create a database and a category).

## Interfaces you must conform to
`ISinkingFundRepository` from BOARD.md. Table:
```sql
CREATE TABLE IF NOT EXISTS sinking_funds (
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    description TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    schedule_kind TEXT NOT NULL,      -- 'EveryMonths' | 'FixedDate' (enum name)
    interval_months INTEGER NOT NULL,
    fixed_month INTEGER NULL,
    due_day INTEGER NOT NULL,
    next_due_date TEXT NOT NULL,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id, category_id) REFERENCES finance_categories (user_id, id)
);
CREATE INDEX IF NOT EXISTS ix_sinking_funds_next_due_date ON sinking_funds (user_id, next_due_date);
```

## Implementation plan
1. `SqliteSchema.cs`: add the table + index to the `CreateTables` script right after the `bills` index lines (~line 207), and add `"sinking_funds"` to `UserTables` right after `"bills"` (parents before children; its parent `finance_categories` is earlier). Do NOT raise `CurrentVersion`: `CREATE TABLE IF NOT EXISTS` creates the table in existing version-4 databases. Verify by reading `EnsureCreatedAsync` that `CreateTables` runs on every start; if it does not, STOP and report.
2. `SqliteSinkingFundRepository.cs` (`public sealed class ... (SqliteConnectionFactory connections) : ISinkingFundRepository`): `FindAsync`, `ListAsync` (`ORDER BY next_due_date, description, rowid`), `ListDueOnOrBeforeAsync` (`next_due_date <= $day`, same order), `SaveAsync` (upsert), `DeleteAsync`, `AnyInCategoryAsync`. A private `ToFund(SqliteDataReader)` rebuilds with `SinkingFund.Restore`, creating the schedule with `SinkingFundSchedule.EveryMonths(interval, dueDay)` or `FixedDate(fixed_month, dueDay)` by `schedule_kind`.
3. `SqlitePersistenceRegistration.cs`: `services.AddSingleton<ISinkingFundRepository, SqliteSinkingFundRepository>();` next to the bill repository line (~42).
4. `SqliteSinkingFundRepositoryTests.cs`: round trip of both schedule kinds, upsert keeps one row, list order, `ListDueOnOrBeforeAsync` boundary (on the day included, day after excluded), delete (and unknown id), another user's rows are invisible (see how other repository tests switch user), category foreign key rejects an unknown category, `AnyInCategoryAsync`.
5. Run the whole suite: backup/migration tests enumerate `UserTables`; fix any expectation that lists table names only if it genuinely needs the new table.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Same id saved twice | one row, second values win, `rowid` unchanged |
| Unknown schedule kind text in a row | `InvalidOperationException` naming the value and the expected kinds |

## Acceptance criteria
- [x] `dotnet build`, `dotnet test Orbit.slnx` and `dotnet format --verify-no-changes` pass.
- [x] A database created before this change gains the table on startup (covered by a test that opens an existing database file).

## Out of scope
Use cases, endpoints, Program.cs, any web code. Do not touch `DeleteFinanceCategory` (blocking category deletion for funds is not in the PRD).
