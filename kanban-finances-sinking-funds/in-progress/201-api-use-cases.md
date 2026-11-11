---
id: 201
title: API use cases - save, delete, list, roll
status: in-progress
wave: 2
depends_on: [101]
priority: high
estimate: M
files:
  - apps/api/Application/Finances/SaveSinkingFund.cs
  - apps/api/Application/Finances/DeleteSinkingFund.cs
  - apps/api/Application/Finances/ListSinkingFunds.cs
  - apps/api/Application/Finances/RollSinkingFunds.cs
  - apps/api/tests/Orbit.Api.Tests/Fakes/InMemorySinkingFundRepository.cs
  - apps/api/tests/Orbit.Api.Tests/Application/SinkingFundUseCaseTests.cs
prd_refs: [FR-1, FR-2, FR-3, FR-5, FR-6, FR-7, FR-8]
memory_refs: []
agent_ready: true
---

# 201 – API use cases: save, delete, list, roll

## Context (self-contained)
Sinking funds (see BOARD.md) are built on the domain from task 101 (`SinkingFund`, `SinkingFundSchedule`, `ISinkingFundRepository`, all assumed to exist exactly as in BOARD.md "Server types"). This task adds the use cases. Mirror `Application/Finances/SaveBill.cs` (command record + class with primary-constructor dependencies, `IUnitOfWork.RunAsync`, `ResourceNotFoundException.For("finance category", id)`), `DeleteBill.cs` and `ListBillsAgenda.cs`. Fakes are named in-memory classes (AGENTS.md): mirror `tests/.../Fakes/InMemoryBillRepository.cs`, and `Fakes/ImmediateUnitOfWork.cs`, `InMemoryFinanceCategoryRepository.cs` for the other dependencies.

## Interfaces you must conform to
The use case classes, commands and records of BOARD.md "Server types" (task 201 block). Constructors:
- `SaveSinkingFund(ISinkingFundRepository funds, IFinanceCategoryRepository categories, IUnitOfWork unitOfWork)`
- `DeleteSinkingFund(ISinkingFundRepository funds)`
- `ListSinkingFunds(ISinkingFundRepository funds)`
- `RollSinkingFunds(ISinkingFundRepository funds, IBillRepository bills, IUnitOfWork unitOfWork)`

## Implementation plan
1. `SaveSinkingFund.ExecuteAsync(command, ct)`:
   1. Throw `ResourceNotFoundException.For("finance category", command.CategoryId)` when the category is missing (existence only, like bills).
   2. Build the schedule and next due date with a private `BuildSchedule(command)` returning `(SinkingFundSchedule, DateOnly)`:
      - `EveryMonths`: require `IntervalMonths` and `NextDueDate` non-null (else `DomainRuleException` naming the missing field and the kind), require `NextDueDate >= Today` (message includes both dates); schedule `EveryMonths(interval, NextDueDate.Day)`, next due = `NextDueDate`.
      - `FixedDate`: require `Month` and `Day` non-null; schedule `FixedDate(month, day)`, next due = `schedule.FirstDueOnOrAfter(Today)`.
   3. `SinkingFund.Create(...)`, then `unitOfWork.RunAsync(() => funds.SaveAsync(fund, ct), ct)`; return the fund. Saving an existing id replaces it (FR-8); no special edit path.
2. `DeleteSinkingFund.ExecuteAsync(id, ct)`: `funds.DeleteAsync(EntityId.Require(id, "sinking fund id"), ct)`.
3. `ListSinkingFunds.ExecuteAsync(today, ct)`: `funds.ListAsync`, map to `SinkingFundSummary(fund, fund.SavedCents(today), fund.CycleStart)`, total = sum of `MonthlyCents`.
4. `RollSinkingFunds.ExecuteAsync(today, ct)`:
   1. `funds.ListDueOnOrBeforeAsync(today)`.
   2. Inside one `unitOfWork.RunAsync`: for each fund loop at most `MaxCyclesPerFund = 12` times while `fund.NextDueDate <= today`: if `bills.FindAsync(fund.CurrentBillId)` is null, `bills.SaveAsync(fund.CurrentBill())` and add it to the result; then `fund = fund.AdvancedOneCycle()`. Save the advanced fund once at the end.
   3. Return the created bills in creation order. Running it again with the same `today` returns `[]` (idempotent).
5. `InMemorySinkingFundRepository` (internal, list-backed) implementing `ISinkingFundRepository`; `ListAsync` orders by next due date then description; `ListDueOnOrBeforeAsync` filters `NextDueDate <= day`.
6. `SinkingFundUseCaseTests.cs` (AAA, named fakes): save new everyMonths (grooming: 10000, every 2 months, next due 2026-12-10, today 2026-11-11); save fixedDate computes next occurrence (month 1 day 15, today 2026-11-11 → 2027-01-15; today 2027-01-15 → 2027-01-15; today 2027-01-16 → 2028-01-15); missing category → not found; everyMonths without interval → rule error; next due before today → rule error; edit replaces; delete removes and unknown id is fine; list totals and saved values; roll creates one bill and advances the fund; roll twice creates nothing; roll with three missed monthly cycles creates three bills; roll caps at 12.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Fund not due yet | roll returns `[]`, fund untouched |
| Bill with the derived id already exists | no duplicate bill; the fund still advances |
| More than 12 missed cycles | 12 bills created, fund advanced 12 cycles, the rest on a later roll |
| Roll fails halfway | whole unit of work fails (single `RunAsync`) |

## Acceptance criteria
- [ ] `dotnet build Orbit.slnx` 0 warnings; `dotnet test Orbit.slnx` passes; `dotnet format Orbit.slnx --verify-no-changes` clean.
- [ ] Every scenario in the test plan above has a test.
- [ ] Functions 4–20 lines, files < 500 lines.

## Out of scope
SQLite, endpoints, `Program.cs` DI registration (task 301).
