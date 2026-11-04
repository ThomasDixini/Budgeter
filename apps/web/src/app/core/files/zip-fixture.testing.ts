const ENCODER = new TextEncoder();

/** A file to put in a test zip; `isDeflated` packs it the way office programs do. */
export interface FixtureFile {
  readonly name: string;
  readonly text: string;
  readonly isDeflated?: boolean;
}

/**
 * Builds a small zip archive in memory for tests of the file readers (the checksum is left empty, as the
 * readers do not check it).
 * @example const bytes = await buildZip([{ name: 'a.txt', text: 'hi' }])
 */
export async function buildZip(files: readonly FixtureFile[]): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = ENCODER.encode(file.name);
    const raw = ENCODER.encode(file.text);
    const data = file.isDeflated ? await deflate(raw) : raw;
    const local = record(30, name, [
      [0, 4, 0x04034b50],
      [8, 2, file.isDeflated ? 8 : 0],
      [18, 4, data.length],
      [22, 4, raw.length],
      [26, 2, name.length],
    ]);
    directory.push(
      record(46, name, [
        [0, 4, 0x02014b50],
        [10, 2, file.isDeflated ? 8 : 0],
        [20, 4, data.length],
        [24, 4, raw.length],
        [28, 2, name.length],
        [42, 4, offset],
      ]),
    );
    parts.push(local, data);
    offset += local.length + data.length;
  }
  const directorySize = directory.reduce((total, entry) => total + entry.length, 0);
  const end = record(22, new Uint8Array(), [
    [0, 4, 0x06054b50],
    [10, 2, files.length],
    [12, 4, directorySize],
    [16, 4, offset],
  ]);
  return join([...parts, ...directory, end]);
}

function record(
  size: number,
  name: Uint8Array,
  fields: readonly (readonly [offset: number, bytes: 2 | 4, value: number])[],
): Uint8Array {
  const bytes = new Uint8Array(size + name.length);
  const view = new DataView(bytes.buffer);
  for (const [offset, length, value] of fields) {
    if (length === 4) view.setUint32(offset, value, true);
    else view.setUint16(offset, value, true);
  }
  bytes.set(name, size);
  return bytes;
}

async function deflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  void writer.write(raw as Uint8Array<ArrayBuffer>).then(() => writer.close());
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (let part = await reader.read(); !part.done; part = await reader.read())
    chunks.push(part.value);
  return join(chunks);
}

function join(chunks: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    joined.set(chunk, position);
    position += chunk.length;
  }
  return joined;
}

/**
 * The XML of a worksheet with the given rows of cells (`'text'` for text, a number for a numeric cell).
 * @example sheetXml([['a', 1.5]])
 */
export function sheetXml(rows: readonly (readonly (string | number | undefined)[])[]): string {
  const letters = 'ABCDEFGHIJ';
  const body = rows
    .map((cells, rowIndex) => {
      const xml = cells
        .map((cell, column) => {
          const ref = `${letters[column]}${rowIndex + 1}`;
          if (cell === undefined) return '';
          if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t>${cell}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${xml}</row>`;
    })
    .join('');
  return `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}
