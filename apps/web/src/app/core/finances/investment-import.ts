import {
  Income,
  IncomeDraft,
  IncomeKind,
  InvestmentDraft,
  InvestmentKind,
  Trade,
  TradeDraft,
} from './investments';

/** What a line of the movements file means for the portfolio. */
export type MovementAction = 'buy' | 'sell' | 'income' | 'ignored';

/** One line of the movements file, read and classified. */
export interface MovementRow {
  /** Stable for the same line of the file, so importing a file twice finds what it already stored. */
  readonly id: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  /** The investment's name as it will be kept (a ticker such as `TOTS3`, or a short product name). */
  readonly name: string;
  readonly investmentKind: InvestmentKind;
  readonly action: MovementAction;
  readonly incomeKind?: IncomeKind;
  readonly quantityThousandths: number;
  readonly unitPriceCents: number;
  /** What the line moved in cents (an income's amount; what a trade came to). */
  readonly amountCents: number;
  /** The movement as the file calls it, for the lines that are left out. */
  readonly movement: string;
  /** The product as the file writes it, ticker and fund name (a fund keeps its name when its ticker changes). */
  readonly product: string;
}

/** What reading a movements file gave: the lines it understood and a message for each it did not. */
export interface ParsedMovements {
  readonly rows: readonly MovementRow[];
  readonly problems: readonly string[];
}

/** What is already stored, to tell new lines from repeated ones and known investments from new ones. */
export interface StoredPortfolio {
  readonly investments: readonly { readonly id: string; readonly name: string }[];
  readonly trades: readonly Trade[];
  readonly incomes: readonly Income[];
}

/** A line with where it would go: the investment it belongs to (none yet when it must be created). */
export interface PlannedMovement {
  readonly row: MovementRow;
  readonly investmentId: string | undefined;
  /** Already stored, either by this same file before or by hand; importing it again would duplicate it. */
  readonly isStored: boolean;
}

/** Everything one import writes, in the order it must be written. */
export interface ImportBatch {
  readonly investments: readonly { id: string; draft: InvestmentDraft }[];
  readonly trades: readonly { id: string; draft: TradeDraft }[];
  readonly incomes: readonly { id: string; draft: IncomeDraft }[];
}

/** The longest investment name the API accepts. */
export const MAX_INVESTMENT_NAME_LENGTH = 40;

const COLUMNS = [
  'entrada/saida',
  'data',
  'movimentacao',
  'produto',
  'instituicao',
  'quantidade',
  'preco unitario',
  'valor da operacao',
] as const;
type Column = (typeof COLUMNS)[number];

const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TICKER_PATTERN = /^[A-Z]{4}\d{1,2}$/;
const FIXED_INCOME_PATTERN = /^(tesouro|cdb|lci|lca|cri|cra|deb[eê]nture)\b/i;
const CENTS = 2;
const THOUSANDTHS = 3;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;
const MIN_EXCEL_SERIAL = 20_000;

/**
 * Reads the rows of a B3 / Nu Invest "Movimentação" workbook (columns Entrada/Saída, Data, Movimentação,
 * Produto, Instituição, Quantidade, Preço unitário, Valor da Operação). Purchases and sales, and the
 * proventos (Rendimento, Juros Sobre Capital Próprio, Dividendo) are understood; the rest (rights,
 * updates…) come as `ignored`. Lines it cannot read are reported in `problems` and left out.
 * @example parseMovements(rows).rows[0].action // 'income'
 */
export function parseMovements(table: readonly (readonly string[])[]): ParsedMovements {
  const rows = table.filter((cells) => cells.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) return { rows: [], problems: ['The file is empty.'] };
  const columns = locateColumns(rows[0]);
  if (typeof columns === 'string') return { rows: [], problems: [columns] };
  const seen = new Map<string, number>();
  const read: MovementRow[] = [];
  const problems: string[] = [];
  rows.slice(1).forEach((cells, index) => {
    const result = readMovement(cells, columns, index + 2, seen);
    if (typeof result === 'string') problems.push(result);
    else read.push(result);
  });
  return { rows: read, problems };
}

