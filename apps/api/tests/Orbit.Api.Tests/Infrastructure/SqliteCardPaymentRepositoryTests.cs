using Orbit.Api.Domain.Finances;
using Orbit.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>Card payments and the sums statements read, over the starter checking account and credit card.</summary>
public sealed class SqliteCardPaymentRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly TransactionMonth November = TransactionMonth.Parse("2026-11");
    private static readonly Account Checking = Account.CreateBankAccount("checking-account", "Checking account");
    private static readonly Account Card = Account.CreateCreditCard("credit-card", "Credit card", FinanceStarterSeed.CardTerms);

    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteCardPaymentRepository _payments;
    private readonly SqliteMoneyTransactionRepository _transactions;

    public SqliteCardPaymentRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _payments = new SqliteCardPaymentRepository(_connections);
        _transactions = new SqliteMoneyTransactionRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await TestUsers.InsertAsync(connection, TestUsers.DefaultId);
        await TestUsers.InsertAsync(connection, TestUsers.OtherId);
        await FinanceStarterSeed.ApplyAsync(connection, TestUsers.DefaultId, CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static CardPayment Payment(string id, int month, int day, long amountCents = 10000) =>
        CardPayment.Create(id, Card, Checking, new DateOnly(2026, month, day), amountCents);

    [Fact]
    public async Task ListInMonth_KeepsTheMonthsPaymentsNewestFirst()
    {
        await _payments.SaveAsync(Payment("oct31", 10, 31), CancellationToken.None);
        await _payments.SaveAsync(Payment("nov01", 11, 1), CancellationToken.None);
        await _payments.SaveAsync(Payment("nov10", 11, 10), CancellationToken.None);

        var november = await _payments.ListInMonthAsync(November, CancellationToken.None);

        november.Select(payment => payment.Id).ShouldBe(["nov10", "nov01"]);
    }

    [Fact]
    public async Task Save_ReplacesAPaymentWithTheSameId()
    {
        await _payments.SaveAsync(Payment("p1", 11, 10, 10000), CancellationToken.None);

        await _payments.SaveAsync(Payment("p1", 11, 10, 25000), CancellationToken.None);

        (await _payments.ListInMonthAsync(November, CancellationToken.None)).Single().AmountCents.ShouldBe(25000);
    }

    [Fact]
    public async Task Sums_CountPaymentsBeforeTheDayOnTheirSide()
    {
        await _payments.SaveAsync(Payment("p1", 11, 1, 10000), CancellationToken.None);
        await _payments.SaveAsync(Payment("p2", 11, 10, 25000), CancellationToken.None);

        var paidFrom = await _payments.SumPaidFromAsync("checking-account", new DateOnly(2026, 11, 10), CancellationToken.None);
        var paidTo = await _payments.SumPaidToAsync("credit-card", new DateOnly(2026, 11, 11), CancellationToken.None);
        var paidToChecking = await _payments.SumPaidToAsync("checking-account", new DateOnly(2026, 11, 11), CancellationToken.None);

        (paidFrom, paidTo, paidToChecking).ShouldBe((10000L, 35000L, 0L));
    }

    [Fact]
    public async Task AnyForAccount_SeesBothTheCardAndTheAccountPaidFrom()
    {
        await _payments.SaveAsync(Payment("p1", 11, 1), CancellationToken.None);
        await _payments.DeleteAsync("missing", CancellationToken.None);

        var card = await _payments.AnyForAccountAsync("credit-card", CancellationToken.None);
        var checking = await _payments.AnyForAccountAsync("checking-account", CancellationToken.None);
        await _payments.DeleteAsync("p1", CancellationToken.None);
        var afterDelete = await _payments.AnyForAccountAsync("credit-card", CancellationToken.None);

        (card, checking, afterDelete).ShouldBe((true, true, false));
    }

    [Fact]
    public async Task Save_RefusesAnAccountThatIsNotStored()
    {
        var wallet = Account.CreateBankAccount("wallet", "Wallet");

        await Should.ThrowAsync<SqliteException>(() =>
            _payments.SaveAsync(CardPayment.Create("p1", Card, wallet, new DateOnly(2026, 11, 1), 100), CancellationToken.None));
    }

    [Fact]
    public async Task TransactionSum_CountsTheAccountsTransactionsInTheRange()
    {
        await SaveTransactionAsync("oct31", new DateOnly(2026, 10, 31), -1000);
        await SaveTransactionAsync("nov01", new DateOnly(2026, 11, 1), -2000);
        await SaveTransactionAsync("nov30", new DateOnly(2026, 11, 30), 5000);

        var november = await _transactions.SumAsync("credit-card", November.FirstDay, November.NextFirstDay, CancellationToken.None);
        var checking = await _transactions.SumAsync("checking-account", DateOnly.MinValue, November.NextFirstDay, CancellationToken.None);

        (november, checking).ShouldBe((3000L, 0L));
    }

    [Fact]
    public async Task TransactionAny_SeesOnlyTheAccountUsed()
    {
        await SaveTransactionAsync("tx1", new DateOnly(2026, 11, 1), -2000);

        var card = await _transactions.AnyOnAccountAsync("credit-card", CancellationToken.None);
        var checking = await _transactions.AnyOnAccountAsync("checking-account", CancellationToken.None);

        (card, checking).ShouldBe((true, false));
    }

    private Task SaveTransactionAsync(string id, DateOnly date, long amountCents) =>
        _transactions.SaveAsync(
            MoneyTransaction.Create(id, date, "Purchase", "food", "credit-card", amountCents), CancellationToken.None);

    private async Task<SqliteCardPaymentRepository> OtherUsersPaymentsAsync()
    {
        var others = TestUsers.FactoryFor(_database, TestUsers.OtherId);
        await FinanceStarterSeed.ApplyAsync(others);
        return new SqliteCardPaymentRepository(others);
    }

    [Fact]
    public async Task TwoUsers_StoreTheSamePaymentIdWithoutSeeingEachOther()
    {
        var others = await OtherUsersPaymentsAsync();
        await _payments.SaveAsync(Payment("p1", 11, 1, 10000), CancellationToken.None);
        await others.SaveAsync(Payment("p1", 11, 1, 99000), CancellationToken.None);

        var mine = await _payments.ListInMonthAsync(November, CancellationToken.None);
        var theirs = await others.ListInMonthAsync(November, CancellationToken.None);

        (mine.Single().AmountCents, theirs.Single().AmountCents).ShouldBe((10000L, 99000L));
    }

    [Fact]
    public async Task Sums_CountOnlyTheSignedInUsersPayments()
    {
        var others = await OtherUsersPaymentsAsync();
        await _payments.SaveAsync(Payment("p1", 11, 1, 10000), CancellationToken.None);
        await others.SaveAsync(Payment("p2", 11, 1, 99000), CancellationToken.None);

        var paidFrom = await _payments.SumPaidFromAsync("checking-account", new DateOnly(2026, 12, 1), CancellationToken.None);
        var paidTo = await _payments.SumPaidToAsync("credit-card", new DateOnly(2026, 12, 1), CancellationToken.None);

        (paidFrom, paidTo).ShouldBe((10000L, 10000L));
    }

    [Fact]
    public async Task AnyForAccount_IgnoresAnotherUsersPayments()
    {
        var others = await OtherUsersPaymentsAsync();
        await others.SaveAsync(Payment("p1", 11, 1), CancellationToken.None);

        (await _payments.AnyForAccountAsync("credit-card", CancellationToken.None)).ShouldBeFalse();
    }

    [Fact]
    public async Task Delete_NeverRemovesAnotherUsersPayment()
    {
        var others = await OtherUsersPaymentsAsync();
        await others.SaveAsync(Payment("p1", 11, 1), CancellationToken.None);

        await _payments.DeleteAsync("p1", CancellationToken.None);

        (await others.ListInMonthAsync(November, CancellationToken.None)).Count.ShouldBe(1);
    }
}
