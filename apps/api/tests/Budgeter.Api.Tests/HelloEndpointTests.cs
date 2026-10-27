using System.Net;
using Budgeter.Api.Tests.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests;

public class HelloEndpointTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public HelloEndpointTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetRoot_ReturnsHelloWorld()
    {
        var response = await _client.GetAsync("/");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldBe("Hello World!");
    }
}
