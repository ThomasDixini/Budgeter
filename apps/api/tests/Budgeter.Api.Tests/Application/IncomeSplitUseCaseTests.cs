using Budgeter.Api.Application;
using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Finances;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class IncomeSplitUseCaseTests
{
    private readonly InMemoryFinanceCategoryRepository _categories =
        new(FinanceCategory.Create("food", "Food"), FinanceCategory.Create("housing", "Housing"));
    private readonly InMemoryMoneyTransactionRepository _transactions = new();
    private readonly InMemoryIncomeSplitRepository _plans = new();

    private SaveIncomeSplit SaveIncomeSplit => new(_plans, _categories);
    private SaveFinanceCategory SaveCategory => new(_categories);
    private DeleteFinanceCategory DeleteCategory => new(_categories, _transactions, new InMemoryBillRepository());

    private static SaveIncomeSplitCommand Plan(params IncomeSplitPartCommand[] parts) => new(950000, parts);

    private static IncomeSplitPartCommand Part(string id, int percent, params string[] categoryIds) =>
        new(id, "Fixed costs", percent, 0, categoryIds);

    [Fact]
    public async Task Get_AnswersAnEmptyPlanBeforeTheFirstSave()
    {
        var plan = await new GetIncomeSplit(_plans).ExecuteAsync(CancellationToken.None);

        (plan.BaseIncomeCents, plan.Parts).ShouldBe((0L, []));
    }

    [Fact]
    public async Task Save_StoresThePlanAndReplacesItOnTheNextSave()
    {
        await SaveIncomeSplit.ExecuteAsync(Plan(Part("a", 50, "food")), CancellationToken.None);
        await SaveIncomeSplit.ExecuteAsync(Plan(Part("b", 30)), CancellationToken.None);

        var plan = await new GetIncomeSplit(_plans).ExecuteAsync(CancellationToken.None);

        plan.Parts.Select(part => part.Id).ShouldBe(["b"]);
    }

    [Fact]
    public async Task Save_RejectsAnUnknownCategory()
    {
        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            SaveIncomeSplit.ExecuteAsync(Plan(Part("a", 50, "travel")), CancellationToken.None));

        exception.Message.ShouldContain("\"travel\"");
    }

    [Fact]
    public async Task Save_RejectsACategoryInTwoParts()
    {
        await Should.ThrowAsync<DomainRuleException>(() =>
            SaveIncomeSplit.ExecuteAsync(Plan(Part("a", 50, "food"), Part("b", 50, "food")), CancellationToken.None));
    }

    [Fact]
    public async Task SaveCategory_CreatesAndRenamesWithoutMovingItsId()
    {
        await SaveCategory.ExecuteAsync(new SaveFinanceCategoryCommand("courses", " Courses "), CancellationToken.None);
        await SaveCategory.ExecuteAsync(new SaveFinanceCategoryCommand("courses", "Study"), CancellationToken.None);

        var names = (await _categories.ListAsync(CancellationToken.None)).Select(category => category.Name);

        names.ShouldBe(["Food", "Housing", "Study"]);
    }

    [Fact]
    public async Task SaveCategory_SavingTheSameCategoryTwiceIsHarmless()
    {
        var command = new SaveFinanceCategoryCommand("courses", "Courses");

        await SaveCategory.ExecuteAsync(command, CancellationToken.None);
        await SaveCategory.ExecuteAsync(command, CancellationToken.None);

        (await _categories.ListAsync(CancellationToken.None)).Count.ShouldBe(3);
    }

    [Fact]
    public async Task SaveCategory_RefusesANameAnotherCategoryHasIgnoringCase()
    {
        var exception = await Should.ThrowAsync<ConflictException>(() =>
            SaveCategory.ExecuteAsync(new SaveFinanceCategoryCommand("meals", "FOOD"), CancellationToken.None));

        exception.Message.ShouldContain("\"food\"");
    }

    [Fact]
    public async Task DeleteCategory_RemovesAnUnusedCategoryAndIgnoresOneAlreadyGone()
    {
        await DeleteCategory.ExecuteAsync("food", CancellationToken.None);
        await DeleteCategory.ExecuteAsync("food", CancellationToken.None);

        (await _categories.FindAsync("food", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task DeleteCategory_KeepsACategoryWithTransactions()
    {
        await _transactions.SaveAsync(
            MoneyTransaction.Create("tx1", new DateOnly(2026, 11, 2), "Lunch", "food", "checking-account", -2500),
            CancellationToken.None);

        await Should.ThrowAsync<ConflictException>(() => DeleteCategory.ExecuteAsync("food", CancellationToken.None));
    }
}
