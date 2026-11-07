import { entryText, readZipEntries } from './zip-reader';

const SHARED_STRINGS = 'xl/sharedStrings.xml';
const SHEET_PATTERN = /^xl\/worksheets\/sheet(\d+)\.xml$/;
const LETTERS = 26;

/**
 * Reads the first sheet of an `.xlsx` workbook as rows of text, one cell per column (an empty cell is an
 * empty string). Numbers come as the text Excel stored (`'17655.02'`), so no precision is lost to a float;
 * dates stored as numbers come as their serial number.
 * @example const rows = await readFirstSheet(new Uint8Array(await file.arrayBuffer()))
 */
export async function readFirstSheet(bytes: Uint8Array): Promise<string[][]> {
  const entries = await readZipEntries(
    bytes,
    (name) => name === SHARED_STRINGS || SHEET_PATTERN.test(name),
  );
  const sheets = entries
    .filter((entry) => SHEET_PATTERN.test(entry.name))
    .sort((first, second) => sheetNumber(first.name) - sheetNumber(second.name));
  if (sheets.length === 0) throw new Error('Expected an .xlsx workbook with a sheet, found none.');
  const sharedEntry = entries.find((entry) => entry.name === SHARED_STRINGS);
  const shared = sharedEntry === undefined ? [] : readSharedStrings(entryText(sharedEntry));
  return readRows(entryText(sheets[0]), shared);
}

function sheetNumber(name: string): number {
  return Number(SHEET_PATTERN.exec(name)?.[1] ?? 0);
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function readSharedStrings(xml: string): string[] {
  return [...parseXml(xml).getElementsByTagName('si')].map((item) =>
    [...item.getElementsByTagName('t')]
      .filter((piece) => piece.parentElement?.tagName !== 'rPh')
      .map((piece) => piece.textContent ?? '')
      .join(''),
  );
}

function readRows(xml: string, shared: readonly string[]): string[][] {
  return [...parseXml(xml).getElementsByTagName('row')].map((row) => {
    const cells: string[] = [];
    for (const cell of row.getElementsByTagName('c')) {
      cells[columnIndex(cell.getAttribute('r') ?? '')] = cellText(cell, shared);
    }
    return Array.from(cells, (text) => text ?? '');
  });
}

function cellText(cell: Element, shared: readonly string[]): string {
  const type = cell.getAttribute('t');
  const value = cell.getElementsByTagName('v')[0]?.textContent ?? '';
  if (type === 's') return shared[Number(value)] ?? '';
  if (type === 'inlineStr') return cell.getElementsByTagName('t')[0]?.textContent ?? '';
  return value;
}

/**
 * The zero-based column of a cell reference.
 * @example columnIndex('C12') // 2
 */
export function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference.toUpperCase())?.[0] ?? '';
  return [...letters].reduce((total, letter) => total * LETTERS + letter.charCodeAt(0) - 64, 0) - 1;
}
