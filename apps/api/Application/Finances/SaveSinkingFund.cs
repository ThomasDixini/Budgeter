using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>How a sinking fund repeats; which fields apply depends on the kind.</summary>
public sealed record SinkingFundScheduleCommand(
    SinkingFundScheduleKind Kind, int? IntervalMonths, DateOnly? NextDueDate, int? Month, int? Day);

public sealed record SaveSinkingFundCommand(
    string Id, string Description, string CategoryId, long AmountCents,
    SinkingFundScheduleCommand Schedule, DateOnly Today);

/// <summary>
/// Creates a sinking fund or replaces the stored one with the same id; saving the same request twice leaves
/// the same state.
/// </summary>
public sealed class SaveSinkingFund(
    ISinkingFundRepository funds, IFinanceCategoryRepository categories, IUnitOfWork unitOfWork)
{
    /// <summary>
    /// Checks the category exists, works out the schedule and the next due date, and stores the fund.
    /// </summary>
    /// <example><code>await saveSinkingFund.ExecuteAsync(new SaveSinkingFundCommand("f1", "IPVA", "taxes", 120000, new(SinkingFundScheduleKind.FixedDate, null, null, 1, 15), today), ct);</code></example>
    public async Task<SinkingFund> ExecuteAsync(SaveSinkingFundCommand command, CancellationToken cancellationToken)
    {
        if ((await categories.FindAsync(command.CategoryId, cancellationToken)) is null)
        {
            throw ResourceNotFoundException.For("finance category", command.CategoryId);
        }
        var (schedule, nextDueDate) = BuildSchedule(command);
        var fund = SinkingFund.Create(
            command.Id, command.Description, command.CategoryId, command.AmountCents, schedule, nextDueDate);
        await unitOfWork.RunAsync(() => funds.SaveAsync(fund, cancellationToken), cancellationToken);
        return fund;
    }

    private static (SinkingFundSchedule Schedule, DateOnly NextDueDate) BuildSchedule(SaveSinkingFundCommand command)
    {
        var requested = command.Schedule;
        if (requested.Kind == SinkingFundScheduleKind.FixedDate)
        {
            var yearly = SinkingFundSchedule.FixedDate(
                Required(requested.Month, "month", requested.Kind), Required(requested.Day, "day", requested.Kind));
            return (yearly, yearly.FirstDueOnOrAfter(command.Today));
        }
        var interval = Required(requested.IntervalMonths, "interval in months", requested.Kind);
        var first = Required(requested.NextDueDate, "next due date", requested.Kind);
        if (first < command.Today)
        {
            throw new DomainRuleException(
                $"Expected the next due date to be on or after {command.Today:yyyy-MM-dd}, received {first:yyyy-MM-dd}");
        }
        return (SinkingFundSchedule.EveryMonths(interval, first.Day), first);
    }

    private static T Required<T>(T? value, string field, SinkingFundScheduleKind kind)
        where T : struct
    {
        if (value is { } present) return present;
        throw new DomainRuleException($"Expected the {field} to be given for a {kind} sinking fund, received none");
    }
}
