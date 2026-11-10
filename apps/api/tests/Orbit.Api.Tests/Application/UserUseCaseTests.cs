using Orbit.Api.Application;
using Orbit.Api.Application.Users;
using Orbit.Api.Domain;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public sealed class UserUseCaseTests
{
    private readonly InMemoryUserRepository _users = new();
    private readonly RecordingUserProvisioner _provisioner = new();
    private readonly RegisterUser _register;
    private readonly SignIn _signIn;

    public UserUseCaseTests()
    {
        var hasher = new FakePasswordHasher();
        var tokens = new FakeTokenIssuer();
        _register = new RegisterUser(_users, hasher, _provisioner, tokens);
        _signIn = new SignIn(_users, hasher, tokens);
    }

    private Task<Session> RegisterAnaAsync(string password = "orbit-2026") =>
        _register.ExecuteAsync(new RegisterUserCommand("Ana", "Ana@Mail.com", password), CancellationToken.None);

    [Fact]
    public async Task Register_StoresTheAccountWithANormalizedEmailAndAHashedPassword()
    {
        await RegisterAnaAsync();

        var stored = _users.Users.Single();
        stored.User.Email.ShouldBe("ana@mail.com");
        stored.PasswordHash.ShouldBe("hashed:orbit-2026");
    }

    [Fact]
    public async Task Register_GivesTheNewAccountItsStarterRecordsAndASession()
    {
        var session = await RegisterAnaAsync();

        _provisioner.Provisioned.ShouldBe([session.User.Id]);
        session.Token.Value.ShouldBe($"token-of-{session.User.Id}-short");
    }

    [Fact]
    public async Task Register_AnEmailWithAnAccountIsAConflict()
    {
        await RegisterAnaAsync();

        await Should.ThrowAsync<ConflictException>(() => RegisterAnaAsync());

        _provisioner.Provisioned.Count.ShouldBe(1);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("")]
    public async Task Register_ATooShortPasswordIsRejectedWithoutEchoingIt(string password)
    {
        var error = await Should.ThrowAsync<DomainRuleException>(() => RegisterAnaAsync(password));

        error.Message.ShouldContain("8-128 characters");
        _users.Users.ShouldBeEmpty();
    }

    [Fact]
    public async Task Register_ABlankNameIsRejected()
    {
        await Should.ThrowAsync<DomainRuleException>(() => _register.ExecuteAsync(
            new RegisterUserCommand(" ", "ana@mail.com", "orbit-2026"), CancellationToken.None));
    }

    [Fact]
    public async Task Register_AMalformedEmailIsRejected()
    {
        await Should.ThrowAsync<DomainRuleException>(() => _register.ExecuteAsync(
            new RegisterUserCommand("Ana", "ana-at-mail", "orbit-2026"), CancellationToken.None));
    }

    [Fact]
    public async Task SignIn_MatchingCredentialsOpenASessionForTheAccount()
    {
        var registered = await RegisterAnaAsync();

        var session = await _signIn.ExecuteAsync(
            new SignInCommand(" ANA@mail.com ", "orbit-2026", Remember: false), CancellationToken.None);

        session.User.Id.ShouldBe(registered.User.Id);
    }

    [Fact]
    public async Task SignIn_RememberAsksForALongLivedToken()
    {
        await RegisterAnaAsync();

        var session = await _signIn.ExecuteAsync(
            new SignInCommand("ana@mail.com", "orbit-2026", Remember: true), CancellationToken.None);

        session.Token.Value.ShouldEndWith("-long");
    }

    [Theory]
    [InlineData("ana@mail.com", "wrong-password")]
    [InlineData("nobody@mail.com", "orbit-2026")]
    [InlineData("not-an-email", "orbit-2026")]
    public async Task SignIn_AnyMismatchIsTheSameUnauthorizedAnswer(string email, string password)
    {
        await RegisterAnaAsync();

        var error = await Should.ThrowAsync<UnauthorizedException>(() => _signIn.ExecuteAsync(
            new SignInCommand(email, password, Remember: false), CancellationToken.None));

        error.Message.ShouldNotContain(email);
    }
}
