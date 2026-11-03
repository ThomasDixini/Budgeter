using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>Port to the storage of finance categories.</summary>
public interface IFinanceCategoryRepository
{
    /// <summary>All finance categories, ordered by name.</summary>
    Task<IReadOnlyList<FinanceCategory>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The finance category with this id, or null when there is none.</summary>
    Task<FinanceCategory?> FindAsync(string id, CancellationToken cancellationToken);
}
