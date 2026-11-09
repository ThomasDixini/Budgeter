namespace Budgeter.Api.Application.Backups;

/// <summary>A file offered for restore that is not a Budgeter backup this version can read.</summary>
public sealed class InvalidBackupException(string message) : Exception(message);
