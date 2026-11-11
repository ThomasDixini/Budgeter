using Orbit.Api.Domain;

namespace Orbit.Api.Application.Finances;

/// <summary>Deletes one sinking fund; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteSinkingFund(ISinkingFundRepository funds)
{
    /// <summary>
    /// Validates the id and removes the fund if it exists. Bills it already created stay.
    /// </summary>
    /// <example><code>await deleteSinkingFund.ExecuteAsync("f1", ct);</code></example>
    public Task ExecuteAsync(string id, CancellationToken cancellationToken)
    {
        return funds.DeleteAsync(EntityId.Require(id, "sinking fund id"), cancellationToken);
    }
}
