using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>Port to the storage of the income split plan (there is one).</summary>
public interface IIncomeSplitRepository
{
    /// <summary>The saved plan, or <see cref="IncomeSplit.Empty"/> when none was saved yet.</summary>
    Task<IncomeSplit> GetAsync(CancellationToken cancellationToken);

    /// <summary>Replaces the saved plan, parts and their categories included, as one change.</summary>
    Task ReplaceAsync(IncomeSplit plan, CancellationToken cancellationToken);
}
