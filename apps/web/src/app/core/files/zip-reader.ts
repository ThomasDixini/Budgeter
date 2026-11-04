const END_OF_DIRECTORY = 0x06054b50;
const CENTRAL_ENTRY = 0x02014b50;
const LOCAL_ENTRY = 0x04034b50;
const END_OF_DIRECTORY_MIN_SIZE = 22;
const STORED = 0;
const DEFLATED = 8;
const TEXT_DECODER = new TextDecoder();

/** One file inside a zip archive, with its bytes already unpacked. */
export interface ZipEntry {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/**
 * Reads the files of a zip archive (what an `.xlsx` is) whose names `wanted` accepts. Understands stored
 * and deflated entries, which is all office files use; anything else is refused with a message saying so.
 * @example const entries = await readZipEntries(bytes, (name) => name === 'xl/sharedStrings.xml')
 */
export async function readZipEntries(
  bytes: Uint8Array,
  wanted: (name: string) => boolean,
): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const directory = findDirectory(view);
  const entries: ZipEntry[] = [];
  let offset = directory.offset;
  for (let index = 0; index < directory.count; index++) {
    if (view.getUint32(offset, true) !== CENTRAL_ENTRY) throw zipError('a damaged entry list');
    const entry = readCentralEntry(view, bytes, offset);
    offset = entry.next;
    if (wanted(entry.name)) {
      entries.push({ name: entry.name, bytes: await unpack(view, bytes, entry) });
    }
  }
  return entries;
}

/**
 * The text of a zip entry, read as UTF-8.
 * @example entryText(entries[0]) // '<?xml version="1.0" ...'
 */
export function entryText(entry: ZipEntry): string {
  return TEXT_DECODER.decode(entry.bytes);
}

interface CentralEntry {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly localOffset: number;
  readonly next: number;
}

function findDirectory(view: DataView): { count: number; offset: number } {
  const last = view.byteLength - END_OF_DIRECTORY_MIN_SIZE;
  for (let position = last; position >= 0 && position > last - 0xffff; position--) {
    if (view.getUint32(position, true) === END_OF_DIRECTORY) {
      return {
        count: view.getUint16(position + 10, true),
        offset: view.getUint32(position + 16, true),
      };
    }
  }
  throw zipError('no end of archive marker');
}

function readCentralEntry(view: DataView, bytes: Uint8Array, offset: number): CentralEntry {
  const nameLength = view.getUint16(offset + 28, true);
  const extraLength = view.getUint16(offset + 30, true);
  const commentLength = view.getUint16(offset + 32, true);
  return {
    name: TEXT_DECODER.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
    method: view.getUint16(offset + 10, true),
    compressedSize: view.getUint32(offset + 20, true),
    localOffset: view.getUint32(offset + 42, true),
    next: offset + 46 + nameLength + extraLength + commentLength,
  };
}

async function unpack(view: DataView, bytes: Uint8Array, entry: CentralEntry): Promise<Uint8Array> {
  if (view.getUint32(entry.localOffset, true) !== LOCAL_ENTRY) throw zipError('a damaged entry');
  const dataStart =
    entry.localOffset +
    30 +
    view.getUint16(entry.localOffset + 26, true) +
    view.getUint16(entry.localOffset + 28, true);
  const packed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === STORED) return packed;
  if (entry.method === DEFLATED) return inflate(packed);
  throw zipError(`compression method ${entry.method}`);
}

async function inflate(packed: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  void writer.write(packed as Uint8Array<ArrayBuffer>).then(() => writer.close());
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (let part = await reader.read(); !part.done; part = await reader.read())
    chunks.push(part.value);
  return concatenate(chunks);
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    joined.set(chunk, position);
    position += chunk.length;
  }
  return joined;
}

function zipError(reason: string): Error {
  return new Error(`Expected a zip archive (an .xlsx file), found ${reason}.`);
}
