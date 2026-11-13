using Orbit.Api.Domain.Notes;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>Notes stored in SQLite, per user.</summary>
public sealed class SqliteNoteRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly DateTimeOffset Created = new(2026, 11, 10, 9, 0, 0, TimeSpan.Zero);

    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteNoteRepository _notes;

    public SqliteNoteRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _notes = new SqliteNoteRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await TestUsers.InsertAsync(connection, TestUsers.DefaultId);
        await TestUsers.InsertAsync(connection, TestUsers.OtherId);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static Note NewNote(string id, DateTimeOffset updatedAt, string title = "Title", NoteKind kind = NoteKind.Note) =>
        Note.Restore(id, kind, title, "", NoteStatus.Open, Created, updatedAt);

    [Theory]
    [InlineData(NoteKind.Goal, NoteStatus.Open)]
    [InlineData(NoteKind.Goal, NoteStatus.Done)]
    [InlineData(NoteKind.Idea, NoteStatus.Archived)]
    [InlineData(NoteKind.Note, NoteStatus.Open)]
    [InlineData(NoteKind.Note, NoteStatus.Archived)]
    public async Task Find_ReadsBackEveryKindAndStatus(NoteKind kind, NoteStatus status)
    {
        var note = Note.Restore("n1", kind, "Title", "Body", status, Created, Created.AddHours(1));
        await _notes.SaveAsync(note, CancellationToken.None);

        var found = await _notes.FindAsync("n1", CancellationToken.None);

        (found!.Kind, found.Status).ShouldBe((kind, status));
    }

    [Fact]
    public async Task Find_KeepsTheBodyExactlyWithLineBreaksEmojiAndQuotes()
    {
        const string body = "line one\r\nline 'two' \"quoted\"\n🚀 done; DROP TABLE notes;--";
        await _notes.SaveAsync(Note.Create("n1", NoteKind.Idea, "Title", body, Created), CancellationToken.None);

        var found = await _notes.FindAsync("n1", CancellationToken.None);

        found!.Body.ShouldBe(body);
    }

    [Fact]
    public async Task Find_AnUnknownIdIsNull()
    {
        (await _notes.FindAsync("missing", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task Save_ReplacesTheNoteKeepsOneRowAndTheOriginalCreatedAt()
    {
        await _notes.SaveAsync(NewNote("n1", Created, "First"), CancellationToken.None);
        var edited = Note.Restore("n1", NoteKind.Goal, "Second", "Text", NoteStatus.Done, Created.AddDays(5), Created.AddDays(6));

        await _notes.SaveAsync(edited, CancellationToken.None);

        var all = await _notes.ListAsync(CancellationToken.None);
        all.Select(note => (note.Title, note.Kind, note.Status, note.CreatedAt, note.UpdatedAt))
            .ShouldBe([("Second", NoteKind.Goal, NoteStatus.Done, Created, Created.AddDays(6))]);
    }

    [Fact]
    public async Task Timestamps_KeepTheSameInstantAfterARoundTrip()
    {
        var local = new DateTimeOffset(2026, 11, 10, 20, 30, 15, 123, TimeSpan.FromHours(-3));
        await _notes.SaveAsync(Note.Restore("n1", NoteKind.Note, "T", "", NoteStatus.Open, local, local.AddMinutes(1)), CancellationToken.None);

        var found = await _notes.FindAsync("n1", CancellationToken.None);

        (found!.CreatedAt.UtcDateTime, found.UpdatedAt.UtcDateTime).ShouldBe((local.UtcDateTime, local.AddMinutes(1).UtcDateTime));
    }

    [Fact]
    public async Task List_OrdersByUpdatedDescendingThenId()
    {
        await _notes.SaveAsync(NewNote("b", Created.AddHours(1)), CancellationToken.None);
        await _notes.SaveAsync(NewNote("a", Created.AddHours(1)), CancellationToken.None);
        await _notes.SaveAsync(NewNote("old", Created), CancellationToken.None);
        await _notes.SaveAsync(NewNote("new", Created.AddHours(2)), CancellationToken.None);

        var all = await _notes.ListAsync(CancellationToken.None);

        all.Select(note => note.Id).ShouldBe(["new", "a", "b", "old"]);
    }

    [Fact]
    public async Task Delete_RemovesTheNoteAndIgnoresAnUnknownId()
    {
        await _notes.SaveAsync(NewNote("n1", Created), CancellationToken.None);

        await _notes.DeleteAsync("missing", CancellationToken.None);
        await _notes.DeleteAsync("n1", CancellationToken.None);

        (await _notes.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task TwoUsers_StoreTheSameNoteIdWithoutSeeingEachOther()
    {
        var others = new SqliteNoteRepository(TestUsers.FactoryFor(_database, TestUsers.OtherId));
        await _notes.SaveAsync(NewNote("n1", Created, "Mine"), CancellationToken.None);
        await others.SaveAsync(NewNote("n1", Created, "Theirs"), CancellationToken.None);

        var mine = await _notes.FindAsync("n1", CancellationToken.None);
        var theirs = await others.FindAsync("n1", CancellationToken.None);

        (mine!.Title, theirs!.Title).ShouldBe(("Mine", "Theirs"));
    }

    [Fact]
    public async Task Queries_NeverSeeAnotherUsersNotes()
    {
        var others = new SqliteNoteRepository(TestUsers.FactoryFor(_database, TestUsers.OtherId));
        await others.SaveAsync(NewNote("n1", Created), CancellationToken.None);

        await _notes.DeleteAsync("n1", CancellationToken.None);

        var seen = (
            (await _notes.ListAsync(CancellationToken.None)).Count,
            (await _notes.FindAsync("n1", CancellationToken.None)) is null,
            (await others.FindAsync("n1", CancellationToken.None)) is not null);
        seen.ShouldBe((0, true, true));
    }

    [Fact]
    public async Task Find_AnUnknownKindNamesTheValueAndTheExpectedKinds()
    {
        await _notes.SaveAsync(NewNote("n1", Created), CancellationToken.None);
        await SetColumnAsync("kind", "Reminder");

        var failure = await Should.ThrowAsync<InvalidOperationException>(() => _notes.FindAsync("n1", CancellationToken.None));

        failure.Message.ShouldContain("'Reminder'");
        failure.Message.ShouldContain("Goal, Note, Idea");
    }

    [Fact]
    public async Task Find_AnUnknownStatusNamesTheValueAndTheExpectedStatuses()
    {
        await _notes.SaveAsync(NewNote("n1", Created), CancellationToken.None);
        await SetColumnAsync("status", "Paused");

        var failure = await Should.ThrowAsync<InvalidOperationException>(() => _notes.FindAsync("n1", CancellationToken.None));

        failure.Message.ShouldContain("'Paused'");
        failure.Message.ShouldContain("Open, Done, Archived");
    }

    [Fact]
    public async Task EnsureCreated_AddsTheTableToADatabaseThatLacksIt()
    {
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(connection, "DROP TABLE notes", CancellationToken.None);
            await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        }

        await _notes.SaveAsync(NewNote("n1", Created), CancellationToken.None);

        (await _notes.ListAsync(CancellationToken.None)).Count.ShouldBe(1);
    }

    private async Task SetColumnAsync(string column, string value)
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteCommands.ExecuteAsync(
            connection, $"UPDATE notes SET {column} = $value", CancellationToken.None, ("$value", value));
    }
}
