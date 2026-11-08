using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Infrastructure.Quotes;

/// <summary>A source that publishes nothing, for when fetching quotes is switched off (<c>Quotes:Enabled=false</c>).</summary>
public sealed class NoQuoteSource : IQuoteSource
{
    public Task<IReadOnlyList<MonthEndPrice>> FetchMonthEndsAsync(
        string symbol, DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<MonthEndPrice>>([]);

    public Task<LatestQuote?> FetchLatestAsync(string symbol, CancellationToken cancellationToken) =>
        Task.FromResult<LatestQuote?>(null);
}

/// <summary>Wires where the market quotes come from.</summary>
public static class QuotesRegistration
{
    public const string EnabledKey = "Quotes:Enabled";
    public const string BaseUrlKey = "Quotes:BaseUrl";
    public const string TokenKey = "Quotes:Token";
    private const string DefaultBaseUrl = "https://brapi.dev/";
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);

    /// <summary>
    /// Registers the brapi.dev source, with its account token from <c>Quotes:Token</c> (set it through the
    /// environment, never a file in the repository), or the empty source when <c>Quotes:Enabled</c> is false
    /// (the E2E suite does that so it never reaches the internet).
    /// </summary>
    /// <example><code>builder.Services.AddQuoteSource(builder.Configuration);</code></example>
    public static IServiceCollection AddQuoteSource(this IServiceCollection services, IConfiguration configuration)
    {
        if (!configuration.GetValue(EnabledKey, true))
        {
            return services.AddSingleton<IQuoteSource, NoQuoteSource>();
        }
        var baseUrl = configuration.GetValue(BaseUrlKey, DefaultBaseUrl)!;
        var token = configuration[TokenKey];
        services.AddHttpClient<IQuoteSource, BrapiQuoteSource>(client =>
        {
            client.BaseAddress = new Uri(baseUrl);
            client.Timeout = RequestTimeout;
            if (!string.IsNullOrWhiteSpace(token)) client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        });
        return services;
    }
}
