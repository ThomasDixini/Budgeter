using Budgeter.Api.Domain.Finances;
using Budgeter.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

public sealed class SqliteAccountRepositoryTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteAccountRepository _accounts;

    public SqliteAccountRepositoryTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _accounts = new SqliteAccountRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    [Fact]
    public async Task Save_RoundTripsABankAccountsOpeningBalance()
    {
        await _accounts.SaveAsync(Account.CreateBankAccount("nubank", "Nubank", -15000), CancellationToken.None);

        var stored = (await _accounts.FindAsync("nubank", CancellationToken.None))!;

        (stored.Name, stored.Kind, stored.OpeningBalanceCents, stored.Card)
            .ShouldBe(("Nubank", AccountKind.BankAccount, -15000L, null));
    }

    [Fact]
    public async Task Save_RoundTripsACardsTerms()
    {
        var terms = CardTerms.Create(1200000, closingDay: 28, dueDay: 5);
        await _accounts.SaveAsync(Account.CreateCreditCard("visa", "Visa", terms), CancellationToken.None);

        var stored = (await _accounts.FindAsync("visa", CancellationToken.None))!;

        (stored.Kind, stored.Card).ShouldBe((AccountKind.CreditCard, terms));
    }

    [Fact]
    public async Task Save_EditingAnAccountKeepsItsPlaceInTheList()
    {
        await _accounts.SaveAsync(Account.CreateBankAccount("first", "First"), CancellationToken.None);
        await _accounts.SaveAsync(Account.CreateBankAccount("second", "Second"), CancellationToken.None);

        await _accounts.SaveAsync(Account.CreateBankAccount("first", "Renamed"), CancellationToken.None);

        (await _accounts.ListAsync(CancellationToken.None)).Select(account => account.Name).ShouldBe(["Renamed", "Second"]);
    }

    [Fact]
    public async Task Delete_RemovesTheAccount()
    {
        await _accounts.SaveAsync(Account.CreateBankAccount("nubank", "Nubank"), CancellationToken.None);

        await _accounts.DeleteAsync("nubank", CancellationToken.None);

        (await _accounts.FindAsync("nubank", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task Delete_RefusesAnAccountATransactionPointsAt()
    {
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await FinanceStarterSeed.ApplyOnceAsync(connection, CancellationToken.None);
        }
        var transactions = new SqliteMoneyTransactionRepository(_connections);
        await transactions.SaveAsync(
            MoneyTransaction.Create("tx1", new DateOnly(2026, 11, 2), "Cash", "food", "checking-account", -100),
            CancellationToken.None);

        await Should.ThrowAsync<SqliteException>(() => _accounts.DeleteAsync("checking-account", CancellationToken.None));
    }
}
