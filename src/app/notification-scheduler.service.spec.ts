import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { PushTestService } from './push-test.service';
import { WorkdayService } from './workday.service';
import { Workday } from './workday';
import { DEFAULT_RULES } from './work-settings';

const days = signal<Workday[]>([]);
const schedule = vi.fn();
const cancel = vi.fn();

/** Prepara servizi fittizi senza caricare SDK o inviare notifiche reali. */
function configure(): void {
  TestBed.configureTestingModule({ providers: [
    { provide: PushTestService, useValue: { loaded: signal(true), subscribed: signal(true), subscriptionId: signal('device-1'), apiKey: signal('fake-key'), schedule, cancel } },
    { provide: WorkdayService, useValue: { days, ready: signal(true), saving: signal(false) } },
  ] });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-29T09:00:00'));
  localStorage.clear();
  schedule.mockReset().mockResolvedValue('message-1');
  cancel.mockReset().mockResolvedValue(undefined);
  days.set([{ date: '2026-10-29', target: 480, rules: { ...DEFAULT_RULES }, stamps: [{ kind: 'entry', time: new Date('2026-10-29T08:00:00').getTime() }] }]);
  configure();
});

afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); localStorage.clear(); });

it('riprogramma al cambio obiettivo e cancella a fine giornata', async () => {
  const service = TestBed.inject(NotificationSchedulerService);
  service.setEnabled('exit', true);
  await service.synchronize();
  expect(schedule).toHaveBeenCalledOnce();
  days.update(items => [{ ...items[0], target: 540 }]);
  await service.synchronize();
  expect(cancel).toHaveBeenCalledWith('message-1');
  expect(schedule).toHaveBeenCalledTimes(2);
  days.update(items => [{ ...items[0], stamps: [...items[0].stamps, { kind: 'finish', time: Date.now() }] }]);
  await service.synchronize();
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(JSON.parse(localStorage.getItem('timbri-push-schedule')!).entries).toEqual([]);
});

it('cancella l’uscita in pausa e le soglie di pausa al rientro', async () => {
  const service = TestBed.inject(NotificationSchedulerService);
  for (const kind of ['exit', 'pause', 'voucher'] as const) service.setEnabled(kind, true);
  await service.synchronize();
  days.update(items => [{ ...items[0], stamps: [...items[0].stamps, { kind: 'pause', time: Date.now() }] }]);
  await service.synchronize();
  expect(schedule).toHaveBeenCalledTimes(3);
  expect(cancel).toHaveBeenCalledOnce();
  vi.setSystemTime(Date.now() + 5 * 60000);
  days.update(items => [{ ...items[0], stamps: [...items[0].stamps, { kind: 'entry', time: Date.now() }] }]);
  await service.synchronize();
  expect(cancel).toHaveBeenCalledTimes(3);
  expect(schedule).toHaveBeenCalledTimes(4);
});

it('non duplica gli avvisi dopo una riapertura e cancella disattivando il toggle', async () => {
  const service = TestBed.inject(NotificationSchedulerService);
  service.setEnabled('exit', true);
  await service.synchronize();
  TestBed.resetTestingModule();
  configure();
  const reopened = TestBed.inject(NotificationSchedulerService);
  await reopened.synchronize();
  expect(schedule).toHaveBeenCalledOnce();
  reopened.setEnabled('exit', false);
  await reopened.synchronize();
  expect(cancel).toHaveBeenCalledOnce();
});

it('recupera una risposta persa con la stessa chiave idempotente', async () => {
  const service = TestBed.inject(NotificationSchedulerService);
  service.setEnabled('exit', true);
  schedule.mockRejectedValueOnce(new Error('Risposta persa'));
  await service.synchronize();
  expect(service.status()).toContain('non sincronizzati');
  const requestId = schedule.mock.calls[0][3];
  await service.synchronize();
  expect(schedule).toHaveBeenCalledTimes(2);
  expect(schedule.mock.calls[1][3]).toBe(requestId);
});

it('non programma il nuovo orario se fallisce la cancellazione del precedente', async () => {
  const service = TestBed.inject(NotificationSchedulerService);
  service.setEnabled('exit', true);
  await service.synchronize();
  cancel.mockRejectedValueOnce(new Error('Offline'));
  days.update(items => [{ ...items[0], target: 540 }]);
  await service.synchronize();
  expect(schedule).toHaveBeenCalledOnce();
  expect(service.status()).toContain('orari precedenti');
  await service.synchronize();
  expect(schedule).toHaveBeenCalledTimes(2);
});

it('non ripete l’avviso di uscita già scaduto quando aumenta l’obiettivo', async () => {
  const service = TestBed.inject(NotificationSchedulerService);
  service.setEnabled('exit', true);
  await service.synchronize();
  vi.setSystemTime(new Date('2026-10-29T16:20:00'));
  days.update(items => [{ ...items[0], target: 540 }]);
  await service.synchronize();
  expect(schedule).toHaveBeenCalledOnce();
});

it('ricalcola dopo un cambio obiettivo mentre un invio è ancora in corso', async () => {
  let finish!: (id: string) => void;
  schedule.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
  const service = TestBed.inject(NotificationSchedulerService);
  service.setEnabled('exit', true);
  const pending = service.synchronize();
  days.update(items => [{ ...items[0], target: 540 }]);
  await service.synchronize();
  finish('first-message');
  await pending;
  expect(cancel).toHaveBeenCalledWith('first-message');
  expect(schedule).toHaveBeenCalledTimes(2);
  expect(schedule.mock.calls[1][2]).toBe(new Date('2026-10-29T17:10:00').getTime());
});
