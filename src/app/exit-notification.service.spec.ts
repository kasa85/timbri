import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ExitNotificationService } from './exit-notification.service';
import { PushTestService } from './push-test.service';

const recipient = '12345678-1234-1234-1234-123456789abc';
const schedule = vi.fn();
const apiKey = signal('personal-key');

beforeEach(() => {
  localStorage.clear();
  apiKey.set('personal-key');
  schedule.mockReset().mockResolvedValue('notification-id');
  TestBed.configureTestingModule({ providers: [
    { provide: PushTestService, useValue: { apiKey, schedule } },
    { provide: ToastController, useValue: { create: vi.fn(async () => ({ present: async () => {} })) } },
  ] });
});
afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); });

it('invia soltanto l’uscita odierna al destinatario configurato', async () => {
  const service = TestBed.inject(ExitNotificationService);
  service.setRecipient(recipient);
  await service.notify(Date.now());
  service.setEnabled(true);
  await service.notify(Date.now() - 86400000);
  expect(schedule).not.toHaveBeenCalled();
  const time = Date.now();
  await service.notify(time);
  expect(schedule).toHaveBeenCalledExactlyOnceWith('Timbrì · Fine giornata', expect.stringContaining('Sto uscendo!'), expect.any(Number), expect.any(String), recipient);
  expect(service.message()).toContain('accettato');
});

it('non invia con codice o chiave mancanti e conserva le preferenze', async () => {
  const service = TestBed.inject(ExitNotificationService);
  service.setEnabled(true);
  service.setRecipient('incompleto');
  await service.notify(Date.now());
  service.setRecipient(recipient);
  apiKey.set('');
  await service.notify(Date.now());
  expect(schedule).not.toHaveBeenCalled();
  expect(service.message()).toContain('non confermato');
  expect(localStorage.getItem('timbri-exit-recipient')).toBe(recipient);
  expect(localStorage.getItem('timbri-exit-enabled')).toBe('1');
});

it('gestisce un errore di rete senza propagare errori alla timbratura', async () => {
  const service = TestBed.inject(ExitNotificationService);
  service.setRecipient(recipient);
  service.setEnabled(true);
  schedule.mockRejectedValueOnce(new Error('Network error'));
  await expect(service.notify(Date.now())).resolves.toBeUndefined();
  expect(service.message()).toContain('non confermato');
  expect(service.busy()).toBe(false);
});
