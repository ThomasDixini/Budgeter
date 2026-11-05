using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Infrastructure.Cdi;

/// <summary>A source that publishes nothing, for when fetching the CDI is switched off (<c>Cdi:Enabled=false</c>).</summary>
public sealed class NoCdiRateSource : ICdiRateSource
{
    public Task<IReadOnlyList<CdiRate>> FetchAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CdiRate>>([]);
}

/// <summary>Wires where the daily CDI rates come from.</summary>
public static class CdiRegistration
{
    public const string EnabledKey = "Cdi:Enabled";
    public const string BaseUrlKey = "Cdi:BaseUrl";
    private const string DefaultBaseUrl = "https://api.bcb.gov.br/";
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);

    /// <summary>
    /// Registers the Central Bank source, or the empty one when <c>Cdi:Enabled</c> is false (the E2E suite
    /// does that so it never reaches the internet).
    /// </summary>
    /// <example><code>builder.Services.AddCdiRateSource(builder.Configuration);</code></example>
    public static IServiceCollection AddCdiRateSource(this IServiceCollection services, IConfiguration configuration)
    {
        if (!configuration.GetValue(EnabledKey, true))
        {
            return services.AddSingleton<ICdiRateSource, NoCdiRateSource>();
        }
        var baseUrl = configuration.GetValue(BaseUrlKey, DefaultBaseUrl)!;
        services.AddHttpClient<ICdiRateSource, BcbCdiRateSource>(client =>
        {
            client.BaseAddress = new Uri(baseUrl);
            client.Timeout = RequestTimeout;
        });
        return services;
    }
}
