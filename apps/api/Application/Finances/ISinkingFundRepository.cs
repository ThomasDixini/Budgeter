using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>Port to the storage of sinking funds.</summary>
public interface ISinkingFundRepository
{
    /// <summary>The sinking fund with this id, or null when there is none.</summary>
    Task<SinkingFund?> FindAsync(string id, CancellationToken cancellationToken);

    /// <summary>Every sinking fund, the next due date first and then by description.</summary>
    Task<IReadOnlyList<SinkingFund>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The sinking funds whose next due date is on or before the day.</summary>
    Task<IReadOnlyList<SinkingFund>> ListDueOnOrBeforeAsync(DateOnly day, CancellationToken cancellationToken);

    /// <summary>Stores the sinking fund, replacing a stored one with the same id.</summary>
    Task SaveAsync(SinkingFund fund, CancellationToken cancellationToken);

    /// <summary>Removes the sinking fund; an unknown id is ignored.</summary>
    Task DeleteAsync(string id, CancellationToken cancellationToken);

    /// <summary>Whether any sinking fund was filed under the finance category.</summary>
    Task<bool> AnyInCategoryAsync(string categoryId, CancellationToken cancellationToken);
}
