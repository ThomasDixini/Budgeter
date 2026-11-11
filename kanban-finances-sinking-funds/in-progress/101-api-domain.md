---
id: 101
title: API domain - SinkingFund, schedule maths, repository port
status: in-progress
wave: 1
depends_on: []
priority: high
estimate: M
files:
  - apps/api/Domain/Finances/SinkingFundScheduleKind.cs
  - apps/api/Domain/Finances/SinkingFundSchedule.cs
  - apps/api/Domain/Finances/SinkingFund.cs
  - apps/api/Application/Finances/ISinkingFundRepository.cs
  - apps/api/tests/Orbit.Api.Tests/Domain/SinkingFundScheduleTests.cs
  - apps/api/tests/Orbit.Api.Tests/Domain/SinkingFundTests.cs
prd_refs: [FR-1, FR-2, FR-3, FR-4, FR-5]
memory_refs: []
agent_ready: true
---

# 101 – API domain: SinkingFund, schedule maths, repository port

## Context (self-contained)
Orbit (`C:\Projetos\Orbit`) is a personal finance/routine app: .NET API under `apps/api` (Clean Architecture: Domain → Application → Infrastructure/Endpoints), Angular web under `apps/web`. A **sinking fund** spreads the cost of an irregular bill (IPVA yearly, $100 dog grooming every 2 months) over the months before it is due. The saved amount is *calculated from time*; nothing is deposited. When the due date arrives the fund creates a normal payable `Bill` (existing entity `apps/api/Domain/Finances/Bill.cs`) and starts its next cycle.

This task builds only the pure domain model and the repository port. No persistence, endpoints or use cases (other tasks). Read `Domain/Finances/Bill.cs`, `BillSchedule.cs`, `Domain/EntityId.cs`, `Domain/RequiredText.cs` and `tests/Orbit.Api.Tests/Domain/BillTests.cs` first and mirror their style (private constructor, `Create` validates, `internal static Restore` rebuilds without today's rules, XML docs with a one-line `<example>`, `DomainRuleException` messages that include the offending value and the expected shape). Code style (AGENTS.md): functions 4–20 lines, files < 500 lines, explicit types, early returns, no `any`.

## Interfaces you must conform to
Exactly as in BOARD.md "Server types" (copy them): `SinkingFundScheduleKind`, `SinkingFundSchedule`, `SinkingFund`, `ISinkingFundRepository`. Other tasks are written against these signatures.

## Implementation plan
1. `SinkingFundScheduleKind.cs`: `public enum SinkingFundScheduleKind { EveryMonths, FixedDate }`.
2. `SinkingFundSchedule.cs`: sealed record with private constructor and properties `Kind`, `IntervalMonths`, `Month` (`int?`), `DueDay`. Constants `MaxIntervalMonths = 60`, `FixedDateCycleMonths = 12`.
   - `EveryMonths(int intervalMonths, int dueDay)`: requires 1..60 and dueDay 1..31, else `DomainRuleException`.
   - `FixedDate(int month, int dueDay)`: requires month 1..12, day 1..31; `IntervalMonths = 12`, `Month = month`.
   - `DueIn(int year, int month)`: `new DateOnly(year, month, Math.Min(DueDay, DateTime.DaysInMonth(year, month)))`.
   - `FirstDueOnOrAfter(DateOnly day)`: for `FixedDate` only (throw `InvalidOperationException` with the kind otherwise): the due date in `day.Year` with `Month`, or the next year's when that is before `day`.
   - `Following(DateOnly due)`: `due` moved forward `IntervalMonths` months, re-clamped with `DueIn` so the due day does not drift (use `due.AddMonths(IntervalMonths)` to get the target year/month, then `DueIn(target.Year, target.Month)`).
   - `Preceding(DateOnly due)`: same with `-IntervalMonths`.
3. `SinkingFund.cs` (sealed class, `MaxDescriptionLength = 80` like `Bill`, `MaxIdLength = 48` so the derived bill id stays within `EntityId`'s 64 characters):
   - `Create(id, description, categoryId, amountCents, schedule, nextDueDate)`: `EntityId.Require(id)` plus the 48-char limit, `RequiredText.Require(description, 80, "sinking fund description")`, `EntityId.Require(categoryId)`, amount above zero and not above the same ceiling `Bill` uses (read `Bill.RequireAmount`; if private, duplicate the constant name `MaxAmountCents` from the same source rather than inventing one). `Restore` does the same without validation, `internal static`.
   - `CycleStart => Schedule.Preceding(NextDueDate)`.
   - `MonthlyCents => (AmountCents + cycle - 1) / cycle` (ceil), `cycle = Schedule.IntervalMonths`.
   - `SavedCents(DateOnly today)`: elapsed months per BOARD.md ("Calculations"), clamped `0..cycle`, then `(long)Math.Round((decimal)AmountCents * elapsed / cycle, MidpointRounding.AwayFromZero)`.
   - `CurrentBillId => $"sf-{Id}-{NextDueDate:yyyyMMdd}"` (invariant culture).
   - `AdvancedOneCycle()`: a copy with `NextDueDate = Schedule.Following(NextDueDate)`.
   - `CurrentBill()`: `Bill.Create(CurrentBillId, BillKind.Payable, Description, CategoryId, AmountCents, NextDueDate)`.
4. `ISinkingFundRepository.cs`: the interface from BOARD.md, each member with an XML doc line.
5. Tests (AAA, one behavior each): schedule validation (0, 61, month 13, day 32), `Following`/`Preceding` keeping due day 31 through February and back, `FirstDueOnOrAfter` for before/on/after the date and 29 Feb in a non-leap year; fund `SavedCents` at cycle start (0), mid-cycle (yearly 120000 cents due 15 Jan 2027 → cycle starts 15 Jan 2026; today 15 Jul 2026 → 6 months elapsed → 60000), on the due date (full), after the due date (clamped full), `MonthlyCents` ceil (10001 cents / 12 = 834), `CurrentBill()` fields, `AdvancedOneCycle()`, description/amount/id validation.

## Edge cases & error handling
| Situation | Expected behavior |
|-----------|-------------------|
| Due day 31, month with 30 days | due date is the 30th; the next cycle returns to the 31st when the month has one |
| 29 Feb in a non-leap year | 28 Feb |
| `today` before cycle start | saved is 0 |
| `today` after next due date | saved is the full amount |
| Id longer than 48 chars | `DomainRuleException` naming the id and the limit |

## Acceptance criteria
- [ ] `dotnet build Orbit.slnx` has 0 warnings; `dotnet test Orbit.slnx` passes including the new tests.
- [ ] `dotnet format Orbit.slnx --verify-no-changes` is clean.
- [ ] The public signatures match BOARD.md exactly.
- [ ] Every function is 4–20 lines and no file passes 500 lines.

## Out of scope
SQLite, use cases, endpoints, DI registration, any web code, the in-memory repository fake (task 201).
