import {
  buildBatch,
  investmentKindOf,
  investmentNameOf,
  parseDecimal,
  parseMovements,
  planMovements,
} from './investment-import';

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

function line(
  direction: string,
  date: string,
  movement: string,
  product: string,
  quantity: string,
  price: string,
  value: string,
): string[] {
  return [direction, date, movement, product, BROKER, quantity, price, value];
}

describe('parseMovements', () => {
  it('reads a settled purchase as a buy of the ticker, with quantity and price scaled', () => {
    const { rows, problems } = parseMovements([
      HEADER,
      line(
        'Credito',
        '09/10/2026',
        'Transferência - Liquidação',
        'TOTS3 - TOTVS S.A.',
        '4',
        '38.48',
        '153.92',
      ),
    ]);

    expect(problems).toEqual([]);
    expect(rows[0]).toMatchObject({
      date: '2026-10-09',
      name: 'TOTS3',
      investmentKind: 'stock',
      action: 'buy',
      quantityThousandths: 4000,
      unitPriceCents: 3848,
      amountCents: 15392,
    });
  });

  it('keeps the fractions of a Treasury bond and the price of a CDB', () => {
    const { rows } = parseMovements([
      HEADER,
      line('Credito', '11/11/2025', 'Compra', 'Tesouro Selic 2031', '0.07', '17655.02', '1235.85'),
      line(
        'Credito',
        '08/01/2025',
        'COMPRA / VENDA',
        'CDB - CDB1252ECOP - MERCADO CREDITO SA',
        '15000',
        '0.01',
        '150',
      ),
    ]);

    expect(
      rows.map((row) => [
        row.name,
        row.investmentKind,
        row.quantityThousandths,
        row.unitPriceCents,
        row.amountCents,
      ]),
    ).toEqual([
      ['Tesouro Selic 2031', 'fixedIncome', 70, 1765502, 123585],
      ['CDB - CDB1252ECOP', 'fixedIncome', 15000000, 1, 15000],
    ]);
  });

  it('reads yields and interest on equity as proventos of their own kind', () => {
    const { rows } = parseMovements([
      HEADER,
      line('Credito', '16/10/2026', 'Rendimento', 'PCIP11 - PATRIA CREDITO', '6', '0.65', '3.9'),
      line(
        'Credito',
        '08/10/2026',
        'Juros Sobre Capital Próprio',
        'TOTS3 - TOTVS S.A.',
        '51',
        '0.15',
        '6.32',
      ),
    ]);

    expect(
      rows.map((row) => [row.action, row.incomeKind, row.amountCents, row.investmentKind]),
    ).toEqual([
      ['income', 'yield', 390, 'realEstateFund'],
      ['income', 'interestOnEquity', 632, 'stock'],
    ]);
  });

  it('takes a debit settlement for a sale', () => {
    const { rows } = parseMovements([
      HEADER,
      line(
        'Debito',
        '09/10/2026',
        'Transferência - Liquidação',
        'TOTS3 - TOTVS S.A.',
        '2',
        '40',
        '80',
      ),
    ]);

    expect(rows[0].action).toBe('sell');
  });

  it('leaves rights and updates out, even when they have no price or value', () => {
    const { rows, problems } = parseMovements([
      HEADER,
      line(
        'Credito',
        '17/09/2026',
        'Direito de Subscrição',
        'PCIP12 - FDO INV. IMOB. VBI CRI',
        '15',
        '-',
        '-',
      ),
      line(
        'Debito',
        '17/09/2026',
        'Direitos de Subscrição - Não Exercido',
        'PCIP12 - FDO',
        '0',
        '-',
        '-',
      ),
      line('Credito', '25/09/2025', 'Atualização', 'PCIP11 - FDO', '3', '-', '-'),
    ]);

    expect([problems, rows.map((row) => row.action)]).toEqual([
      [],
      ['ignored', 'ignored', 'ignored'],
    ]);
  });

  it('gives the same line the same id every time and identical lines different ones', () => {
    const rows = [
      HEADER,
      line('Credito', '15/10/2026', 'Rendimento', 'VINO11 - VINCI', '132', '0.042', '5.54'),
      line('Credito', '15/10/2026', 'Rendimento', 'VINO11 - VINCI', '132', '0.042', '5.54'),
    ];

    const first = parseMovements(rows).rows.map((row) => row.id);
    const again = parseMovements(rows).rows.map((row) => row.id);

    expect([
      first,
      first[0] === first[1],
      first.every((id) => /^import-[0-9a-f]{28}$/.test(id)),
    ]).toEqual([again, false, true]);
  });

  it('reads a date stored as an Excel serial number', () => {
    const { rows } = parseMovements([
      HEADER,
      line('Credito', '46311', 'Rendimento', 'VINO11 - X', '1', '1', '1'),
    ]);

    expect(rows[0].date).toBe('2026-10-16');
  });

  it('reports the lines it cannot read and keeps the others', () => {
    const { rows, problems } = parseMovements([
      HEADER,
      line('Credito', '31/02/2026', 'Rendimento', 'VINO11 - X', '1', '1', '1'),
      line('Credito', '15/10/2026', 'Rendimento', 'VINO11 - X', '1', '1', '-'),
      line('Credito', '15/10/2026', 'Compra', 'Tesouro Selic 2031', '0', '10', '0'),
      line('Credito', '15/10/2026', 'Rendimento', 'VINO11 - X', '1', '1', '1'),
    ]);

    expect([rows.length, problems]).toEqual([
      1,
      [
        'Line 2: expected a date like 31/10/2026, received "31/02/2026".',
        'Line 3: expected a quantity, a unit price and a value above zero for "Rendimento", received "1", "1", "-".',
        'Line 4: expected a quantity, a unit price and a value above zero for "Compra", received "0", "10", "0".',
      ],
    ]);
  });

  it('refuses a sheet that is not a movements export, and an empty one', () => {
    expect([parseMovements([['Name', 'Amount']]).problems, parseMovements([]).problems]).toEqual([
      [
        'Expected the columns Entrada/Saída, Data, Movimentação, Produto, Instituição, Quantidade, Preço unitário, Valor da Operação, but "entrada/saida" is missing.',
      ],
      ['The file is empty.'],
    ]);
  });
});

