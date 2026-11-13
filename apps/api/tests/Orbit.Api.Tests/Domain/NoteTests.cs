using Orbit.Api.Domain;
using Orbit.Api.Domain.Notes;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class NoteTests
{
    private static readonly DateTimeOffset Created = new(2026, 11, 1, 9, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = Created.AddHours(3);

    private static Note NewNote(NoteKind kind = NoteKind.Goal) =>
        Note.Create("n1", kind, "Run a 10k", "Train 3x a week", Created);

    [Fact]
    public void Create_TrimsTheTitleAndKeepsTheBodyUntouched()
    {
        var note = Note.Create("n1", NoteKind.Idea, "  Standing desk ", "\n  First line  ", Created);

        (note.Title, note.Body).ShouldBe(("Standing desk", "\n  First line  "));
    }

    [Fact]
    public void Create_StartsOpenWithBothTimestampsSet()
    {
        var note = NewNote();

        (note.Status, note.CreatedAt, note.UpdatedAt).ShouldBe((NoteStatus.Open, Created, Created));
    }

    [Fact]
    public void Create_TurnsANullBodyIntoAnEmptyOne()
    {
        Note.Create("n1", NoteKind.Note, "Title", null, Created).Body.ShouldBe("");
    }

    [Fact]
    public void Create_AcceptsABodyOfExactlyTheLimit()
    {
        var body = new string('a', Note.MaxBodyLength);

        Note.Create("n1", NoteKind.Note, "Title", body, Created).Body.Length.ShouldBe(Note.MaxBodyLength);
    }

    [Fact]
    public void Create_RejectsABlankTitle()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Note.Create("n1", NoteKind.Note, "   ", "", Created));

        exception.Message.ShouldContain("\"   \"");
    }

    [Fact]
    public void Create_RejectsATitleOverTheLimit()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Note.Create("n1", NoteKind.Note, new string('t', 81), "", Created));

        exception.Message.ShouldContain("81 characters");
    }

    [Fact]
    public void Create_RejectsABodyOverTheLimit()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Note.Create("n1", NoteKind.Note, "Title", new string('b', 4001), Created));

        exception.Message.ShouldContain("4001");
    }

    [Fact]
    public void Create_RejectsAnInvalidId()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Note.Create("bad id", NoteKind.Note, "Title", "", Created));

        exception.Message.ShouldContain("\"bad id\"");
    }

    [Fact]
    public void Create_RejectsAnUndefinedKind()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Note.Create("n1", (NoteKind)99, "Title", "", Created));

        exception.Message.ShouldContain("99");
    }

    [Fact]
    public void Edited_KeepsStatusAndCreatedTimeAndMovesUpdatedAt()
    {
        var note = NewNote().WithStatus(NoteStatus.Archived, Created);

        var edited = note.Edited(NoteKind.Idea, " New title ", "New body", Later);

        (edited.Id, edited.Kind, edited.Title, edited.Body, edited.Status, edited.CreatedAt, edited.UpdatedAt)
            .ShouldBe(("n1", NoteKind.Idea, "New title", "New body", NoteStatus.Archived, Created, Later));
    }

    [Fact]
    public void Edited_RejectsMovingADoneGoalToANote()
    {
        var done = NewNote().WithStatus(NoteStatus.Done, Created);

        var exception = Should.Throw<DomainRuleException>(() => done.Edited(NoteKind.Note, "Title", "", Later));

        exception.Message.ShouldBe("Expected a done item to stay a goal or an idea, received kind \"Note\"");
    }

    [Fact]
    public void Edited_AllowsMovingADoneGoalToAnIdea()
    {
        var done = NewNote().WithStatus(NoteStatus.Done, Created);

        done.Edited(NoteKind.Idea, "Title", "", Later).Kind.ShouldBe(NoteKind.Idea);
    }

    [Fact]
    public void Edited_RejectsAnUndefinedKind()
    {
        var exception = Should.Throw<DomainRuleException>(() => NewNote().Edited((NoteKind)7, "Title", "", Later));

        exception.Message.ShouldContain("7");
    }

    [Theory]
    [InlineData(NoteKind.Goal)]
    [InlineData(NoteKind.Idea)]
    public void WithStatus_AllowsDoneForGoalsAndIdeas(NoteKind kind)
    {
        NewNote(kind).WithStatus(NoteStatus.Done, Later).Status.ShouldBe(NoteStatus.Done);
    }

    [Fact]
    public void WithStatus_RejectsDoneForANote()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            NewNote(NoteKind.Note).WithStatus(NoteStatus.Done, Later));

        exception.Message.ShouldBe("Expected a goal or an idea to be marked done, received kind \"Note\"");
    }

    [Theory]
    [InlineData(NoteKind.Goal)]
    [InlineData(NoteKind.Note)]
    [InlineData(NoteKind.Idea)]
    public void WithStatus_AllowsArchivingEveryKind(NoteKind kind)
    {
        NewNote(kind).WithStatus(NoteStatus.Archived, Later).Status.ShouldBe(NoteStatus.Archived);
    }

    [Theory]
    [InlineData(NoteStatus.Done)]
    [InlineData(NoteStatus.Archived)]
    public void WithStatus_ReopensFromDoneAndArchived(NoteStatus from)
    {
        var note = NewNote().WithStatus(from, Created);

        note.WithStatus(NoteStatus.Open, Later).Status.ShouldBe(NoteStatus.Open);
    }

    [Fact]
    public void WithStatus_RefreshesUpdatedAtEvenForTheSameStatus()
    {
        var note = NewNote().WithStatus(NoteStatus.Open, Later);

        (note.Status, note.CreatedAt, note.UpdatedAt).ShouldBe((NoteStatus.Open, Created, Later));
    }

    [Fact]
    public void WithStatus_RejectsAnUndefinedStatus()
    {
        var exception = Should.Throw<DomainRuleException>(() => NewNote().WithStatus((NoteStatus)42, Later));

        exception.Message.ShouldContain("42");
    }
}
