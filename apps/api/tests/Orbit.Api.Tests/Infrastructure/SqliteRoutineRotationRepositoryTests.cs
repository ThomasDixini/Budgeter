using Orbit.Api.Domain.Categories;
using Orbit.Api.Domain.Routines;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

public sealed class SqliteRoutineRotationRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly DateOnly Monday = new(2026, 11, 2);

    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteRoutineRepository _routines;
    private readonly SqliteRoutineRotationRepository _rotations;

    public SqliteRoutineRotationRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _routines = new SqliteRoutineRepository(_connections);
        _rotations = new SqliteRoutineRotationRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
        await new SqliteCategoryRepository(_connections)
            .AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
        await _routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);
        await _routines.SaveAsync(
            Routine.Create("light", "Light", [0, 1, 2, 3, 4], "09:00", "16:00", []), CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    [Fact]
    public async Task Get_BeforeAnySaveIsTheEmptyRotation()
    {
        (await _rotations.GetAsync(CancellationToken.None)).ShouldBeSameAs(RoutineRotation.Empty);
    }

    [Fact]
    public async Task Replace_RoundTripsTheStartAndStepsInOrder()
    {
        await _rotations.ReplaceAsync(Rotation(("weekdays", 2), ("light", 1), ("weekdays", 1)), CancellationToken.None);

        var stored = await _rotations.GetAsync(CancellationToken.None);

        stored.StartsOn.ShouldBe(Monday);
        stored.Steps.Select(step => (step.RoutineId, step.Weeks))
            .ShouldBe([("weekdays", 2), ("light", 1), ("weekdays", 1)]);
    }

    [Fact]
    public async Task Replace_OverwritesThePreviousSteps()
    {
        await _rotations.ReplaceAsync(Rotation(("weekdays", 2), ("light", 1)), CancellationToken.None);

        await _rotations.ReplaceAsync(Rotation(("light", 3)), CancellationToken.None);

        var stored = await _rotations.GetAsync(CancellationToken.None);
        stored.Steps.Select(step => (step.RoutineId, step.Weeks)).ShouldBe([("light", 3)]);
    }

    [Fact]
    public async Task DeletingARoutine_TakesItsStepsOutOfTheRotation()
    {
        await _rotations.ReplaceAsync(Rotation(("weekdays", 2), ("light", 1)), CancellationToken.None);

        await _routines.DeleteAsync("light", CancellationToken.None);

        var stored = await _rotations.GetAsync(CancellationToken.None);
        stored.Steps.Select(step => step.RoutineId).ShouldBe(["weekdays"]);
    }

    private static RoutineRotation Rotation(params (string RoutineId, int Weeks)[] steps) =>
        RoutineRotation.Create(Monday, steps.Select(step => RotationStep.Create(step.RoutineId, step.Weeks)).ToList());
}
