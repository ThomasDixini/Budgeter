using Orbit.Api.Application;
using Orbit.Api.Application.Finances;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class AccountUseCaseTests
{
    private static readonly CardTermsCommand Terms = new(500000, ClosingDay: 3, DueDay: 10);
    private static readonly DateOnly November2 = new(2026, 11, 2);

    private readonly InMemoryAccountRepository _accounts = new();
    private readonly InMemoryMoneyTransactionRepository _transactions = new();
    private readonly InMemoryCardPaymentRepository _payments = new();

    private SaveAccount SaveAccount => new(_accounts);
    private DeleteAccount DeleteAccount => new(_accounts, _transactions, _payments);
    private ListAccountStatements ListStatements => new(_accounts, _transactions, _payments);

    private static SaveAccountCommand Checking(long openingBalanceCents = 0) =>
        new("checking-account", "Checking account", AccountKind.BankAccount, openingBalanceCents, Card: null);

    private static SaveAccountCommand Visa() => new("visa", "Visa", AccountKind.CreditCard, 0, Terms);

    private Task SpendAsync(string accountId, DateOnly date, long amountCents) =>
        _transactions.SaveAsync(
            MoneyTransaction.Create(Guid.NewGuid().ToString(), date, "Purchase", "food", accountId, amountCents),
            CancellationToken.None);

    [Fact]
    public async Task Save_StoresANewAccountAndReplacesItOnTheNextSave()
    {
        await SaveAccount.ExecuteAsync(Checking(), CancellationToken.None);
        await SaveAccount.ExecuteAsync(Checking(openingBalanceCents: 120000) with { Name = "Main" }, CancellationToken.None);

        var stored = (await _accounts.ListAsync(CancellationToken.None)).Single();
        (stored.Name, stored.OpeningBalanceCents).ShouldBe(("Main", 120000L));
    }

    [Fact]
    public async Task Save_StoresTheCardTerms()
    {
        var card = await SaveAccount.ExecuteAsync(Visa(), CancellationToken.None);

        card.Card.ShouldBe(CardTerms.Create(500000, 3, 10));
    }

    [Fact]
    public async Task Save_RefusesToTurnABankAccountIntoACard()
    {
        await SaveAccount.ExecuteAsync(Checking(), CancellationToken.None);
        var asCard = new SaveAccountCommand("checking-account", "Checking account", AccountKind.CreditCard, 0, Terms);

        var exception = await Should.ThrowAsync<ConflictException>(() => SaveAccount.ExecuteAsync(asCard, CancellationToken.None));

        exception.Message.ShouldContain("BankAccount");
    }

    [Fact]
    public async Task Save_RejectsACardWithoutTerms()
    {
        await Should.ThrowAsync<DomainRuleException>(() =>
            SaveAccount.ExecuteAsync(Visa() with { Card = null }, CancellationToken.None));
    }

    [Fact]
    public async Task Delete_RemovesAnUnusedAccountAndIgnoresOneAlreadyGone()
    {
        await SaveAccount.ExecuteAsync(Checking(), CancellationToken.None);

        await DeleteAccount.ExecuteAsync("checking-account", CancellationToken.None);
        await DeleteAccount.ExecuteAsync("checking-account", CancellationToken.None);

        (await _accounts.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Delete_KeepsAnAccountWithTransactions()
    {
        await SaveAccount.ExecuteAsync(Checking(), CancellationToken.None);
        await SpendAsync("checking-account", November2, -1000);

        await Should.ThrowAsync<ConflictException>(() => DeleteAccount.ExecuteAsync("checking-account", CancellationToken.None));
    }

    [Fact]
    public async Task Delete_KeepsACardWithPayments()
    {
        await SaveAccount.ExecuteAsync(Checking(), CancellationToken.None);
        var visa = await SaveAccount.ExecuteAsync(Visa(), CancellationToken.None);
        var checking = (await _accounts.FindAsync("checking-account", CancellationToken.None))!;
        await _payments.SaveAsync(CardPayment.Create("p1", visa, checking, November2, 1000), CancellationToken.None);

        await Should.ThrowAsync<ConflictException>(() => DeleteAccount.ExecuteAsync("visa", CancellationToken.None));
    }

    [Fact]
    public async Task Statements_CountOnlyWhatIsDatedUpToTheDay()
    {
        await SaveAccount.ExecuteAsync(Checking(openingBalanceCents: 100000), CancellationToken.None);
        await SpendAsync("checking-account", November2, -1000);
        await SpendAsync("checking-account", November2.AddDays(1), -5000);

        var statement = (await ListStatements.ExecuteAsync(November2, CancellationToken.None)).Single();

        (statement.BalanceCents, statement.Card).ShouldBe((99000L, null));
    }

    [Fact]
    public async Task Statements_SplitACardsSpendingBetweenItsOpenAndClosedInvoices()
    {
        await SaveAccount.ExecuteAsync(Visa(), CancellationToken.None);
        await SpendAsync("visa", new DateOnly(2026, 10, 2), -30000);
        await SpendAsync("visa", new DateOnly(2026, 10, 3), -20000);

        var card = (await ListStatements.ExecuteAsync(November2, CancellationToken.None)).Single().Card!;

        (card.OpenInvoice.AmountCents, card.ClosedInvoice.AmountCents, card.AmountDueCents).ShouldBe((20000L, 30000L, 30000L));
    }

    [Fact]
    public async Task Statements_APaymentLowersTheBankBalanceAndWhatTheCardOwes()
    {
        var checking = await SaveAccount.ExecuteAsync(Checking(openingBalanceCents: 100000), CancellationToken.None);
        var visa = await SaveAccount.ExecuteAsync(Visa(), CancellationToken.None);
        await SpendAsync("visa", new DateOnly(2026, 10, 2), -30000);
        await _payments.SaveAsync(CardPayment.Create("p1", visa, checking, November2, 30000), CancellationToken.None);

        var statements = await ListStatements.ExecuteAsync(November2, CancellationToken.None);

        statements.Select(statement => statement.BalanceCents).ShouldBe([70000L, 0L]);
    }
}
