---
id: 301
title: API endpoints, DI registration, endpoint tests
status: backlog
wave: 3
depends_on: [201, 202]
priority: high
estimate: M
files:
  - apps/api/Endpoints/SinkingFundEndpoints.cs
  - apps/api/Program.cs
  - apps/api/tests/Orbit.Api.Tests/Endpoints/SinkingFundEndpointsTests.cs
prd_refs: [FR-1, FR-6, FR-7, FR-9]
memory_refs: []
agent_ready: true
---

# 301 – API endpoints, DI registration, endpoint tests

## Context (self-contained)
Use cases (`SaveSinkingFund`, `DeleteSinkingFund`, `ListSinkingFunds`, `RollSinkingFunds`) and the SQLite repository exist (tasks 201/202; BOARD.md "Server types"). Expose them over HTTP using the exact wire format of BOARD.md "Wire format". Mirror `Endpoints/BillEndpoints.cs` (request/response records with `ToCommand` / `From`, `MapXEndpoints` extension, `Results.Ok/NoContent`) and `Program.cs` (use cases registered `AddScoped` ~lines 75-90, endpoints mapped ~line 119, JSON options camelCase enums) and `tests/.../Endpoints/BillEndpointsTests.cs` with `ApiFactory`.

## Implementation plan
1. `SinkingFundEndpoints.cs`:
   - `ScheduleBody(SinkingFundScheduleKind Kind, int? IntervalMonths, DateOnly? NextDueDate, int? Month, int? Day)` with `ToCommand()` → `SinkingFundScheduleCommand`.
   - `SaveSinkingFundRequest(string Description, string CategoryId, long AmountCents, ScheduleBody Schedule)` with `ToCommand(string id, DateOnly today)`.
   - `RollSinkingFundsRequest(DateOnly Today)`.
   - Responses: `SinkingFundScheduleResponse(SinkingFundScheduleKind Kind, int IntervalMonths, int? Month, int Day, DateOnly NextDueDate)`, `SinkingFundResponse(Id, Description, CategoryId, AmountCents, Schedule, SavedCents, MonthlyCents, CycleStart)` with `From(SinkingFund fund, DateOnly today)`, `SinkingFundsResponse(IReadOnlyList<SinkingFundResponse> Funds, long TotalMonthlyCents)`.
   - `MapSinkingFundEndpoints`: `GET /sinking-funds?today=`, `PUT /sinking-funds/{id}?today=`, `DELETE /sinking-funds/{id}`, `POST /sinking-funds/roll` (returns `BillResponse` list via `BillResponse.From`).
2. `Program.cs`: `AddScoped` for the four use cases next to the bill ones; `app.MapSinkingFundEndpoints();` next to `MapBillEndpoints()`.
3. Tests (end to end through `ApiFactory`, signed in as the factory does for bills): create a category first via the finance-category endpoint (see `BillEndpointsTests`); PUT everyMonths and fixedDate and check the response JSON (kind as `everyMonths`/`fixedDate`, nextDueDate, monthlyCents, savedCents); GET lists with `totalMonthlyCents`; PUT again replaces; DELETE returns 204 and unknown id returns 204; POST roll returns the created bill and a second POST returns `[]`, and the bill then shows in `GET /bills`; unknown category → 404; invalid interval (0) → 400 with a message that names the value; another user cannot see the funds (follow how other endpoint tests register a second user, if any, else cover it in the repository tests only).

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Missing `today` query | 400 (same behavior as `GET /bills` without `date`) |
| Unknown category | 404 via the existing `BusinessExceptionHandler` |
| `everyMonths` without `nextDueDate` | 400 naming the missing field |

## Acceptance criteria
- [ ] `dotnet build`, `dotnet test Orbit.Api.Tests` (all), `dotnet format --verify-no-changes` pass.
- [ ] JSON matches BOARD.md exactly (property names and enum strings).

## Out of scope
Domain, use cases, SQLite and web changes.
