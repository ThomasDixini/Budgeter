using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Application.Investments;

/// <summary>Port to the stored daily CDI rates, kept so they are fetched from the outside only once.</summary>
public interface ICdiRateStore
{
    /// <summary>The stored rates dated on or after <paramref name="from"/>, oldest first.</summary>
    Task<IReadOnlyList<CdiRate>> ListFromAsync(DateOnly from, CancellationToken cancellationToken);

    /// <summary>The first and last day with a stored rate; null when there are none.</summary>
    Task<(DateOnly First, DateOnly Last)?> CoverageAsync(CancellationToken cancellationToken);

    /// <summary>Stores the rates; one for a day already stored is ignored.</summary>
    Task SaveAsync(IReadOnlyList<CdiRate> rates, CancellationToken cancellationToken);
}

/// <summary>Port to wherever the daily CDI rates are published (the Central Bank).</summary>
public interface ICdiRateSource
{
    /// <summary>The daily rates published from <paramref name="from"/> to <paramref name="to"/>, both included.</summary>
    Task<IReadOnlyList<CdiRate>> FetchAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);
}
