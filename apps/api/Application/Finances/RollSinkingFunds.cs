using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>
/// Turns every sinking fund that has fallen due into its payable bill and moves the fund to its next cycle.
/// Running it again for the same day creates nothing.
/// </summary>
public sealed class RollSinkingFunds(ISinkingFundRepository funds, IBillRepository bills, IUnitOfWork unitOfWork)
{
    /// <summary>Cycles rolled per fund in one run, so a long-forgotten fund cannot flood the bills.</summary>
    public const int MaxCyclesPerFund = 12;

    /// <summary>
    /// Creates the bills of the cycles due on or before the day, in one unit of work.
    /// </summary>
    /// <example><code>var created = await rollSinkingFunds.ExecuteAsync(new DateOnly(2026, 11, 11), ct);</code></example>
    public async Task<IReadOnlyList<Bill>> ExecuteAsync(DateOnly today, CancellationToken cancellationToken)
    {
        var due = await funds.ListDueOnOrBeforeAsync(today, cancellationToken);
        var created = new List<Bill>();
        await unitOfWork.RunAsync(() => RollAllAsync(due, today, created, cancellationToken), cancellationToken);
        return created;
    }

    private async Task RollAllAsync(
        IReadOnlyList<SinkingFund> due, DateOnly today, List<Bill> created, CancellationToken cancellationToken)
    {
        foreach (var fund in due)
        {
            var advanced = await RollFundAsync(fund, today, created, cancellationToken);
            await funds.SaveAsync(advanced, cancellationToken);
        }
    }

    private async Task<SinkingFund> RollFundAsync(
        SinkingFund fund, DateOnly today, List<Bill> created, CancellationToken cancellationToken)
    {
        for (var cycle = 0; cycle < MaxCyclesPerFund && fund.NextDueDate <= today; cycle++)
        {
            if (await bills.FindAsync(fund.CurrentBillId, cancellationToken) is null)
            {
                var bill = fund.CurrentBill();
                await bills.SaveAsync(bill, cancellationToken);
                created.Add(bill);
            }
            fund = fund.AdvancedOneCycle();
        }
        return fund;
    }
}
