import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoragePersistenceService } from './storage-persistence.service';

afterEach(() => vi.unstubAllGlobals());

describe('Protezione dell’archivio locale', () => {
  it('riconosce la persistenza già concessa senza chiedere permessi', async () => {
    const persist = vi.fn();
    vi.stubGlobal('navigator', { storage: { persisted: async () => true, persist } });
    const service = new StoragePersistenceService();
    await vi.waitFor(() => expect(service.state()).toBe('active'));
    await service.protect();
    expect(persist).not.toHaveBeenCalled();
    expect(service.canRequest()).toBe(false);
  });

  it('richiede la protezione solo su azione e permette di riprovare dopo un rifiuto', async () => {
    const persist = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist } });
    const service = new StoragePersistenceService();
    await vi.waitFor(() => expect(service.state()).toBe('available'));
    expect(persist).not.toHaveBeenCalled();
    await service.protect();
    expect(service.state()).toBe('denied');
    expect(service.canRequest()).toBe(true);
    await service.protect();
    expect(service.state()).toBe('active');
  });

  it('gestisce browser senza API o con supporto parziale', () => {
    for (const storage of [undefined, { persisted: async () => false }]) {
      vi.stubGlobal('navigator', { storage });
      const service = new StoragePersistenceService();
      expect(service.state()).toBe('unsupported');
      expect(service.canRequest()).toBe(false);
    }
  });

  it('gestisce gli errori del browser e sblocca la richiesta per un nuovo tentativo', async () => {
    vi.stubGlobal('navigator', { storage: {
      persisted: vi.fn().mockRejectedValue(new Error('Accesso negato')),
      persist: vi.fn().mockRejectedValue(new Error('Accesso negato')),
    } });
    const service = new StoragePersistenceService();
    await vi.waitFor(() => expect(service.state()).toBe('error'));
    await service.protect();
    expect(service.state()).toBe('error');
    expect(service.requesting()).toBe(false);
    expect(service.canRequest()).toBe(true);
  });

  it('impedisce richieste sovrapposte mentre il browser attende una risposta', async () => {
    let complete!: (granted: boolean) => void;
    const persist = vi.fn(() => new Promise<boolean>(resolve => { complete = resolve; }));
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist } });
    const service = new StoragePersistenceService();
    await vi.waitFor(() => expect(service.state()).toBe('available'));
    const request = service.protect();
    expect(service.requesting()).toBe(true);
    await service.protect();
    expect(persist).toHaveBeenCalledTimes(1);
    complete(true);
    await request;
    expect(service.state()).toBe('active');
    expect(service.requesting()).toBe(false);
  });
});
