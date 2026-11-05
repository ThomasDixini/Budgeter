using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Endpoints;

public sealed record IncomeSplitPartBody(
    string Id, string Name, int Percent, int Color, IReadOnlyList<string> CategoryIds)
{
    public static IncomeSplitPartBody From(IncomeSplitPart part) =>
        new(part.Id, part.Name, part.Percent, part.Color, part.CategoryIds);

    public IncomeSplitPartCommand ToCommand() => new(Id, Name, Percent, Color, CategoryIds);
}

/// <summary>Body of <c>PUT /income-split</c> and what <c>GET /income-split</c> answers with.</summary>
public sealed record IncomeSplitBody(long BaseIncomeCents, IReadOnlyList<IncomeSplitPartBody> Parts)
{
    public static IncomeSplitBody From(IncomeSplit plan) =>
        new(plan.BaseIncomeCents, plan.Parts.Select(IncomeSplitPartBody.From).ToList());

    public SaveIncomeSplitCommand ToCommand() => new(BaseIncomeCents, Parts.Select(part => part.ToCommand()).ToList());
}

/// <summary>HTTP routes for the income split plan.</summary>
public static class IncomeSplitEndpoints
{
    /// <summary>
    /// Maps <c>GET /income-split</c> and <c>PUT /income-split</c> (which replaces the whole plan).
    /// </summary>
    /// <example><code>app.MapIncomeSplitEndpoints();</code></example>
    public static IEndpointRouteBuilder MapIncomeSplitEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/income-split", GetAsync);
        routes.MapPut("/income-split", SaveAsync);
        return routes;
    }

    private static async Task<IResult> GetAsync(GetIncomeSplit getIncomeSplit, CancellationToken cancellationToken)
    {
        return Results.Ok(IncomeSplitBody.From(await getIncomeSplit.ExecuteAsync(cancellationToken)));
    }

    private static async Task<IResult> SaveAsync(
        IncomeSplitBody request, SaveIncomeSplit saveIncomeSplit, CancellationToken cancellationToken)
    {
        var plan = await saveIncomeSplit.ExecuteAsync(request.ToCommand(), cancellationToken);
        return Results.Ok(IncomeSplitBody.From(plan));
    }
}
