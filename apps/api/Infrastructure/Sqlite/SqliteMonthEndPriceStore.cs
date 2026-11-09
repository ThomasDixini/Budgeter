using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>Month-end closing prices stored in the <c>month_end_prices</c> table, one row per symbol and month.</summary>
public sealed class SqliteMonthEndPriceStore(SqliteConnectionFactory connections) : IMonthEndPriceStore
{
    public async Task<IReadOnlyList<MonthEndPrice>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT symbol, month, price_cents FROM month_end_prices ORDER BY symbol, month",
            reader => new MonthEndPrice(reader.GetString(0), reader.GetString(1), reader.GetInt64(2)),
            cancellationToken);
    }

    public async Task<string?> LastMonthAsync(string symbol, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var months = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT MAX(month) FROM month_end_prices WHERE symbol = $symbol",
            reader => reader.IsDBNull(0) ? null : reader.GetString(0),
            cancellationToken,
            ("$symbol", symbol));
        return months[0];
    }

    public async Task SaveAsync(IReadOnlyList<MonthEndPrice> prices, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        foreach (var price in prices)
        {
            await SqliteCommands.ExecuteAsync(
                lease.Connection,
                "INSERT OR IGNORE INTO month_end_prices (symbol, month, price_cents) VALUES ($symbol, $month, $cents)",
                cancellationToken,
                ("$symbol", price.Symbol), ("$month", price.Month), ("$cents", price.Cents));
        }
    }
}
