---
id: 202
title: SQLite table and repository for notes
status: done
wave: 2
depends_on: [101]
priority: high
estimate: M
files:
  - apps/api/Infrastructure/Sqlite/SqliteSchema.cs
  - apps/api/Infrastructure/Sqlite/SqliteNoteRepository.cs
  - apps/api/Infrastructure/Sqlite/SqlitePersistenceRegistration.cs
  - apps/api/tests/Orbit.Api.Tests/Infrastructure/SqliteNoteRepositoryTests.cs
prd_refs: [FR-1, FR-5, FR-8]
memory_refs: []
agent_ready: true
---

# 202 – SQLite table and repository for notes

## Context (self-contained)
Orbit's API stores data in SQLite. Every user table has `user_id` in its primary key and repositories filter by `connections.UserId` (AGENTS.md "Decided"). `INoteRepository` and the `Note` domain come from task 101 (BOARD.md "Server types"). Mirror `Infrastructure/Sqlite/SqliteSinkingFundRepository.cs` (the most recent repository: `LeaseAsync`, `SqliteCommands.QueryAsync/ExecuteAsync`, `ON CONFLICT (user_id, id) DO UPDATE` upsert instead of `INSERT OR REPLACE`) and its tests `tests/.../Infrastructure/SqliteSinkingFundRepositoryTests.cs` (shared setup helpers, user switching, the test that re-runs `EnsureCreatedAsync` on an existing database).

## Interfaces you must conform to
`INoteRepository` from BOARD.md. Table:
```sql
CREATE TABLE IF NOT EXISTS notes (
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    kind TEXT NOT NULL,          -- enum name: 'Goal' | 'Note' | 'Idea'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL,        -- enum name: 'Open' | 'Done' | 'Archived'
    created_at TEXT NOT NULL,    -- DateTimeOffset round-trip text ("o" format)
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS ix_notes_updated_at ON notes (user_id, updated_at);
```

## Implementation plan
1. `SqliteSchema.cs`: add the table + index to the `CreateTables` script (next to the other tables, e.g. after the tasks tables) and add `"notes"` to `UserTables` (it has no parent but `users`). Do NOT raise `CurrentVersion`: `CREATE TABLE IF NOT EXISTS` creates the table in existing databases; verify by reading `EnsureCreatedAsync` that `CreateTables` runs on every start (if not, STOP and report).
2. `SqliteNoteRepository.cs` (`public sealed class ... (SqliteConnectionFactory connections) : INoteRepository`): `FindAsync`, `ListAsync` (`ORDER BY updated_at DESC, id`), `SaveAsync` (upsert; on conflict update kind, title, body, status, updated_at only — `created_at` is kept), `DeleteAsync`. Timestamps are written with `value.ToString("o", CultureInfo.InvariantCulture)` and read with `DateTimeOffset.Parse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind)`. All timestamps are stored in UTC (`ToUniversalTime()` on write) so text order equals time order. A private `ToNote(SqliteDataReader)` rebuilds with `Note.Restore`; an unknown `kind` or `status` text throws `InvalidOperationException` naming the value and the expected names.
3. `SqlitePersistenceRegistration.cs`: `services.AddSingleton<INoteRepository, SqliteNoteRepository>();` next to the other repositories.
4. `SqliteNoteRepositoryTests.cs`: round trip of each kind and status keeping the body with line breaks, emoji and quotes exactly; unknown id → null; upsert keeps one row and the original `created_at`; list order (updated desc, then id); delete and unknown id; another user's rows are invisible and the same id can exist for two users; a note's timestamps keep the same instant after a round trip; an existing database without the table gains it on `EnsureCreatedAsync`.
5. Run the whole suite: backup/migration tests enumerate `UserTables`; adjust only an expectation that genuinely needs the new table.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Body with `'`, `"`, newline, emoji | stored and read back identical (parameters, never string concatenation) |
| Same id saved twice | one row; `created_at` unchanged |
| Unknown `kind`/`status` text in a row | `InvalidOperationException` naming the value |

## Acceptance criteria
- [x] `dotnet build`, `dotnet test Orbit.slnx`, `dotnet format --no-restore --verify-no-changes` pass.
- [x] A database created before this change gains the table on startup (test).

## Out of scope
Use cases, endpoints, Program.cs, any web code.
