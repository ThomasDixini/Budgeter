import { Account } from './finance-references';

/** One thing that adds to or takes from the net worth, in cents. */
export interface NetWorthItem {
  readonly id: string;
  readonly name: string;
  readonly cents: number;
}

/** An investment as the net worth sees it: what it is worth today (its cost while it has no price). */
export interface HeldInvestment {
  readonly id: string;
  readonly name: string;
  readonly valueCents: number;
}

/** What is owned, what is owed, and what is left. */
export interface NetWorth {
  readonly bankAccounts: readonly NetWorthItem[];
  readonly investments: readonly NetWorthItem[];
  /** What is owed on each credit card, as positive cents; a card paid ahead owes nothing. */
  readonly cards: readonly NetWorthItem[];
  readonly bankCents: number;
  readonly investmentsCents: number;
  readonly cardsOwedCents: number;
  /** Bank balances plus investments. */
  readonly assetsCents: number;
  /** Assets minus what the cards owe; negative when more is owed than owned. */
  readonly totalCents: number;
  /** Share of the assets held in bank accounts, 0–100; 0 when the assets are not above zero. */
  readonly bankPercent: number;
  /** Share of the assets held in investments, 0–100; the two shares always add up to 100 or are both 0. */
  readonly investmentsPercent: number;
}

/**
 * Puts the net worth together from today's balances (bank accounts hold, cards owe) and the investments
 * held. An investment worth nothing (a closed position) is left out of the list.
 * @example netWorth(accounts, new Map([['checking-account', 100000]]), []).totalCents // 100000
 */
export function netWorth(
  accounts: readonly Account[],
  balances: ReadonlyMap<string, number>,
  held: readonly HeldInvestment[],
): NetWorth {
  const bankAccounts = accounts
    .filter((account) => account.kind === 'bankAccount')
    .map((account) => ({
      id: account.id,
      name: account.name,
      cents: balances.get(account.id) ?? 0,
    }));
  const investments = held
    .filter((investment) => investment.valueCents > 0)
    .map((investment) => ({
      id: investment.id,
      name: investment.name,
      cents: investment.valueCents,
    }));
  const cards = accounts
    .filter((account) => account.kind === 'creditCard')
    .map((account) => ({
      id: account.id,
      name: account.name,
      cents: Math.max(0, -(balances.get(account.id) ?? 0)),
    }));
  return summarize(bankAccounts, investments, cards);
}

function summarize(
  bankAccounts: readonly NetWorthItem[],
  investments: readonly NetWorthItem[],
  cards: readonly NetWorthItem[],
): NetWorth {
  const bankCents = sum(bankAccounts);
  const investmentsCents = sum(investments);
  const cardsOwedCents = sum(cards);
  const assetsCents = bankCents + investmentsCents;
  const bankPercent = shareOf(bankCents, assetsCents);
  return {
    bankAccounts,
    investments,
    cards,
    bankCents,
    investmentsCents,
    cardsOwedCents,
    assetsCents,
    totalCents: assetsCents - cardsOwedCents,
    bankPercent,
    investmentsPercent: assetsCents > 0 ? 100 - bankPercent : 0,
  };
}

function sum(items: readonly NetWorthItem[]): number {
  return items.reduce((total, item) => total + item.cents, 0);
}

// Clamped, so an overdrawn account beside investments never gives a share below 0 or above 100.
function shareOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}
