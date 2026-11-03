using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Bank accounts and credit cards stored in the <c>accounts</c> table (kind kept by name); a card's terms
/// fill the columns that stay null on a bank account.
/// </summary>
public sealed class SqliteAccountRepository(SqliteConnectionFactory connections) : IAccountRepository
{
    /// <summary>The column list and values clause shared by every insert of an account.</summary>
    internal const string InsertColumns = """
        (id, name, kind, opening_balance_cents, credit_limit_cents, closing_day, due_day)
        VALUES ($id, $name, $kind, $openingBalanceCents, $creditLimitCents, $closingDay, $dueDay)
        """;

    private const string SelectColumns =
        "SELECT id, name, kind, opening_balance_cents, credit_limit_cents, closing_day, due_day FROM accounts";

    public async Task<IReadOnlyList<Account>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection, $"{SelectColumns} ORDER BY rowid", ToAccount, cancellationToken);
    }

    public async Task<Account?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var rows = await SqliteCommands.QueryAsync(
            lease.Connection, $"{SelectColumns} WHERE id = $id", ToAccount, cancellationToken, ("$id", id));
        return rows.FirstOrDefault();
    }

    public async Task SaveAsync(Account account, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        // Not INSERT OR REPLACE: that deletes and re-inserts the row, giving it a new rowid (and a new place in the list).
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            $"""
            INSERT INTO accounts {InsertColumns}
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name, kind = excluded.kind, opening_balance_cents = excluded.opening_balance_cents,
                credit_limit_cents = excluded.credit_limit_cents, closing_day = excluded.closing_day,
                due_day = excluded.due_day
            """,
            cancellationToken,
            ParametersOf(account));
    }

    public async Task DeleteAsync(string accountId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection, "DELETE FROM accounts WHERE id = $id", cancellationToken, ("$id", accountId));
    }

    /// <summary>
    /// The values of <see cref="InsertColumns"/> for an account.
    /// </summary>
    /// <example><code>await SqliteCommands.ExecuteAsync(connection, $"INSERT INTO accounts {InsertColumns}", ct, ParametersOf(account));</code></example>
    internal static (string Name, object? Value)[] ParametersOf(Account account) =>
    [
        ("$id", account.Id), ("$name", account.Name), ("$kind", account.Kind.ToString()),
        ("$openingBalanceCents", account.OpeningBalanceCents), ("$creditLimitCents", account.Card?.LimitCents),
        ("$closingDay", account.Card?.ClosingDay), ("$dueDay", account.Card?.DueDay),
    ];

    private static Account ToAccount(SqliteDataReader reader) =>
        Account.Restore(
            reader.GetString(0),
            reader.GetString(1),
            Enum.Parse<AccountKind>(reader.GetString(2), ignoreCase: true),
            reader.GetInt64(3),
            ToCardTerms(reader));

    private static CardTerms? ToCardTerms(SqliteDataReader reader) =>
        reader.IsDBNull(4) ? null : CardTerms.Restore(reader.GetInt64(4), reader.GetInt32(5), reader.GetInt32(6));
}
