using Orbit.Api.Application;
using Orbit.Api.Application.Finances;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class SinkingFundUseCaseTests
{
    private static readonly DateOnly Today = new(2026, 11, 11);

    private readonly InMemorySinkingFundRepository _funds = new();
    private readonly InMemoryBillRepository _bills = new();
    private readonly InMemoryFinanceCategoryRepository _categories = new(FinanceCategory.Create("home", "Home"));
    private readonly ImmediateUnitOfWork _unitOfWork = new();

    private SaveSinkingFund Save => new(_funds, _categories, _unitOfWork);
    private RollSinkingFunds Roll => new(_funds, _bills, _unitOfWork);

    private static SinkingFundScheduleCommand EveryMonths(DateOnly? nextDue = null, int? interval = 2) =>
        new(SinkingFundScheduleKind.EveryMonths, interval, nextDue ?? new DateOnly(2026, 12, 10), null, null);

    private static SinkingFundScheduleCommand Yearly(int month = 1, int day = 15) =>
        new(SinkingFundScheduleKind.FixedDate, null, null, month, day);

    private static SaveSinkingFundCommand Grooming(
        SinkingFundScheduleCommand schedule, string id = "f1", string categoryId = "home", DateOnly? today = null) =>
        new(id, "Grooming", categoryId, 10000, schedule, today ?? Today);

    private async Task<SinkingFund> StoredAsync(string id) =>
        (await _funds.FindAsync(id, CancellationToken.None))!;

    [Fact]
    public async Task Save_StoresAnEveryMonthsFund()
    {
        var fund = await Save.ExecuteAsync(Grooming(EveryMonths()), CancellationToken.None);

        fund.NextDueDate.ShouldBe(new DateOnly(2026, 12, 10));
        fund.Schedule.ShouldBe(SinkingFundSchedule.EveryMonths(2, 10));
        (await StoredAsync("f1")).ShouldBeSameAs(fund);
    }

    [Theory]
    [InlineData(2026, 11, 11, 2027, 1, 15)]
    [InlineData(2027, 1, 15, 2027, 1, 15)]
    [InlineData(2027, 1, 16, 2028, 1, 15)]
    public async Task Save_ComputesTheNextOccurrenceOfAFixedDate(
        int year, int month, int day, int dueYear, int dueMonth, int dueDay)
    {
        var fund = await Save.ExecuteAsync(
            Grooming(Yearly(), today: new DateOnly(year, month, day)), CancellationToken.None);

        fund.NextDueDate.ShouldBe(new DateOnly(dueYear, dueMonth, dueDay));
    }

    [Fact]
    public async Task Save_RejectsAnUnknownCategory()
    {
        var save = () => Save.ExecuteAsync(Grooming(EveryMonths(), categoryId: "ghost"), CancellationToken.None);

        await Should.ThrowAsync<ResourceNotFoundException>(save);
    }

    [Fact]
    public async Task Save_RejectsAnEveryMonthsFundWithoutAnInterval()
    {
        var save = () => Save.ExecuteAsync(Grooming(EveryMonths(interval: null)), CancellationToken.None);

        var error = await Should.ThrowAsync<DomainRuleException>(save);
        error.Message.ShouldContain("interval in months");
    }

    [Fact]
    public async Task Save_RejectsANextDueDateBeforeToday()
    {
        var save = () => Save.ExecuteAsync(
            Grooming(EveryMonths(new DateOnly(2026, 11, 10))), CancellationToken.None);

        var error = await Should.ThrowAsync<DomainRuleException>(save);
        error.Message.ShouldContain("2026-11-10");
        error.Message.ShouldContain("2026-11-11");
    }

    [Fact]
    public async Task Save_ReplacesAnExistingFund()
    {
        await Save.ExecuteAsync(Grooming(EveryMonths()), CancellationToken.None);

        await Save.ExecuteAsync(Grooming(Yearly()) with { Description = "Vet" }, CancellationToken.None);

        (await _funds.ListAsync(CancellationToken.None)).Single().Description.ShouldBe("Vet");
    }

    [Fact]
    public async Task Delete_RemovesTheFundAndIgnoresAnUnknownId()
    {
        await Save.ExecuteAsync(Grooming(EveryMonths()), CancellationToken.None);
        var delete = new DeleteSinkingFund(_funds);

        await delete.ExecuteAsync("f1", CancellationToken.None);
        await delete.ExecuteAsync("f1", CancellationToken.None);

        (await _funds.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task List_ReturnsSavedValuesAndTheMonthlyTotal()
    {
        await Save.ExecuteAsync(Grooming(EveryMonths()), CancellationToken.None);
        await Save.ExecuteAsync(Grooming(Yearly(), id: "f2") with { AmountCents = 120000 }, CancellationToken.None);

        var overview = await new ListSinkingFunds(_funds).ExecuteAsync(Today, CancellationToken.None);

        overview.Funds.Select(summary => summary.Fund.Id).ShouldBe(["f1", "f2"]);
        overview.Funds[0].SavedCents.ShouldBe(5000);
        overview.Funds[0].CycleStart.ShouldBe(new DateOnly(2026, 10, 10));
        overview.Funds[1].SavedCents.ShouldBe(90000);
        overview.TotalMonthlyCents.ShouldBe(5000 + 10000);
    }

    [Fact]
    public async Task Roll_CreatesOneBillAndAdvancesTheFund()
    {
        await Save.ExecuteAsync(Grooming(EveryMonths()), CancellationToken.None);

        var created = await Roll.ExecuteAsync(new DateOnly(2026, 12, 10), CancellationToken.None);

        created.Single().Id.ShouldBe("sf-f1-20261210");
        (await _bills.FindAsync("sf-f1-20261210", CancellationToken.None)).ShouldNotBeNull();
        (await StoredAsync("f1")).NextDueDate.ShouldBe(new DateOnly(2027, 2, 10));
    }

    [Fact]
    public async Task Roll_DoesNothingWhenNoFundIsDue()
    {
        await Save.ExecuteAsync(Grooming(EveryMonths()), CancellationToken.None);

        var created = await Roll.ExecuteAsync(Today, CancellationToken.None);

        created.ShouldBeEmpty();
        (await StoredAsync("f1")).NextDueDate.ShouldBe(new DateOnly(2026, 12, 10));
    }

    [Fact]
    public async Task Roll_RunTwiceForTheSameDayCreatesNothingTheSecondTime()
    {
        await Save.ExecuteAsync(Grooming(EveryMonths()), CancellationToken.None);
        await Roll.ExecuteAsync(new DateOnly(2026, 12, 10), CancellationToken.None);

        var second = await Roll.ExecuteAsync(new DateOnly(2026, 12, 10), CancellationToken.None);

        second.ShouldBeEmpty();
    }

    [Fact]
    public async Task Roll_CreatesABillForEveryMissedCycle()
    {
        await Save.ExecuteAsync(Grooming(Monthly(new DateOnly(2026, 11, 11))), CancellationToken.None);

        var created = await Roll.ExecuteAsync(new DateOnly(2027, 1, 20), CancellationToken.None);

        created.Select(bill => bill.DueDate).ShouldBe(
            [new DateOnly(2026, 11, 11), new DateOnly(2026, 12, 11), new DateOnly(2027, 1, 11)]);
        (await StoredAsync("f1")).NextDueDate.ShouldBe(new DateOnly(2027, 2, 11));
    }

    [Fact]
    public async Task Roll_CapsTheCyclesCreatedPerRun()
    {
        await Save.ExecuteAsync(Grooming(Monthly(new DateOnly(2026, 11, 11))), CancellationToken.None);

        var created = await Roll.ExecuteAsync(new DateOnly(2028, 12, 11), CancellationToken.None);

        created.Count.ShouldBe(RollSinkingFunds.MaxCyclesPerFund);
        (await StoredAsync("f1")).NextDueDate.ShouldBe(new DateOnly(2027, 11, 11));
    }

    [Fact]
    public async Task Roll_DoesNotDuplicateABillThatAlreadyExists()
    {
        await Save.ExecuteAsync(Grooming(EveryMonths()), CancellationToken.None);
        await _bills.SaveAsync((await StoredAsync("f1")).CurrentBill(), CancellationToken.None);

        var created = await Roll.ExecuteAsync(new DateOnly(2026, 12, 10), CancellationToken.None);

        created.ShouldBeEmpty();
        (await StoredAsync("f1")).NextDueDate.ShouldBe(new DateOnly(2027, 2, 10));
    }

    private static SinkingFundScheduleCommand Monthly(DateOnly nextDue) => EveryMonths(nextDue, interval: 1);
}
