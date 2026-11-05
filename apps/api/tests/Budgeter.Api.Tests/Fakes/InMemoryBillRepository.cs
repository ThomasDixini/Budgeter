using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Bill storage kept in a list (in creation order), for use case tests.</summary>
internal sealed class InMemoryBillRepository : IBillRepository
{
    private readonly List<Bill> _bills = [];

    public Task<Bill?> FindAsync(string id, CancellationToken cancellationToken)
    {
        return Task.FromResult(_bills.Find(bill => bill.Id == id));
    }

    public Task<IReadOnlyList<Bill>> ListOpenDueBeforeAsync(DateOnly until, CancellationToken cancellationToken)
    {
        var open = _bills.Where(bill => !bill.IsSettled && bill.DueDate < until).OrderBy(bill => bill.DueDate);
        return Task.FromResult<IReadOnlyList<Bill>>(open.ToList());
    }

    public Task<IReadOnlyList<Bill>> ListSettledSinceAsync(DateOnly since, CancellationToken cancellationToken)
    {
        var settled = _bills
            .Where(bill => bill.Settlement is { } settlement && settlement.Date >= since)
            .OrderByDescending(bill => bill.Settlement!.Date);
        return Task.FromResult<IReadOnlyList<Bill>>(settled.ToList());
    }

    public Task SaveAsync(Bill bill, CancellationToken cancellationToken)
    {
        var index = _bills.FindIndex(stored => stored.Id == bill.Id);
        if (index < 0) _bills.Add(bill);
        else _bills[index] = bill;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string billId, CancellationToken cancellationToken)
    {
        _bills.RemoveAll(bill => bill.Id == billId);
        return Task.CompletedTask;
    }

    public Task<bool> AnyInCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        return Task.FromResult(_bills.Exists(bill => bill.CategoryId == categoryId));
    }
}
