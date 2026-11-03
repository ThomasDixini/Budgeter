using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>Port to the storage of bills to pay and to receive.</summary>
public interface IBillRepository
{
    /// <summary>The bill with this id, or null when there is none.</summary>
    Task<Bill?> FindAsync(string id, CancellationToken cancellationToken);

    /// <summary>The bills not yet settled that are due before <paramref name="until"/>, earliest due date first.</summary>
    Task<IReadOnlyList<Bill>> ListOpenDueBeforeAsync(DateOnly until, CancellationToken cancellationToken);

    /// <summary>The bills settled on or after <paramref name="since"/>, the latest settlement first.</summary>
    Task<IReadOnlyList<Bill>> ListSettledSinceAsync(DateOnly since, CancellationToken cancellationToken);

    /// <summary>Stores the bill, replacing a stored one with the same id.</summary>
    Task SaveAsync(Bill bill, CancellationToken cancellationToken);

    /// <summary>Removes the bill; an unknown id is ignored.</summary>
    Task DeleteAsync(string billId, CancellationToken cancellationToken);

    /// <summary>Whether any bill was filed under the finance category.</summary>
    Task<bool> AnyInCategoryAsync(string categoryId, CancellationToken cancellationToken);
}
