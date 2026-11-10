import { MAX_AMOUNT_CENTS } from './money';
import {
  ParsedStatement,
  StatementRow,
  StatementRowKind,
  describeStatementLine,
  splitCsvLine,
} from './statement-import';

/** Some programs start a UTF-8 file with this invisible character. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const CARD_HEADER = ['date', 'title', 'amount'];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
/** `59,90`, `3.519,76` or `-3.519,76`: dots group thousands and the comma starts the cents. */
const AMOUNT_PATTERN = /^(-?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
/** Lines that only move what was owed or paid, already counted by the bank statement or the debt. */
const BOOKKEEPING_PATTERN = /^(valor pendente do mês anterior|pagamento recebido)/i;
const CENTS_PER_REAL = 100;
const HASH_SEEDS = [0x811c9dc5, 0x01000193] as const;
const FNV_PRIME = 0x01000193;

function withoutByteOrderMark(csv: string): string {
  return csv.startsWith(BYTE_ORDER_MARK) ? csv.slice(1) : csv;
}

function cleanLines(csv: string): { text: string; number: number }[] {
  return withoutByteOrderMark(csv)
    .split(/\r?\n/)
    .map((text, index) => ({ text, number: index + 1 }))
    .filter((line) => line.text.trim() !== '');
}

/**
 * Whether the file is a card invoice export (columns `date,title,amount`) rather than a bank statement.
 * @example isCardInvoice('date,title,amount\n2026-11-08,Netflix,"59,90"') // true
 */
export function isCardInvoice(csv: string): boolean {
  const [first] = cleanLines(csv);
  if (first === undefined) return false;
  return (
    splitCsvLine(first.text)
      .map((cell) => cell.trim().toLowerCase())
      .join() === CARD_HEADER.join()
  );
}

/**
 * Reads the CSV a card invoice is exported as (`date,title,amount`, ISO dates, amounts with a comma).
 * A purchase becomes a negative line and a credit a positive one. The file has no identifiers, so each
 * line gets one made of its own date, title, amount and place among identical lines: importing the same
 * file again finds the same ids. Carried-over balances and payments received are marked `internal`.
 * @example parseCardInvoice('date,title,amount\n2026-11-08,Netflix,"59,90"').rows[0].amountCents // -5990
 */
export function parseCardInvoice(csv: string): ParsedStatement {
  const lines = cleanLines(csv);
  if (lines.length === 0) return { rows: [], problems: ['The file is empty.'] };
  const rows: StatementRow[] = [];
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const result = readCardRow(splitCsvLine(line.text), line.number, seen);
    if (typeof result === 'string') problems.push(result);
    else rows.push(result);
  }
  return { rows, problems };
}

function readCardRow(
  cells: readonly string[],
  lineNumber: number,
  seen: Map<string, number>,
): StatementRow | string {
  if (cells.length < CARD_HEADER.length) {
    return `Line ${lineNumber}: expected 3 columns, received ${cells.length}.`;
  }
  const [dateText, ...rest] = cells.map((cell) => cell.trim());
  const amountText = rest.at(-1) ?? '';
  const title = rest.slice(0, -1).join(',').trim();
  if (!isRealDate(dateText)) {
    return `Line ${lineNumber}: expected a date like 2026-10-31, received "${dateText}".`;
  }
  const amountCents = parseCardAmount(amountText);
  if (amountCents === undefined) {
    return `Line ${lineNumber}: expected an amount like 59,90 or - 3.519,76, received "${amountText}".`;
  }
  const id = lineId(dateText, title, amountCents, seen);
  return {
    id,
    date: dateText,
    amountCents,
    description: describeStatementLine(title),
    kind: cardKindOf(title),
  };
}

function cardKindOf(title: string): StatementRowKind {
  return BOOKKEEPING_PATTERN.test(title) ? 'internal' : 'regular';
}

function isRealDate(text: string): boolean {
  const match = DATE_PATTERN.exec(text);
  if (match === null) return false;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return parsed.getDate() === Number(day) && parsed.getMonth() === Number(month) - 1;
}

/** In the file a positive amount is a purchase; here money that left is negative. */
function parseCardAmount(text: string): number | undefined {
  const match = AMOUNT_PATTERN.exec(text.replaceAll(/\s/g, ''));
  if (match === null) return undefined;
  const [, sign, whole, fraction = ''] = match;
  const cents =
    Number(whole.replaceAll('.', '')) * CENTS_PER_REAL + Number(fraction.padEnd(2, '0'));
  if (cents === 0 || cents > MAX_AMOUNT_CENTS) return undefined;
  return sign === '-' ? cents : -cents;
}

/** Same date, title and amount twice in a file are two purchases, so the count joins the hash. */
function lineId(
  date: string,
  title: string,
  amountCents: number,
  seen: Map<string, number>,
): string {
  const key = `${date}|${title}|${amountCents}`;
  const occurrence = (seen.get(key) ?? 0) + 1;
  seen.set(key, occurrence);
  const text = `${key}|${occurrence}`;
  return `card-${HASH_SEEDS.map((seed) => hashHex(text, seed)).join('')}`;
}

function hashHex(text: string, seed: number): string {
  let hash = seed;
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
