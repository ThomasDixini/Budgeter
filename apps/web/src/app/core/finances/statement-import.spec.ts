import { FinanceCategory } from './finance-references';
import {
  MAX_STATEMENT_DESCRIPTION_LENGTH,
  describeStatementLine,
  parseStatement,
  rememberCategories,
  splitCsvLine,
  statementMonths,
  suggestCategoryId,
  toCardPayment,
} from './statement-import';

const HEADER = 'Data,Valor,Identificador,Descrição';

const CATEGORIES: readonly FinanceCategory[] = [
  { id: 'food', name: 'Food' },
  { id: 'transport', name: 'Transport' },
  { id: 'salary', name: 'Salary' },
  { id: 'extra', name: 'Extra income' },
  { id: 'invest', name: 'Investments' },
  { id: 'other', name: 'Other' },
];

describe('splitCsvLine', () => {
  it('keeps a quoted cell with commas and quotes in one piece', () => {
    expect(splitCsvLine('a,"b, ""c""",d')).toEqual(['a', 'b, "c"', 'd']);
  });
});

describe('parseStatement', () => {
  it('reads dates, signed amounts, identifiers and descriptions', () => {
    const { rows, problems } = parseStatement(
      `${HEADER}\n03/10/2026,57.10,id-1,Resgate RDB\n05/10/2026,-3.75,id-2,Padaria`,
    );

    expect([problems, rows.map((row) => [row.id, row.date, row.amountCents])]).toEqual([
      [],
      [
        ['id-1', '2026-10-03', 5710],
        ['id-2', '2026-10-05', -375],
      ],
    ]);
  });

  it('tells money moving between the own accounts from what was earned or spent', () => {
    const { rows } = parseStatement(
      [
        HEADER,
        '07/10/2026,-100.00,a,Aplicação RDB',
        '07/10/2026,-2064.28,b,Pagamento de fatura',
        '07/10/2026,-155.29,c,Compra de Ações - TOTS3',
        '07/10/2026,-20.00,d,Mercado',
      ].join('\n'),
    );

    expect(rows.map((row) => row.kind)).toEqual([
      'internal',
      'invoicePayment',
      'internal',
      'regular',
    ]);
  });

  it('only takes a line that leaves the account for the payment of an invoice', () => {
    const { rows } = parseStatement(
      [
        HEADER,
        '07/10/2026,-2064.28,a,Pagamento de fatura',
        '08/10/2026,50.00,b,Pagamento de fatura estornado',
      ].join('\n'),
    );

    expect(rows.map((row) => row.kind)).toEqual(['invoicePayment', 'internal']);
  });

  it('keeps a description with commas that the bank wrapped in quotes', () => {
    const { rows } = parseStatement(`${HEADER}\n03/10/2026,10.00,a,"Loja, filial 2"`);

    expect(rows[0].description).toBe('Loja, filial 2');
  });

  it('reports each line it cannot read and keeps the others', () => {
    const { rows, problems } = parseStatement(
      [
        HEADER,
        '31/02/2026,1.00,a,x',
        '03/10/2026,abc,b,x',
        '03/10/2026,1.00,c d,x',
        '03/10/2026,0.00,e,x',
        '03/10/2026,5.00,f,ok',
      ].join('\n'),
    );

    expect([rows.map((row) => row.id), problems]).toEqual([
      ['f'],
      [
        'Line 2: expected a date like 31/10/2026, received "31/02/2026".',
        'Line 3: expected an amount like 57.10 or -3.75, received "abc".',
        'Line 4: expected an identifier of letters, digits and dashes, received "c d".',
        'Line 5: expected an amount like 57.10 or -3.75, received "0.00".',
      ],
    ]);
  });

  it('refuses a file that is not a statement', () => {
    const { rows, problems } = parseStatement('Name,Amount\nrent,10');

    expect([rows, problems]).toEqual([
      [],
      [
        'Expected the columns Data, Valor, Identificador, Descrição on the first line, received "Name,Amount".',
      ],
    ]);
  });

  it('says so when the file is empty, and ignores a byte order mark', () => {
    expect([
      parseStatement('').problems,
      parseStatement(`${String.fromCharCode(0xfeff)}${HEADER}\n03/10/2026,1.00,a,x`).rows.length,
    ]).toEqual([['The file is empty.'], 1]);
  });
});

