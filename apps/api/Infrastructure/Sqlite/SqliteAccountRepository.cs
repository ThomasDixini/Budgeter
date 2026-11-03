using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>Bank accounts and credit cards stored in the <c>accounts</c> table (kind kept by name).</summary>
public sealed class SqliteAccountRepository(SqliteConnectionFactory connections) : IAccountRepository
{
    private const string SelectColumns = "SELECT id, name, kind FROM accounts";

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

    private static Account ToAccount(SqliteDataReader reader) =>
        Account.Restore(
            reader.GetString(0),
            reader.GetString(1),
            Enum.Parse<AccountKind>(reader.GetString(2), ignoreCase: true));
}
