import { calculateDay, dayKey, earnsMealVoucher, Workday } from './workday';

export type RegisterView = 'day' | 'week' | 'month';
export interface RegisterRow {
  key: string;
  label: string;
  days: Workday[];
  work: number;
  balance: number;
  vouchers: number;
  provisional: boolean;
  incomplete: boolean;
}

/** Calcola le righe del registro, raggruppando solo le giornate concluse nei riepiloghi. */
export function registerRows(days: Workday[], view: RegisterView, period: string, now: number): RegisterRow[] {
  const rows = new Map<string, RegisterRow>();
  for (const day of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    if (!day.stamps.length || !day.date.startsWith(period)) continue;
    const closed = day.stamps.at(-1)?.kind === 'finish';
    if (view !== 'day' && !closed) continue;
    const date = new Date(`${day.date}T12:00:00`);
    let key = day.date;
    let label = date.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '');
    if (view === 'week') {
      // Le settimane vanno da lunedì a domenica; la prima può iniziare nel mese precedente.
      const first = new Date(date.getFullYear(), date.getMonth(), 1);
      const offset = (first.getDay() + 6) % 7;
      const week = Math.ceil((date.getDate() + offset) / 7);
      key = `${period}-W${week}`;
      label = `Sett. ${week}`;
    } else if (view === 'month') {
      key = day.date.slice(0, 7);
      label = date.toLocaleDateString('it-IT', { month: 'long' });
    }
    const end = day.date === dayKey(new Date(now)) ? now : day.stamps.at(-1)!.time;
    const totals = calculateDay(day, end);
    const row = rows.get(key) ?? { key, label, days: [], work: 0, balance: 0, vouchers: 0, provisional: !closed, incomplete: !closed && day.date < dayKey(new Date(now)) };
    row.days.push(day);
    row.work += totals.work;
    row.balance += totals.work - day.target;
    // Le giornate precedenti all’introduzione del campo vengono calcolate senza migrazioni distruttive.
    row.vouchers += closed && (day.mealVoucher ?? earnsMealVoucher(day)) ? 1 : 0;
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** Formatta una durata intera, usando il segno soltanto per il balance. */
export function registerDuration(minutes: number, signed = false): string {
  const whole = Math.round(minutes);
  const absolute = Math.abs(whole);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  const value = hours ? `${hours}h${rest ? ` ${String(rest).padStart(2, '0')}m` : ''}` : `${rest}m`;
  return `${signed && whole !== 0 ? whole > 0 ? '+' : '−' : ''}${value}`;
}
