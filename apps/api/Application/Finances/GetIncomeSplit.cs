using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>Reads the income split plan.</summary>
public sealed class GetIncomeSplit(IIncomeSplitRepository plans)
{
    /// <summary>
    /// Returns the saved plan, or an empty one before the first save.
    /// </summary>
    /// <example><code>var plan = await getIncomeSplit.ExecuteAsync(ct);</code></example>
    public Task<IncomeSplit> ExecuteAsync(CancellationToken cancellationToken)
    {
        return plans.GetAsync(cancellationToken);
    }
}
