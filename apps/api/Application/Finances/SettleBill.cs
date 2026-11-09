using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

public sealed record SettleBillCommand(string BillId, DateOnly Date, string AccountId);

/// <summary>
/// Marks a bill paid or received and records the money movement as a transaction with the bill's own id,
/// so settling twice the same way leaves a single transaction.
/// </summary>
public sealed class SettleBill(IBillRepository bills, SaveTransaction saveTransaction, IUnitOfWork unitOfWork)
{
    /// <summary>
    /// Settles the bill through the account on the day: a payable becomes an expense there, a receivable
    /// income. Both writes happen together or not at all.
    /// </summary>
    /// <example><code>var paid = await settleBill.ExecuteAsync(new SettleBillCommand("b1", today, "checking-account"), ct);</code></example>
    public async Task<Bill> ExecuteAsync(SettleBillCommand command, CancellationToken cancellationToken)
    {
        var bill = await bills.FindAsync(command.BillId, cancellationToken)
            ?? throw ResourceNotFoundException.For("bill", command.BillId);
        var settled = bill.Settle(command.Date, command.AccountId);
        await unitOfWork.RunAsync(() => StoreAsync(settled, cancellationToken), cancellationToken);
        return settled;
    }

    private async Task StoreAsync(Bill settled, CancellationToken cancellationToken)
    {
        var settlement = settled.Settlement!;
        await saveTransaction.ExecuteAsync(
            new SaveTransactionCommand(
                settled.Id, settlement.Date, settled.Description, settled.CategoryId,
                settlement.AccountId, settled.SignedAmountCents),
            cancellationToken);
        await bills.SaveAsync(settled, cancellationToken);
    }
}
