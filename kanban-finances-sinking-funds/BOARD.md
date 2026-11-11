# Kanban – Finances · Sinking funds

Source PRD: [../prd-finances-sinking-funds.md](../prd-finances-sinking-funds.md)

## How to run this board with AI agents
- Tasks in the same wave are safe to run **in parallel** (one agent, session or git worktree per task): they share no files.
- Start a wave only when every task in the previous wave is in `done/`.
- To work a task: move its file to `in-progress/`, set `status`, implement, verify the acceptance criteria and the project gates (AGENTS.md: lint, typecheck, tests), then move it to `done/`.
- Each task is self-contained: give an agent just the task file. Where a task says "mirror X", read X first; the pattern is the spec.
- API commands run from the repo root (`dotnet build Orbit.slnx`, `dotnet test Orbit.slnx`); web commands from `apps/web` (`npm run lint`, `npx ng test --no-watch`, `npx prettier --check .`).

## Execution plan
| Wave | Tasks | Max parallel agents |
|------|-------|---------------------|
| 1 | 101, 102, 103 | 3 |
| 2 | 201, 202, 203, 204 | 4 |
| 3 | 301, 302, 303 | 3 |
| 4 | 401 | 1 |
| 5 | 501 | 1 |

## Shared interfaces (pinned; every task conforms to these)

### Wire format (JSON, camelCase, enums as camelCase strings, nulls omitted)
```
GET    /api/sinking-funds?today=YYYY-MM-DD   -> SinkingFundsResponse
PUT    /api/sinking-funds/{id}?today=YYYY-MM-DD   body SaveSinkingFundRequest -> SinkingFundResponse
DELETE /api/sinking-funds/{id}               -> 204 (unknown id ignored)
POST   /api/sinking-funds/roll   body { "today": "YYYY-MM-DD" } -> BillResponse[]  (the bills created; [] when none)

SaveSinkingFundRequest  { description: string, categoryId: string, amountCents: number, schedule: ScheduleBody }
ScheduleBody            { kind: "everyMonths" | "fixedDate",
                          intervalMonths?: number (1-60, everyMonths only),
                          nextDueDate?: "YYYY-MM-DD" (everyMonths only; on or after today),
                          month?: number (1-12, fixedDate only), day?: number (1-31, fixedDate only) }
SinkingFundsResponse    { funds: SinkingFundResponse[], totalMonthlyCents: number }
SinkingFundResponse     { id, description, categoryId, amountCents,
                          schedule: { kind, intervalMonths: number (12 for fixedDate), month?: number, day: number, nextDueDate: "YYYY-MM-DD" },
                          savedCents: number, monthlyCents: number, cycleStart: "YYYY-MM-DD" }
```
`BillResponse` is the existing one (`apps/api/Endpoints/BillEndpoints.cs`). Funds are listed by `nextDueDate`, then description.

### Calculations (domain, integer cents only)
- `cycleMonths` = `intervalMonths` (12 for `fixedDate`).
- `dueDay` = day of the first `nextDueDate` (`everyMonths`) or the given `day` (`fixedDate`). A due date is `min(dueDay, last day of that month)`, so the 31st never drifts to the 28th.
- `cycleStart` = `nextDueDate` moved back `cycleMonths` months (same clamping rule).
- `elapsedMonths` = whole months from `cycleStart` to `today` (`(today.Year-start.Year)*12 + today.Month-start.Month`, minus 1 when `today.Day < start.Day`), clamped to `0..cycleMonths`.
- `savedCents` = `round(amountCents * elapsedMonths / cycleMonths)` (away from zero); `monthlyCents` = `ceil(amountCents / cycleMonths)`; `totalMonthlyCents` = sum of `monthlyCents`.
- A `fixedDate` fund's stored `nextDueDate` is the first occurrence of (month, day) on or after the `today` it was saved with, and moves one cycle forward on each roll.

