using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Finance category storage kept in a list, for use case tests.</summary>
internal sealed class InMemoryFinanceCategoryRepository(params FinanceCategory[] categories) : IFinanceCategoryRepository
{
    private readonly List<FinanceCategory> _categories = [.. categories];

    public Task<IReadOnlyList<FinanceCategory>> ListAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<FinanceCategory>>(_categories.OrderBy(category => category.Name).ToList());
    }

    public Task<FinanceCategory?> FindAsync(string id, CancellationToken cancellationToken)
    {
        return Task.FromResult(_categories.Find(category => category.Id == id));
    }

    public Task SaveAsync(FinanceCategory category, CancellationToken cancellationToken)
    {
        var index = _categories.FindIndex(stored => stored.Id == category.Id);
        if (index < 0) _categories.Add(category);
        else _categories[index] = category;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string categoryId, CancellationToken cancellationToken)
    {
        _categories.RemoveAll(category => category.Id == categoryId);
        return Task.CompletedTask;
    }
}
