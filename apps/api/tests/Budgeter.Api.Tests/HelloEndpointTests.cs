using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Shouldly;

namespace Budgeter.Api.Tests;

public class HelloEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HelloEndpointTests(WebApplicationFactory<Program> factory)
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
