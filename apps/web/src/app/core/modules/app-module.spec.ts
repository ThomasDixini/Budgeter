import { AppModule, accentRgbVariable, isModuleAvailable } from './app-module';
import { APP_MODULES } from './module-catalog';

describe('isModuleAvailable', () => {
  it('is true when the module has a route', () => {
    const finances: AppModule = { ...APP_MODULES[1], route: '/finances' };

    expect(isModuleAvailable(finances)).toBe(true);
  });

  it('is false for a coming-soon module', () => {
    const upcoming: AppModule = { ...APP_MODULES[2], route: undefined };

    expect(isModuleAvailable(upcoming)).toBe(false);
  });
});

describe('accentRgbVariable', () => {
  it('points at the RGB token of the accent', () => {
    expect(accentRgbVariable('violet')).toBe('var(--color-violet-rgb)');
  });
});

describe('APP_MODULES', () => {
  it('starts with the routines module, the first one built', () => {
    expect(APP_MODULES[0].kind).toBe('routines');
  });
});
