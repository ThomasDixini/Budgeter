using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Finances;

/// <summary>
/// Deletes a finance category nothing was recorded under; deleting one already gone succeeds, so retries
/// are harmless. A category with transactions is kept, since removing it would change the totals of
/// months already closed. It leaves the income split on its own.
/// </summary>
public sealed class DeleteFinanceCategory(IFinanceCategoryRepository categories, IMoneyTransactionRepository transactions)
{
    /// <summary>
    /// Validates the id, checks the category is unused and removes it if it exists.
    /// </summary>
    /// <example><code>await deleteFinanceCategory.ExecuteAsync("courses", ct);</code></example>
    public async Task ExecuteAsync(string categoryId, CancellationToken cancellationToken)
    {
        var id = EntityId.Require(categoryId, "finance category id");
        if (await transactions.AnyInCategoryAsync(id, cancellationToken))
        {
            throw new ConflictException(
                $"Expected finance category \"{id}\" to have no transactions before deleting it, found some");
        }
        await categories.DeleteAsync(id, cancellationToken);
    }
}
