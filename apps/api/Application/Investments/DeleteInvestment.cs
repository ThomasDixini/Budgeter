using Orbit.Api.Domain;

namespace Orbit.Api.Application.Investments;

/// <summary>
/// Deletes an investment with no trades or proventos; deleting one already gone succeeds, so retries are
/// harmless. One with history is kept, since removing it would rewrite the portfolio's results.
/// </summary>
public sealed class DeleteInvestment(IInvestmentRepository investments)
{
    /// <summary>
    /// Validates the id, checks the investment has no history and removes it if it exists.
    /// </summary>
    /// <example><code>await deleteInvestment.ExecuteAsync("petr4", ct);</code></example>
    public async Task ExecuteAsync(string investmentId, CancellationToken cancellationToken)
    {
        var id = EntityId.Require(investmentId, "investment id");
        if (await investments.HasActivityAsync(id, cancellationToken))
        {
            throw new ConflictException(
                $"Expected investment \"{id}\" to have no trades or proventos before deleting it, found some");
        }
        await investments.DeleteAsync(id, cancellationToken);
    }
}
