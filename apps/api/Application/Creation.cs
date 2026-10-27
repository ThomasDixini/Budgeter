namespace Budgeter.Api.Application;

/// <summary>
/// Outcome of an idempotent create: the stored record and whether this call inserted it
/// (false when a retry found it already saved).
/// </summary>
public sealed record Creation<TRecord>(TRecord Record, bool WasCreated);
