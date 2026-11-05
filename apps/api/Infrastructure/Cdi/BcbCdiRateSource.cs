using System.Globalization;
using System.Text.Json;
using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Infrastructure.Cdi;

/// <summary>
/// The daily CDI rate (series 12 of the Central Bank's time-series system, free and keyless). The service
/// answers at most ten years per request, so a longer span is read in windows.
/// </summary>
public sealed class BcbCdiRateSource(HttpClient client) : ICdiRateSource
{
    private const int MaxYearsPerRequest = 10;
    private const string DateFormat = "dd/MM/yyyy";

    public async Task<IReadOnlyList<CdiRate>> FetchAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var rates = new List<CdiRate>();
        for (var start = from; start <= to; start = start.AddYears(MaxYearsPerRequest))
        {
            var end = Earliest(start.AddYears(MaxYearsPerRequest).AddDays(-1), to);
            rates.AddRange(await FetchWindowAsync(start, end, cancellationToken));
        }
        return rates;
    }

    private async Task<IReadOnlyList<CdiRate>> FetchWindowAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var url = $"dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial={Text(from)}&dataFinal={Text(to)}";
        using var response = await client.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
        return ParseRates(await JsonDocument.ParseAsync(body, cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Reads the service's answer: a list of <c>{"data": "02/01/2026", "valor": "0.054266"}</c>.
    /// </summary>
    /// <example><code>BcbCdiRateSource.ParseRates(JsonDocument.Parse("[{\"data\":\"02/01/2026\",\"valor\":\"0.05\"}]"));</code></example>
    public static IReadOnlyList<CdiRate> ParseRates(JsonDocument answer)
    {
        if (answer.RootElement.ValueKind != JsonValueKind.Array)
        {
            throw new FormatException($"Expected the CDI answer to be a list of daily rates, received {answer.RootElement.ValueKind}");
        }
        return answer.RootElement.EnumerateArray().Select(ParseRate).ToList();
    }

    private static CdiRate ParseRate(JsonElement item)
    {
        var day = DateOnly.ParseExact(item.GetProperty("data").GetString()!, DateFormat, CultureInfo.InvariantCulture);
        var percent = decimal.Parse(item.GetProperty("valor").GetString()!, CultureInfo.InvariantCulture);
        return new CdiRate(day, percent);
    }

    private static DateOnly Earliest(DateOnly first, DateOnly second) => first < second ? first : second;

    private static string Text(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
