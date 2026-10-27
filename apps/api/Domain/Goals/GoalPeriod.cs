namespace Budgeter.Api.Domain.Goals;

/// <summary>Window in which a goal must be reached; custom periods end on a deadline.</summary>
public enum GoalPeriod
{
    Daily,
    Weekly,
    Monthly,
    Yearly,
    Custom,
}
