namespace Orbit.Api.Domain.Finances;

/// <summary>How a bill repeats once it is created; each occurrence is stored as a bill of its own.</summary>
public enum BillRecurrence
{
    /// <summary>Every month, on the day of the first due date (a short month falls on its last day).</summary>
    Monthly,

    /// <summary>Every year, on the date of the first due date.</summary>
    Yearly,

    /// <summary>Every month for a fixed number of installments, each of the same amount.</summary>
    Installments,
}
