using System.Globalization;
using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Daily CDI rates stored in the <c>cdi_rates</c> table. The rate is kept as text so a decimal survives
/// the round trip exactly.
/// </summary>
public sealed class SqliteCdiRateStore(SqliteConnectionFactory connections) : ICdiRateStore
{
    private const string DateFormat = "yyyy-MM-dd";

    public async Task<IReadOnlyList<CdiRate>> ListFromAsync(DateOnly from, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT date, daily_percent FROM cdi_rates WHERE date >= $from ORDER BY date",
            ToRate,
            cancellationToken,
            ("$from", ToText(from)));
    }

    public async Task<(DateOnly First, DateOnly Last)?> CoverageAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var bounds = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT MIN(date), MAX(date) FROM cdi_rates",
            reader => reader.IsDBNull(0) ? default((DateOnly, DateOnly)?) : (ToDay(reader.GetString(0)), ToDay(reader.GetString(1))),
            cancellationToken);
        return bounds[0];
    }

    public async Task SaveAsync(IReadOnlyList<CdiRate> rates, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        foreach (var rate in rates)
        {
            await SqliteCommands.ExecuteAsync(
                lease.Connection,
                "INSERT OR IGNORE INTO cdi_rates (date, daily_percent) VALUES ($date, $percent)",
                cancellationToken,
                ("$date", ToText(rate.Date)), ("$percent", rate.DailyPercent.ToString(CultureInfo.InvariantCulture)));
        }
    }

    private static CdiRate ToRate(SqliteDataReader reader) =>
        new(ToDay(reader.GetString(0)), decimal.Parse(reader.GetString(1), CultureInfo.InvariantCulture));

    private static DateOnly ToDay(string text) => DateOnly.ParseExact(text, DateFormat, CultureInfo.InvariantCulture);

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
