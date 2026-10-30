using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Categories;

/// <summary>
/// Deletes a category together with its goals; routine blocks and tasks that used it stay, without a
/// category. Deleting one already gone succeeds, so retries are harmless.
/// </summary>
public sealed class DeleteCategory(ICategoryRepository categories)
{
    /// <summary>
    /// Validates the id and removes the category if it exists.
    /// </summary>
    /// <example><code>await deleteCategory.ExecuteAsync("languages", ct);</code></example>
    public Task ExecuteAsync(string categoryId, CancellationToken cancellationToken)
    {
        return categories.DeleteAsync(EntityId.Require(categoryId, "category id"), cancellationToken);
    }
}
