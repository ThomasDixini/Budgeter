using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Application.Investments;

public sealed record SaveInvestmentCommand(
    string Id, string Name, InvestmentKind Kind, long? PriceCents, DateOnly? PricedOn);

/// <summary>Creates or replaces an investment, with the latest price the user typed; saving twice leaves the same state.</summary>
public sealed class SaveInvestment(IInvestmentRepository investments)
{
    /// <summary>
    /// Validates the investment and stores it. A price needs the day it is from.
    /// </summary>
    /// <example><code>await saveInvestment.ExecuteAsync(new SaveInvestmentCommand("petr4", "PETR4", InvestmentKind.Stock, 3845, day), ct);</code></example>
    public async Task<Investment> ExecuteAsync(SaveInvestmentCommand command, CancellationToken cancellationToken)
    {
        var investment = Investment.Create(command.Id, command.Name, command.Kind, PriceOf(command));
        await investments.SaveAsync(investment, cancellationToken);
        return investment;
    }

    private static PricePoint? PriceOf(SaveInvestmentCommand command)
    {
        if (command.PriceCents is not { } cents) return null;
        if (command.PricedOn is { } day) return PricePoint.Create(cents, day);
        throw new DomainRuleException($"Expected the day of the price {cents} to be given, received none");
    }
}
