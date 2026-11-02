using System.Net;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

public class HealthEndpointTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetHealth_AnswersNoContentOnceTheApiIsUp()
    {
        var response = await _client.GetAsync("/health");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }
}
