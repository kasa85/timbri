import { describe, expect, it } from 'vitest';
import { appendStamp, dayKey, earnsMealVoucher, Workday } from './workday';
import { registerDuration, registerRows } from './registro-data';

/** Crea una giornata con due pause di quindici minuti e lavoro netto controllabile. */
function closedDay(date: string, work = 540, target = 540): Workday {
  const at = (minutes: number) => new Date(`${date}T00:00:00`).getTime() + minutes * 60000;
  const day: Workday = { date, target, stamps: [
    { kind: 'entry', time: at(480) },
    { kind: 'pause', time: at(600) },
    { kind: 'entry', time: at(615) },
    { kind: 'pause', time: at(735) },
    { kind: 'entry', time: at(750) },
  ] };
  return appendStamp(day, 'finish', at(480 + work + 30), at(1439));
}

const now = new Date(2026, 9, 29, 20).getTime();

describe('Buono pasto', () => {
  it('somma pause brevi e salva il buono alla chiusura', () => {
    const day = closedDay('2026-10-29', 361);
    expect(day.mealVoucher).toBe(true);
    expect(JSON.parse(JSON.stringify(day)).mealVoucher).toBe(true);
  });
  it('richiede più di sei ore effettive, anche se l’obiettivo è nove ore', () => {
    expect(closedDay('2026-10-29', 360).mealVoucher).toBe(false);
    expect(closedDay('2026-10-29', 359).mealVoucher).toBe(false);
    expect(closedDay('2026-10-29', 361, 360).mealVoucher).toBe(true);
  });
  it('richiede trenta minuti complessivi e una giornata conclusa', () => {
    const day = closedDay('2026-10-29');
    day.stamps[2].time -= 60000;
    expect(earnsMealVoucher(day)).toBe(false);
    day.stamps.pop();
    expect(earnsMealVoucher(day)).toBe(false);
  });
});

describe('Righe e riepiloghi del registro', () => {
  it('mostra la giornata in corso come provvisoria senza assegnare il buono', () => {
    const day = closedDay('2026-10-29');
    day.stamps.pop();
    delete day.mealVoucher;
    const [row] = registerRows([day], 'day', '2026-10', now);
    expect(row.provisional).toBe(true);
    expect(row.vouchers).toBe(0);
    expect(registerRows([day], 'week', '2026-10', now)).toEqual([]);
    expect(registerRows([day], 'month', '2026', now)).toEqual([]);
  });
  it('somma giorni, ore, balance e buoni nelle settimane da lunedì a domenica', () => {
    const days = [closedDay('2026-10-26', 550), closedDay('2026-10-29', 535), closedDay('2026-10-25')];
    const rows = registerRows(days, 'week', '2026-10', now);
    expect(rows.map(row => row.label)).toEqual(['Sett. 5', 'Sett. 4']);
    expect(rows[0]).toMatchObject({ work: 1085, balance: 5, vouchers: 2 });
    expect(rows[0].days).toHaveLength(2);
  });
  it('separa i mesi e gli anni e non include timbrature di altri periodi', () => {
    const days = [closedDay('2026-10-29', 550), closedDay('2026-09-30', 530), closedDay('2025-10-29')];
    const rows = registerRows(days, 'month', '2026', now);
    expect(rows.map(row => row.label)).toEqual(['ottobre', 'settembre']);
    expect(rows.map(row => row.balance)).toEqual([10, -10]);
    expect(registerRows(days, 'day', '2026-10', now)).toHaveLength(1);
  });
  it('gestisce la prima settimana parziale del mese e domenica/lunedì', () => {
    const days = ['2026-11-01', '2026-11-02'].map(date => closedDay(date));
    expect(registerRows(days, 'week', '2026-11', new Date(2026, 11, 1).getTime()).map(row => row.label)).toEqual(['Sett. 2', 'Sett. 1']);
  });
  it('calcola anche i buoni delle giornate salvate prima del nuovo campo', () => {
    const day = closedDay('2026-10-29');
    delete day.mealVoucher;
    expect(registerRows([day], 'day', '2026-10', now)[0].vouchers).toBe(1);
  });
  it('ignora le giornate resettate senza timbrature', () => {
    expect(registerRows([{ date: dayKey(new Date(now)), target: 540, stamps: [] }], 'day', '2026-10', now)).toEqual([]);
  });
  it('formatta durate e balance senza segni superflui', () => {
    expect(registerDuration(395)).toBe('6h 35m');
    expect(registerDuration(-145, true)).toBe('−2h 25m');
    expect(registerDuration(12, true)).toBe('+12m');
    expect(registerDuration(0, true)).toBe('0m');
  });
});

it('segnala una giornata incompleta dopo mezzanotte e la reinserisce nei riepiloghi alla chiusura', () => {
  const time = new Date('2026-10-28T09:00:00').getTime();
  const day: Workday = { date: '2026-10-28', target: 540, stamps: [{ kind: 'entry', time }] };
  expect(registerRows([day], 'day', '2026-10', now)[0].incomplete).toBe(true);
  const closed = appendStamp(day, 'finish', time + 9 * 3600000, now);
  expect(registerRows([closed], 'day', '2026-10', now)[0]).toMatchObject({ incomplete: false, work: 540, balance: 0 });
  expect(registerRows([closed], 'week', '2026-10', now)).toHaveLength(1);
});
