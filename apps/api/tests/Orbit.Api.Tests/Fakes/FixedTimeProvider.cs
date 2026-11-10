namespace Orbit.Api.Tests.Fakes;

/// <summary>A clock stopped at one moment, in a time zone of the test's choice.</summary>
internal sealed class FixedTimeProvider(DateTimeOffset now, TimeZoneInfo localTimeZone) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => now.ToUniversalTime();

    public override TimeZoneInfo LocalTimeZone => localTimeZone;
}
