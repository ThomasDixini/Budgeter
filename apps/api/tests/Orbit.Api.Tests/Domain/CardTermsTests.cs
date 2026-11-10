using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class CardTermsTests
{
    /// <summary>Closes on the 3rd, due on the 10th of the same month.</summary>
    private static readonly CardTerms ClosesThirdDueTenth = CardTerms.Create(500000, closingDay: 3, dueDay: 10);

    [Fact]
    public void CycleContaining_ADayBeforeTheClosingDay_EndsOnThisMonthsClosingDay()
    {
        var cycle = ClosesThirdDueTenth.CycleContaining(new DateOnly(2026, 11, 2));

        cycle.ShouldBe(new InvoiceCycle(new DateOnly(2026, 10, 3), new DateOnly(2026, 11, 3), new DateOnly(2026, 11, 10)));
    }

    [Fact]
    public void CycleContaining_TheClosingDay_GoesToTheNextInvoice()
    {
        var cycle = ClosesThirdDueTenth.CycleContaining(new DateOnly(2026, 11, 3));

        (cycle.StartsOn, cycle.ClosesOn, cycle.DueOn)
            .ShouldBe((new DateOnly(2026, 11, 3), new DateOnly(2026, 12, 3), new DateOnly(2026, 12, 10)));
    }

    [Fact]
    public void CycleContaining_DueBeforeTheClosingDay_IsDueTheMonthAfterClosing()
    {
        var closesTwentyFifthDueFifth = CardTerms.Create(500000, closingDay: 25, dueDay: 5);

        var cycle = closesTwentyFifthDueFifth.CycleContaining(new DateOnly(2026, 12, 20));

        (cycle.ClosesOn, cycle.DueOn).ShouldBe((new DateOnly(2026, 12, 25), new DateOnly(2027, 1, 5)));
    }

    [Fact]
    public void CycleContaining_AClosingDayPastAShortMonth_ClosesOnItsLastDay()
    {
        var closesThirtyFirst = CardTerms.Create(500000, closingDay: 31, dueDay: 8);

        var cycle = closesThirtyFirst.CycleContaining(new DateOnly(2027, 2, 10));

        (cycle.StartsOn, cycle.ClosesOn).ShouldBe((new DateOnly(2027, 1, 31), new DateOnly(2027, 2, 28)));
    }

    [Fact]
    public void CycleBefore_IsTheInvoiceThatClosedWhenThisOneStarted()
    {
        var open = ClosesThirdDueTenth.CycleContaining(new DateOnly(2026, 11, 2));

        var closed = ClosesThirdDueTenth.CycleBefore(open);

        closed.ShouldBe(new InvoiceCycle(new DateOnly(2026, 9, 3), new DateOnly(2026, 10, 3), new DateOnly(2026, 10, 10)));
    }

    [Fact]
    public void InvoiceCycle_ContainsItsFirstDayButNotItsClosingDay()
    {
        var cycle = ClosesThirdDueTenth.CycleContaining(new DateOnly(2026, 11, 2));

        (cycle.Contains(new DateOnly(2026, 10, 3)), cycle.Contains(new DateOnly(2026, 11, 3))).ShouldBe((true, false));
    }

    [Theory]
    [InlineData(0, 3, 10)]
    [InlineData(MoneyTransaction.MaxAbsoluteAmountCents + 1, 3, 10)]
    [InlineData(500000, 0, 10)]
    [InlineData(500000, 3, 32)]
    public void Create_RejectsALimitOrDayOutOfRange(long limitCents, int closingDay, int dueDay)
    {
        Should.Throw<DomainRuleException>(() => CardTerms.Create(limitCents, closingDay, dueDay));
    }
}
