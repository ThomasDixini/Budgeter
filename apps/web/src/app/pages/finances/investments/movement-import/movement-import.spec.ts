import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clock } from '../../../../core/calendar/clock';
import { FixedClock } from '../../../../core/calendar/fixed-clock';
import { buildZip, sheetXml } from '../../../../core/files/zip-fixture.testing';
import { FakeInvestmentsGateway } from '../../../../core/finances/fake-investments-gateway';
import { InvestmentsGateway } from '../../../../core/finances/investments-gateway';
import { InvestmentsStore } from '../../../../core/finances/investments-store';
import { IdGenerator } from '../../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../../core/ids/sequential-id-generator';
import { MovementImport, MovementImportResult } from './movement-import';

const HEADER = [
  'Entrada/Saída',
  'Data',
  'Movimentação',
  'Produto',
  'Instituição',
  'Quantidade',
  'Preço unitário',
  'Valor da Operação',
];
const BROKER = 'NU INVEST CORRETORA DE VALORES S.A.';

/** A purchase of VINO11, its yield, a right that moves no money, and the PETR4 purchase the sample already has. */
const ROWS: readonly (readonly (string | number)[])[] = [
  HEADER,
  [
    'Credito',
    '10/10/2026',
    'Transferência - Liquidação',
    'VINO11 - VINCI OFFICES',
    BROKER,
    10,
    5,
    50,
  ],
  ['Credito', '15/10/2026', 'Rendimento', 'VINO11 - VINCI OFFICES', BROKER, 10, 0.5, 5],
  ['Credito', '17/09/2026', 'Direito de Subscrição', 'PCIP12 - FDO', BROKER, 15, '-', '-'],
  [
    'Credito',
    '05/10/2026',
    'Transferência - Liquidação',
    'PETR4 - PETROBRAS',
    BROKER,
    100,
    10,
    1000,
  ],
];

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

interface Rendered {
  fixture: ComponentFixture<MovementImport>;
  gateway: FakeInvestmentsGateway;
  results: MovementImportResult[];
}

async function render(): Promise<Rendered> {
  const gateway = new FakeInvestmentsGateway();
  TestBed.configureTestingModule({
    providers: [
      InvestmentsStore,
      { provide: InvestmentsGateway, useValue: gateway },
      { provide: Clock, useValue: new FixedClock(new Date(2026, 10, 3, 9, 0)) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(MovementImport);
  const results: MovementImportResult[] = [];
  fixture.componentInstance.imported.subscribe((result) => results.push(result));
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, gateway, results };
}

async function settle(fixture: ComponentFixture<MovementImport>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

function element(fixture: ComponentFixture<MovementImport>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function texts(fixture: ComponentFixture<MovementImport>, selector: string): string[] {
  return [...element(fixture).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

/** Hands the component a workbook the way the browser does, then lets the reading finish. */
async function choose(fixture: ComponentFixture<MovementImport>, bytes: Uint8Array): Promise<void> {
  const input = element(fixture).querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', {
    value: [new File([bytes as Uint8Array<ArrayBuffer>], 'movimentacao.xlsx')],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  fixture.detectChanges();
}

async function workbook(rows = ROWS): Promise<Uint8Array> {
  return buildZip([{ name: 'xl/worksheets/sheet1.xml', text: sheetXml(rows), isDeflated: true }]);
}

async function confirm(fixture: ComponentFixture<MovementImport>): Promise<void> {
  element(fixture).querySelector<HTMLButtonElement>('.ui-button-primary')!.click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  fixture.detectChanges();
}

describe('MovementImport', () => {
  it('lists the lines, leaves out what moves no money and what is already recorded', async () => {
    const { fixture } = await render();

    await choose(fixture, await workbook());

    expect([
      texts(fixture, '.lines .asset'),
      [...element(fixture).querySelectorAll<HTMLInputElement>('tbody .ui-checkbox')].map(
        (box) => box.checked,
      ),
      texts(fixture, '.lines .ui-tag'),
      texts(fixture, '.summary'),
    ]).toEqual([
      ['VINO11', 'VINO11', 'PCIP12', 'PETR4'],
      [true, true, false, false],
      ['No value', 'Already recorded'],
      [expect.stringContaining('1 purchases · 0 sales · 1 proventos')],
    ]);
  });

  it('offers to create the investments that do not exist yet, with a kind guessed from the name', async () => {
    const { fixture } = await render();

    await choose(fixture, await workbook());

    expect([
      texts(fixture, '.created-name'),
      [...element(fixture).querySelectorAll<HTMLSelectElement>('.created select')].map(
        (select) => select.value,
      ),
    ]).toEqual([['VINO11'], ['realEstateFund']]);
  });

  it('writes the new investment with the kind picked, then its purchase and provento, and reports it', async () => {
    const { fixture, gateway, results } = await render();
    await choose(fixture, await workbook());
    const kind = element(fixture).querySelector<HTMLSelectElement>('.created select')!;
    kind.value = 'fund';
    kind.dispatchEvent(new Event('change'));

    await confirm(fixture);

    expect([
      gateway.savedInvestments.map((request) => [
        request.id,
        request.draft.name,
        request.draft.kind,
      ]),
      gateway.savedTrades.map((request) => [
        request.draft.date,
        request.draft.kind,
        request.draft.quantityThousandths,
        request.draft.unitPriceCents,
      ]),
      gateway.savedIncomes.map((request) => [
        request.draft.date,
        request.draft.kind,
        request.draft.amountCents,
      ]),
      results,
    ]).toEqual([
      [['import-inv-vino11', 'VINO11', 'fund']],
      [['2026-10-10', 'buy', 10000, 500]],
      [['2026-10-15', 'yield', 500]],
      [{ saved: 3, failed: 0 }],
    ]);
  });

  it('can leave out a line by unticking it', async () => {
    const { fixture, gateway } = await render();
    await choose(fixture, await workbook());

    // The right moves no money and its box is disabled, so ticking does nothing for it.
    const boxes = element(fixture).querySelectorAll<HTMLInputElement>('tbody .ui-checkbox');
    boxes[0].click();
    fixture.detectChanges();
    await confirm(fixture);

    expect(gateway.savedTrades).toEqual([]);
  });

  it('says so when the file is not an Excel workbook', async () => {
    const { fixture } = await render();

    await choose(fixture, new TextEncoder().encode('Data,Valor\n1,2'));

    expect([texts(fixture, '.problems li'), element(fixture).querySelector('.lines')]).toEqual([
      ['Expected a zip archive (an .xlsx file), found no end of archive marker.'],
      null,
    ]);
  });

  it('says which lines it could not read and still offers the others', async () => {
    const { fixture } = await render();

    await choose(
      fixture,
      await workbook([
        HEADER,
        ['Credito', '31/02/2026', 'Rendimento', 'VINO11 - X', BROKER, 1, 1, 1],
        ['Credito', '15/10/2026', 'Rendimento', 'VINO11 - X', BROKER, 1, 1, 1],
      ]),
    );

    expect([texts(fixture, '.problems li'), texts(fixture, '.lines .asset')]).toEqual([
      ['Line 2: expected a date like 31/10/2026, received "31/02/2026".'],
      ['VINO11'],
    ]);
  });
});