/**
 * The name an investment is kept under: the ticker when the product starts with one, a short product
 * name otherwise.
 * @example investmentNameOf('TOTS3 - TOTVS S.A.') // 'TOTS3'
 */
export function investmentNameOf(product: string): string {
  const [first, second] = product.split(' - ').map((part) => part.trim());
  const name = TICKER_PATTERN.test(first)
    ? first
    : /^cdb$/i.test(first) && second
      ? `${first} - ${second}`
      : product.trim();
  return name.slice(0, MAX_INVESTMENT_NAME_LENGTH);
}

/**
 * A guess at the kind of an investment from its name: `…11` is taken for a real estate fund, other tickers
 * for stocks, and Tesouro, CDB and the like for fixed income.
 * @example investmentKindOf('VINO11') // 'realEstateFund'
 */
export function investmentKindOf(name: string): InvestmentKind {
  if (FIXED_INCOME_PATTERN.test(name)) return 'fixedIncome';
  if (!TICKER_PATTERN.test(name)) return 'other';
  return name.endsWith('11') ? 'realEstateFund' : 'stock';
}

/**
 * Finds tickers that are very likely the same fund under another name: the fund's name in the file is the
 * same for both (a ticker change keeps it), so the older ticker is suggested to be merged into the one used
 * last. Only lines that move money count, so a subscription right such as `PCIP12` does not take part.
 * @example suggestMerges(rows) // { CVBI11: 'PCIP11' }
 */
export function suggestMerges(rows: readonly MovementRow[]): Record<string, string> {
  const byFundName = new Map<string, Map<string, string>>();
  for (const row of rows.filter((candidate) => candidate.action !== 'ignored')) {
    const fund = fundNameOf(row.product);
    if (fund === '') continue;
    const tickers = byFundName.get(fund) ?? new Map<string, string>();
    const lastDate = tickers.get(row.name) ?? '';
    tickers.set(row.name, row.date > lastDate ? row.date : lastDate);
    byFundName.set(fund, tickers);
  }
  const merges: Record<string, string> = {};
  for (const tickers of byFundName.values()) {
    const [latest] = [...tickers].sort((first, second) => second[1].localeCompare(first[1]));
    for (const name of tickers.keys()) if (name !== latest[0]) merges[name] = latest[0];
  }
  return merges;
}

/**
 * The lines with each investment name replaced by the one it is merged into (a merge can lead to another
 * merge); the lines keep their ids, so a file imports the same lines whatever was merged.
 * @example applyMerges(rows, { CVBI11: 'PCIP11' })[0].name // 'PCIP11'
 */
export function applyMerges(
  rows: readonly MovementRow[],
  merges: Readonly<Record<string, string>>,
): MovementRow[] {
  return rows.map((row) => {
    const name = finalName(row.name, merges);
    return name === row.name ? row : { ...row, name, investmentKind: investmentKindOf(name) };
  });
}

/**
 * Matches each line with the investment it belongs to and says which ones are stored already: by the id
 * a previous import gave it, or by being the same trade or provento someone recorded by hand.
 * @example planMovements(rows, stored)[0].isStored // false
 */
export function planMovements(
  rows: readonly MovementRow[],
  stored: StoredPortfolio,
): PlannedMovement[] {
  const byName = new Map(
    stored.investments.map((investment) => [investment.name.trim().toLowerCase(), investment.id]),
  );
  const ids = new Set([...stored.trades, ...stored.incomes].map((record) => record.id));
  return rows.map((row) => {
    const investmentId = byName.get(row.name.toLowerCase());
    return {
      row,
      investmentId,
      isStored: ids.has(row.id) || isRecorded(row, investmentId, stored),
    };
  });
}

/**
 * What an import writes for the lines that were kept: the investments that do not exist yet (with the kind
 * the person settled on), then trades from the oldest, so a sale never comes before the purchase behind it,
 * then proventos.
 * @example buildBatch(planned.filter((line) => !line.isStored), (name) => investmentKindOf(name)).trades.length
 */
