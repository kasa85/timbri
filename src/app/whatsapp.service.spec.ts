import { afterEach, expect, it } from 'vitest';
import { WhatsappService } from './whatsapp.service';

afterEach(() => localStorage.clear());

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
