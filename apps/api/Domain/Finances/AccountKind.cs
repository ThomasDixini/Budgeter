namespace Budgeter.Api.Domain.Finances;

/// <summary>Where money is kept: a bank account holds a balance, a credit card builds up an invoice.</summary>
public enum AccountKind
{
    BankAccount,
    CreditCard,
}
