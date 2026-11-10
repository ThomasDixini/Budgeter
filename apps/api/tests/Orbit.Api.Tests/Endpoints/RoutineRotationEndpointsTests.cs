using System.Net;
using System.Net.Http.Json;
using Orbit.Api.Endpoints;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class RoutineRotationEndpointsTests : IDisposable
{
    private static readonly SaveRoutineRequest Normal = new("Normal", [0, 1, 2, 3, 4], "08:00", "17:00", []);
    private static readonly SaveRoutineRequest Intense = new("Intense", [0, 1, 2, 3, 4], "07:00", "22:00", []);

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public RoutineRotationEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Get_BeforeAnySaveAnswersWithNoSteps()
    {
        var rotation = await _client.GetFromJsonAsync<RoutineRotationBody>("/routine-rotation");

        rotation!.Steps.ShouldBeEmpty();
    }

    [Fact]
    public async Task Put_StoresTheRotationOfRoutinesSharingWeekdays()
    {
        await SaveRoutinesAsync();
        var body = new RoutineRotationBody(new DateOnly(2026, 11, 5), [new("normal", 2), new("intense", 1)]);

        var response = await _client.PutAsJsonAsync("/routine-rotation", body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var stored = await _client.GetFromJsonAsync<RoutineRotationBody>("/routine-rotation");
        stored!.StartsOn.ShouldBe(new DateOnly(2026, 11, 2));
        stored.Steps.ShouldBe([new("normal", 2), new("intense", 1)]);
    }

    [Fact]
    public async Task Put_UnknownRoutineIsNotFoundNamingIt()
    {
        var body = new RoutineRotationBody(new DateOnly(2026, 11, 2), [new("light", 1)]);

        var response = await _client.PutAsJsonAsync("/routine-rotation", body);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await response.Content.ReadAsStringAsync()).ShouldContain("light");
    }

    [Fact]
    public async Task Put_TooManyWeeksIsBadRequestNamingTheValue()
    {
        await SaveRoutinesAsync();
        var body = new RoutineRotationBody(new DateOnly(2026, 11, 2), [new("normal", 40)]);

        var response = await _client.PutAsJsonAsync("/routine-rotation", body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("40");
    }

    [Fact]
    public async Task DeletingARoutine_DropsItFromTheRotation()
    {
        await SaveRoutinesAsync();
        var body = new RoutineRotationBody(new DateOnly(2026, 11, 2), [new("normal", 2), new("intense", 1)]);
        (await _client.PutAsJsonAsync("/routine-rotation", body)).EnsureSuccessStatusCode();

        await _client.DeleteAsync("/routines/intense");

        var stored = await _client.GetFromJsonAsync<RoutineRotationBody>("/routine-rotation");
        stored!.Steps.ShouldBe([new("normal", 2)]);
    }

    /// <summary>Two routines on the same weekdays, which only a rotation tells apart.</summary>
    private async Task SaveRoutinesAsync()
    {
        (await _client.PutAsJsonAsync("/routines/normal", Normal)).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/routines/intense", Intense)).EnsureSuccessStatusCode();
    }
}
