import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InstallGuideService } from './install-guide.service';

const events = new Subject<{ type: string }>();
const checkForUpdate = vi.fn();

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  checkForUpdate.mockReset().mockResolvedValue(false);
  TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: { isEnabled: true, versionUpdates: events, checkForUpdate } }] });
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('verifica all’avvio e al rientro, ignorando il passaggio in background', async () => {
  const service = TestBed.inject(InstallGuideService);
  await vi.waitFor(() => expect(service.checkingUpdate()).toBe(false));
  expect(checkForUpdate).toHaveBeenCalledOnce();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  expect(checkForUpdate).toHaveBeenCalledOnce();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.waitFor(() => expect(service.checkingUpdate()).toBe(false));
  expect(checkForUpdate).toHaveBeenCalledTimes(2);
  TestBed.resetTestingModule();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(checkForUpdate).toHaveBeenCalledTimes(2);
});

it('mostra l’aggiornamento pronto anche se era stato scaricato durante un altro controllo', async () => {
  const service = TestBed.inject(InstallGuideService);
  await vi.waitFor(() => expect(service.checkingUpdate()).toBe(false));
  events.next({ type: 'VERSION_READY' });
  await service.checkForUpdate();
  expect(service.updateReady()).toBe(true);
  expect(service.updateStatus()).toContain('Nuova versione pronta');
});

it('evita controlli sovrapposti e consente di riprovare dopo un errore', async () => {
  const service = TestBed.inject(InstallGuideService);
  await vi.waitFor(() => expect(service.checkingUpdate()).toBe(false));
  let reject!: (error: Error) => void;
  checkForUpdate.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const pending = service.checkForUpdate();
  await service.checkForUpdate();
  expect(checkForUpdate).toHaveBeenCalledTimes(2);
  reject(new Error('Offline'));
  await pending;
  expect(service.checkingUpdate()).toBe(false);
  expect(service.updateStatus()).toContain('Controlla la connessione');
  checkForUpdate.mockResolvedValueOnce(true);
  await service.checkForUpdate();
  expect(service.updateReady()).toBe(true);
});

it('non verifica nella versione di sviluppo', async () => {
  TestBed.overrideProvider(SwUpdate, { useValue: { isEnabled: false, versionUpdates: events, checkForUpdate } });
  const service = TestBed.inject(InstallGuideService);
  await service.checkForUpdate();
  expect(checkForUpdate).not.toHaveBeenCalled();
  expect(service.updateStatus()).toContain('versione pubblicata');
});
