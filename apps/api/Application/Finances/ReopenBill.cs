using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>Undoes a settlement: the bill is open again and the transaction it created is removed.</summary>
public sealed class ReopenBill(IBillRepository bills, DeleteTransaction deleteTransaction, IUnitOfWork unitOfWork)
{
    /// <summary>
    /// Reopens the bill; reopening one that is already open succeeds, so retries are harmless.
    /// </summary>
    /// <example><code>var open = await reopenBill.ExecuteAsync("b1", ct);</code></example>
    public async Task<Bill> ExecuteAsync(string billId, CancellationToken cancellationToken)
    {
        var bill = await bills.FindAsync(billId, cancellationToken)
            ?? throw ResourceNotFoundException.For("bill", billId);
        var reopened = bill.Reopen();
        await unitOfWork.RunAsync(() => StoreAsync(reopened, cancellationToken), cancellationToken);
        return reopened;
    }

    private async Task StoreAsync(Bill reopened, CancellationToken cancellationToken)
    {
        await deleteTransaction.ExecuteAsync(reopened.Id, cancellationToken);
        await bills.SaveAsync(reopened, cancellationToken);
    }
}
