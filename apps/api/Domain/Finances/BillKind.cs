namespace Budgeter.Api.Domain.Finances;

/// <summary>Which way a bill moves money: a payable goes out when settled, a receivable comes in.</summary>
public enum BillKind
{
    Payable,
    Receivable,
}
