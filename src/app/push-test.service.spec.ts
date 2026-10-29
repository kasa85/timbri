import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PushTestService } from './push-test.service';

const subscription = { id: 'device-123', optedIn: true, optIn: vi.fn(async () => {}), addEventListener: vi.fn() };
const sdk = {
  init: vi.fn(async (_options: Record<string, unknown>) => {}),
  Notifications: { isPushSupported: () => true, requestPermission: vi.fn(async () => {}) },
  User: { PushSubscription: subscription },
};
const request = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('navigator', { serviceWorker: {} });
  vi.stubGlobal('OneSignalDeferred', []);
  vi.stubGlobal('fetch', request);
  request.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: 'scheduled-test' }) });
  sdk.init.mockClear();
  subscription.id = 'device-123';
  subscription.optedIn = true;
  subscription.addEventListener.mockClear();
  vi.spyOn(document.head, 'append').mockImplementation(() => {
    const callbacks = (window as unknown as { OneSignalDeferred: Array<(value: typeof sdk) => void> }).OneSignalDeferred;
    callbacks.shift()!(sdk);
  });
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('configura un worker separato e non invia la chiave durante inizializzazione o registrazione', async () => {
  const service = new PushTestService();
  service.setKey('test-secret');
  await vi.waitFor(() => expect(service.loaded()).toBe(true));
  expect(sdk.init).toHaveBeenCalledWith(expect.objectContaining({
    appId: '6b5b69bc-0c05-46c2-b8fd-3550b6e09b53',
    serviceWorkerPath: new URL('onesignal/OneSignalSDKWorker.js', document.baseURI).pathname,
    serviceWorkerParam: { scope: new URL('onesignal/', document.baseURI).pathname },
    welcomeNotification: { disable: true },
  }));
  expect(JSON.stringify(sdk.init.mock.calls)).not.toContain('test-secret');
  await service.enable();
  expect(request).not.toHaveBeenCalled();
  expect(service.subscribed()).toBe(true);
});

it('programma sul server il test a 15 secondi per il solo dispositivo corrente', async () => {
  const service = new PushTestService();
  service.setKey('test-secret');
  await vi.waitFor(() => expect(service.loaded()).toBe(true));
  const before = Date.now();
  await service.test();
  expect(request).toHaveBeenCalledOnce();
  const [url, options] = request.mock.calls[0];
  expect(url).toBe('https://api.onesignal.com/notifications?c=push');
  expect(options.headers.Authorization).toBe('Key test-secret');
  const body = JSON.parse(options.body);
  expect(body.include_subscription_ids).toEqual(['device-123']);
  expect(body.included_segments).toBeUndefined();
  expect(body.app_id).toBe(service.appId);
  expect(new Date(body.send_after).getTime()).toBeGreaterThanOrEqual(before + 15000);
  expect(body.ttl).toBe(60);
  expect(service.message()).toContain('Prova programmata');
  expect(service.busy()).toBe(false);
});

it('non invia senza chiave o senza sottoscrizione e permette di cancellare la chiave locale', async () => {
  const service = new PushTestService();
  await vi.waitFor(() => expect(service.loaded()).toBe(true));
  await service.test();
  service.setKey('test-secret');
  subscription.optedIn = false;
  subscription.addEventListener.mock.calls[0][1]();
  await service.test();
  expect(request).not.toHaveBeenCalled();
  expect(localStorage.getItem('timbri-onesignal-key')).toBe('test-secret');
  service.setKey('');
  expect(localStorage.getItem('timbri-onesignal-key')).toBeNull();
});

it('gestisce rifiuto API, risposte senza ID ed errori CORS senza mostrare dati sensibili', async () => {
  const service = new PushTestService();
  service.setKey('test-secret');
  await vi.waitFor(() => expect(service.loaded()).toBe(true));
  request.mockResolvedValueOnce({ ok: false, status: 401 });
  await service.test();
  expect(service.message()).toContain('Chiave non valida');
  request.mockResolvedValueOnce({ ok: true, json: async () => ({ errors: ['test-secret'] }) });
  await service.test();
  expect(service.message()).toContain('non ha confermato');
  expect(service.message()).not.toContain('test-secret');
  request.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await service.test();
  expect(service.message()).toContain('CORS');
  expect(service.busy()).toBe(false);
});
