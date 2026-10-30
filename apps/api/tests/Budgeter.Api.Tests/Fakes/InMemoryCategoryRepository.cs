using Budgeter.Api.Application.Categories;
using Budgeter.Api.Domain.Categories;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Category storage kept in a list, for use case tests.</summary>
internal sealed class InMemoryCategoryRepository : ICategoryRepository
{
    private readonly List<Category> _categories = [];

    public int AddCount { get; private set; }

    public InMemoryCategoryRepository(params Category[] categories)
    {
        _categories.AddRange(categories);
    }

    public Task<IReadOnlyList<Category>> ListAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<Category>>(_categories.ToList());
    }

    public Task<Category?> FindAsync(string id, CancellationToken cancellationToken)
    {
        return Task.FromResult(_categories.Find(category => category.Id == id));
    }

    public Task AddAsync(Category category, CancellationToken cancellationToken)
    {
        _categories.Add(category);
        AddCount++;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(Category category, CancellationToken cancellationToken)
    {
        _categories[_categories.FindIndex(current => current.Id == category.Id)] = category;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        _categories.RemoveAll(category => category.Id == id);
        return Task.CompletedTask;
    }
}
