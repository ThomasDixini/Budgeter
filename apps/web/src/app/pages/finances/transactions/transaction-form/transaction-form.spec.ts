import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  SAMPLE_ACCOUNTS,
  SAMPLE_FINANCE_CATEGORIES,
  SAMPLE_OCTOBER,
} from '../../../../core/finances/fake-finances-gateways';
import { Transaction, TransactionDraft } from '../../../../core/finances/transaction';
import { TransactionForm } from './transaction-form';

const [GROCERIES, , SALARY] = SAMPLE_OCTOBER;

interface FormHarness {
  readonly fixture: ComponentFixture<TransactionForm>;
  readonly saved: TransactionDraft[];
  readonly removed: number[];
  readonly dismissed: number[];
}

function createForm(transaction?: Transaction): FormHarness {
  const fixture = TestBed.createComponent(TransactionForm);
  fixture.componentRef.setInput('categories', SAMPLE_FINANCE_CATEGORIES);
  fixture.componentRef.setInput('accounts', SAMPLE_ACCOUNTS);
  fixture.componentRef.setInput('defaultDate', '2026-10-31');
  fixture.componentRef.setInput('defaultAccountId', 'credit-card');
  if (transaction !== undefined) fixture.componentRef.setInput('transaction', transaction);
  const harness: FormHarness = { fixture, saved: [], removed: [], dismissed: [] };
  fixture.componentInstance.save.subscribe((draft) => harness.saved.push(draft));
  fixture.componentInstance.remove.subscribe(() => harness.removed.push(1));
  fixture.componentInstance.dismiss.subscribe(() => harness.dismissed.push(1));
  fixture.detectChanges();
  return harness;
}

function element(fixture: ComponentFixture<TransactionForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function fill(fixture: ComponentFixture<TransactionForm>, selector: string, value: string): void {
  const field = element(fixture).querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
  fixture.detectChanges();
}

function fillExpense(fixture: ComponentFixture<TransactionForm>, amount: string): void {
  fill(fixture, 'input[name="amount"]', amount);
  fill(fixture, 'input[maxlength="80"]', '  Groceries ');
  fill(fixture, 'select', 'food');
}

function clickButton(fixture: ComponentFixture<TransactionForm>, label: string): void {
  const buttons = [...element(fixture).querySelectorAll<HTMLButtonElement>('button')];
  buttons.find((button) => button.textContent?.trim() === label)!.click();
  fixture.detectChanges();
}

function submitButton(fixture: ComponentFixture<TransactionForm>): HTMLButtonElement {
  return element(fixture).querySelector<HTMLButtonElement>('[type="submit"]')!;
}

describe('TransactionForm', () => {
  it('records an expense with a negative amount on the default day and account', () => {
    const { fixture, saved } = createForm();
    fillExpense(fixture, '286,4');

    submitButton(fixture).click();

    expect(saved).toEqual([
      {
        date: '2026-10-31',
        description: 'Groceries',
        categoryId: 'food',
        accountId: 'credit-card',
        amountCents: -28640,
      },
    ]);
  });

  it('records income with a positive amount', () => {
    const { fixture, saved } = createForm();
    clickButton(fixture, 'Income');
    fillExpense(fixture, '9500');

    submitButton(fixture).click();

    expect(saved[0].amountCents).toBe(950000);
  });

  it('cannot save until amount, description and category are given', () => {
    const { fixture } = createForm();
    fill(fixture, 'input[name="amount"]', '10');

    expect(submitButton(fixture).disabled).toBe(true);
  });

  it('says what is wrong with an amount it cannot read', () => {
    const { fixture } = createForm();

    fill(fixture, 'input[name="amount"]', '1.234,56');

    expect(element(fixture).querySelector('.error')?.textContent).toContain('above zero');
  });

  it('opens on the transaction being edited', () => {
    const { fixture } = createForm(SALARY);

    const amount = element(fixture).querySelector<HTMLInputElement>('input[name="amount"]')!;
    const pressed = element(fixture).querySelector('[aria-pressed="true"]')?.textContent?.trim();
    expect([amount.value, pressed, submitButton(fixture).textContent?.trim()]).toEqual([
      '9500.00',
      'Income',
      'Save transaction',
    ]);
  });

  it('saves an edit with the fields changed', () => {
    const { fixture, saved } = createForm(GROCERIES);
    fill(fixture, 'input[name="amount"]', '300');

    submitButton(fixture).click();

    const { id, ...draft } = GROCERIES;
    expect([saved, id]).toEqual([[{ ...draft, amountCents: -30000 }], 'groceries']);
  });

  it('offers to delete only while editing', () => {
    const editing = createForm(GROCERIES);
    clickButton(editing.fixture, 'Delete');

    const creating = createForm();
    const labels = [...element(creating.fixture).querySelectorAll('button')].map((button) =>
      button.textContent?.trim(),
    );
    expect([editing.removed.length, labels.includes('Delete')]).toEqual([1, false]);
  });

  it('closes on Escape', () => {
    const { fixture, dismissed } = createForm();

    element(fixture)
      .querySelector('form')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(dismissed.length).toBe(1);
  });
});