### Server types (C#, namespace `Orbit.Api.Domain.Finances` / `Orbit.Api.Application.Finances`)
```csharp
public enum SinkingFundScheduleKind { EveryMonths, FixedDate }
public sealed record SinkingFundSchedule {  // task 101
    SinkingFundScheduleKind Kind; int IntervalMonths; int? Month; int DueDay;
    static SinkingFundSchedule EveryMonths(int intervalMonths, int dueDay);
    static SinkingFundSchedule FixedDate(int month, int dueDay);
    DateOnly DueIn(int year, int month); DateOnly FirstDueOnOrAfter(DateOnly day);
    DateOnly Following(DateOnly due); DateOnly Preceding(DateOnly due); }
public sealed class SinkingFund {            // task 101
    string Id; string Description; string CategoryId; long AmountCents;
    SinkingFundSchedule Schedule; DateOnly NextDueDate;
    static SinkingFund Create(string id, string description, string categoryId, long amountCents, SinkingFundSchedule schedule, DateOnly nextDueDate);
    static SinkingFund Restore(...same parameters...);
    DateOnly CycleStart { get; } long MonthlyCents { get; }
    long SavedCents(DateOnly today); string CurrentBillId { get; }   // "sf-{Id}-{NextDueDate:yyyyMMdd}"
    SinkingFund AdvancedOneCycle(); Bill CurrentBill(); }            // payable bill for NextDueDate
public interface ISinkingFundRepository {    // task 101 (Application/Finances)
    Task<SinkingFund?> FindAsync(string id, CancellationToken ct);
    Task<IReadOnlyList<SinkingFund>> ListAsync(CancellationToken ct);       // ordered by next due date, then description
    Task<IReadOnlyList<SinkingFund>> ListDueOnOrBeforeAsync(DateOnly day, CancellationToken ct);
    Task SaveAsync(SinkingFund fund, CancellationToken ct);                 // upsert by id
    Task DeleteAsync(string id, CancellationToken ct);                      // unknown id ignored
    Task<bool> AnyInCategoryAsync(string categoryId, CancellationToken ct); }
// task 201
public sealed record SinkingFundScheduleCommand(SinkingFundScheduleKind Kind, int? IntervalMonths, DateOnly? NextDueDate, int? Month, int? Day);
public sealed record SaveSinkingFundCommand(string Id, string Description, string CategoryId, long AmountCents, SinkingFundScheduleCommand Schedule, DateOnly Today);
public sealed class SaveSinkingFund   { Task<SinkingFund> ExecuteAsync(SaveSinkingFundCommand, CancellationToken); }
public sealed class DeleteSinkingFund { Task ExecuteAsync(string id, CancellationToken); }
public sealed record SinkingFundSummary(SinkingFund Fund, long SavedCents, DateOnly CycleStart);
public sealed record SinkingFundsOverview(IReadOnlyList<SinkingFundSummary> Funds, long TotalMonthlyCents);
public sealed class ListSinkingFunds  { Task<SinkingFundsOverview> ExecuteAsync(DateOnly today, CancellationToken); }
public sealed class RollSinkingFunds  { Task<IReadOnlyList<Bill>> ExecuteAsync(DateOnly today, CancellationToken); }
```

### Web types (TypeScript, `apps/web/src/app/core/finances/`)
```ts
// sinking-funds.ts (task 102)
export type SinkingFundScheduleKind = 'everyMonths' | 'fixedDate';
export interface SinkingFundSchedule { readonly kind: SinkingFundScheduleKind; readonly intervalMonths: number; readonly month?: number; readonly day: number; readonly nextDueDate: string; }
export interface SinkingFund { readonly id: string; readonly description: string; readonly categoryId: string; readonly amountCents: number; readonly schedule: SinkingFundSchedule; readonly savedCents: number; readonly monthlyCents: number; readonly cycleStart: string; }
export interface SinkingFundsOverview { readonly funds: readonly SinkingFund[]; readonly totalMonthlyCents: number; }
export type SinkingFundScheduleDraft =
  | { readonly kind: 'everyMonths'; readonly intervalMonths: number; readonly nextDueDate: string }
  | { readonly kind: 'fixedDate'; readonly month: number; readonly day: number };
export interface SinkingFundDraft { readonly description: string; readonly categoryId: string; readonly amountCents: number; readonly schedule: SinkingFundScheduleDraft; }
// sinking-funds-gateway.ts (task 102)
export abstract class SinkingFundsGateway {
  abstract list(today: string): Observable<SinkingFundsOverview>;
  abstract save(id: string, today: string, draft: SinkingFundDraft): Observable<SinkingFund>;
  abstract delete(id: string): Observable<void>;
  abstract roll(today: string): Observable<readonly Bill[]>;
}
// sinking-funds-store.ts (task 203) - @Injectable(), provided by the page
export class SinkingFundsStore {
  readonly funds: Signal<readonly SinkingFund[]>; readonly totalMonthlyCents: Signal<number>;
  readonly isLoaded: Signal<boolean>; readonly hasLoadFailed: Signal<boolean>; readonly hasActionFailed: Signal<boolean>;
  readonly rolledBills: Signal<readonly Bill[]>;           // bills the roll created on load
  readonly today: string;
  reload(): void; save(draft: SinkingFundDraft, id?: string): void;  // new id from IdGenerator when omitted
  remove(id: string): void; }
```
Components (tasks 302/303): `SinkingFundList` (`app-sinking-fund-list`; inputs `funds`, `totalMonthlyCents`, `categories`; outputs `add`, `edit` (SinkingFund), `remove` (SinkingFund)) and `SinkingFundForm` (`app-sinking-fund-form`; inputs `fund: SinkingFund | null`, `categories`, `today`; outputs `saved` (`{ id: string | null; draft: SinkingFundDraft }`), `cancelled`). `categories` has the type the bill form already uses.

