using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Investment storage kept in lists (in creation order), for use case tests.</summary>
internal sealed class InMemoryInvestmentRepository : IInvestmentRepository
{
    private readonly List<Investment> _investments = [];
    private readonly List<InvestmentTrade> _trades = [];
    private readonly List<InvestmentIncome> _incomes = [];

    public Task<IReadOnlyList<Investment>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Investment>>(_investments.ToList());

    public Task<Investment?> FindAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(_investments.Find(investment => investment.Id == id));

    public Task SaveAsync(Investment investment, CancellationToken cancellationToken)
    {
        Upsert(_investments, investment, stored => stored.Id == investment.Id);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string investmentId, CancellationToken cancellationToken)
    {
        _investments.RemoveAll(investment => investment.Id == investmentId);
        return Task.CompletedTask;
    }

    public Task<bool> HasActivityAsync(string investmentId, CancellationToken cancellationToken) =>
        Task.FromResult(
            _trades.Exists(trade => trade.InvestmentId == investmentId)
            || _incomes.Exists(income => income.InvestmentId == investmentId));

    public Task<IReadOnlyList<InvestmentTrade>> ListTradesAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<InvestmentTrade>>(_trades.OrderBy(trade => trade.Date).ToList());

    public Task<InvestmentTrade?> FindTradeAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(_trades.Find(trade => trade.Id == id));

    public Task SaveTradeAsync(InvestmentTrade trade, CancellationToken cancellationToken)
    {
        Upsert(_trades, trade, stored => stored.Id == trade.Id);
        return Task.CompletedTask;
    }

    public Task DeleteTradeAsync(string tradeId, CancellationToken cancellationToken)
    {
        _trades.RemoveAll(trade => trade.Id == tradeId);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<InvestmentIncome>> ListIncomesAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<InvestmentIncome>>(_incomes.OrderByDescending(income => income.Date).ToList());

    public Task SaveIncomeAsync(InvestmentIncome income, CancellationToken cancellationToken)
    {
        Upsert(_incomes, income, stored => stored.Id == income.Id);
        return Task.CompletedTask;
    }

    public Task DeleteIncomeAsync(string incomeId, CancellationToken cancellationToken)
    {
        _incomes.RemoveAll(income => income.Id == incomeId);
        return Task.CompletedTask;
    }

    private static void Upsert<TRecord>(List<TRecord> records, TRecord record, Predicate<TRecord> isSame)
    {
        var index = records.FindIndex(isSame);
        if (index < 0) records.Add(record);
        else records[index] = record;
    }
}
