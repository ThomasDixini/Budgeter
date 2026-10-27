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
}
