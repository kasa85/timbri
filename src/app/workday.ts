export type StampKind = 'entry' | 'pause' | 'finish';
export interface Stamp { kind: StampKind; time: number; }
export interface Workday { date: string; target: number; stamps: Stamp[]; mealVoucher?: boolean; }

/** Identifica la giornata secondo il calendario locale del telefono. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Ricostruisce lavoro netto, pause e previsione senza dipendere da timer persistenti. */
export function calculateDay(day: Workday | undefined, now: number) {
  let work = 0;
  let pause = 0;
  const stamps = day?.stamps ?? [];
  for (let i = 0; i < stamps.length; i++) {
    const duration = Math.max(0, (Math.min(stamps[i + 1]?.time ?? now, now) - stamps[i].time) / 60000);
    if (stamps[i].kind === 'entry') work += duration;
    if (stamps[i].kind === 'pause') pause += duration;
  }
  const last = stamps.at(-1);
  const state = !last ? 'idle' : last.kind === 'entry' ? 'working' : last.kind === 'pause' ? 'paused' : 'finished';
  const remaining = Math.max(0, (day?.target ?? 0) - work);
  const missingPause = day && day.target > 360 ? Math.max(0, 10 - pause) : 0;
  return { work, pause, remaining, state, exit: !last || state === 'finished' ? null : now + (remaining + missingPause) * 60000 };
}

/** Valida la sequenza e impedisce orari futuri, fuori giornata o precedenti all’ultima timbratura. */
export function appendStamp(day: Workday, kind: StampKind, time: number, now: number): Workday {
  const last = day.stamps.at(-1);
  if (!Number.isFinite(time) || time > now || dayKey(new Date(time)) !== day.date || (last && time < last.time)) throw new Error('Scegli un orario della giornata, non futuro e successivo all’ultima timbratura.');
  if ((!last && kind !== 'entry') || (last?.kind === 'entry' && kind === 'entry') || (last?.kind === 'pause' && kind !== 'entry' && kind !== 'finish') || last?.kind === 'finish') throw new Error('Timbratura non consentita nello stato attuale.');
  const updated: Workday = { ...day, stamps: [...day.stamps, { kind, time }] };
  if (kind === 'finish') updated.mealVoucher = earnsMealVoucher(updated);
  return updated;
}

/** Distribuisce lavoro e pause in ordine cronologico entro il progresso netto raggiunto. */
export function timelineSegments(day: Workday | undefined, now: number) {
  if (!day || day.target <= 0) return [];
  const progress = Math.min(1, calculateDay(day, now).work / day.target) * 360;
  const intervals = day.stamps.flatMap((stamp, index) => {
    if (stamp.kind === 'finish') return [];
    const minutes = Math.max(0, (Math.min(day.stamps[index + 1]?.time ?? now, now) - stamp.time) / 60000);
    // Una pausa appena iniziata deve avere un indicatore visibile anche prima del primo minuto.
    return [{ type: stamp.kind === 'entry' ? 'work' : 'pause', minutes: stamp.kind === 'pause' ? Math.max(1, minutes) : minutes }];
  });
  const total = intervals.reduce((sum, interval) => sum + interval.minutes, 0);
  let angle = 0;
  return intervals.filter(interval => interval.minutes > 0).map(interval => {
    const start = angle;
    angle += total > 0 ? interval.minutes / total * progress : 0;
    return { type: interval.type, start, end: Math.min(angle, 359.999) };
  }).filter(segment => segment.end > segment.start);
}

/** Assegna un buono con più di sei ore nette e almeno trenta minuti totali di pausa. */
export function earnsMealVoucher(day: Workday): boolean {
  const totals = calculateDay(day, day.stamps.at(-1)?.time ?? 0);
  return totals.state === 'finished' && totals.work > 360 && totals.pause >= 30;
}
