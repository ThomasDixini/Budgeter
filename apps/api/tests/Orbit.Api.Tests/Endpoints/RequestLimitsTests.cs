using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public class RequestLimitsTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public RequestLimitsTests(ApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public void Kestrel_RejectsBodiesLargerThan256Kilobytes()
    {
        var options = _factory.Services.GetRequiredService<IOptions<KestrelServerOptions>>().Value;

        options.Limits.MaxRequestBodySize.ShouldBe(256 * 1024);
    }
}
