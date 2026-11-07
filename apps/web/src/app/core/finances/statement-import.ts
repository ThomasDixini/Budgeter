import { CardPayment } from './account-statement';
import { MAX_AMOUNT_CENTS } from './money';
import { FinanceCategory } from './finance-references';
import { Transaction } from './transaction';

/**
 * What a statement line is: something earned or spent ('regular'), money moving in the person's own
 * accounts and investments ('internal': an RDB application or redemption, buying shares), or the payment
 * of a card invoice ('invoicePayment'), which is stored as a payment to a card, not as a transaction.
 */
export type StatementRowKind = 'regular' | 'internal' | 'invoicePayment';

/** One line of a bank statement file, read and tidied. */
export interface StatementRow {
  /** The bank's own identifier of the line; kept as the transaction id so an import can be repeated. */
  readonly id: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  /** Signed amount in cents: positive came in, negative went out. */
  readonly amountCents: number;
  /** Short enough for a transaction (see `MAX_STATEMENT_DESCRIPTION_LENGTH`). */
  readonly description: string;
  readonly kind: StatementRowKind;
}

/** What reading a statement gave: the lines it understood and a message for each it did not. */
export interface ParsedStatement {
  readonly rows: readonly StatementRow[];
  readonly problems: readonly string[];
}

/** The longest description the API accepts for a transaction. */
export const MAX_STATEMENT_DESCRIPTION_LENGTH = 80;

/** Some programs start a UTF-8 file with this invisible character. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const HEADER = ['data', 'valor', 'identificador', 'descrição'];
const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const AMOUNT_PATTERN = /^(-?)(\d{1,8})(?:\.(\d{1,2}))?$/;
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const INTERNAL_PATTERN = /^(resgate|aplicação) rdb|^(compra|venda) de (ações|fundos?)\b/i;
const INVOICE_PATTERN = /^pagamento de fatura/i;
const CENTS_PER_REAL = 100;

/**
 * Reads the CSV statement the bank exports (columns `Data,Valor,Identificador,Descrição`, dates as
 * `dd/mm/yyyy`, amounts with a dot). Lines it cannot read are reported in `problems` and left out.
 * @example parseStatement('Data,Valor,Identificador,Descrição\n03/10/2026,57.10,abc-1,Resgate RDB').rows[0].amountCents // 5710
 */
export function parseStatement(csv: string): ParsedStatement {
  const lines = (csv.startsWith(BYTE_ORDER_MARK) ? csv.slice(1) : csv)
    .split(/\r?\n/)
    .map((line, index) => ({ text: line, number: index + 1 }))
    .filter((line) => line.text.trim() !== '');
  if (lines.length === 0) return { rows: [], problems: ['The file is empty.'] };
  const header = splitCsvLine(lines[0].text).map((cell) => cell.trim().toLowerCase());
  if (header.join() !== HEADER.join()) {
    return {
      rows: [],
      problems: [
        `Expected the columns Data, Valor, Identificador, Descrição on the first line, received "${lines[0].text}".`,
      ],
    };
  }
  const rows: StatementRow[] = [];
  const problems: string[] = [];
  for (const line of lines.slice(1)) {
    const result = readRow(splitCsvLine(line.text), line.number);
    if (typeof result === 'string') problems.push(result);
    else rows.push(result);
  }
  return { rows, problems };
}

/**
 * Splits one CSV line into its cells; a cell may be wrapped in double quotes to hold commas, and `""`
 * inside quotes is one quote.
 * @example splitCsvLine('a,"b, c",d') // ['a', 'b, c', 'd']
 */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let isQuoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (isQuoted && character === '"' && line[index + 1] === '"') {
      current += '"';
      index++;
    } else if (character === '"') isQuoted = !isQuoted;
    else if (character === ',' && !isQuoted) {
      cells.push(current);
      current = '';
    } else current += character;
  }
  cells.push(current);
  return cells;
}

/**
 * A short description for a line: a Pix or transfer keeps its direction and the other person's name, and
 * anything is cut to what a transaction accepts.
 * @example describeStatementLine('Transferência enviada pelo Pix - ANA SOUZA - •••.123.456-•• - NU PAGAMENTOS') // 'Pix enviado - ANA SOUZA'
 */
