import { afterEach, expect, it, vi } from 'vitest';
import { WhatsappService } from './whatsapp.service';

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

it('ripristina le preferenze e normalizza il prefisso mantenendo gli zeri del numero', () => {
  const service = new WhatsappService();
  service.setEnabled(true);
  service.setPhone('0039 06 1234567');
  expect(service.number()).toBe('39061234567');
  expect(service.ready()).toBe(true);
  const restored = new WhatsappService();
  expect(restored.enabled()).toBe(true);
  expect(restored.phone()).toBe('0039 06 1234567');
});

it('non prepara link se disabilitato o con un numero non valido', () => {
  const service = new WhatsappService();
  service.setPhone('+39 333 1234567');
  expect(service.link(Date.now())).toBeNull();
  service.setEnabled(true);
  for (const phone of ['', '123', '+39 abc 3331234567', '+39/3331234567']) {
    service.setPhone(phone);
    expect(service.ready()).toBe(false);
    expect(service.link(Date.now())).toBeNull();
  }
});

it('precompila l’ora scelta e distingue le giornate recuperate dall’uscita odierna', () => {
  const service = new WhatsappService();
  service.setEnabled(true);
  service.setPhone('+39 (333) 123-4567');
  const today = new Date();
  today.setHours(17, 35, 0, 0);
  const url = new URL(service.link(today.getTime())!);
  expect(url.origin).toBe('https://wa.me');
  expect(url.pathname).toBe('/393331234567');
  expect(url.searchParams.get('text')).toBe('Ho finito di lavorare alle 17:35. Sto uscendo!');
  const historical = new URL(service.link(new Date('2025-01-02T18:30:00').getTime())!);
  expect(historical.searchParams.get('text')).toBe('Ho concluso la giornata lavorativa del 02/01/2025 alle 18:30.');
});

it('usa il collegamento diretto su iPhone e iPad conservando numero e messaggio', () => {
  const service = new WhatsappService();
  service.setEnabled(true);
  service.setPhone('+39 333 1234567');
  const time = new Date();
  time.setHours(17, 35, 0, 0);
  for (const device of [
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 },
    { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 },
  ]) {
    vi.stubGlobal('navigator', device);
    const url = new URL(service.link(time.getTime())!);
    expect(url.protocol).toBe('whatsapp:');
    expect(url.hostname).toBe('send');
    expect(url.searchParams.get('phone')).toBe('393331234567');
    expect(url.searchParams.get('text')).toBe('Ho finito di lavorare alle 17:35. Sto uscendo!');
  }
});

it('mantiene il link web su Mac e Android', () => {
  const service = new WhatsappService();
  service.setEnabled(true);
  service.setPhone('+39 333 1234567');
  for (const device of [
    { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 },
    { userAgent: 'Mozilla/5.0 (Linux; Android)', platform: 'Linux', maxTouchPoints: 5 },
  ]) {
    vi.stubGlobal('navigator', device);
    expect(service.link(Date.now())).toMatch(/^https:\/\/wa\.me\/393331234567\?text=/);
  }
});
