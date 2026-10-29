import { describe, expect, it } from 'vitest';
import { appendStamp, calculateDay, Workday } from './workday';
import { DEFAULT_RULES, DEFAULT_SETTINGS, dayRules, validDayRules } from './work-settings';
import { exportCsv, importCsv } from './archive-csv';
import { registerRows } from './registro-data';

const at = (hour: number, minute = 0) => new Date(2026, 9, 28, hour, minute).getTime();
const day = (target = 540): Workday => ({ date: '2026-10-28', target, stamps: [{ kind: 'entry', time: at(9) }], rules: { ...DEFAULT_RULES } });

describe('Regole personalizzate della giornata', () => {
  it('usa l’obiettivo previsto per la pausa, anche dopo aver superato sei ore effettive', () => {
    expect(calculateDay(day(360), at(15, 10)).exit).toBe(at(15, 10));
    const current = day();
    current.rules!.pauseMinutes = 25;
    expect(calculateDay(current, at(10)).exit).toBe(at(18, 25));
    current.rules!.pauseEnabled = false;
    expect(calculateDay(current, at(10)).exit).toBe(at(18));
    current.rules!.pauseEnabled = true;
    current.rules!.pauseAbove = 540;
    expect(calculateDay(current, at(10)).exit).toBe(at(18));
  });

  it('applica soglie, pause e disattivazione del buono anche al registro', () => {
    const current = day();
    current.rules = { ...DEFAULT_RULES, voucherAbove: 300, voucherPause: 0 };
    expect(appendStamp(current, 'finish', at(14), at(20)).mealVoucher).toBe(false);
    const closed = appendStamp(current, 'finish', at(14, 1), at(20));
    expect(closed.mealVoucher).toBe(true);
    expect(registerRows([closed], 'day', '2026-10', at(20))[0].vouchers).toBe(1);
    current.rules.voucherEnabled = false;
    const disabled = appendStamp(current, 'finish', at(18), at(20));
    expect(disabled.mealVoucher).toBe(false);
    expect(registerRows([disabled], 'day', '2026-10', at(20))[0].voucherEligible).toBe(false);
  });

  it('conserva una copia delle regole e mantiene i valori originali per lo storico', () => {
    const settings = { ...DEFAULT_SETTINGS };
    const current: Workday = { ...day(), rules: dayRules(settings) };
    settings.pauseMinutes = 45;
    expect(calculateDay(current, at(10)).exit).toBe(at(18, 10));
    delete current.rules;
    expect(calculateDay(current, at(10)).exit).toBe(at(18, 10));
  });

  it('ripristina le regole dal CSV insieme a giornate vecchie e giornate vuote', () => {
    const current = day();
    current.rules!.voucherAbove = 420;
    const legacy: Workday = { date: '2026-10-27', target: 360, stamps: [] };
    const empty: Workday = { ...day(), date: '2026-10-26', stamps: [] };
    const days = [empty, legacy, current];
    expect(importCsv(exportCsv(days), at(20))).toEqual(days);
    expect(() => importCsv(exportCsv(days).replace(';true;360;10;', ';true;-1;10;'), at(20))).toThrow();
    expect(() => importCsv(exportCsv(days).replace(';true;420;30', ';true;;30'), at(20))).toThrow();
  });

  it('rifiuta regole incomplete e durate non valide', () => {
    expect(validDayRules(DEFAULT_RULES)).toBe(true);
    for (const pauseMinutes of [-1, 1441, 1.5, NaN]) expect(validDayRules({ ...DEFAULT_RULES, pauseMinutes })).toBe(false);
    expect(validDayRules({ pauseEnabled: true })).toBe(false);
  });
});
