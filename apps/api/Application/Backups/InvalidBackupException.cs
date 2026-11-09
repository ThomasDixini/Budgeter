namespace Orbit.Api.Application.Backups;

/// <summary>A file offered for restore that is not an Orbit backup this version can read.</summary>
public sealed class InvalidBackupException(string message) : Exception(message);
