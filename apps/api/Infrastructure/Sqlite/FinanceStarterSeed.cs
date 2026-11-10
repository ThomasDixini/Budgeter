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
    /// Inserts the starter set for a user who never got it and records that it did, so a starter
    /// item the user deletes later never comes back.
    /// </summary>
    /// <example><code>await FinanceStarterSeed.ApplyOnceAsync(connection, userId, ct);</code></example>
    public static async Task ApplyOnceAsync(SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        await using var transaction = connection.BeginTransaction(deferred: false);
        if (await IsMarkedAsync(connection, userId, cancellationToken)) return;
        await InsertCategoriesAsync(connection, userId, cancellationToken);
        await InsertAccountsAsync(connection, userId, cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, "INSERT INTO finance_seed (user_id) VALUES ($user)", cancellationToken, ("$user", userId));
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task<bool> IsMarkedAsync(
        SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection,
            "SELECT COUNT(*) FROM finance_seed WHERE user_id = $user",
            reader => reader.GetInt64(0),
            cancellationToken,
            ("$user", userId));
        return counts[0] > 0;
    }

    private static async Task InsertCategoriesAsync(
        SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        foreach (var (id, name) in Categories)
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                "INSERT OR IGNORE INTO finance_categories (user_id, id, name) VALUES ($user, $id, $name)",
                cancellationToken,
                ("$user", userId), ("$id", id), ("$name", name));
        }
    }

    private static async Task InsertAccountsAsync(
        SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        foreach (var account in Accounts)
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                $"INSERT OR IGNORE INTO accounts {SqliteAccountRepository.InsertColumns}",
                cancellationToken,
                SqliteAccountRepository.ParametersOf(account, userId));
        }
    }
}
