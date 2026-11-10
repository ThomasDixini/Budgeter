using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Configuration;
using Orbit.Api.Domain.Users;
using Orbit.Api.Infrastructure.Auth;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

public sealed class Pbkdf2PasswordHasherTests
{
    private readonly Pbkdf2PasswordHasher _hasher = new();

    [Fact]
    public void Verify_AcceptsThePasswordThatWasHashed()
    {
        var hash = _hasher.Hash("orbit-2026");

        _hasher.Verify("orbit-2026", hash).ShouldBeTrue();
    }

    [Fact]
    public void Verify_RejectsAnotherPassword()
    {
        _hasher.Verify("orbit-2027", _hasher.Hash("orbit-2026")).ShouldBeFalse();
    }

    [Fact]
    public void Hash_DiffersEachTimeBecauseOfTheSalt_AndNeverHoldsThePassword()
    {
        var first = _hasher.Hash("orbit-2026");

        first.ShouldNotBe(_hasher.Hash("orbit-2026"));
        first.ShouldNotContain("orbit-2026");
    }

    [Theory]
    [InlineData("")]
    [InlineData("plain-text")]
    [InlineData("pbkdf2-sha256$600000$not-base64$also-not")]
    [InlineData("pbkdf2-sha256$0$AAAA$AAAA")]
    [InlineData("md5$1$AAAA$AAAA")]
    public void Verify_AMalformedHashIsAMismatchNotAnError(string hash)
    {
        _hasher.Verify("orbit-2026", hash).ShouldBeFalse();
    }
}

public sealed class AuthOptionsTests
{
    private static IConfiguration Configuration(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(pair => pair.Key, pair => (string?)pair.Value))
            .Build();

    [Fact]
    public void ASigningKeyThatIsTooShortFailsFast()
    {
        var error = Should.Throw<InvalidOperationException>(() =>
            AuthOptions.FromConfiguration(Configuration((AuthOptions.SigningKeyKey, "short")), isDevelopment: false, KeyPath()));

        error.Message.ShouldContain("received 5");
    }

    [Fact]
    public void AMissingSigningKeyFailsFastOutsideDevelopment()
    {
        Should.Throw<InvalidOperationException>(() =>
            AuthOptions.FromConfiguration(Configuration(), isDevelopment: false, KeyPath()));
    }

    [Fact]
    public void AMissingSigningKeyGetsARandomOneInDevelopment_KeptSoARestartKeepsTokensValid()
    {
        var path = KeyPath();

        var first = AuthOptions.FromConfiguration(Configuration(), isDevelopment: true, path);
        var afterRestart = AuthOptions.FromConfiguration(Configuration(), isDevelopment: true, path);
        var otherMachine = AuthOptions.FromConfiguration(Configuration(), isDevelopment: true, KeyPath());

        first.SigningKey.Length.ShouldBe(AuthOptions.MinSigningKeyBytes);
        afterRestart.SigningKey.ShouldBe(first.SigningKey);
        otherMachine.SigningKey.ShouldNotBe(first.SigningKey);
    }

    private static string KeyPath() => Path.Combine(Path.GetTempPath(), $"orbit-test-key-{Guid.NewGuid():N}");

    [Fact]
    public void LifetimesDefaultToTwelveHoursAndThirtyDays()
    {
        var options = AuthOptions.FromConfiguration(
            Configuration((AuthOptions.SigningKeyKey, new string('k', 32))), isDevelopment: false, KeyPath());

        (options.Lifetime, options.RememberedLifetime).ShouldBe((TimeSpan.FromHours(12), TimeSpan.FromDays(30)));
    }
}

public sealed class JwtTokenIssuerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 10, 12, 0, 0, TimeSpan.Zero);

    private static JwtTokenIssuer Issuer() => new(
        new AuthOptions(new byte[32], "orbit-api", TimeSpan.FromHours(12), TimeSpan.FromDays(30)),
        new FixedTimeProvider(Now));

    private static JwtSecurityToken Read(string token) => new JwtSecurityTokenHandler().ReadJwtToken(token);

    [Fact]
    public void TheTokenNamesTheUserAsItsSubject()
    {
        var user = User.Register("ana@mail.com", "Ana");

        var token = Issuer().Issue(user, remember: false);

        Read(token.Value).Subject.ShouldBe(user.Id);
    }

    [Fact]
    public void ATokenLastsHoursUnlessTheUserAskedToStaySignedIn()
    {
        var user = User.Register("ana@mail.com", "Ana");

        Issuer().Issue(user, remember: false).ExpiresAt.ShouldBe(Now.AddHours(12));
        Issuer().Issue(user, remember: true).ExpiresAt.ShouldBe(Now.AddDays(30));
    }

    [Fact]
    public void TheTokenHoldsNoEmailOrPassword()
    {
        var token = Issuer().Issue(User.Register("ana@mail.com", "Ana"), remember: false);

        Read(token.Value).Claims.Select(claim => claim.Type).ShouldBe(["sub", "jti", "nbf", "exp", "iss", "aud"], ignoreOrder: true);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