describe('describeStatementLine', () => {
  it('keeps the direction and the name of a Pix or transfer', () => {
    expect([
      describeStatementLine(
        'Transferência enviada pelo Pix - ANA SOUZA - •••.123.456-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 8-1',
      ),
      describeStatementLine(
        'Transferência recebida pelo Pix - VMS LTDA - 06.268.608/0001-88 - CC COPERSUL',
      ),
      describeStatementLine(
        'Transferência Recebida - Yasmim Faria - •••.116.266-•• - NU PAGAMENTOS',
      ),
    ]).toEqual([
      'Pix enviado - ANA SOUZA',
      'Pix recebido - VMS LTDA',
      'Transferência recebida - Yasmim Faria',
    ]);
  });

  it('leaves a short description as it is and cuts a long one to what a transaction accepts', () => {
    const long = 'x'.repeat(200);

    expect([describeStatementLine('Resgate RDB'), describeStatementLine(long).length]).toEqual([
      'Resgate RDB',
      MAX_STATEMENT_DESCRIPTION_LENGTH,
    ]);
  });
});

describe('suggestCategoryId', () => {
  it('starts income on extra income, spending on other and investments on investments', () => {
    const row = { description: 'x', kind: 'regular' as const };

    expect([
      suggestCategoryId({ ...row, amountCents: 100 }, CATEGORIES),
      suggestCategoryId({ ...row, amountCents: -100 }, CATEGORIES),
      suggestCategoryId({ ...row, amountCents: -100, kind: 'internal' }, CATEGORIES),
    ]).toEqual(['extra', 'other', 'invest']);
  });

  it('falls back to the first category when the usual ones are missing', () => {
    expect(
      suggestCategoryId({ description: 'x', kind: 'regular', amountCents: -1 }, [
        { id: 'food', name: 'Food' },
      ]),
    ).toBe('food');
  });
});

describe('suggestCategoryId by words and history', () => {
  const spent = (
    description: string,
  ): { description: string; kind: 'regular'; amountCents: number } => ({
    description,
    kind: 'regular',
    amountCents: -100,
  });

  it('points a description to the category its words name, ignoring case and accents', () => {
    expect([
      suggestCategoryId(spent('Pix enviado - UBER TRIP'), CATEGORIES),
      suggestCategoryId(spent('Padaria Pão de Açúcar'), CATEGORIES),
      suggestCategoryId({ ...spent('Salário outubro'), amountCents: 100 }, CATEGORIES),
    ]).toEqual(['transport', 'food', 'salary']);
  });

  it('does not take an income word for an expense, nor the other way round', () => {
    expect(suggestCategoryId(spent('Salário'), CATEGORIES)).toBe('other');
  });

  it('keeps to other when the category the words name does not exist', () => {
    expect(suggestCategoryId(spent('Uber'), [{ id: 'other', name: 'Other' }])).toBe('other');
  });

  it('prefers what was used before for the same description over the words', () => {
    const memory = rememberCategories([
      { date: '2026-09-01', description: 'Uber', categoryId: 'food', amountCents: -500 },
    ]);

    expect(suggestCategoryId(spent('UBER'), CATEGORIES, memory)).toBe('food');
  });

  it('ignores a remembered category that was deleted', () => {
    const memory = rememberCategories([
      { date: '2026-09-01', description: 'Uber', categoryId: 'gone', amountCents: -500 },
    ]);

    expect(suggestCategoryId(spent('Uber'), CATEGORIES, memory)).toBe('transport');
  });
});

describe('rememberCategories', () => {
  const past = (date: string, categoryId: string, amountCents = -100) => ({
    date,
    description: 'Padaria',
    categoryId,
    amountCents,
  });

  it('remembers the category used most for a description', () => {
    const memory = rememberCategories([
      past('2026-09-01', 'a'),
      past('2026-09-02', 'b'),
      past('2026-09-03', 'b'),
    ]);

    expect(memory.get('out|padaria')).toBe('b');
  });

  it('takes the latest one when two were used the same number of times', () => {
    const memory = rememberCategories([past('2026-09-05', 'a'), past('2026-09-01', 'b')]);

    expect(memory.get('out|padaria')).toBe('a');
  });

  it('keeps money coming in apart from money going out', () => {
    const memory = rememberCategories([past('2026-09-01', 'a'), past('2026-09-02', 'b', 100)]);

    expect([memory.get('out|padaria'), memory.get('in|padaria')]).toEqual(['a', 'b']);
  });
});

describe('statementMonths', () => {
  it('lists each month once, oldest first', () => {
    expect(
      statementMonths([{ date: '2026-11-02' }, { date: '2026-10-31' }, { date: '2026-11-05' }]),
    ).toEqual(['2026-10', '2026-11']);
  });
});

describe('toCardPayment', () => {
  it('turns the money that left the account into a payment above zero', () => {
    expect(
      toCardPayment({ id: 'p1', date: '2026-10-07', amountCents: -206428 }, 'visa', 'checking'),
    ).toEqual({
      id: 'p1',
      cardId: 'visa',
      fromAccountId: 'checking',
      date: '2026-10-07',
      amountCents: 206428,
    });
  });
});
