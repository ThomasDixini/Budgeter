using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>How a new bill repeats: the kind of recurrence and the total number of occurrences.</summary>
public sealed record BillRecurrenceCommand(BillRecurrence Kind, int Count);

public sealed record SaveBillCommand(
    string Id, BillKind Kind, string Description, string CategoryId, long AmountCents,
    DateOnly DueDate, BillRecurrenceCommand? Recurrence);

/// <summary>
/// Creates a bill (every occurrence of it, when it repeats) or replaces an open one; saving the same
/// request twice leaves the same state.
/// </summary>
public sealed class SaveBill(IBillRepository bills, IFinanceCategoryRepository categories, IUnitOfWork unitOfWork)
{
    /// <summary>
    /// Checks the category exists, then stores the new bill with its occurrences, or the edit of the stored
    /// one (an edit changes that occurrence only, and ignores any recurrence sent with it).
    /// </summary>
    /// <example><code>await saveBill.ExecuteAsync(new SaveBillCommand("b1", BillKind.Payable, "Rent", "housing", 150000, due, new(BillRecurrence.Monthly, 12)), ct);</code></example>
    public async Task<IReadOnlyList<Bill>> ExecuteAsync(SaveBillCommand command, CancellationToken cancellationToken)
    {
        var stored = await bills.FindAsync(command.Id, cancellationToken);
        var toSave = stored is null ? NewBills(command) : [Edited(command, stored)];
        if ((await categories.FindAsync(command.CategoryId, cancellationToken)) is null)
        {
            throw ResourceNotFoundException.For("finance category", command.CategoryId);
        }
        await unitOfWork.RunAsync(() => SaveAllAsync(toSave, cancellationToken), cancellationToken);
        return toSave;
    }

    private static IReadOnlyList<Bill> NewBills(SaveBillCommand command)
    {
        if (command.Recurrence is { } recurrence)
        {
            return BillSchedule.Occurrences(
                command.Id, command.Kind, command.Description, command.CategoryId, command.AmountCents,
                command.DueDate, recurrence.Kind, recurrence.Count);
        }
        return [Bill.Create(command.Id, command.Kind, command.Description, command.CategoryId, command.AmountCents, command.DueDate)];
    }

    private static Bill Edited(SaveBillCommand command, Bill stored)
    {
        if (stored.IsSettled)
        {
            throw new ConflictException(
                $"Expected bill \"{stored.Id}\" to be open to edit it, found it settled on {stored.Settlement!.Date:yyyy-MM-dd}");
        }
        return Bill.Create(
            command.Id, command.Kind, command.Description, command.CategoryId, command.AmountCents,
            command.DueDate, stored.Series);
    }

    private async Task SaveAllAsync(IReadOnlyList<Bill> toSave, CancellationToken cancellationToken)
    {
        foreach (var bill in toSave) await bills.SaveAsync(bill, cancellationToken);
    }
}
