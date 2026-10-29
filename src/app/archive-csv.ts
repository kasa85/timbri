import { appendStamp, dayKey, StampKind, Workday } from './workday';

const columns = 'data;obiettivo_minuti;buono_pasto;tipo;timestamp_ms';

/** Esporta una riga per timbratura, conservando anche le giornate senza timbri. */
export function exportCsv(days: Workday[]): string {
  const rows = [...days].sort((a, b) => a.date.localeCompare(b.date)).flatMap(day => {
    const prefix = `${day.date};${day.target};${day.mealVoucher ?? ''}`;
    return day.stamps.length ? day.stamps.map(stamp => `${prefix};${stamp.kind};${stamp.time}`) : [`${prefix};;`];
  });
  return '\uFEFF' + [columns, ...rows].join('\r\n');
}

/** Valida interamente il CSV di Timbrì prima di consentire qualsiasi scrittura. */
export function importCsv(text: string, now = Date.now()): Workday[] {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.shift() !== columns) throw new Error('Formato CSV non riconosciuto. Usa un file esportato da Timbrì.');
  const days = new Map<string, Workday>();
  const empty = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const cells = line.split(';').map(value => value.replace(/^"([^"\r\n]*)"$/, '$1'));
    const [date, targetText, voucher, kind, timeText] = cells;
    const target = Number(targetText);
    const parsedDate = new Date(`${date}T12:00:00`);
    const fail = () => new Error(`Riga ${index + 2} non valida. Nessun dato è stato importato.`);
    if (cells.length !== 5 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || dayKey(parsedDate) !== date || date > dayKey(new Date(now)) || !targetText || !Number.isFinite(target) || target < 0 || target > 1440 || !['', 'true', 'false'].includes(voucher)) throw fail();
    let day = days.get(date);
    if (day && (day.target !== target || String(day.mealVoucher ?? '') !== voucher)) throw fail();
    day ??= { date, target, stamps: [], ...(voucher === '' ? {} : { mealVoucher: voucher === 'true' }) };
    if (!kind && !timeText) {
      if (days.has(date)) throw fail();
      empty.add(date);
    } else {
      if (empty.has(date) || !['entry', 'pause', 'finish'].includes(kind) || !timeText || !Number.isSafeInteger(Number(timeText))) throw fail();
      try {
        const updated = appendStamp(day, kind as StampKind, Number(timeText), now);
        day = { ...updated, ...(voucher === '' ? {} : { mealVoucher: voucher === 'true' }) };
        if (voucher === '') delete day.mealVoucher;
      } catch { throw fail(); }
    }
    days.set(date, day);
  }
  if (!days.size) throw new Error('Il file CSV non contiene giornate da importare.');
  return [...days.values()];
}
