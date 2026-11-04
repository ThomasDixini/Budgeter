using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>Lists every finance category, ordered by name.</summary>
public sealed class ListFinanceCategories(IFinanceCategoryRepository categories)
{
    /// <summary>
    /// Returns all finance categories, for the transaction form and the category chips.
    /// </summary>
    /// <example><code>var all = await listFinanceCategories.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<FinanceCategory>> ExecuteAsync(CancellationToken cancellationToken)
    {
        return categories.ListAsync(cancellationToken);
    }
}
