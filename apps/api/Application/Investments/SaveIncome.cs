using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Application.Investments;

public sealed record SaveIncomeCommand(string Id, string InvestmentId, DateOnly Date, IncomeKind Kind, long AmountCents);

/// <summary>Records or replaces a provento; saving the same one twice leaves the same state.</summary>
public sealed class SaveIncome(IInvestmentRepository investments)
{
    /// <summary>
    /// Checks the investment exists and stores the provento.
    /// </summary>
    /// <example><code>await saveIncome.ExecuteAsync(new SaveIncomeCommand("i1", "petr4", day, IncomeKind.Dividend, 12000), ct);</code></example>
    public async Task<InvestmentIncome> ExecuteAsync(SaveIncomeCommand command, CancellationToken cancellationToken)
    {
        var income = InvestmentIncome.Create(command.Id, command.InvestmentId, command.Date, command.Kind, command.AmountCents);
        if (await investments.FindAsync(income.InvestmentId, cancellationToken) is null)
        {
            throw ResourceNotFoundException.For("investment", income.InvestmentId);
        }
        await investments.SaveIncomeAsync(income, cancellationToken);
        return income;
    }
}

/// <summary>Deletes a provento; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteIncome(IInvestmentRepository investments)
{
    /// <summary>
    /// Validates the id and removes the provento if it exists.
    /// </summary>
    /// <example><code>await deleteIncome.ExecuteAsync("i1", ct);</code></example>
    public Task ExecuteAsync(string incomeId, CancellationToken cancellationToken)
    {
        return investments.DeleteIncomeAsync(EntityId.Require(incomeId, "income id"), cancellationToken);
    }
}
