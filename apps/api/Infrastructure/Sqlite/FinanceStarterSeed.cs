using Orbit.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// The finance categories and accounts every database starts with, which the user can then change.
/// Tracked by its own <c>finance_seed</c> marker: <c>sample_seed</c> is already set on databases that
/// existed before Finances, which would never get these. Unlike the sample data it is not optional, since
/// a transaction cannot be recorded without a category and an account.
/// </summary>
internal static class FinanceStarterSeed
{
    /// <summary>The starter card's terms (R$ 5,000.00, closing on the 3rd, due on the 10th), until the user edits them.</summary>
    public static readonly CardTerms CardTerms = CardTerms.Create(500_000, closingDay: 3, dueDay: 10);

    private static readonly (string Id, string Name)[] Categories =
    [
        ("housing", "Housing"),
        ("food", "Food"),
        ("transport", "Transport"),
        ("health", "Health"),
        ("leisure", "Leisure"),
        ("subscriptions", "Subscriptions"),
        ("education", "Education"),
        ("salary", "Salary"),
        ("extra-income", "Extra income"),
        ("investments", "Investments"),
        ("other", "Other"),
    ];

    private static readonly Account[] Accounts =
    [
        Account.CreateBankAccount("checking-account", "Checking account"),
        Account.CreateCreditCard("credit-card", "Credit card", CardTerms),
    ];

    /// <summary>
    /// Inserts the starter set into a database that never got it and records that it did, so a starter
    /// item the user deletes later never comes back.
    /// </summary>
    /// <example><code>await FinanceStarterSeed.ApplyOnceAsync(connection, ct);</code></example>
    public static async Task ApplyOnceAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        await using var transaction = connection.BeginTransaction(deferred: false);
        if (await IsMarkedAsync(connection, cancellationToken)) return;
        await InsertCategoriesAsync(connection, cancellationToken);
        await InsertAccountsAsync(connection, cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, "INSERT INTO finance_seed (id) VALUES (1)", cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task<bool> IsMarkedAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection, "SELECT COUNT(*) FROM finance_seed", reader => reader.GetInt64(0), cancellationToken);
        return counts[0] > 0;
    }

    private static async Task InsertCategoriesAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        foreach (var (id, name) in Categories)
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                "INSERT OR IGNORE INTO finance_categories (id, name) VALUES ($id, $name)",
                cancellationToken,
                ("$id", id), ("$name", name));
        }
    }

    private static async Task InsertAccountsAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        foreach (var account in Accounts)
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                $"INSERT OR IGNORE INTO accounts {SqliteAccountRepository.InsertColumns}",
                cancellationToken,
                SqliteAccountRepository.ParametersOf(account));
        }
    }
}
