import { TestBed } from '@angular/core/testing';
import { PageHeading } from './page-heading';

function renderHeading(inputs: { description?: string; eyebrowIcon?: 'routines' }): HTMLElement {
  const fixture = TestBed.createComponent(PageHeading);
  fixture.componentRef.setInput('eyebrow', 'Routines & Goals');
  fixture.componentRef.setInput('heading', 'My routine');
  fixture.componentRef.setInput('description', inputs.description);
  fixture.componentRef.setInput('eyebrowIcon', inputs.eyebrowIcon);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PageHeading', () => {
  it('renders the heading as the page title', () => {
    const element = renderHeading({});

    expect(element.querySelector('h1')?.textContent).toBe('My routine');
  });

  it('shows the description when given', () => {
    const element = renderHeading({ description: 'Set your hours.' });

    expect(element.querySelector('.description')?.textContent).toBe('Set your hours.');
  });

  it('omits the description and icon when absent', () => {
    const element = renderHeading({});

    expect(element.querySelector('.description')).toBeNull();
    expect(element.querySelector('app-module-icon')).toBeNull();
  });

  it('prefixes the eyebrow with the module icon when asked', () => {
    const element = renderHeading({ eyebrowIcon: 'routines' });

    expect(element.querySelector('.ui-eyebrow app-module-icon')).not.toBeNull();
  });
});
