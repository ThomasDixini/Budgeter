using Budgeter.Api.Application.Backups;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class BackupUseCaseTests
{
    private static readonly TimeZoneInfo SaoPaulo = TimeZoneInfo.CreateCustomTimeZone(
        "Test/SaoPaulo", TimeSpan.FromHours(-3), "Sao Paulo", "Sao Paulo");

    private readonly InMemoryDatabaseBackup _database = new([1, 2, 3]);

    [Fact]
    public void NameFor_SortsByDateAndTime()
    {
        var name = BackupFile.NameFor(new DateTimeOffset(2026, 11, 9, 7, 5, 3, TimeSpan.Zero));

        name.ShouldBe("budgeter-backup-2026-11-09-070503.db");
    }

    [Fact]
    public async Task Export_NamesTheFileAfterTheLocalTime()
    {
        var clock = new FixedTimeProvider(new DateTimeOffset(2026, 11, 10, 1, 30, 0, TimeSpan.Zero), SaoPaulo);

        var file = await new ExportBackup(_database, clock).ExecuteAsync(CancellationToken.None);

        file.FileName.ShouldBe("budgeter-backup-2026-11-09-223000.db");
    }

    [Fact]
    public async Task Export_HandsOverTheSnapshot()
    {
        var clock = new FixedTimeProvider(DateTimeOffset.UnixEpoch, TimeZoneInfo.Utc);

        var file = await new ExportBackup(_database, clock).ExecuteAsync(CancellationToken.None);

        await using var content = file.Content;
        using var copy = new MemoryStream();
        await content.CopyToAsync(copy);
        copy.ToArray().ShouldBe([1, 2, 3]);
    }

    [Fact]
    public async Task Restore_ReplacesTheDatabaseWithTheBackup()
    {
        using var backup = new MemoryStream([9, 8]);

        await new RestoreBackup(_database).ExecuteAsync(backup, CancellationToken.None);

        _database.Stored.ShouldBe([9, 8]);
    }
}
