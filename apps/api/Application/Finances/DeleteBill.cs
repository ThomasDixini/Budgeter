using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Finances;

/// <summary>
/// Deletes one bill; deleting one already gone succeeds, so retries are harmless. A settled bill leaves its
/// transaction behind: the money did move.
/// </summary>
public sealed class DeleteBill(IBillRepository bills)
{
    /// <summary>
    /// Validates the id and removes the bill if it exists.
    /// </summary>
    /// <example><code>await deleteBill.ExecuteAsync("b1", ct);</code></example>
    public Task ExecuteAsync(string billId, CancellationToken cancellationToken)
    {
        return bills.DeleteAsync(EntityId.Require(billId, "bill id"), cancellationToken);
    }
}
