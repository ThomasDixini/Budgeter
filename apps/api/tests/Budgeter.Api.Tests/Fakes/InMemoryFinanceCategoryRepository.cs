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
}
