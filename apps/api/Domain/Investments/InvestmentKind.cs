namespace Orbit.Api.Domain.Investments;

/// <summary>What sort of asset an investment is; only used to label and group it.</summary>
public enum InvestmentKind
{
    Stock,
    RealEstateFund,
    FixedIncome,
    Fund,
    Other,
}
