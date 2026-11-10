using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.IdentityModel.Tokens;
using Orbit.Api.Endpoints;
using Orbit.Api.Infrastructure.Auth;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class AuthEndpointsTests : IDisposable
{
    private const string Password = "orbit-2026";

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _anonymous;

    public AuthEndpointsTests()
    {
        _anonymous = _factory.CreateAnonymousClient();
    }

    public void Dispose() => _factory.Dispose();

    private Task<HttpResponseMessage> RegisterAsync(string email = "ana@mail.com", string password = Password) =>
        _anonymous.PostAsJsonAsync("/auth/register", new RegisterRequest("Ana", email, password));

    private static HttpClient ClientWith(HttpClient template, string token)
    {
        template.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return template;
    }

    [Fact]
    public async Task Register_CreatesTheAccountAndReturnsASession()
    {
        var response = await RegisterAsync("Ana@Mail.com");

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var session = (await response.Content.ReadFromJsonAsync<AuthResponse>())!;
        session.User.Email.ShouldBe("ana@mail.com");
        session.Token.ShouldNotBeNullOrEmpty();
    }

    [Fact]
    public async Task Register_TheResponseNeverCarriesThePasswordOrItsHash()
    {
        var body = await (await RegisterAsync()).Content.ReadAsStringAsync();

        body.ShouldNotContain(Password);
        body.ShouldNotContain("pbkdf2");
    }

    [Fact]
    public async Task Register_ARepeatedEmailIsAConflictEvenInAnotherCase()
    {
        await RegisterAsync("ana@mail.com");

        var response = await RegisterAsync("ANA@mail.com");

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Theory]
    [InlineData("ana@mail.com", "short")]
    [InlineData("not-an-email", Password)]
    public async Task Register_InvalidInputIsBadRequest(string email, string password)
    {
        var response = await RegisterAsync(email, password);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldNotContain("pbkdf2");
    }

    [Fact]
    public async Task Login_ReturnsASessionThatOpensTheApi()
    {
        await RegisterAsync();

        var response = await _anonymous.PostAsJsonAsync("/auth/login", new LoginRequest("ana@mail.com", Password));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var token = (await response.Content.ReadFromJsonAsync<AuthResponse>())!.Token;
        var categories = await ClientWith(_factory.CreateAnonymousClient(), token).GetAsync("/categories");
        categories.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("ana@mail.com", "wrong-password")]
    [InlineData("nobody@mail.com", Password)]
    public async Task Login_AnyMismatchIsUnauthorizedWithTheSameBody(string email, string password)
    {
        await RegisterAsync();

        var response = await _anonymous.PostAsJsonAsync("/auth/login", new LoginRequest(email, password));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadAsStringAsync()).ShouldNotContain(email);
    }

    [Fact]
    public async Task Login_RememberIssuesATokenThatLastsWeeks()
    {
        await RegisterAsync();

        var response = await _anonymous.PostAsJsonAsync(
            "/auth/login", new LoginRequest("ana@mail.com", Password, Remember: true));

        var session = (await response.Content.ReadFromJsonAsync<AuthResponse>())!;
        session.ExpiresAt.ShouldBeGreaterThan(DateTimeOffset.UtcNow.AddDays(29));
    }

    [Theory]
    [InlineData("/categories")]
    [InlineData("/goals")]
    [InlineData("/routines")]
    [InlineData("/tasks")]
    [InlineData("/accounts")]
    [InlineData("/investments")]
    [InlineData("/backup")]
    public async Task EveryDataRoute_RejectsARequestWithoutAToken(string route)
    {
        var response = await _anonymous.GetAsync(route);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Health_StaysOpen()
    {
        (await _anonymous.GetAsync("/health")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Theory]
    [InlineData("garbage")]
    [InlineData("a.b.c")]
    public async Task AMalformedTokenIsUnauthorized(string token)
    {
        var response = await ClientWith(_factory.CreateAnonymousClient(), token).GetAsync("/categories");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ATokenSignedWithAnotherKeyIsUnauthorized()
    {
        var forged = Mint(new SymmetricSecurityKey(new byte[32]), DateTime.UtcNow.AddHours(1));

        var response = await ClientWith(_factory.CreateAnonymousClient(), forged).GetAsync("/categories");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnExpiredTokenIsUnauthorized()
    {
        var key = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(ApiFactory.SigningKey));
        var expired = Mint(key, DateTime.UtcNow.AddHours(-1));

        var response = await ClientWith(_factory.CreateAnonymousClient(), expired).GetAsync("/categories");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ATokenWithTheNoneAlgorithmIsUnauthorized()
    {
        var unsigned = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            "orbit-api", AuthOptions.Audience, [new System.Security.Claims.Claim("sub", "someone")],
            DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddHours(1)));

        var response = await ClientWith(_factory.CreateAnonymousClient(), unsigned).GetAsync("/categories");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TwoAccounts_NeverSeeEachOthersRecords()
    {
        var ana = _factory.CreateClientFor("ana@mail.com");
        var bia = _factory.CreateClientFor("bia@mail.com");
        await ana.PostAsJsonAsync("/categories", new CreateCategoryRequest("study", "Study", "#7DD3FC"));

        var seenByBia = await bia.GetFromJsonAsync<CategoryResponse[]>("/categories");
        var createdByBia = await bia.PostAsJsonAsync("/categories", new CreateCategoryRequest("study", "Music", "#86EFAC"));

        seenByBia.ShouldBeEmpty();
        createdByBia.StatusCode.ShouldBe(HttpStatusCode.Created);
        (await ana.GetFromJsonAsync<CategoryResponse[]>("/categories"))!.Single().Name.ShouldBe("Study");
    }

    [Fact]
    public async Task AnAccount_CannotEditOrDeleteAnotherAccountsRecord()
    {
        var ana = _factory.CreateClientFor("ana@mail.com");
        var bia = _factory.CreateClientFor("bia@mail.com");
        await ana.PostAsJsonAsync("/categories", new CreateCategoryRequest("study", "Study", "#7DD3FC"));

        var edit = await bia.PutAsJsonAsync("/categories/study", new UpdateCategoryRequest("Mine", "#86EFAC"));
        var delete = await bia.DeleteAsync("/categories/study");

        edit.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        delete.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ana.GetFromJsonAsync<CategoryResponse[]>("/categories"))!.Single().Name.ShouldBe("Study");
    }

    [Fact]
    public async Task EachNewAccount_StartsWithItsOwnFinanceCategories()
    {
        var ana = _factory.CreateClientFor("ana@mail.com");
        var bia = _factory.CreateClientFor("bia@mail.com");

        var fromAna = await ana.GetStringAsync("/finance-categories");
        var fromBia = await bia.GetStringAsync("/finance-categories");

        fromAna.ShouldContain("housing");
        fromBia.ShouldBe(fromAna);
    }

    private static string Mint(SecurityKey key, DateTime expires) =>
        new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            "orbit-api",
            AuthOptions.Audience,
            [new System.Security.Claims.Claim("sub", "someone")],
            expires.AddHours(-2),
            expires,
            new SigningCredentials(key, SecurityAlgorithms.HmacSha256)));
}
