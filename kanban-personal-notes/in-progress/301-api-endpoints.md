---
id: 301
title: API endpoints, DI registration, endpoint tests
status: in-progress
wave: 3
depends_on: [201, 202]
priority: high
estimate: M
files:
  - apps/api/Endpoints/NoteEndpoints.cs
  - apps/api/Program.cs
  - apps/api/tests/Orbit.Api.Tests/Endpoints/NoteEndpointsTests.cs
prd_refs: [FR-1, FR-2, FR-3, FR-4, FR-5, FR-8]
memory_refs: []
agent_ready: true
---

# 301 – API endpoints, DI registration, endpoint tests

## Context (self-contained)
Use cases (`SaveNote`, `SetNoteStatus`, `DeleteNote`, `ListNotes`) and the SQLite repository exist (tasks 201/202; BOARD.md "Server types"). Expose them over HTTP using the exact wire format of BOARD.md "Wire format". Mirror `Endpoints/SinkingFundEndpoints.cs` and `Endpoints/BillEndpoints.cs` (request/response records with `ToCommand` / `From`, `MapXEndpoints` extension, `Results.Ok/NoContent`), `Program.cs` (use cases registered with `AddScoped` in one block; `app.MapXEndpoints()` calls together; JSON options already camelCase enums) and `tests/.../Endpoints/SinkingFundEndpointsTests.cs` with `ApiFactory`.

## Implementation plan
1. `NoteEndpoints.cs`: `SaveNoteRequest(NoteKind Kind, string Title, string? Body)` with `ToCommand(string id)`; `SetNoteStatusRequest(NoteStatus Status)` with `ToCommand(string id)`; `NoteResponse(string Id, NoteKind Kind, string Title, string Body, NoteStatus Status, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)` with `static From(Note note)`; `MapNoteEndpoints`: `GET /notes` (list), `PUT /notes/{id}` (save → `Results.Ok(NoteResponse)`), `PUT /notes/{id}/status`, `DELETE /notes/{id}` → `Results.NoContent()`.
2. `Program.cs`: `builder.Services.AddScoped<ListNotes>();`, `<SaveNote>`, `<SetNoteStatus>`, `<DeleteNote>` together after the last existing `AddScoped` block entry of the finances use cases; `app.MapNoteEndpoints();` right after the other `Map...Endpoints()` calls. Do not touch any other line.
3. Tests (through `ApiFactory`, signed in as the factory does for bills): PUT creates (response `status` `open`, `kind` as `goal`/`note`/`idea` strings, ISO timestamps with an offset); PUT again edits and keeps `createdAt` while `updatedAt` does not go back; GET lists most recently updated first; PUT status to `done` on a goal and an idea, to `archived` on a note, back to `open`; status `done` on a note → 400 and the message names the kind; unknown id status → 404; DELETE returns 204 and unknown id also 204; blank title → 400 naming the value; 81-char title → 400; 4001-char body → 400; a missing `body` is stored as `""`; unknown kind string → 400; unauthenticated request → 401; a note body with line breaks, quotes and emoji round-trips unchanged.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| `done` on a note | 400 (`DomainRuleException` via the existing handler) |
| Status of an unknown id | 404 |
| Missing/null `body` | stored as empty text |

## Acceptance criteria
- [ ] `dotnet build`, `dotnet test Orbit.slnx` (all), `dotnet format --no-restore --verify-no-changes` pass.
- [ ] JSON matches BOARD.md exactly (property names and enum strings).

## Out of scope
Domain, use cases, SQLite and web changes.
