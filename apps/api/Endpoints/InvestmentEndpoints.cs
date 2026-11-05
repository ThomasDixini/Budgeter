using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Endpoints;

/// <summary>The latest price typed for an investment: cents for one unit and the day it is from.</summary>
public sealed record PriceBody(long Cents, DateOnly On)
{
    public static PriceBody? From(PricePoint? price) => price is null ? null : new(price.Cents, price.On);
}

/// <summary>Body of <c>PUT /investments/{investmentId}</c>; the id comes from the route. Leaving the price out clears it.</summary>
public sealed record SaveInvestmentRequest(string Name, InvestmentKind Kind, PriceBody? Price = null)
{
    public SaveInvestmentCommand ToCommand(string investmentId) =>
        new(investmentId, Name, Kind, Price?.Cents, Price?.On);
}

public sealed record InvestmentResponse(string Id, string Name, InvestmentKind Kind, PriceBody? Price)
{
    public static InvestmentResponse From(Investment investment) =>
        new(investment.Id, investment.Name, investment.Kind, PriceBody.From(investment.Price));
}

/// <summary>Body of <c>PUT /investment-trades/{tradeId}</c>; the id comes from the route.</summary>
public sealed record SaveTradeRequest(
    string InvestmentId, DateOnly Date, TradeKind Kind, long QuantityThousandths, long UnitPriceCents)
{
    public SaveTradeCommand ToCommand(string tradeId) =>
        new(tradeId, InvestmentId, Date, Kind, QuantityThousandths, UnitPriceCents);
}

public sealed record TradeResponse(
    string Id, string InvestmentId, DateOnly Date, TradeKind Kind, long QuantityThousandths, long UnitPriceCents)
{
    public static TradeResponse From(InvestmentTrade trade) =>
        new(trade.Id, trade.InvestmentId, trade.Date, trade.Kind, trade.QuantityThousandths, trade.UnitPriceCents);
}

/// <summary>Body of <c>PUT /investment-incomes/{incomeId}</c>; the id comes from the route.</summary>
public sealed record SaveIncomeRequest(string InvestmentId, DateOnly Date, IncomeKind Kind, long AmountCents)
{
    public SaveIncomeCommand ToCommand(string incomeId) => new(incomeId, InvestmentId, Date, Kind, AmountCents);
}

public sealed record IncomeResponse(string Id, string InvestmentId, DateOnly Date, IncomeKind Kind, long AmountCents)
{
    public static IncomeResponse From(InvestmentIncome income) =>
        new(income.Id, income.InvestmentId, income.Date, income.Kind, income.AmountCents);
}

public sealed record PortfolioLineResponse(
    InvestmentResponse Investment, long QuantityThousandths, long CostCents, long? ValueCents, long? GainCents, long IncomeCents)
{
    public static PortfolioLineResponse From(PortfolioLine line) =>
        new(InvestmentResponse.From(line.Investment), line.QuantityThousandths, line.CostCents,
            line.ValueCents, line.GainCents, line.IncomeCents);
}

public sealed record PerformanceResponse(
    long InvestedCents, long GainCents, decimal GainPercent, long CdiGainCents, decimal CdiPercent, DateOnly? CdiThrough)
{
    public static PerformanceResponse? From(PortfolioPerformance? performance) =>
        performance is null
            ? null
            : new(performance.InvestedCents, performance.GainCents, performance.GainPercent,
                performance.CdiGainCents, performance.CdiPercent, performance.CdiThrough);
}

public sealed record PortfolioResponse(
    IReadOnlyList<PortfolioLineResponse> Lines, PortfolioTotals Totals, PerformanceResponse? Performance,
    IReadOnlyList<TradeResponse> Trades, IReadOnlyList<IncomeResponse> Incomes)
{
    public static PortfolioResponse From(PortfolioSnapshot snapshot) =>
        new(snapshot.Portfolio.Lines.Select(PortfolioLineResponse.From).ToList(),
            snapshot.Portfolio.Totals,
            PerformanceResponse.From(snapshot.Portfolio.Performance),
            snapshot.Trades.Select(TradeResponse.From).ToList(),
            snapshot.Incomes.Select(IncomeResponse.From).ToList());
}

/// <summary>HTTP routes for investments, their trades and proventos, and the portfolio they make up.</summary>
public static class InvestmentEndpoints
{
    /// <summary>
    /// Maps <c>GET /investments?date=YYYY-MM-DD</c>, <c>PUT</c>/<c>DELETE /investments/{investmentId}</c>,
    /// <c>PUT</c>/<c>DELETE /investment-trades/{tradeId}</c> and <c>PUT</c>/<c>DELETE /investment-incomes/{incomeId}</c>.
    /// </summary>
    /// <example><code>app.MapInvestmentEndpoints();</code></example>
    public static IEndpointRouteBuilder MapInvestmentEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/investments", GetPortfolioAsync);
        routes.MapPut("/investments/{investmentId}", SaveInvestmentAsync);
        routes.MapDelete("/investments/{investmentId}", DeleteInvestmentAsync);
        routes.MapPut("/investment-trades/{tradeId}", SaveTradeAsync);
        routes.MapDelete("/investment-trades/{tradeId}", DeleteTradeAsync);
        routes.MapPut("/investment-incomes/{incomeId}", SaveIncomeAsync);
        routes.MapDelete("/investment-incomes/{incomeId}", DeleteIncomeAsync);
        return routes;
    }

    private static async Task<IResult> GetPortfolioAsync(
        DateOnly date, GetPortfolio getPortfolio, CancellationToken cancellationToken)
    {
        var snapshot = await getPortfolio.ExecuteAsync(date, cancellationToken);
        return Results.Ok(PortfolioResponse.From(snapshot));
    }

    private static async Task<IResult> SaveInvestmentAsync(
        string investmentId, SaveInvestmentRequest request, SaveInvestment saveInvestment,
        CancellationToken cancellationToken)
    {
        var saved = await saveInvestment.ExecuteAsync(request.ToCommand(investmentId), cancellationToken);
        return Results.Ok(InvestmentResponse.From(saved));
    }

    private static async Task<IResult> DeleteInvestmentAsync(
        string investmentId, DeleteInvestment deleteInvestment, CancellationToken cancellationToken)
    {
        await deleteInvestment.ExecuteAsync(investmentId, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> SaveTradeAsync(
        string tradeId, SaveTradeRequest request, SaveTrade saveTrade, CancellationToken cancellationToken)
    {
        var saved = await saveTrade.ExecuteAsync(request.ToCommand(tradeId), cancellationToken);
        return Results.Ok(TradeResponse.From(saved));
    }

    private static async Task<IResult> DeleteTradeAsync(
        string tradeId, DeleteTrade deleteTrade, CancellationToken cancellationToken)
    {
        await deleteTrade.ExecuteAsync(tradeId, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> SaveIncomeAsync(
        string incomeId, SaveIncomeRequest request, SaveIncome saveIncome, CancellationToken cancellationToken)
    {
        var saved = await saveIncome.ExecuteAsync(request.ToCommand(incomeId), cancellationToken);
        return Results.Ok(IncomeResponse.From(saved));
    }

    private static async Task<IResult> DeleteIncomeAsync(
        string incomeId, DeleteIncome deleteIncome, CancellationToken cancellationToken)
    {
        await deleteIncome.ExecuteAsync(incomeId, cancellationToken);
        return Results.NoContent();
    }
}
