using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Application.Investments;

/// <summary>Port to the storage of investments, their trades and the proventos they paid.</summary>
public interface IInvestmentRepository
{
    /// <summary>All investments in creation order.</summary>
    Task<IReadOnlyList<Investment>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The investment with this id, or null when there is none.</summary>
    Task<Investment?> FindAsync(string id, CancellationToken cancellationToken);

    /// <summary>Stores the investment, replacing a stored one with the same id without moving it in the list.</summary>
    Task SaveAsync(Investment investment, CancellationToken cancellationToken);

    /// <summary>Removes the investment; an unknown id is ignored.</summary>
    Task DeleteAsync(string investmentId, CancellationToken cancellationToken);

    /// <summary>Whether the investment has any trade or provento.</summary>
    Task<bool> HasActivityAsync(string investmentId, CancellationToken cancellationToken);

    /// <summary>Every trade, oldest day first and, within a day, in the order recorded.</summary>
    Task<IReadOnlyList<InvestmentTrade>> ListTradesAsync(CancellationToken cancellationToken);

    /// <summary>The trade with this id, or null when there is none.</summary>
    Task<InvestmentTrade?> FindTradeAsync(string id, CancellationToken cancellationToken);

    /// <summary>Stores the trade, replacing a stored one with the same id.</summary>
    Task SaveTradeAsync(InvestmentTrade trade, CancellationToken cancellationToken);

    /// <summary>Removes the trade; an unknown id is ignored.</summary>
    Task DeleteTradeAsync(string tradeId, CancellationToken cancellationToken);

    /// <summary>Every provento, newest day first.</summary>
    Task<IReadOnlyList<InvestmentIncome>> ListIncomesAsync(CancellationToken cancellationToken);

    /// <summary>Stores the provento, replacing a stored one with the same id.</summary>
    Task SaveIncomeAsync(InvestmentIncome income, CancellationToken cancellationToken);

    /// <summary>Removes the provento; an unknown id is ignored.</summary>
    Task DeleteIncomeAsync(string incomeId, CancellationToken cancellationToken);
}
