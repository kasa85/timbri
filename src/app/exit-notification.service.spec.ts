import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ExitNotificationService } from './exit-notification.service';
import { WorkdayService } from './workday.service';
import { dayKey, Workday } from './workday';
import { DEFAULT_RULES } from './work-settings';

const showNotification = vi.fn();
const days = signal<Workday[]>([]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-29T17:00:00'));
  localStorage.clear();
  localStorage.setItem('timbri-exit-enabled', '1');
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn(async () => 'granted') });
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => ({ active: {}, showNotification }) } });
  showNotification.mockReset().mockResolvedValue(undefined);
  days.set([{ date: dayKey(new Date()), target: 480, rules: { pauseEnabled: false } as Workday['rules'], stamps: [{ kind: 'entry', time: Date.now() - 480 * 60000 }] }]);
  TestBed.configureTestingModule({ providers: [{ provide: WorkdayService, useValue: { days, ready: signal(true), saving: signal(false) } }] });
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('avvisa al raggiungimento dell’obiettivo una sola volta anche dopo la riapertura', async () => {
  const service = TestBed.inject(ExitNotificationService);
  await service['check']();
  await service['check']();
  expect(showNotification).toHaveBeenCalledOnce();
  expect(localStorage.getItem('timbri-exit-notified')).toBe(dayKey(new Date()));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: WorkdayService, useValue: { days, ready: signal(true), saving: signal(false) } }] });
  await TestBed.inject(ExitNotificationService)['check']();
  expect(showNotification).toHaveBeenCalledOnce();
});

it('attende la pausa obbligatoria e non avvisa durante una pausa o a giornata conclusa', async () => {
  const service = TestBed.inject(ExitNotificationService);
  days.update(items => [{ ...items[0], rules: { ...items[0].rules!, pauseEnabled: true, pauseAbove: 360, pauseMinutes: 30 } }]);
  await service['check']();
  for (const kind of ['pause', 'finish'] as const) {
    days.update(items => [{ ...items[0], stamps: [...items[0].stamps.slice(0, 1), { kind, time: Date.now() }] }]);
    await service['check']();
  }
  expect(showNotification).not.toHaveBeenCalled();
});

it('riprova dopo un errore senza segnare come inviato l’avviso fallito', async () => {
  showNotification.mockRejectedValueOnce(new Error('Non disponibile'));
  const service = TestBed.inject(ExitNotificationService);
  await service['check']();
  expect(localStorage.getItem('timbri-exit-notified')).toBeNull();
  await service['check']();
  expect(showNotification).toHaveBeenCalledTimes(2);
});

it('invia la prova dopo 15 secondi e la annulla se le notifiche vengono disattivate', async () => {
  days.set([]);
  const service = TestBed.inject(ExitNotificationService);
  service.test();
  await vi.advanceTimersByTimeAsync(14999);
  expect(showNotification).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(showNotification).toHaveBeenCalledWith('Notifica di prova', expect.any(Object));
  service.test();
  await service.toggle();
  await vi.advanceTimersByTimeAsync(15000);
  expect(showNotification).toHaveBeenCalledOnce();
});

/** Prepara due pause separate, sommando dieci minuti precedenti a quella corrente. */
function preparePause(currentMinutes: number, voucherPause = 30): void {
  localStorage.setItem('timbri-pause-enabled', '1');
  localStorage.setItem('timbri-voucher-enabled', '1');
  const now = Date.now();
  days.set([{ date: dayKey(new Date()), target: 480, rules: { ...DEFAULT_RULES, pauseMinutes: 20, voucherPause }, stamps: [
    { kind: 'entry', time: now - 180 * 60000 },
    { kind: 'pause', time: now - 120 * 60000 },
    { kind: 'entry', time: now - 110 * 60000 },
    { kind: 'pause', time: now - currentMinutes * 60000 },
  ] }]);
}

it('somma le pause e avvisa alle due soglie una volta per tipo', async () => {
  preparePause(9);
  const service = TestBed.inject(ExitNotificationService);
  await service['check']();
  expect(showNotification).not.toHaveBeenCalled();
  vi.setSystemTime(Date.now() + 60000);
  await service['check']();
  expect(showNotification).toHaveBeenLastCalledWith('Pausa minima completata', expect.any(Object));
  vi.setSystemTime(Date.now() + 10 * 60000);
  await service['check']();
  expect(showNotification).toHaveBeenLastCalledWith('Pausa per buono pasto completata', expect.objectContaining({ body: expect.stringContaining('requisiti di lavoro') }));
  await service['check']();
  expect(showNotification).toHaveBeenCalledTimes(2);
});

it('raggruppa le soglie coincidenti e ricorda entrambi gli avvisi', async () => {
  preparePause(10, 20);
  const service = TestBed.inject(ExitNotificationService);
  await service['check']();
  expect(showNotification).toHaveBeenCalledWith('Pause completate', expect.any(Object));
  const date = dayKey(new Date());
  expect(localStorage.getItem('timbri-pause-notified')).toBe(date);
  expect(localStorage.getItem('timbri-voucher-notified')).toBe(date);
  await service['check']();
  expect(showNotification).toHaveBeenCalledOnce();
});

it('rispetta i toggle indipendenti e non avvisa dopo il rientro', async () => {
  preparePause(25);
  localStorage.setItem('timbri-pause-enabled', '0');
  const service = TestBed.inject(ExitNotificationService);
  days.update(items => [{ ...items[0], stamps: [...items[0].stamps, { kind: 'entry', time: Date.now() }] }]);
  await service['check']();
  expect(showNotification).not.toHaveBeenCalled();
  days.update(items => [{ ...items[0], stamps: items[0].stamps.slice(0, -1) }]);
  await service['check']();
  expect(showNotification).toHaveBeenCalledWith('Pausa per buono pasto completata', expect.any(Object));
  expect(localStorage.getItem('timbri-pause-notified')).toBeNull();
});

it('ignora le regole disattivate o la pausa minima non prevista per l’obiettivo', async () => {
  preparePause(25);
  const service = TestBed.inject(ExitNotificationService);
  days.update(items => [{ ...items[0], target: 360, rules: { ...DEFAULT_RULES, voucherEnabled: false } }]);
  await service['check']();
  expect(showNotification).not.toHaveBeenCalled();
});

it('attiva le pause senza attivare l’uscita e senza richiedere un permesso già concesso', async () => {
  localStorage.setItem('timbri-exit-enabled', '0');
  days.set([]);
  const service = TestBed.inject(ExitNotificationService);
  await service.toggle('pause');
  expect(service.pauseEnabled()).toBe(true);
  expect(service.enabled()).toBe(false);
  expect(Notification.requestPermission).not.toHaveBeenCalled();
  expect(localStorage.getItem('timbri-pause-enabled')).toBe('1');
});