describe('names and kinds', () => {
  it('keeps the ticker of a stock or fund and a short name for the rest', () => {
    expect([
      investmentNameOf('VINO11 - VINCI OFFICES FDO INV IMOB'),
      investmentNameOf('Tesouro Selic 2031'),
      investmentNameOf('x'.repeat(80)).length,
    ]).toEqual(['VINO11', 'Tesouro Selic 2031', 40]);
  });

  it('guesses the kind from the name', () => {
    expect(
      ['VINO11', 'TOTS3', 'Tesouro Selic 2031', 'CDB - X', 'Something'].map(investmentKindOf),
    ).toEqual(['realEstateFund', 'stock', 'fixedIncome', 'fixedIncome', 'other']);
  });
});

describe('parseDecimal', () => {
  it('scales dot and comma numbers and rounds past the last decimal', () => {
    expect([
      parseDecimal('17655.02', 2),
      parseDecimal('1.234,56', 2),
      parseDecimal('0.075', 3),
      parseDecimal('0.0749', 3),
      parseDecimal('-', 2),
      parseDecimal('', 2),
      parseDecimal('1.2.3', 2),
    ]).toEqual([1765502, 123456, 75, 75, undefined, undefined, undefined]);
  });
});

describe('planMovements and buildBatch', () => {
  const rows = parseMovements([
    HEADER,
    line('Credito', '10/10/2026', 'Transferência - Liquidação', 'VINO11 - X', '10', '5', '50'),
    line('Credito', '15/10/2026', 'Rendimento', 'VINO11 - X', '10', '0.5', '5'),
    line('Debito', '20/10/2026', 'Transferência - Liquidação', 'VINO11 - X', '4', '6', '24'),
    line('Credito', '12/10/2026', 'Compra', 'Tesouro Selic 2031', '1', '100', '100'),
  ]).rows;

  it('matches the investments by name, ignoring case, and leaves the new ones without an id', () => {
    const planned = planMovements(rows, {
      investments: [{ id: 'vino', name: 'vino11' }],
      trades: [],
      incomes: [],
    });

    expect(planned.map((item) => item.investmentId)).toEqual(['vino', 'vino', 'vino', undefined]);
  });

  it('knows a line stored by an earlier import, and the same trade recorded by hand', () => {
    const [buy, income] = rows;
    const planned = planMovements(rows, {
      investments: [{ id: 'vino', name: 'VINO11' }],
      trades: [
        {
          id: 'by-hand',
          investmentId: 'vino',
          date: buy.date,
          kind: 'buy',
          quantityThousandths: 10000,
          unitPriceCents: 500,
        },
      ],
      incomes: [
        { id: income.id, investmentId: 'vino', date: income.date, kind: 'yield', amountCents: 500 },
      ],
    });

    expect(planned.map((item) => item.isStored)).toEqual([true, true, false, false]);
  });

  it('writes the new investments first, then the trades from the oldest, then the proventos', () => {
    const planned = planMovements(rows, { investments: [], trades: [], incomes: [] });

    const batch = buildBatch(planned, (name) =>
      name === 'VINO11' ? 'fund' : investmentKindOf(name),
    );

    expect([
      batch.investments.map((item) => [item.id, item.draft.name, item.draft.kind]),
      batch.trades.map((item) => [item.draft.date, item.draft.kind, item.draft.investmentId]),
      batch.incomes.map((item) => [item.draft.date, item.draft.kind, item.draft.amountCents]),
    ]).toEqual([
      [
        ['import-inv-vino11', 'VINO11', 'fund'],
        ['import-inv-tesouro-selic-2031', 'Tesouro Selic 2031', 'fixedIncome'],
      ],
      [
        ['2026-10-10', 'buy', 'import-inv-vino11'],
        ['2026-10-12', 'buy', 'import-inv-tesouro-selic-2031'],
        ['2026-10-20', 'sell', 'import-inv-vino11'],
      ],
      [['2026-10-15', 'yield', 500]],
    ]);
  });
});
