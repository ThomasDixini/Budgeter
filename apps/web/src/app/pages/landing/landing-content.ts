import { ModuleAccent } from '../../core/modules/app-module';

export interface LandingHighlight {
  readonly text: string;
  readonly accent: ModuleAccent;
}

export interface LandingFeature {
  readonly title: string;
  readonly text: string;
  readonly module: 'Routines & Goals' | 'Finances';
  /** SVG path data of a 24x24 stroke icon. */
  readonly icon: string;
}

export interface LandingStep {
  readonly title: string;
  readonly text: string;
  readonly accent: ModuleAccent;
}

/** Short selling points shown in the strip right under the hero. */
export const LANDING_HIGHLIGHTS: readonly LandingHighlight[] = [
  { text: 'Routine split into blocks', accent: 'mint' },
  { text: 'Goals by frequency or target', accent: 'sky' },
  { text: 'Income split your way', accent: 'violet' },
  { text: 'Investments compared to the CDI', accent: 'orchid' },
];

/** What the first version already does, one card each. */
export const LANDING_FEATURES: readonly LandingFeature[] = [
  {
    title: 'Routine by blocks',
    text: 'Hours of the day split your way, with weekdays and different routines.',
    module: 'Routines & Goals',
    icon: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  },
  {
    title: 'Categories of your own',
    text: 'Study, networking, reading: you create them, pick a color and link them to blocks.',
    module: 'Routines & Goals',
    icon: 'M4 6h7v7H4zM13 6h7v7h-7zM4 15h7v5H4zM13 15h7v5h-7z',
  },
  {
    title: 'Goals that make sense',
    text: 'By frequency or by target, over any period, with progress in one tap.',
    module: 'Routines & Goals',
    icon: 'M5 21V4h11l-2 4 2 4H5',
  },
  {
    title: 'Income split',
    text: 'Set a percentage for each part of your income and compare it with what happened.',
    module: 'Finances',
    icon: 'M12 3v9l7 4M12 3a9 9 0 1 0 9 9',
  },
  {
    title: 'Spending and income',
    text: 'A history of transactions filtered by type, account, card and category.',
    module: 'Finances',
    icon: 'M4 7h16M4 12h16M4 17h10',
  },
  {
    title: 'Banks and cards',
    text: 'Balances, bills, used limit and the spending of each card kept apart.',
    module: 'Finances',
    icon: 'M3 5h18v14H3zM3 10h18M7 15h3',
  },
  {
    title: 'To pay and to receive',
    text: 'Due dates grouped, a warning when something is late and the expected balance.',
    module: 'Finances',
    icon: 'M7 3v4M17 3v4M4 8h16M5 5h14v15H5z',
  },
  {
    title: 'Investments vs CDI',
    text: 'Average price, current value, return and charts by class or asset.',
    module: 'Finances',
    icon: 'M4 19l5-6 4 3 7-9',
  },
  {
    title: 'Net worth over time',
    text: 'What you have today, what it is made of and how it grew month by month.',
    module: 'Finances',
    icon: 'M4 20h16M7 16V10M12 16V6M17 16v-4',
  },
];

/** The three steps of the "how it works" section. */
export const LANDING_STEPS: readonly LandingStep[] = [
  {
    title: 'Build your routine',
    text: 'Set the hours of the day and split them into blocks. The blocks that matter get a category you created.',
    accent: 'mint',
  },
  {
    title: 'Turn categories into goals',
    text: 'Inside each category, create goals by frequency or by target and log progress with a tap.',
    accent: 'sky',
  },
  {
    title: 'Spin to your money',
    text: 'On the wheel, move to Finances: split your income, follow spending and watch your investments grow.',
    accent: 'violet',
  },
];
