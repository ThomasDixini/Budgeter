using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>Port to the storage of finance categories.</summary>
public interface IFinanceCategoryRepository
{
    /// <summary>All finance categories, ordered by name.</summary>
    Task<IReadOnlyList<FinanceCategory>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The finance category with this id, or null when there is none.</summary>
    Task<FinanceCategory?> FindAsync(string id, CancellationToken cancellationToken);

    /// <summary>Stores the category, replacing a stored one with the same id.</summary>
    Task SaveAsync(FinanceCategory category, CancellationToken cancellationToken);

    /// <summary>Removes the category and its place in the income split; an unknown id is ignored.</summary>
    Task DeleteAsync(string categoryId, CancellationToken cancellationToken);
}
