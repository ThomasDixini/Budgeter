using Orbit.Api.Application;
using Orbit.Api.Application.Notes;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Notes;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class NoteUseCaseTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 1, 9, 0, 0, TimeSpan.Zero);
    private readonly InMemoryNoteRepository _notes = new();

    private static FixedTimeProvider ClockAt(DateTimeOffset moment) => new(moment, TimeZoneInfo.Utc);

    private Task<Note> SaveAsync(SaveNoteCommand command, DateTimeOffset moment) =>
        new SaveNote(_notes, ClockAt(moment)).ExecuteAsync(command, CancellationToken.None);

    private Task<Note> SetStatusAsync(string id, NoteStatus status, DateTimeOffset moment) =>
        new SetNoteStatus(_notes, ClockAt(moment)).ExecuteAsync(new SetNoteStatusCommand(id, status), CancellationToken.None);

    [Fact]
    public async Task Save_CreatesAnOpenNoteStampedWithNow()
    {
        var note = await SaveAsync(new("n1", NoteKind.Idea, "Standing desk", "Try one"), Start);

        note.Status.ShouldBe(NoteStatus.Open);
        note.CreatedAt.ShouldBe(Start);
        note.UpdatedAt.ShouldBe(Start);
        (await _notes.FindAsync("n1", CancellationToken.None)).ShouldBe(note);
    }

    [Fact]
    public async Task Save_EditsAnExistingNoteKeepingCreationAndStatus()
    {
        await SaveAsync(new("n1", NoteKind.Goal, "Run", ""), Start);
        await SetStatusAsync("n1", NoteStatus.Archived, Start.AddHours(1));

        var edited = await SaveAsync(new("n1", NoteKind.Goal, "Run a 10k", "Weekly"), Start.AddHours(2));

        edited.Title.ShouldBe("Run a 10k");
        edited.CreatedAt.ShouldBe(Start);
        edited.UpdatedAt.ShouldBe(Start.AddHours(2));
        edited.Status.ShouldBe(NoteStatus.Archived);
    }

    [Fact]
    public async Task Save_StoresAMissingBodyAsEmptyText()
    {
        var note = await SaveAsync(new("n1", NoteKind.Note, "Groceries", null), Start);

        note.Body.ShouldBe("");
    }

    [Fact]
    public async Task Save_RejectsAnInvalidTitle()
    {
        var exception = await Should.ThrowAsync<DomainRuleException>(() =>
            SaveAsync(new("n1", NoteKind.Note, "   ", ""), Start));

        exception.Message.ShouldNotBeEmpty();
        (await _notes.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Save_RejectsAnUnknownKind()
    {
        var exception = await Should.ThrowAsync<DomainRuleException>(() =>
            SaveAsync(new("n1", (NoteKind)42, "Title", ""), Start));

        exception.Message.ShouldContain("42");
    }

    [Fact]
    public async Task Save_RejectsEditingADoneGoalIntoANote()
    {
        await SaveAsync(new("n1", NoteKind.Goal, "Run", ""), Start);
        await SetStatusAsync("n1", NoteStatus.Done, Start.AddHours(1));

        await Should.ThrowAsync<DomainRuleException>(() =>
            SaveAsync(new("n1", NoteKind.Note, "Run", ""), Start.AddHours(2)));

        var stored = await _notes.FindAsync("n1", CancellationToken.None);
        stored!.Kind.ShouldBe(NoteKind.Goal);
    }

    [Fact]
    public async Task SetStatus_MarksAGoalDoneAndReopensIt()
    {
        await SaveAsync(new("n1", NoteKind.Goal, "Run", ""), Start);

        var done = await SetStatusAsync("n1", NoteStatus.Done, Start.AddHours(1));
        var reopened = await SetStatusAsync("n1", NoteStatus.Open, Start.AddHours(2));

        done.Status.ShouldBe(NoteStatus.Done);
        done.UpdatedAt.ShouldBe(Start.AddHours(1));
        reopened.Status.ShouldBe(NoteStatus.Open);
    }

    [Fact]
    public async Task SetStatus_RejectsDoneForANoteAndAllowsArchiving()
    {
        await SaveAsync(new("n1", NoteKind.Note, "Groceries", ""), Start);

        await Should.ThrowAsync<DomainRuleException>(() => SetStatusAsync("n1", NoteStatus.Done, Start));
        var archived = await SetStatusAsync("n1", NoteStatus.Archived, Start.AddHours(1));

        archived.Status.ShouldBe(NoteStatus.Archived);
    }

    [Fact]
    public async Task SetStatus_RejectsAnUnknownNote()
    {
        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            SetStatusAsync("missing", NoteStatus.Archived, Start));

        exception.Message.ShouldContain("\"missing\"");
    }

    [Fact]
    public async Task Delete_RemovesTheNoteAndIgnoresAnUnknownId()
    {
        await SaveAsync(new("n1", NoteKind.Note, "Groceries", ""), Start);
        var deleteNote = new DeleteNote(_notes);

        await deleteNote.ExecuteAsync("n1", CancellationToken.None);
        await deleteNote.ExecuteAsync("n1", CancellationToken.None);

        (await _notes.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task List_ReturnsTheMostRecentlyUpdatedFirst()
    {
        await SaveAsync(new("old", NoteKind.Note, "Old", ""), Start);
        await SaveAsync(new("new", NoteKind.Note, "New", ""), Start.AddHours(1));

        var notes = await new ListNotes(_notes).ExecuteAsync(CancellationToken.None);

        notes.Select(note => note.Id).ShouldBe(["new", "old"]);
    }
}
