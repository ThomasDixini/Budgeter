using System.Globalization;
using System.Net;
using System.Text.Json;
using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Infrastructure.Quotes;

/// <summary>
/// Closing prices of B3 symbols from brapi.dev. It asks for the daily history and keeps the last close of
/// each month. The free plan answers at most 90 days per request (however far back they are), so a longer
/// span is read in windows of that size, one after the other. Requests carry the account token
/// (<c>Quotes:Token</c>) as a bearer header; without one only a few sample symbols answer.
/// </summary>
public sealed class BrapiQuoteSource(HttpClient client) : IQuoteSource
{
    private const int CentsPerReal = 100;
    private const int MaxDaysPerRequest = 90;
    private const string DateFormat = "yyyy-MM-dd";

    public async Task<IReadOnlyList<MonthEndPrice>> FetchMonthEndsAsync(
        string symbol, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var days = new List<(DateOnly Day, long Cents)>();
        for (var start = from; start <= to; start = start.AddDays(MaxDaysPerRequest + 1))
        {
            var end = Earliest(start.AddDays(MaxDaysPerRequest), to);
            days.AddRange(await FetchWindowAsync(symbol, start, end, cancellationToken));
        }
        return LastCloseOfEachMonth(symbol, days);
    }

    public async Task<LatestQuote?> FetchLatestAsync(string symbol, CancellationToken cancellationToken)
    {
        using var response = await client.GetAsync($"api/quote/{Uri.EscapeDataString(symbol)}", cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
        return ParseLatest(symbol, await JsonDocument.ParseAsync(body, cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Reads <c>results[0]</c> of a quote answer: <c>regularMarketPrice</c> and the ISO <c>regularMarketTime</c>.
    /// An answer for another symbol, or without a positive price, has no quote.
    /// </summary>
    /// <example><code>BrapiQuoteSource.ParseLatest("TOTS3", JsonDocument.Parse(answer))?.Cents; // 3314</code></example>
    public static LatestQuote? ParseLatest(string symbol, JsonDocument answer)
    {
        if (!answer.RootElement.TryGetProperty("results", out var results) || results.GetArrayLength() == 0) return null;
        var result = results[0];
        if (!IsFor(symbol, result) || !TryCents(result, "regularMarketPrice", out var cents)) return null;
        if (!result.TryGetProperty("regularMarketTime", out var time) || time.ValueKind != JsonValueKind.String) return null;
        var day = DateOnly.FromDateTime(DateTimeOffset.Parse(time.GetString()!, CultureInfo.InvariantCulture).UtcDateTime);
        return new LatestQuote(symbol, cents, day);
    }

    private static bool TryCents(JsonElement result, string property, out long cents)
    {
        cents = 0;
        if (!result.TryGetProperty(property, out var price) || price.ValueKind != JsonValueKind.Number) return false;
        cents = (long)Math.Round(price.GetDecimal() * CentsPerReal, MidpointRounding.AwayFromZero);
        return cents > 0;
    }

    private async Task<IReadOnlyList<(DateOnly Day, long Cents)>> FetchWindowAsync(
        string symbol, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var url = $"api/quote/{Uri.EscapeDataString(symbol)}?interval=1d&startDate={Text(from)}&endDate={Text(to)}";
        using var response = await client.GetAsync(url, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound) return [];
        response.EnsureSuccessStatusCode();
        await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
        return ParseDays(symbol, await JsonDocument.ParseAsync(body, cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Reads the service's answer: <c>results[0].historicalDataPrice</c>, one item per trading day with a
    /// Unix-seconds <c>date</c> and a <c>close</c>. Days without a close are skipped, and so is an answer
    /// for another symbol (brapi may answer a renamed ticker with its successor).
    /// </summary>
    /// <example><code>BrapiQuoteSource.ParseDays("PETR4", JsonDocument.Parse(answer))[0].Cents; // 3845</code></example>
    public static IReadOnlyList<(DateOnly Day, long Cents)> ParseDays(string symbol, JsonDocument answer)
    {
        if (!answer.RootElement.TryGetProperty("results", out var results) || results.GetArrayLength() == 0) return [];
        var result = results[0];
        if (!IsFor(symbol, result) || !result.TryGetProperty("historicalDataPrice", out var days)) return [];
        return days.EnumerateArray().Select(ToDay).OfType<(DateOnly Day, long Cents)>().ToList();
    }

    private static bool IsFor(string symbol, JsonElement result) =>
        result.TryGetProperty("symbol", out var answered)
        && string.Equals(answered.GetString(), symbol, StringComparison.OrdinalIgnoreCase);

    private static (DateOnly Day, long Cents)? ToDay(JsonElement item)
    {
        if (!item.TryGetProperty("close", out var close) || close.ValueKind != JsonValueKind.Number) return null;
        var cents = (long)Math.Round(close.GetDecimal() * CentsPerReal, MidpointRounding.AwayFromZero);
        if (cents <= 0) return null;
        // brapi stamps a day at its start in Brazil (03:00 UTC); the UTC date is that same day.
        var day = DateOnly.FromDateTime(DateTimeOffset.FromUnixTimeSeconds(item.GetProperty("date").GetInt64()).UtcDateTime);
        return (day, cents);
    }

    private static IReadOnlyList<MonthEndPrice> LastCloseOfEachMonth(string symbol, IEnumerable<(DateOnly Day, long Cents)> days) =>
        days.GroupBy(day => $"{day.Day.Year:0000}-{day.Day.Month:00}")
            .Select(month => new MonthEndPrice(symbol, month.Key, month.MaxBy(day => day.Day).Cents))
            .OrderBy(price => price.Month, StringComparer.Ordinal)
            .ToList();

    private static DateOnly Earliest(DateOnly first, DateOnly second) => first < second ? first : second;

    private static string Text(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
