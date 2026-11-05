using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Income split storage kept in a field, for use case tests.</summary>
internal sealed class InMemoryIncomeSplitRepository : IIncomeSplitRepository
{
    private IncomeSplit _plan = IncomeSplit.Empty;

    public Task<IncomeSplit> GetAsync(CancellationToken cancellationToken) => Task.FromResult(_plan);

    public Task ReplaceAsync(IncomeSplit plan, CancellationToken cancellationToken)
    {
        _plan = plan;
        return Task.CompletedTask;
    }
}
