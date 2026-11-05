import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SAMPLE_ACCOUNTS } from '../../../../core/finances/fake-finances-gateways';
import { Account, AccountDraft } from '../../../../core/finances/finance-references';
import { AccountForm } from './account-form';

const [CHECKING, CARD] = SAMPLE_ACCOUNTS;

interface FormHarness {
  readonly fixture: ComponentFixture<AccountForm>;
  readonly saved: AccountDraft[];
  readonly removed: number[];
}

function createForm(account?: Account): FormHarness {
  const fixture = TestBed.createComponent(AccountForm);
  if (account !== undefined) fixture.componentRef.setInput('account', account);
  const harness: FormHarness = { fixture, saved: [], removed: [] };
  fixture.componentInstance.save.subscribe((draft) => harness.saved.push(draft));
  fixture.componentInstance.remove.subscribe(() => harness.removed.push(1));
  fixture.detectChanges();
  return harness;
}

function element(fixture: ComponentFixture<AccountForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function fill(fixture: ComponentFixture<AccountForm>, name: string, value: string): void {
  const field = element(fixture).querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function clickButton(fixture: ComponentFixture<AccountForm>, label: string): void {
  const buttons = [...element(fixture).querySelectorAll<HTMLButtonElement>('button')];
  buttons.find((button) => button.textContent?.trim() === label)!.click();
  fixture.detectChanges();
}

function submitButton(fixture: ComponentFixture<AccountForm>): HTMLButtonElement {
  return element(fixture).querySelector<HTMLButtonElement>('[type="submit"]')!;
}

describe('AccountForm', () => {
  it('adds a bank account with an overdrawn opening balance', () => {
    const { fixture, saved } = createForm();
    fill(fixture, 'name', ' Nubank ');
    fill(fixture, 'openingBalance', '-150,5');

    submitButton(fixture).click();

    expect(saved).toEqual([{ name: 'Nubank', kind: 'bankAccount', openingBalanceCents: -15050 }]);
  });

  it('adds a credit card with its limit, closing day and due day', () => {
    const { fixture, saved } = createForm();
    clickButton(fixture, 'Credit card');
    fill(fixture, 'name', 'Visa');
    fill(fixture, 'limit', '5000');
    fill(fixture, 'closingDay', '3');
    fill(fixture, 'dueDay', '10');

    submitButton(fixture).click();

    expect(saved).toEqual([
      {
        name: 'Visa',
        kind: 'creditCard',
        openingBalanceCents: 0,
        card: { limitCents: 500000, closingDay: 3, dueDay: 10 },
      },
    ]);
  });

  it('keeps saving off until the card terms are complete and says which day is wrong', () => {
    const { fixture } = createForm();
    clickButton(fixture, 'Credit card');
    fill(fixture, 'name', 'Visa');
    fill(fixture, 'limit', '5000');
    fill(fixture, 'closingDay', '32');

    expect([submitButton(fixture).disabled, element(fixture).textContent]).toEqual([
      true,
      expect.stringContaining('Enter days of the month from 1 to 31.'),
    ]);
  });

  it('refills the fields from the account being edited, which keeps its kind', () => {
    const { fixture } = createForm(CHECKING);
    const kindGroup = element(fixture).querySelector('[aria-label="Kind"]');
    const balance = element(fixture).querySelector<HTMLInputElement>(
      'input[name="openingBalance"]',
    )!;

    expect([kindGroup, balance.value]).toEqual([null, '1000.00']);
  });

  it("saves a card's edited terms and offers to delete it", () => {
    const { fixture, saved, removed } = createForm(CARD);
    fill(fixture, 'dueDay', '12');

    submitButton(fixture).click();
    clickButton(fixture, 'Delete');

    expect([saved[0].card, removed.length]).toEqual([
      { limitCents: 500000, closingDay: 3, dueDay: 12 },
      1,
    ]);
  });
});
