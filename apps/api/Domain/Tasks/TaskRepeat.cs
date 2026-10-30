namespace Budgeter.Api.Domain.Tasks;

/// <summary>How often a task shows up on the Today list.</summary>
public enum TaskRepeat
{
    /// <summary>A single day, given by the task's date.</summary>
    Once,

    /// <summary>Every day.</summary>
    Daily,

    /// <summary>On the task's weekdays.</summary>
    Weekly,
}