export function buildBatch(
  kept: readonly PlannedMovement[],
  kindOf: (name: string) => InvestmentKind,
): ImportBatch {
  const idOf = (line: PlannedMovement): string =>
    line.investmentId ?? newInvestmentId(line.row.name);
  const created = new Map<string, { id: string; draft: InvestmentDraft }>();
  for (const line of kept.filter((candidate) => candidate.investmentId === undefined)) {
    created.set(idOf(line), {
      id: idOf(line),
      draft: { name: line.row.name, kind: kindOf(line.row.name) },
    });
  }
  const byDate = [...kept].sort((first, second) => first.row.date.localeCompare(second.row.date));
  return {
    investments: [...created.values()],
    trades: byDate
      .filter(isTrade)
      .map((line) => ({ id: line.row.id, draft: toTradeDraft(line.row, idOf(line)) })),
    incomes: byDate
      .filter(isIncome)
      .map((line) => ({ id: line.row.id, draft: toIncomeDraft(line.row, idOf(line)) })),
  };
}

/** What follows the ticker in a product (the fund's name), without punctuation or case. */
function fundNameOf(product: string): string {
  const [ticker, ...rest] = product.split(' - ');
  if (!TICKER_PATTERN.test(ticker.trim())) return '';
  return normalize(rest.join(' - '))
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

function finalName(name: string, merges: Readonly<Record<string, string>>): string {
  let current = name;
  for (let step = 0; step < Object.keys(merges).length && merges[current] !== undefined; step++) {
    current = merges[current];
  }
  return current;
}

function locateColumns(header: readonly string[]): Record<Column, number> | string {
  const names = header.map(normalize);
  const missing = COLUMNS.filter((column) => !names.includes(column));
  if (missing.length > 0) {
    return `Expected the columns Entrada/Saída, Data, Movimentação, Produto, Instituição, Quantidade, Preço unitário, Valor da Operação, but "${missing[0]}" is missing.`;
  }
  return Object.fromEntries(COLUMNS.map((column) => [column, names.indexOf(column)])) as Record<
    Column,
    number
  >;
}

function readMovement(
  cells: readonly string[],
  columns: Record<Column, number>,
  lineNumber: number,
  seen: Map<string, number>,
): MovementRow | string {
  const cell = (column: Column): string => (cells[columns[column]] ?? '').trim();
  const date = parseMovementDate(cell('data'));
  if (date === undefined)
    return `Line ${lineNumber}: expected a date like 31/10/2026, received "${cell('data')}".`;
  const movement = cell('movimentacao');
  const { action, incomeKind } = classify(movement, cell('entrada/saida'));
  const quantityThousandths = parseDecimal(cell('quantidade'), THOUSANDTHS) ?? 0;
  const unitPriceCents = parseDecimal(cell('preco unitario'), CENTS) ?? 0;
  const amountCents = parseDecimal(cell('valor da operacao'), CENTS) ?? 0;
  if (!hasWhatItNeeds(action, quantityThousandths, unitPriceCents, amountCents)) {
    return `Line ${lineNumber}: expected a quantity, a unit price and a value above zero for "${movement}", received "${cell('quantidade')}", "${cell('preco unitario')}", "${cell('valor da operacao')}".`;
  }
  const product = cell('produto');
  const name = investmentNameOf(product);
  return {
    id: stableId(cells.map((value) => value.trim()).join('|'), seen),
    date,
    name,
    investmentKind: investmentKindOf(name),
    action,
    incomeKind,
    quantityThousandths,
    unitPriceCents,
    amountCents:
      action === 'income'
        ? amountCents
        : Math.round((quantityThousandths * unitPriceCents) / 10 ** THOUSANDTHS),
    movement,
    product,
  };
}

function classify(
  movement: string,
  direction: string,
): { action: MovementAction; incomeKind?: IncomeKind } {
  const label = normalize(movement);
  if (label === 'rendimento') return { action: 'income', incomeKind: 'yield' };
  if (label.includes('juros sobre capital proprio'))
    return { action: 'income', incomeKind: 'interestOnEquity' };
  if (label === 'dividendo') return { action: 'income', incomeKind: 'dividend' };
  if (label === 'venda') return { action: 'sell' };
  if (label === 'compra') return { action: 'buy' };
  if (label === 'transferencia - liquidacao' || label === 'compra / venda') {
    return { action: normalize(direction) === 'debito' ? 'sell' : 'buy' };
  }
  return { action: 'ignored' };
}

function hasWhatItNeeds(
  action: MovementAction,
  quantity: number,
  price: number,
  amount: number,
): boolean {
  if (action === 'ignored') return true;
  if (action === 'income') return amount > 0;
  return quantity > 0 && price > 0;
}

function parseMovementDate(text: string): string | undefined {
  const match = DATE_PATTERN.exec(text);
  if (match !== null) return validDay(Number(match[3]), Number(match[2]), Number(match[1]));
  const serial = Number(text);
  if (!Number.isFinite(serial) || serial < MIN_EXCEL_SERIAL) return undefined;
  const day = new Date(EXCEL_EPOCH + Math.floor(serial) * MS_PER_DAY);
  return validDay(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
}

function validDay(year: number, month: number, day: number): string | undefined {
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day)
    return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A number typed with a dot (`17655.02`) or a comma (`1.234,56`), scaled to whole units of the smallest
 * part: `2` decimals gives cents. A dash, a blank or anything else gives undefined.
 * @example parseDecimal('0.075', 3) // 75
 */
export function parseDecimal(text: string, decimals: number): number | undefined {
  const cleaned = text.replaceAll(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(cleaned)) return undefined;
  const normalized = cleaned.includes(',')
    ? cleaned.replaceAll('.', '').replace(',', '.')
    : cleaned;
  const [whole, fraction = '', extra] = normalized.split('.');
  if (extra !== undefined) return undefined;
  const kept = fraction.slice(0, decimals).padEnd(decimals, '0');
  const roundsUp = fraction.length > decimals && fraction[decimals] >= '5' ? 1 : 0;
  return Number(whole) * 10 ** decimals + Number(kept) + roundsUp;
}

function stableId(key: string, seen: Map<string, number>): string {
  const occurrence = (seen.get(key) ?? 0) + 1;
  seen.set(key, occurrence);
  const text = `${key}#${occurrence}`;
  return `import-${hash(text, 1).toString(16).padStart(14, '0')}${hash(text, 2).toString(16).padStart(14, '0')}`;
}

/** A 53-bit string hash (cyrb53): plenty to tell apart the lines of one file, with no library. */
function hash(text: string, seed: number): number {
  let first = 0xdeadbeef ^ seed;
  let second = 0x41c6ce57 ^ seed;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  }
  first =
    Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
  second =
    Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);
  return 4294967296 * (2097151 & second) + (first >>> 0);
}

