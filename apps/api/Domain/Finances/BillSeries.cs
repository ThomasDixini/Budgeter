namespace Orbit.Api.Domain.Finances;

/// <summary>Where a bill sits in the series it was created with: occurrence <c>Number</c> of <c>Count</c>.</summary>
public sealed record BillSeries(string SeriesId, BillRecurrence Recurrence, int Number, int Count);
