---
id: 101
title: API domain - Note, kind, status, repository port
status: done
wave: 1
depends_on: []
priority: high
estimate: M
files:
  - apps/api/Domain/Notes/NoteKind.cs
  - apps/api/Domain/Notes/NoteStatus.cs
  - apps/api/Domain/Notes/Note.cs
  - apps/api/Application/Notes/INoteRepository.cs
  - apps/api/tests/Orbit.Api.Tests/Domain/NoteTests.cs
prd_refs: [FR-1, FR-2, FR-3]
memory_refs: []
agent_ready: true
---

# 101 – API domain: Note, kind, status, repository port

## Context (self-contained)
Orbit (`C:\Projetos\Orbit`) is a personal routine/finance app: .NET API in `apps/api` (Clean Architecture: Domain → Application → Infrastructure/Endpoints), Angular web in `apps/web`. A new **Notes** tab in Routines & Goals keeps short written items: goals, notes and ideas (free text, a status, no dates or progress). This task builds only the pure domain model and the repository port. No persistence, use cases or endpoints (other tasks).

Read first and mirror the style: `apps/api/Domain/Tasks/TaskItem.cs` (private constructor, `Create` validates, `internal static Restore`, XML docs with a one-line `<example>`), `Domain/RequiredText.cs`, `Domain/EntityId.cs`, `Domain/DomainRuleException.cs`, `tests/Orbit.Api.Tests/Domain/TaskItemTests.cs`. Exception messages must include the offending value and the expected shape. AGENTS.md style: functions 4–20 lines, files < 500 lines, explicit types, early returns.

## Interfaces you must conform to
Exactly BOARD.md "Server types" (task 101 block): `NoteKind { Goal, Note, Idea }`, `NoteStatus { Open, Done, Archived }`, `Note`, `INoteRepository`. Namespaces: `Orbit.Api.Domain.Notes` and `Orbit.Api.Application.Notes`.

## Implementation plan
1. `NoteKind.cs`, `NoteStatus.cs`: the two enums with a doc comment per member.
2. `Note.cs` (sealed class, constants `MaxTitleLength = 80`, `MaxBodyLength = 4000`):
   - `Create(id, kind, title, body, now)`: `EntityId.Require(id, "note id")`, `RequiredText.Require(title, 80, "note title")` (trims, rejects blank), body via a private `RequireBody(string? body)`: null → `""`, longer than 4000 → `DomainRuleException` naming the length and the limit, a body is NOT trimmed (leading line breaks and spaces are the user's), kind must be a defined enum value (`Enum.IsDefined`, else `DomainRuleException` with the value). Status `Open`, `CreatedAt = UpdatedAt = now`.
   - `Restore(...)`: `internal static`, no validation.
   - `Edited(kind, title, body, now)`: validates like `Create`; keeps `Id`, `Status`, `CreatedAt`; sets `UpdatedAt = now`. Throws `DomainRuleException` when `Status == Done` and the new kind is `Note` (message: `Expected a done item to stay a goal or an idea, received kind "Note"`).
   - `WithStatus(status, now)`: status must be a defined enum value; `Done` is allowed only when `Kind` is `Goal` or `Idea`, else `DomainRuleException` (`Expected a goal or an idea to be marked done, received kind "Note"`); returns a copy with the status and `UpdatedAt = now`. Setting the same status again still refreshes `UpdatedAt`.
3. `INoteRepository.cs`: the interface from BOARD.md, each member with an XML doc line (`ListAsync`: most recently updated first, then by id).
4. Tests (AAA, one behavior each) in `NoteTests.cs`: create trims the title and keeps the body untouched; blank title, 81-char title, 4001-char body, bad id, undefined kind → rule exceptions whose message contains the value; a null body becomes `""`; `Edited` keeps status and created time and moves `UpdatedAt`; `Edited` of a done goal to `Note` throws, to `Idea` works; `WithStatus` Done on goal and idea works, on note throws; Archived works for every kind; reopen to Open works from Done and Archived; `UpdatedAt` changes with `WithStatus`.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Title with surrounding spaces | trimmed |
| Body of exactly 4000 chars | accepted |
| Body with leading newline/spaces | stored as typed |
| Same status set twice | accepted, `UpdatedAt` refreshed |

## Acceptance criteria
- [x] `dotnet build Orbit.slnx` has 0 warnings; `dotnet test Orbit.slnx` passes with the new tests; `dotnet format Orbit.slnx --no-restore --verify-no-changes` is clean.
- [x] Public signatures match BOARD.md exactly.
- [x] Every function is 4–20 lines and no file passes 500 lines.

## Out of scope
SQLite, use cases, endpoints, DI registration, the in-memory repository fake (task 201), any web code.
