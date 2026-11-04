import { columnIndex, readFirstSheet } from './xlsx-reader';
import { readZipEntries } from './zip-reader';
import { buildZip, sheetXml } from './zip-fixture.testing';

const SHARED = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<si><t>Produto</t></si><si><r><t>TOTS3 </t></r><r><t>- TOTVS</t></r></si></sst>`;

describe('readZipEntries', () => {
  it('unpacks stored and deflated entries and skips the ones not asked for', async () => {
    const bytes = await buildZip([
      { name: 'a.txt', text: 'stored text' },
      { name: 'b.txt', text: 'deflated text '.repeat(20), isDeflated: true },
      { name: 'c.txt', text: 'not wanted' },
    ]);

    const entries = await readZipEntries(bytes, (name) => name !== 'c.txt');

    expect(entries.map((entry) => [entry.name, new TextDecoder().decode(entry.bytes)])).toEqual([
      ['a.txt', 'stored text'],
      ['b.txt', 'deflated text '.repeat(20)],
    ]);
  });

  it('says so when the file is not a zip archive', async () => {
    await expect(
      readZipEntries(new TextEncoder().encode('Data,Valor\n1,2'), () => true),
    ).rejects.toThrow('Expected a zip archive (an .xlsx file), found no end of archive marker.');
  });
});

describe('columnIndex', () => {
  it('counts columns from zero, past Z', () => {
    expect([columnIndex('A1'), columnIndex('C12'), columnIndex('Z3'), columnIndex('AA1')]).toEqual([
      0, 2, 25, 26,
    ]);
  });
});

describe('readFirstSheet', () => {
  it('reads text, shared strings and numbers as the text Excel stored, leaving gaps empty', async () => {
    const xml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>x</t></is></c><c r="B2"><v>17655.02</v></c><c r="C2"><v>0.075</v></c></row></sheetData></worksheet>`;
    const bytes = await buildZip([
      { name: 'xl/sharedStrings.xml', text: SHARED, isDeflated: true },
      { name: 'xl/worksheets/sheet1.xml', text: xml, isDeflated: true },
    ]);

    expect(await readFirstSheet(bytes)).toEqual([
      ['Produto', '', 'TOTS3 - TOTVS'],
      ['x', '17655.02', '0.075'],
    ]);
  });

  it('reads the first sheet by its number, not by where it sits in the archive', async () => {
    const bytes = await buildZip([
      { name: 'xl/worksheets/sheet2.xml', text: sheetXml([['second']]) },
      { name: 'xl/worksheets/sheet1.xml', text: sheetXml([['first']]) },
    ]);

    expect(await readFirstSheet(bytes)).toEqual([['first']]);
  });

  it('says so when the archive has no sheet', async () => {
    const bytes = await buildZip([{ name: 'readme.txt', text: 'x' }]);

    await expect(readFirstSheet(bytes)).rejects.toThrow(
      'Expected an .xlsx workbook with a sheet, found none.',
    );
  });
});
