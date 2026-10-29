import { expect, it } from 'vitest';
import { notificationPlans } from './notification-plans';
import { DEFAULT_RULES } from './work-settings';
import { Workday } from './workday';

const at = (time: string) => new Date(`2026-10-29T${time}:00`).getTime();
const preferences = { exit: true, pause: true, voucher: true };
const day: Workday = { date: '2026-10-29', target: 480, rules: { ...DEFAULT_RULES }, stamps: [{ kind: 'entry', time: at('08:00') }] };

it('prevede l’uscita includendo la pausa obbligatoria mancante', () => {
  expect(notificationPlans(day, preferences)).toEqual([expect.objectContaining({ kind: 'exit', at: at('16:10') })]);
  expect(notificationPlans({ ...day, target: 540 }, preferences)[0].at).toBe(at('17:10'));
});

it('somma le pause precedenti e raggruppa le soglie coincidenti', () => {
  const paused: Workday = { ...day, stamps: [...day.stamps, { kind: 'pause', time: at('10:00') }, { kind: 'entry', time: at('10:05') }, { kind: 'pause', time: at('12:00') }] };
  expect(notificationPlans(paused, preferences).map(plan => [plan.kind, plan.at])).toEqual([
    ['pause', at('12:05')], ['voucher', at('12:25')],
  ]);
  const combined = notificationPlans({ ...paused, rules: { ...DEFAULT_RULES, pauseMinutes: 30 } }, preferences);
  expect(combined).toHaveLength(1);
  expect(combined[0].kind).toBe('pause-voucher');
  expect(combined[0].at).toBe(at('12:25'));
});

it('rispetta toggle, regole e fine giornata', () => {
  expect(notificationPlans(day, { ...preferences, exit: false })).toEqual([]);
  expect(notificationPlans({ ...day, stamps: [...day.stamps, { kind: 'finish', time: at('17:00') }] }, preferences)).toEqual([]);
  const paused = { ...day, target: 360, rules: { ...DEFAULT_RULES, voucherEnabled: false }, stamps: [...day.stamps, { kind: 'pause' as const, time: at('12:00') }] };
  expect(notificationPlans(paused, preferences)).toEqual([]);
});
