using Orbit.Api.Application.Finances;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Endpoints;

/// <summary>How a sinking fund repeats; which fields apply depends on the kind.</summary>
public sealed record ScheduleBody(
    SinkingFundScheduleKind Kind, int? IntervalMonths = null, DateOnly? NextDueDate = null,
    int? Month = null, int? Day = null)
{
    public SinkingFundScheduleCommand ToCommand() => new(Kind, IntervalMonths, NextDueDate, Month, Day);
}

/// <summary>Body of <c>PUT /sinking-funds/{id}</c>; the id comes from the route.</summary>
public sealed record SaveSinkingFundRequest(
    string Description, string CategoryId, long AmountCents, ScheduleBody Schedule)
{
    public SaveSinkingFundCommand ToCommand(string id, DateOnly today) =>
        new(id, Description, CategoryId, AmountCents, Schedule.ToCommand(), today);
}

/// <summary>Body of <c>POST /sinking-funds/roll</c>.</summary>
public sealed record RollSinkingFundsRequest(DateOnly Today);

public sealed record SinkingFundScheduleResponse(
    SinkingFundScheduleKind Kind, int IntervalMonths, int? Month, int Day, DateOnly NextDueDate);

public sealed record SinkingFundResponse(
    string Id, string Description, string CategoryId, long AmountCents, SinkingFundScheduleResponse Schedule,
    long SavedCents, long MonthlyCents, DateOnly CycleStart)
{
    public static SinkingFundResponse From(SinkingFund fund, DateOnly today) =>
        new(fund.Id, fund.Description, fund.CategoryId, fund.AmountCents,
            new SinkingFundScheduleResponse(
                fund.Schedule.Kind, fund.Schedule.IntervalMonths, fund.Schedule.Month, fund.Schedule.DueDay,
                fund.NextDueDate),
            fund.SavedCents(today), fund.MonthlyCents, fund.CycleStart);
}

public sealed record SinkingFundsResponse(IReadOnlyList<SinkingFundResponse> Funds, long TotalMonthlyCents)
{
    public static SinkingFundsResponse From(SinkingFundsOverview overview, DateOnly today) =>
        new(overview.Funds.Select(summary => SinkingFundResponse.From(summary.Fund, today)).ToList(),
            overview.TotalMonthlyCents);
}

/// <summary>HTTP routes for the sinking funds that save up for bills paid from time to time.</summary>
public static class SinkingFundEndpoints
{
    /// <summary>
    /// Maps <c>GET /sinking-funds?today=YYYY-MM-DD</c>, <c>PUT /sinking-funds/{id}?today=YYYY-MM-DD</c>,
    /// <c>DELETE /sinking-funds/{id}</c> and <c>POST /sinking-funds/roll</c>.
    /// </summary>
    /// <example><code>app.MapSinkingFundEndpoints();</code></example>
    public static IEndpointRouteBuilder MapSinkingFundEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/sinking-funds", ListAsync);
        routes.MapPut("/sinking-funds/{id}", SaveAsync);
        routes.MapDelete("/sinking-funds/{id}", DeleteAsync);
        routes.MapPost("/sinking-funds/roll", RollAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(
        DateOnly today, ListSinkingFunds listSinkingFunds, CancellationToken cancellationToken)
    {
        var overview = await listSinkingFunds.ExecuteAsync(today, cancellationToken);
        return Results.Ok(SinkingFundsResponse.From(overview, today));
    }

    private static async Task<IResult> SaveAsync(
        string id, DateOnly today, SaveSinkingFundRequest request, SaveSinkingFund saveSinkingFund,
        CancellationToken cancellationToken)
    {
        var saved = await saveSinkingFund.ExecuteAsync(request.ToCommand(id, today), cancellationToken);
        return Results.Ok(SinkingFundResponse.From(saved, today));
    }

    private static async Task<IResult> DeleteAsync(
        string id, DeleteSinkingFund deleteSinkingFund, CancellationToken cancellationToken)
    {
        await deleteSinkingFund.ExecuteAsync(id, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> RollAsync(
        RollSinkingFundsRequest request, RollSinkingFunds rollSinkingFunds, CancellationToken cancellationToken)
    {
        var created = await rollSinkingFunds.ExecuteAsync(request.Today, cancellationToken);
        return Results.Ok(created.Select(BillResponse.From));
    }
}
