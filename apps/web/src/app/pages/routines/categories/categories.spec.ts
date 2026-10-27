import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { Categories } from './categories';

function createPage(): ComponentFixture<Categories> {
  const fixture = TestBed.createComponent(Categories);
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<Categories>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function openForm(fixture: ComponentFixture<Categories>): void {
  element(fixture).querySelector<HTMLButtonElement>('.new-category')?.click();
  fixture.detectChanges();
}

function typeName(fixture: ComponentFixture<Categories>, name: string): void {
  const input = element(fixture).querySelector<HTMLInputElement>('.create-form input');
  if (input === null) throw new Error('Expected the category name input, found none');
  input.value = name;
  input.dispatchEvent(new Event('input'));
}

function submit(fixture: ComponentFixture<Categories>): void {
  element(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
  fixture.detectChanges();
}

describe('Categories', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('summarizes each category on its card', () => {
    const card = element(createPage()).querySelector('.card');

    expect(card?.getAttribute('href')).toBe('/routines/categories/study');
    expect(card?.textContent).toContain('3 goals');
    expect(card?.textContent).toContain('1 block · 7h30 per week');
  });

  it('opens and cancels the new category form', () => {
    const fixture = createPage();
    openForm(fixture);

    element(fixture).querySelector<HTMLButtonElement>('.form-actions .ui-button-ghost')?.click();
    fixture.detectChanges();

    expect(element(fixture).querySelector('.create-form')).toBeNull();
  });

  it('ignores a blank name', () => {
    const fixture = createPage();
    openForm(fixture);

    submit(fixture);

    expect(TestBed.inject(RoutinesStore).categories()).toHaveLength(4);
  });

  it('creates a category with the picked color and opens it', () => {
    const fixture = createPage();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    openForm(fixture);
    typeName(fixture, 'Languages');
    element(fixture).querySelectorAll<HTMLButtonElement>('.swatch')[5].click();

    submit(fixture);

    const created = TestBed.inject(RoutinesStore).categories().at(-1);
    expect(created).toMatchObject({ name: 'Languages', color: '#C4B5FD' });
    expect(navigate).toHaveBeenCalledWith(['/routines/categories', created?.id], {
      queryParams: { newGoal: true },
    });
  });
});
