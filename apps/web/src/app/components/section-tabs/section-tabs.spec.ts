import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FINANCES_SECTIONS } from '../../core/finances/finances-section';
import { ROUTINES_SECTIONS } from '../../core/routines/routines-section';
import { SectionTabs } from './section-tabs';

@Component({ template: '' })
class BlankPage {}

function renderTabs(sections: typeof ROUTINES_SECTIONS): HTMLElement {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: '**', component: BlankPage }])],
  });
  const fixture = TestBed.createComponent(SectionTabs);
  fixture.componentRef.setInput('sections', sections);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SectionTabs', () => {
  it('links every section of the module given', () => {
    const element = renderTabs(FINANCES_SECTIONS);

    const links = [...element.querySelectorAll('a')].map((link) => [
      link.textContent?.trim(),
      link.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Overview', '/finances/overview'],
      ['Income split', '/finances/income-split'],
      ['Transactions', '/finances/transactions'],
      ['Banks & Cards', '/finances/accounts'],
      ['To pay & receive', '/finances/bills'],
    ]);
  });

  it('keeps the routines tabs in header order', () => {
    const element = renderTabs(ROUTINES_SECTIONS);

    expect([...element.querySelectorAll('a')].map((link) => link.textContent?.trim())).toEqual([
      'Today',
      'Routine',
      'Categories & Goals',
      'History',
    ]);
  });
});
