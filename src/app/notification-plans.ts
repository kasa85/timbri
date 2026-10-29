import { calculateDay, Workday } from './workday';
import { DEFAULT_RULES } from './work-settings';

export interface NotificationPreferences { exit: boolean; pause: boolean; voucher: boolean; }
export interface NotificationPlan { kind: string; title: string; body: string; at: number; }

/** Calcola scadenze stabili dall’ultima timbratura e somma le pause già completate. */
export function notificationPlans(day: Workday | undefined, preferences: NotificationPreferences): NotificationPlan[] {
  const last = day?.stamps.at(-1);
  if (!day || !last) return [];
  const metrics = calculateDay(day, last.time);
  const rules = day.rules ?? DEFAULT_RULES;
  if (metrics.state === 'working' && preferences.exit && metrics.exit !== null) {
    return [{ kind: 'exit', title: 'Puoi uscire', body: 'Hai raggiunto l’orario di uscita previsto per oggi.', at: metrics.exit }];
  }
  if (metrics.state !== 'paused') return [];
  const plans: NotificationPlan[] = [];
  if (preferences.pause && rules.pauseEnabled && day.target > rules.pauseAbove && metrics.pause < rules.pauseMinutes) {
    plans.push({ kind: 'pause', title: 'Pausa minima completata', body: 'Hai raggiunto i minuti di pausa obbligatoria previsti per oggi.', at: last.time + (rules.pauseMinutes - metrics.pause) * 60000 });
  }
  if (preferences.voucher && rules.voucherEnabled && metrics.pause < rules.voucherPause) {
    plans.push({ kind: 'voucher', title: 'Pausa per buono pasto completata', body: 'Hai raggiunto la pausa richiesta per il buono pasto. Restano necessari i requisiti di lavoro della giornata.', at: last.time + (rules.voucherPause - metrics.pause) * 60000 });
  }
  if (plans.length === 2 && plans[0].at === plans[1].at) {
    return [{ kind: 'pause-voucher', title: 'Pause completate', body: 'Hai completato la pausa minima e quella richiesta per il buono pasto. Restano necessari i requisiti di lavoro della giornata.', at: plans[0].at }];
  }
  return plans;
}