function newInvestmentId(name: string): string {
  return `import-inv-${name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')}`.slice(0, 64);
}

function isRecorded(
  row: MovementRow,
  investmentId: string | undefined,
  stored: StoredPortfolio,
): boolean {
  if (investmentId === undefined) return false;
  if (row.action === 'income') {
    return stored.incomes.some(
      (income) =>
        income.investmentId === investmentId &&
        income.date === row.date &&
        income.kind === row.incomeKind &&
        income.amountCents === row.amountCents,
    );
  }
  return stored.trades.some(
    (trade) =>
      trade.investmentId === investmentId &&
      trade.date === row.date &&
      trade.kind === row.action &&
      trade.quantityThousandths === row.quantityThousandths &&
      trade.unitPriceCents === row.unitPriceCents,
  );
}

function isTrade(line: PlannedMovement): boolean {
  return line.row.action === 'buy' || line.row.action === 'sell';
}

function isIncome(line: PlannedMovement): boolean {
  return line.row.action === 'income';
}

function toTradeDraft(row: MovementRow, investmentId: string): TradeDraft {
  return {
    investmentId,
    date: row.date,
    kind: row.action === 'sell' ? 'sell' : 'buy',
    quantityThousandths: row.quantityThousandths,
    unitPriceCents: row.unitPriceCents,
  };
}

function toIncomeDraft(row: MovementRow, investmentId: string): IncomeDraft {
  return {
    investmentId,
    date: row.date,
    kind: row.incomeKind ?? 'yield',
    amountCents: row.amountCents,
  };
}

function normalize(text: string): string {
  return text.normalize('NFD').replaceAll(/[̀-ͯ]/g, '').trim().toLowerCase();
}
