using Orbit.Api.Application;
using Orbit.Api.Application.Finances;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class TransactionUseCaseTests
{
    private readonly InMemoryFinanceCategoryRepository _categories = new(FinanceCategory.Create("food", "Food"));
    private readonly InMemoryAccountRepository _accounts =
        new(Account.CreateCreditCard("credit-card", "Credit card", CardTerms.Create(500000, 3, 10)));
    private readonly InMemoryMoneyTransactionRepository _transactions = new();

    private SaveTransaction SaveTransaction => new(_transactions, _categories, _accounts);

    private static SaveTransactionCommand Spend(
        string id, DateOnly date, string categoryId = "food", string accountId = "credit-card") =>
        new(id, date, "Groceries", categoryId, accountId, -28640);

    [Fact]
    public async Task Save_StoresTheTransactionAndListsItInItsMonth()
    {
        await SaveTransaction.ExecuteAsync(Spend("tx1", new DateOnly(2026, 10, 31)), CancellationToken.None);

        var october = await new ListTransactions(_transactions).ExecuteAsync("2026-10", CancellationToken.None);
        var november = await new ListTransactions(_transactions).ExecuteAsync("2026-11", CancellationToken.None);

        (october.Single().Id, november.Count).ShouldBe(("tx1", 0));
    }

    [Fact]
    public async Task Save_RejectsAnUnknownCategory()
    {
        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            SaveTransaction.ExecuteAsync(Spend("tx1", new DateOnly(2026, 10, 1), categoryId: "travel"), CancellationToken.None));

        exception.Message.ShouldContain("\"travel\"");
    }

    [Fact]
    public async Task Save_RejectsAnUnknownAccount()
    {
        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            SaveTransaction.ExecuteAsync(Spend("tx1", new DateOnly(2026, 10, 1), accountId: "wallet"), CancellationToken.None));

        exception.Message.ShouldContain("\"wallet\"");
    }

    [Fact]
    public async Task List_RejectsAMalformedMonth()
    {
        await Should.ThrowAsync<DomainRuleException>(() =>
            new ListTransactions(_transactions).ExecuteAsync("2026-1", CancellationToken.None));
    }

    [Fact]
    public async Task Delete_RemovesTheTransactionAndIgnoresOneAlreadyGone()
    {
        await SaveTransaction.ExecuteAsync(Spend("tx1", new DateOnly(2026, 10, 31)), CancellationToken.None);
        var deleteTransaction = new DeleteTransaction(_transactions);

        await deleteTransaction.ExecuteAsync("tx1", CancellationToken.None);
        await deleteTransaction.ExecuteAsync("tx1", CancellationToken.None);

        (await new ListTransactions(_transactions).ExecuteAsync("2026-10", CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ListReferences_ReturnCategoriesAndAccounts()
    {
        var categories = await new ListFinanceCategories(_categories).ExecuteAsync(CancellationToken.None);
        var accounts = await new ListAccounts(_accounts).ExecuteAsync(CancellationToken.None);

        (categories.Single().Id, accounts.Single().Kind).ShouldBe(("food", AccountKind.CreditCard));
    }
}
