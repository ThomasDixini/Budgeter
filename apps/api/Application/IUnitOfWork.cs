namespace Orbit.Api.Application;

/// <summary>
/// Port that runs several repository writes as one: either all of them are stored or none is, so a
/// failure halfway never leaves, say, a completed block without the goal progress it earned.
/// </summary>
public interface IUnitOfWork
{
    /// <summary>
    /// Runs the work; every repository call inside it joins the same transaction, committed once the
    /// work ends and rolled back if it throws.
    /// </summary>
    /// <example><code>await unitOfWork.RunAsync(async () => { await outcomes.SaveAsync(outcome, ct); await credits.CreditBlockAsync(..., ct); }, ct);</code></example>
    Task RunAsync(Func<Task> work, CancellationToken cancellationToken);
}
