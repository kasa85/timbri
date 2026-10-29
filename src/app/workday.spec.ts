import { describe, expect, it } from 'vitest';
import { appendStamp, calculateDay, dayKey, timelineSegments, Workday } from './workday';

const at = (hour: number, minute = 0) => new Date(2026, 9, 29, hour, minute).getTime();
const day = (target = 540): Workday => ({ date: '2026-10-29', target, stamps: [{ kind: 'entry', time: at(9) }] });

describe('Calcolo della giornata', () => {
  it('prevede dieci minuti aggiuntivi oltre sei ore', () => {
    const result = calculateDay(day(), at(10));
    expect(result.work).toBe(60);
    expect(result.remaining).toBe(480);
    expect(result.exit).toBe(at(18, 10));
  });
  it('rende facoltativa la pausa per sei ore esatte', () => {
    expect(calculateDay(day(360), at(10)).exit).toBe(at(15));
  });
  it('somma più pause e considera solo la pausa minima residua', () => {
    let current = appendStamp(day(), 'pause', at(10), at(12));
    current = appendStamp(current, 'entry', at(10, 4), at(12));
    current = appendStamp(current, 'pause', at(11), at(12));
    const paused = calculateDay(current, at(11, 3));
    expect(paused.pause).toBe(7);
    expect(paused.work).toBe(116);
    expect(paused.exit).toBe(at(18, 10));
    expect(calculateDay(current, at(11, 20)).work).toBe(116);
    expect(calculateDay(current, at(11, 20)).exit).toBe(at(18, 24));
  });
  it('congela i totali dopo una chiusura anticipata e dopo la riapertura', () => {
    const closed = appendStamp(day(), 'finish', at(10), at(12));
    const restored = JSON.parse(JSON.stringify(closed));
    expect(calculateDay(restored, at(15))).toMatchObject({ work: 60, pause: 0, remaining: 480, exit: null, state: 'finished' });
  });
  it('non produce tempo rimanente negativo quando si supera l’obiettivo', () => {
    expect(calculateDay(day(360), at(17)).remaining).toBe(0);
  });
  it('parte senza timbrature nella nuova giornata', () => {
    expect(dayKey(new Date(2026, 9, 30))).toBe('2026-10-30');
    expect(calculateDay(undefined, at(9)).state).toBe('idle');
  });
});

describe('Validazione timbrature', () => {
  it('accetta entrata, pausa, rientro e fine giornata', () => {
    let current: Workday = { ...day(), stamps: [] };
    for (const [kind, hour] of [['entry', 9], ['pause', 10], ['entry', 11], ['finish', 12]] as const) current = appendStamp(current, kind, at(hour), at(13));
    expect(current.stamps).toHaveLength(4);
  });
  it('rifiuta orari futuri, precedenti e fuori giornata', () => {
    expect(() => appendStamp(day(), 'pause', at(11), at(10))).toThrow();
    expect(() => appendStamp(day(), 'pause', at(8), at(10))).toThrow();
    expect(() => appendStamp(day(), 'pause', new Date(2026, 9, 30, 9).getTime(), at(10))).toThrow();
  });
  it('rifiuta doppie entrate e riapertura dopo fine giornata', () => {
    expect(() => appendStamp(day(), 'entry', at(10), at(12))).toThrow();
    const closed = appendStamp(day(), 'finish', at(10), at(12));
    expect(() => appendStamp(closed, 'entry', at(11), at(12))).toThrow();
  });
});

describe('Colori del cerchio', () => {
  it('mostra subito il viola e mantiene fermo il progresso durante la pausa', () => {
    const paused = appendStamp(day(), 'pause', at(10), at(10));
    const initial = timelineSegments(paused, at(10));
    const later = timelineSegments(paused, at(10, 20));
    expect(initial.map(segment => segment.type)).toEqual(['work', 'pause']);
    expect(initial.at(-1)!.end).toBeCloseTo(40);
    expect(later.at(-1)!.end).toBeCloseTo(40);
    expect(later[1].end - later[1].start).toBeGreaterThan(initial[1].end - initial[1].start);
  });
  it('conserva le pause tra gli intervalli di lavoro dopo il rientro', () => {
    let current = appendStamp(day(), 'pause', at(10), at(12));
    current = appendStamp(current, 'entry', at(10, 10), at(12));
    expect(timelineSegments(current, at(11)).map(segment => segment.type)).toEqual(['work', 'pause', 'work']);
  });
  it('ricalcola progresso e pausa minima cambiando durata', () => {
    expect(calculateDay({ ...day(), target: 360 }, at(10)).exit).toBe(at(15));
    expect(timelineSegments({ ...day(), target: 360 }, at(10)).at(-1)!.end).toBeCloseTo(60);
    expect(timelineSegments({ ...day(), target: 540 }, at(10)).at(-1)!.end).toBeCloseTo(40);
  });
});
