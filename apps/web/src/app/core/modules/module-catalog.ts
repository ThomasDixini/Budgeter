import { AppModule } from './app-module';

/** Modules shown on the home wheel, in wheel order. */
export const APP_MODULES: readonly AppModule[] = [
  {
    kind: 'routines',
    name: 'Routines & Goals',
    description: 'Organize your daily habits and track the progress of your personal goals.',
    accent: 'mint',
    route: '/routines',
  },
  {
    kind: 'finances',
    name: 'Finances',
    description: 'Track income, expenses and the monthly budget in one place.',
    accent: 'violet',
    route: '/finances',
  },
  {
    kind: 'upcoming',
    name: 'Coming soon',
    description: 'A new module will show up here.',
    accent: 'sky',
  },
  {
    kind: 'upcoming',
    name: 'Coming soon',
    description: 'A new module will show up here.',
    accent: 'orchid',
  },
];
