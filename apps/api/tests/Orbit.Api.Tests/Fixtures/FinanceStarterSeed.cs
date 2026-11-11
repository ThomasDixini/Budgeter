using Orbit.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Test fixture: a handful of finance categories and the two accounts specs need to record transactions,
/// bills and payments. The app itself starts every account empty.
/// </summary>
internal static class FinanceStarterSeed
{
    /// <summary>The fixture card's terms (R$ 5,000.00, closing on the 3rd, due on the 10th).</summary>
    public static readonly CardTerms CardTerms = SqliteMigrations.StarterCardTerms;

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
    /// Inserts the fixture set for a user; rows that already exist are kept.
    /// </summary>
    /// <example><code>await FinanceStarterSeed.ApplyAsync(connection, userId, ct);</code></example>
    public static async Task ApplyAsync(SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        foreach (var (id, name) in Categories)
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                "INSERT OR IGNORE INTO finance_categories (user_id, id, name) VALUES ($user, $id, $name)",
                cancellationToken,
                ("$user", userId), ("$id", id), ("$name", name));
        }
        foreach (var account in Accounts)
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                $"INSERT OR IGNORE INTO accounts {SqliteAccountRepository.InsertColumns}",
                cancellationToken,
                SqliteAccountRepository.ParametersOf(account, userId));
        }
    }

    /// <summary>Gives the user of the factory the fixture set.</summary>
    /// <example><code>await FinanceStarterSeed.ApplyAsync(connections);</code></example>
    public static async Task ApplyAsync(SqliteConnectionFactory connections)
    {
        await using var connection = await connections.OpenAsync(CancellationToken.None);
        await ApplyAsync(connection, connections.UserId, CancellationToken.None);
    }
}
