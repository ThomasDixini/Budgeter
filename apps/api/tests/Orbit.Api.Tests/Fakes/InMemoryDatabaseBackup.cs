using Orbit.Api.Application.Backups;

namespace Orbit.Api.Tests.Fakes;

/// <summary>Keeps the "database" as bytes: a snapshot copies them, a restore replaces them.</summary>
internal sealed class InMemoryDatabaseBackup(byte[] stored) : IDatabaseBackup
{
    public byte[] Stored { get; private set; } = stored;

    public Task<Stream> OpenSnapshotAsync(CancellationToken cancellationToken) =>
        Task.FromResult<Stream>(new MemoryStream(Stored.ToArray(), writable: false));

    public async Task RestoreAsync(Stream backup, CancellationToken cancellationToken)
    {
        using var copy = new MemoryStream();
        await backup.CopyToAsync(copy, cancellationToken);
        Stored = copy.ToArray();
    }
}
