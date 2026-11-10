import { isCardInvoice, parseCardInvoice } from './card-invoice-import';

const HEADER = 'date,title,amount';

describe('isCardInvoice', () => {
  it('tells the card export from the bank statement', () => {
    expect([
      isCardInvoice(`${HEADER}\n2026-11-08,Netflix,"59,90"`),
      isCardInvoice('Data,Valor,Identificador,Descrição\n03/10/2026,1.00,a,b'),
      isCardInvoice(''),
    ]).toEqual([true, false, false]);
  });
});

describe('parseCardInvoice', () => {
  it('reads purchases as spending and credits as money back', () => {
    const { rows, problems } = parseCardInvoice(
      `${HEADER}\n2026-11-08,Amazonprimebr,"19,90"\n2026-10-19,Estorno,"- 3.519,76"`,
    );

    expect([problems, rows.map((row) => [row.date, row.amountCents, row.kind])]).toEqual([
      [],
      [
        ['2026-11-08', -1990, 'regular'],
        ['2026-10-19', 351976, 'regular'],
      ],
    ]);
  });

  it('reads thousands separators and keeps the installment note in the description', () => {
    const { rows } = parseCardInvoice(
      `${HEADER}\n2026-10-19,Valor pendente do mês anterior (rotativo),"3.221,05"\n2026-10-20,Ipiranga Pneus - Parcela 2/6,"339,16"`,
    );

    expect(rows.map((row) => [row.amountCents, row.description])).toEqual([
      [-322105, 'Valor pendente do mês anterior (rotativo)'],
      [-33916, 'Ipiranga Pneus - Parcela 2/6'],
    ]);
  });

  it('marks carried-over balances and payments received so they are not counted twice', () => {
    const { rows } = parseCardInvoice(
      [
        HEADER,
        '2026-10-19,Pagamento recebido,"- 3.519,76"',
        '2026-10-16,Valor pendente do mês anterior,"3.221,05"',
        '2026-10-19,Multa por fatura atrasada,"64,66"',
      ].join('\n'),
    );

    expect(rows.map((row) => row.kind)).toEqual(['internal', 'internal', 'regular']);
  });

  it('gives the same ids when the file is read again, and different ids to identical purchases', () => {
    const csv = `${HEADER}\n2026-10-24,Mercearia Alves,"24,00"\n2026-10-24,Mercearia Alves,"24,00"`;

    const first = parseCardInvoice(csv).rows.map((row) => row.id);
    const second = parseCardInvoice(csv).rows.map((row) => row.id);

    expect([first, first[0] === first[1], first[0].startsWith('card-')]).toEqual([
      second,
      false,
      true,
    ]);
  });

  it('reports lines it cannot read and keeps the rest', () => {
    const { rows, problems } = parseCardInvoice(
      `${HEADER}\n31/10/2026,Padaria,"5,00"\n2026-10-31,Padaria,abc\n2026-10-31,Padaria,"0,00"\n2026-10-31,Padaria`,
    );

    expect([rows.length, problems.length]).toEqual([0, 4]);
  });

  it('reports an empty file', () => {
    expect(parseCardInvoice('').problems).toEqual(['The file is empty.']);
  });
});
