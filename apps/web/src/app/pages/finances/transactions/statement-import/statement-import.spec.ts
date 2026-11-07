import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clock } from '../../../../core/calendar/clock';
import { FixedClock } from '../../../../core/calendar/fixed-clock';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
  SAMPLE_ACCOUNTS,
  SAMPLE_FINANCE_CATEGORIES,
} from '../../../../core/finances/fake-finances-gateways';
import {
  FinanceReferencesGateway,
  TransactionsGateway,
} from '../../../../core/finances/transactions-gateway';
import { IdGenerator } from '../../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../../core/ids/sequential-id-generator';
import { ImportResult, StatementImport } from './statement-import';

const HEADER = 'Data,Valor,Identificador,Descrição';

/** A few lines of the bank's file: a Pix sent twice to the same person, a Pix received and an RDB redemption. */
const STATEMENT = [
  HEADER,
  '03/10/2026,57.10,rdb-1,Resgate RDB',
  '05/10/2026,-20.00,pix-1,Transferência enviada pelo Pix - ANA SOUZA - •••.123.456-•• - NU PAGAMENTOS',
  '14/10/2026,-90.00,pix-2,Transferência enviada pelo Pix - ANA SOUZA - •••.123.456-•• - NU PAGAMENTOS',
  '06/10/2026,1000.00,pix-3,Transferência recebida pelo Pix - EMPRESA LTDA - 06.268.608/0001-88 - CC COPERSUL',
].join('\n');

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

interface Rendered {
  fixture: ComponentFixture<StatementImport>;
  gateway: FakeTransactionsGateway;
  results: ImportResult[];
}

function render(gateway = new FakeTransactionsGateway()): Rendered {
  TestBed.configureTestingModule({
    providers: [
      { provide: TransactionsGateway, useValue: gateway },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(new Date(2026, 9, 31, 20, 0)) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(StatementImport);
  fixture.componentRef.setInput('categories', [
    ...SAMPLE_FINANCE_CATEGORIES,
    { id: 'extra', name: 'Extra income' },
    { id: 'other', name: 'Other' },
    { id: 'invest', name: 'Investments' },
  ]);
  fixture.componentRef.setInput('accounts', SAMPLE_ACCOUNTS);
  const results: ImportResult[] = [];
  fixture.componentInstance.imported.subscribe((result) => results.push(result));
  fixture.detectChanges();
  return { fixture, gateway, results };
}

function element(fixture: ComponentFixture<StatementImport>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function texts(fixture: ComponentFixture<StatementImport>, selector: string): string[] {
  return [...element(fixture).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

/** Hands the component a file the way the browser does, then lets the reading finish. */
async function choose(fixture: ComponentFixture<StatementImport>, csv: string): Promise<void> {
  const input = element(fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', {
    value: [new File([csv], 'extrato.csv', { type: 'text/csv' })],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

async function confirm(fixture: ComponentFixture<StatementImport>): Promise<void> {
  element(fixture).querySelector<HTMLButtonElement>('.ui-button-primary')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

describe('StatementImport', () => {
  it('lists the lines with short descriptions and leaves the money between own accounts out', async () => {
    const { fixture } = render();

    await choose(fixture, STATEMENT);

    expect([
      texts(fixture, '.lines .description span:first-child'),
      [...element(fixture).querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')].map(
        (box) => box.checked,
      ),
      texts(fixture, '.summary'),
    ]).toEqual([
      [
        'Resgate RDB',
        'Pix enviado - ANA SOUZA',
        'Pix enviado - ANA SOUZA',
        'Pix recebido - EMPRESA LTDA',
      ],
      [false, true, true, true],
      [expect.stringContaining('3 to import')],
    ]);
  });

  it('starts income on extra income and spending on other', async () => {
    const { fixture } = render();

    await choose(fixture, STATEMENT);

    expect(
      [...element(fixture).querySelectorAll<HTMLSelectElement>('select.category')].map(
        (select) => select.value,
      ),
    ).toEqual(['invest', 'other', 'other', 'extra']);
  });

  it('applies a category to every line with the same description', async () => {
    const { fixture } = render();
    await choose(fixture, STATEMENT);
    const selects = element(fixture).querySelectorAll<HTMLSelectElement>('select.category');

    selects[1].value = 'food';
    selects[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(
      [...element(fixture).querySelectorAll<HTMLSelectElement>('select.category')].map(
        (select) => select.value,
      ),
    ).toEqual(['invest', 'food', 'food', 'extra']);
  });

  it('leaves out the lines already stored, so importing again changes nothing', async () => {
    const gateway = new FakeTransactionsGateway(
      new Map([
        [
          '2026-10',
          [
            {
              id: 'pix-1',
              date: '2026-10-05',
              description: 'Pix enviado - ANA SOUZA',
              categoryId: 'food',
              accountId: 'checking-account',
              amountCents: -2000,
            },
          ],
        ],
      ]),
    );
    const { fixture } = render(gateway);

    await choose(fixture, STATEMENT);

    expect([texts(fixture, '.lines .ui-tag'), texts(fixture, '.summary')]).toEqual([
      ['Own accounts', 'Already imported'],
      [expect.stringContaining('2 to import')],
    ]);
  });

  it('saves the ticked lines on the chosen account under the bank identifiers, then reports it', async () => {
    const { fixture, gateway, results } = render();
    await choose(fixture, STATEMENT);

    await confirm(fixture);

    expect([
      gateway.saved.map((transaction) => [
        transaction.id,
        transaction.accountId,
        transaction.amountCents,
      ]),
      results,
    ]).toEqual([
      [
        ['pix-1', 'checking-account', -2000],
        ['pix-2', 'checking-account', -9000],
        ['pix-3', 'checking-account', 100000],
      ],
      [{ saved: 3, failed: 0, month: '2026-10' }],
    ]);
  });

  it('can bring back a line left out by ticking it', async () => {
    const { fixture, gateway } = render();
    await choose(fixture, STATEMENT);

    element(fixture).querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!.click();
    fixture.detectChanges();
    await confirm(fixture);

    expect(gateway.saved.map((transaction) => transaction.id)).toContain('rdb-1');
  });

  it('says which lines it could not read and still offers the others', async () => {
    const { fixture } = render();

    await choose(fixture, `${HEADER}\n31/02/2026,1.00,a,x\n03/10/2026,5.00,ok-1,Padaria`);

    expect([
      texts(fixture, '.problems li'),
      texts(fixture, '.lines .description span:first-child'),
    ]).toEqual([['Line 2: expected a date like 31/10/2026, received "31/02/2026".'], ['Padaria']]);
  });

  it('refuses a file that is not a statement and offers nothing to import', async () => {
    const { fixture } = render();

    await choose(fixture, 'Name,Amount\nrent,10');

    expect([
      texts(fixture, '.problems li').length,
      element(fixture).querySelector('.lines'),
    ]).toEqual([1, null]);
  });

  it('only offers bank accounts to import into', () => {
    const { fixture } = render();

    expect(texts(fixture, 'select[name="account"] option')).toEqual(['Checking account']);
  });
});