### Translation keys (English text is the key; PT-BR owned by task 103)
| English | PT-BR |
|---|---|
| Sinking funds | Fundos de reserva |
| New sinking fund | Novo fundo de reserva |
| Edit sinking fund | Editar fundo de reserva |
| No sinking funds yet. Add one for a bill you pay from time to time, like a yearly tax. | Nenhum fundo de reserva ainda. Crie um para uma conta paga de tempos em tempos, como um imposto anual. |
| Set aside {amountCents} per month | Guardar {amountCents} por mês |
| Total to set aside per month: {amountCents} | Total a guardar por mês: {amountCents} |
| Saved so far {savedCents} of {amountCents} | Guardado até agora {savedCents} de {amountCents} |
| Falls due {date} | Vence em {date} |
| Delete sinking fund {description} | Excluir fundo de reserva {description} |
| Could not load the sinking funds. | Não foi possível carregar os fundos de reserva. |
| Could not save the sinking fund. | Não foi possível salvar o fundo de reserva. |
| Cost per cycle (R$) | Custo por ciclo (R$) |
| Repeats | Repete |
| Every few months | A cada alguns meses |
| Every year on a fixed date | Todo ano em data fixa |
| Every (months) | A cada (meses) |
| Next due date | Próximo vencimento |
| Month of the year (1-12) | Mês do ano (1-12) |
| Day of the month | Dia do mês |

## File ownership map
| File | Owned by task |
|------|---------------|
| apps/api/Domain/Finances/SinkingFund.cs, SinkingFundSchedule.cs, SinkingFundScheduleKind.cs | 101 |
| apps/api/Application/Finances/ISinkingFundRepository.cs | 101 |
| apps/api/tests/Orbit.Api.Tests/Domain/SinkingFundTests.cs, SinkingFundScheduleTests.cs | 101 |
| apps/web/src/app/core/finances/sinking-funds.ts, sinking-funds-gateway.ts, http-sinking-funds-gateway.ts, http-sinking-funds-gateway.spec.ts, fake-sinking-funds-gateway.ts | 102 |
| apps/web/src/app/app.config.ts | 102 (HTTP binding), then 204 (demo switch) |
| apps/web/src/app/core/i18n/translations/pt-br-finances.ts | 103 |
| apps/api/Application/Finances/SaveSinkingFund.cs, DeleteSinkingFund.cs, ListSinkingFunds.cs, RollSinkingFunds.cs | 201 |
| apps/api/tests/Orbit.Api.Tests/Fakes/InMemorySinkingFundRepository.cs, Application/SinkingFundUseCaseTests.cs | 201 |
| apps/api/Infrastructure/Sqlite/SqliteSchema.cs, SqliteSinkingFundRepository.cs, SqlitePersistenceRegistration.cs | 202 |
| apps/api/tests/Orbit.Api.Tests/Infrastructure/SqliteSinkingFundRepositoryTests.cs | 202 |
| apps/web/src/app/core/finances/sinking-funds-store.ts, sinking-funds-store.spec.ts | 203 |
| apps/web/src/app/core/finances/demo/demo-sinking-funds.ts, demo-sinking-funds.spec.ts | 204 |
| apps/api/Endpoints/SinkingFundEndpoints.cs, apps/api/Program.cs, tests/.../Endpoints/SinkingFundEndpointsTests.cs | 301 |
| apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-list.* | 302 |
| apps/web/src/app/pages/finances/bills/sinking-funds/sinking-fund-form.* | 303 |
| apps/web/src/app/pages/finances/bills/bills.ts/.html/.css/.spec.ts, core/finances/bills-store.ts/.spec.ts | 401 |
| apps/web/e2e/sinking-funds.e2e.ts, apps/web/e2e/pages/sinking-funds.page.ts, TODO.md | 501 |

## Backlog
| ID | Wave | Task | Priority | Estimate | Depends on |
|----|------|------|----------|----------|------------|
| 301 | 3 | API endpoints, DI registration, endpoint tests | high | M | 201, 202 |
| 302 | 3 | Web SinkingFundList component | high | M | 102, 103 |
| 303 | 3 | Web SinkingFundForm component | high | M | 102, 103 |
| 401 | 4 | Integrate into the To pay & receive page | high | M | 203, 204, 302, 303 |
| 501 | 5 | E2E test and TODO tick | medium | S | 301, 401 |

## In progress
_(empty)_

## Done
| ID | Task |
|----|------|
| 101 | API domain: SinkingFund, schedule maths, repository port |
| 102 | Web model, gateway port, HTTP + fake gateways |
| 103 | Web PT-BR translations |
| 201 | API use cases: save, delete, list, roll |
| 202 | SQLite table and repository |
| 203 | Web SinkingFundsStore |
| 204 | Web demo gateway and binding |
