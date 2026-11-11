using Orbit.Api.Application.Finances;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Tests.Fakes;

/// <summary>Sinking fund storage kept in a list, for use case tests.</summary>
internal sealed class InMemorySinkingFundRepository : ISinkingFundRepository
{
    private readonly List<SinkingFund> _funds = [];

    public Task<SinkingFund?> FindAsync(string id, CancellationToken cancellationToken)
    {
        return Task.FromResult(_funds.Find(fund => fund.Id == id));
    }

    public Task<IReadOnlyList<SinkingFund>> ListAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<SinkingFund>>(Ordered(_funds));
    }

    public Task<IReadOnlyList<SinkingFund>> ListDueOnOrBeforeAsync(DateOnly day, CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<SinkingFund>>(Ordered(_funds.Where(fund => fund.NextDueDate <= day)));
    }

    public Task SaveAsync(SinkingFund fund, CancellationToken cancellationToken)
    {
        var index = _funds.FindIndex(stored => stored.Id == fund.Id);
        if (index < 0) _funds.Add(fund);
        else _funds[index] = fund;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        _funds.RemoveAll(fund => fund.Id == id);
        return Task.CompletedTask;
    }

    public Task<bool> AnyInCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        return Task.FromResult(_funds.Exists(fund => fund.CategoryId == categoryId));
    }

    private static List<SinkingFund> Ordered(IEnumerable<SinkingFund> funds) =>
        [.. funds.OrderBy(fund => fund.NextDueDate).ThenBy(fund => fund.Description, StringComparer.Ordinal)];
}
