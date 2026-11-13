---
id: 201
title: API use cases - save, set status, delete, list
status: done
wave: 2
depends_on: [101]
priority: high
estimate: M
files:
  - apps/api/Application/Notes/SaveNote.cs
  - apps/api/Application/Notes/SetNoteStatus.cs
  - apps/api/Application/Notes/DeleteNote.cs
  - apps/api/Application/Notes/ListNotes.cs
  - apps/api/tests/Orbit.Api.Tests/Fakes/InMemoryNoteRepository.cs
  - apps/api/tests/Orbit.Api.Tests/Application/NoteUseCaseTests.cs
prd_refs: [FR-1, FR-2, FR-3, FR-4, FR-5]
memory_refs: []
agent_ready: true
---

# 201 – API use cases: save, set status, delete, list

## Context (self-contained)
The Notes domain (task 101: `Note`, `NoteKind`, `NoteStatus`, `INoteRepository`) exists exactly as in BOARD.md "Server types". This task adds the use cases. Mirror `Application/Tasks/SaveTask.cs` and `DeleteTask.cs` (command record + class with primary-constructor dependencies, XML doc with `<example>`), `ResourceNotFoundException.For("note", id)` from `Application/ResourceNotFoundException.cs`. Time comes from the injected `TimeProvider` (`clock.GetUtcNow()`), as `Application/Backups/ExportBackup.cs` does; tests use `tests/Orbit.Api.Tests/Fakes/FixedTimeProvider.cs`. Fakes are named in-memory classes (AGENTS.md): mirror `Fakes/InMemoryTaskRepository.cs`.

## Interfaces you must conform to
BOARD.md "Server types", task 201 block. Constructors: `SaveNote(INoteRepository notes, TimeProvider clock)`, `SetNoteStatus(INoteRepository notes, TimeProvider clock)`, `DeleteNote(INoteRepository notes)`, `ListNotes(INoteRepository notes)`. The commands live in the same file as their use case (`SaveNoteCommand` in `SaveNote.cs`, `SetNoteStatusCommand` in `SetNoteStatus.cs`).

## Implementation plan
1. `SaveNote.ExecuteAsync(command, ct)`: `var now = clock.GetUtcNow()`; `var stored = await notes.FindAsync(EntityId.Require(command.Id, "note id"), ct)`; the note is `stored is null ? Note.Create(id, kind, title, body ?? "", now) : stored.Edited(kind, title, body ?? "", now)`; `await notes.SaveAsync(note, ct)`; return it. (A missing body means an empty text.)
2. `SetNoteStatus.ExecuteAsync(command, ct)`: find the note or throw `ResourceNotFoundException.For("note", command.Id)`; `stored.WithStatus(command.Status, clock.GetUtcNow())`; save; return it.
3. `DeleteNote.ExecuteAsync(id, ct)`: `notes.DeleteAsync(EntityId.Require(id, "note id"), ct)`.
4. `ListNotes.ExecuteAsync(ct)`: `notes.ListAsync(ct)` (the repository already orders).
5. `InMemoryNoteRepository` (internal, list-backed) implementing `INoteRepository`; `ListAsync` orders by `UpdatedAt` descending then `Id`.
6. `NoteUseCaseTests.cs` (AAA, named fakes, `FixedTimeProvider`): save creates an open note with both timestamps equal to now; saving an existing id edits it, keeps `CreatedAt` and status and moves `UpdatedAt` (advance the fake clock if it supports it, else build two providers); a null body is stored as empty; invalid title → rule exception; set status to done on a goal works, on a note throws, to archived works for a note, back to open works; setting status of an unknown id → `ResourceNotFoundException`; delete removes and an unknown id is fine; list returns most recently updated first.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Save with an unknown kind value | rule exception from the domain (value in the message) |
| Edit a done goal to kind `Note` | rule exception, nothing saved |
| Status of an unknown id | not found (404 in the endpoint) |

## Acceptance criteria
- [x] `dotnet build Orbit.slnx` 0 warnings; `dotnet test Orbit.slnx` passes; `dotnet format Orbit.slnx --no-restore --verify-no-changes` clean.
- [x] Every scenario of the test list has a test.
- [x] Functions 4–20 lines, files < 500 lines.

## Out of scope
SQLite, endpoints, `Program.cs` DI registration (task 301).
