using Budgeter.Api.Domain.Categories;

namespace Budgeter.Api.Application.Categories;

/// <summary>Port to the storage of categories.</summary>
public interface ICategoryRepository
{
    /// <summary>All categories in creation order.</summary>
    Task<IReadOnlyList<Category>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The category with this id, or null when there is none.</summary>
    Task<Category?> FindAsync(string id, CancellationToken cancellationToken);

    /// <summary>Stores a new category.</summary>
    Task AddAsync(Category category, CancellationToken cancellationToken);

    /// <summary>Replaces the name and color of the stored category with the same id.</summary>
    Task UpdateAsync(Category category, CancellationToken cancellationToken);

    /// <summary>
    /// Removes the category and its goals; blocks and tasks that used it lose their category.
    /// An unknown id is ignored.
    /// </summary>
    Task DeleteAsync(string id, CancellationToken cancellationToken);
}
