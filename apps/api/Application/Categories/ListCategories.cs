using Budgeter.Api.Domain.Categories;

namespace Budgeter.Api.Application.Categories;

/// <summary>Lists every category in creation order.</summary>
public sealed class ListCategories(ICategoryRepository categories)
{
    /// <summary>
    /// Returns all categories.
    /// </summary>
    /// <example><code>var all = await listCategories.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<Category>> ExecuteAsync(CancellationToken cancellationToken)
    {
        return categories.ListAsync(cancellationToken);
    }
}