export function describeStatementLine(description: string): string {
  const text = description.trim();
  const [lead, name] = text.split(' - ').map((part) => part.trim());
  const prefix = transferPrefix(lead);
  const short = prefix !== undefined && name ? `${prefix} - ${name}` : text;
  if (short.length <= MAX_STATEMENT_DESCRIPTION_LENGTH) return short;
  return `${short.slice(0, MAX_STATEMENT_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
}

/** What was learned from past transactions: the category used for a description, by direction and text. */
export type CategoryMemory = ReadonlyMap<string, string>;

interface KeywordRule {
  /** Name (lower case, no accents) of the category the words point to. */
  readonly category: string;
  /** Whether the rule is for money coming in; an income word never moves an expense, and the other way round. */
  readonly isIncome: boolean;
  /** Matched against the description without accents, in lower case. */
  readonly words: RegExp;
}

/** Words of a description that point to one of the starter categories. */
const KEYWORD_RULES: readonly KeywordRule[] = [
  {
    category: 'salary',
    isIncome: true,
    words: /salario|folha de pagamento|\bsalary\b|\bpayroll\b/,
  },
  {
    category: 'housing',
    isIncome: false,
    words:
      /aluguel|condominio|\biptu\b|\benel\b|cemig|sabesp|copel|energia|\bagua\b|internet|\bgas\b|\brent\b/,
  },
  {
    category: 'food',
    isIncome: false,
    words:
      /ifood|rappi|restaurante|padaria|mercado|atacadao|carrefour|pao de acucar|lanchonete|acai|hamburguer|pizza|acougue|hortifruti|restaurant|grocer/,
  },
  {
    category: 'transport',
    isIncome: false,
    words:
      /\buber\b|\b99\b|\bposto\b|combustivel|estacionamento|ipiranga|\bshell\b|\bmetro\b|bilhete unico|pedagio|sem parar|gasolina|\bfuel\b|parking/,
  },
  {
    category: 'health',
    isIncome: false,
    words:
      /farmacia|drogaria|drogasil|droga raia|pague menos|clinica|hospital|unimed|laboratorio|dentista|medico|pharmacy/,
  },
  {
    category: 'subscriptions',
    isIncome: false,
    words:
      /netflix|spotify|amazon prime|disney|\bhbo\b|youtube|apple\.com|google one|assinatura|subscription/,
  },
  {
    category: 'education',
    isIncome: false,
    words: /\bcurso\b|udemy|alura|escola|faculdade|livraria|\blivro|coursera|tuition/,
  },
  {
    category: 'leisure',
    isIncome: false,
    words: /cinema|ingresso|steam|playstation|xbox|airbnb|hotel|viagem|\bbar\b|teatro|\bticket/,
  },
];

function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function memoryKey(description: string, amountCents: number): string {
  return `${amountCents > 0 ? 'in' : 'out'}|${normalizeText(description)}`;
}

interface CategoryUse {
  readonly count: number;
  readonly lastDate: string;
}

/**
 * Learns the category of each description from past transactions: the one used most, the latest one when
 * tied. Money coming in and going out are kept apart.
 * @example rememberCategories(transactions).get('out|padaria do ze') // 'food'
 */
export function rememberCategories(
  transactions: readonly Pick<Transaction, 'date' | 'description' | 'categoryId' | 'amountCents'>[],
): CategoryMemory {
  const uses = new Map<string, Map<string, CategoryUse>>();
  for (const transaction of transactions) {
    const key = memoryKey(transaction.description, transaction.amountCents);
    const byCategory = uses.get(key) ?? new Map<string, CategoryUse>();
    byCategory.set(
      transaction.categoryId,
      countUse(byCategory.get(transaction.categoryId), transaction.date),
    );
    uses.set(key, byCategory);
  }
  return new Map([...uses].map(([key, byCategory]) => [key, mostUsed(byCategory)]));
}

function countUse(seen: CategoryUse | undefined, date: string): CategoryUse {
  const lastDate = seen !== undefined && seen.lastDate > date ? seen.lastDate : date;
  return { count: (seen?.count ?? 0) + 1, lastDate };
}

function mostUsed(byCategory: ReadonlyMap<string, CategoryUse>): string {
  const ranked = [...byCategory].sort(
    ([, first], [, second]) =>
      second.count - first.count || second.lastDate.localeCompare(first.lastDate),
  );
  return ranked[0][0];
}

function findByName(categories: readonly FinanceCategory[], name: string): string | undefined {
  return categories.find((category) => normalizeText(category.name) === name)?.id;
}

function categoryFromWords(
  row: Pick<StatementRow, 'amountCents' | 'description'>,
  categories: readonly FinanceCategory[],
): string | undefined {
  const text = normalizeText(row.description);
  const isIncome = row.amountCents > 0;
  const rule = KEYWORD_RULES.find(
    (candidate) => candidate.isIncome === isIncome && candidate.words.test(text),
  );
  return rule === undefined ? undefined : findByName(categories, rule.category);
}

/**
 * The category to start a line on. Money moved into or out of investments goes to investments; otherwise
 * what the person used before for the same description, then a category the words point to (Uber →
 * Transport), then extra income for what came in and "Other" for what went out; the first category when
 * none of those exists.
 * @example suggestCategoryId(row, categories, rememberCategories(pastTransactions)) // 'food'
 */
export function suggestCategoryId(
  row: Pick<StatementRow, 'kind' | 'amountCents' | 'description'>,
  categories: readonly FinanceCategory[],
  memory: CategoryMemory = new Map(),
): string | undefined {
  if (row.kind === 'internal') return findByName(categories, 'investments') ?? categories[0]?.id;
  const remembered = memory.get(memoryKey(row.description, row.amountCents));
  if (remembered !== undefined && categories.some((category) => category.id === remembered)) {
    return remembered;
  }
  const fallback = row.amountCents > 0 ? 'extra income' : 'other';
  return (
    categoryFromWords(row, categories) ?? findByName(categories, fallback) ?? categories[0]?.id
  );
}

/**
 * The card payment an invoice payment line comes to: what left the account, in cents above zero.
 * @example toCardPayment(row, 'visa', 'checking').amountCents // 206428
 */
export function toCardPayment(
  row: Pick<StatementRow, 'id' | 'date' | 'amountCents'>,
  cardId: string,
  fromAccountId: string,
): CardPayment {
  return {
    id: row.id,
    cardId,
    fromAccountId,
    date: row.date,
    amountCents: Math.abs(row.amountCents),
  };
}

/**
 * The `YYYY-MM` months the lines fall in, oldest first.
 * @example statementMonths(rows) // ['2026-10']
 */
export function statementMonths(rows: readonly Pick<StatementRow, 'date'>[]): string[] {
  return [...new Set(rows.map((row) => row.date.slice(0, 7)))].sort((a, b) => a.localeCompare(b));
}

function readRow(cells: readonly string[], lineNumber: number): StatementRow | string {
  if (cells.length < HEADER.length) {
    return `Line ${lineNumber}: expected 4 columns, received ${cells.length}.`;
  }
  const [dateText, amountText, idText, ...rest] = cells.map((cell) => cell.trim());
  const date = parseStatementDate(dateText);
  if (date === undefined)
    return `Line ${lineNumber}: expected a date like 31/10/2026, received "${dateText}".`;
  const amountCents = parseStatementAmount(amountText);
  if (amountCents === undefined) {
    return `Line ${lineNumber}: expected an amount like 57.10 or -3.75, received "${amountText}".`;
  }
  if (!ID_PATTERN.test(idText)) {
    return `Line ${lineNumber}: expected an identifier of letters, digits and dashes, received "${idText}".`;
  }
  const original = rest.join(',').trim();
  const kind = kindOf(original, amountCents);
  return { id: idText, date, amountCents, description: describeStatementLine(original), kind };
}

/** An invoice payment leaves the account; anything else with that name (a refund) is not one. */
function kindOf(description: string, amountCents: number): StatementRowKind {
  if (INVOICE_PATTERN.test(description) && amountCents < 0) return 'invoicePayment';
  const isOwnMoney = INTERNAL_PATTERN.test(description) || INVOICE_PATTERN.test(description);
  return isOwnMoney ? 'internal' : 'regular';
}

function parseStatementDate(text: string): string | undefined {
  const match = DATE_PATTERN.exec(text);
  if (match === null) return undefined;
  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  const isReal = parsed.getDate() === Number(day) && parsed.getMonth() === Number(month) - 1;
  return isReal ? `${year}-${month}-${day}` : undefined;
}

function parseStatementAmount(text: string): number | undefined {
  const match = AMOUNT_PATTERN.exec(text);
  if (match === null) return undefined;
  const cents = Number(match[2]) * CENTS_PER_REAL + Number((match[3] ?? '').padEnd(2, '0'));
  if (cents === 0 || cents > MAX_AMOUNT_CENTS) return undefined;
  return match[1] === '-' ? -cents : cents;
}

function transferPrefix(lead: string): string | undefined {
  if (/^transferência enviada pelo pix/i.test(lead)) return 'Pix enviado';
  if (/^transferência recebida pelo pix/i.test(lead)) return 'Pix recebido';
  if (/^transferência recebida/i.test(lead)) return 'Transferência recebida';
  if (/^transferência enviada/i.test(lead)) return 'Transferência enviada';
  return undefined;
}
