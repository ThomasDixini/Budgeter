import { openPage, text } from './routines-page.testing';

describe('Routines & Goals routes', () => {
  it.each([
    ['/routines', 'Monday, October 26', 'Today'],
    ['/routines/routine', 'My routine', 'Routine'],
    ['/routines/categories', 'Categories', 'Categories & Goals'],
    ['/routines/categories/study', 'Study', 'Categories & Goals'],
    ['/routines/history', 'Sunday, October 25', 'History'],
  ])('opens %s with its tab selected', async (url, title, tab) => {
    const element = await openPage(url);

    expect(text(element, 'h1')).toBe(title);
    expect(text(element, '.tab[aria-current="page"]')).toBe(tab);
  });

  it('shows the module dock on every page', async () => {
    const element = await openPage('/routines/routine');

    expect(element.querySelector('app-module-dock')).not.toBeNull();
  });
});
