import { describe, expect, it } from 'vitest';
import { exportCsv, importCsv } from './archive-csv';
import { Workday } from './workday';

const at = (hour: number) => new Date(2025, 0, 2, hour).getTime();
const days: Workday[] = [
  { date: '2025-01-02', target: 540, stamps: [{ kind: 'entry', time: at(9) }, { kind: 'finish', time: at(17) }], mealVoucher: false },
  { date: '2025-01-03', target: 360, stamps: [] },
];

describe('Backup CSV', () => {
  it('ripristina esattamente timbrature, obiettivi, buoni e giornate vuote', () => {
    expect(importCsv(exportCsv(days))).toEqual(days);
    const legacy = [{ ...days[0], mealVoucher: undefined }];
    expect(importCsv(exportCsv(legacy))[0].mealVoucher).toBeUndefined();
  });

  it('accetta CRLF, BOM e celle numeriche tra virgolette', () => {
    expect(importCsv(exportCsv(days).replace(';540;', ';"540";'))).toEqual(days);
  });

  it('rifiuta sequenze errate, metadati incoerenti, date impossibili e righe troncate', () => {
    const csv = exportCsv(days);
    for (const invalid of [
      csv.replace(';entry;', ';pause;'),
      csv.replace(';540;false;finish;', ';360;false;finish;'),
      csv.replaceAll('2025-01-02', '2025-02-30'),
      csv + '\r\n2025-01-04;360;',
      csv + '\r\n2025-01-03;360;;;',
      csv.replace(';540;', ';-1;'),
      csv.replace(';false;', ';forse;'),
    ]) expect(() => importCsv(invalid)).toThrow();
  });

  it('rifiuta file vuoti, intestazioni estranee e orari futuri', () => {
    expect(() => importCsv('')).toThrow();
    expect(() => importCsv(exportCsv([]))).toThrow();
    expect(() => importCsv(exportCsv(days), at(8))).toThrow();
  });
});

it('ripristina anche le giornate con obiettivo zero ammesse dalla Home', () => {
  const zero = days.map(day => ({ ...day, target: 0 }));
  expect(importCsv(exportCsv(zero))).toEqual(zero);
});
