namespace Orbit.Api.Domain.Finances;

/// <summary>When a bill was paid or received, and the account the money left or reached.</summary>
public sealed record BillSettlement(DateOnly Date, string AccountId);
