import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WorkdayService } from './workday.service';
import { Workday } from './workday';

/** Crea il servizio con le stesse dipendenze usate dall’app. */
function createStore(): WorkdayService {
  return TestBed.runInInjectionContext(() => new WorkdayService());
}

afterEach(() => vi.unstubAllGlobals());

describe('Archivio delle giornate', () => {
  it('attende il commit e ripristina i dati quando il servizio viene ricreato', async () => {
    let saved: Workday[] = [];
    let commit: (() => void) | undefined;
    const db = {
      transaction: (_store: string, mode?: string) => {
        const transaction = {
          oncomplete: () => {},
          objectStore: () => ({
            getAll: () => {
              const request = { result: saved, onsuccess: () => {} };
              queueMicrotask(() => request.onsuccess());
              return request;
            },
            put: (day: Workday) => { commit = () => { saved = [day]; transaction.oncomplete(); }; },
          }),
        };
        return transaction;
      },
    };
    vi.stubGlobal('indexedDB', {
      open: () => {
        const request = { result: db, onsuccess: () => {} };
        queueMicrotask(() => request.onsuccess());
        return request;
      },
    });
    const store = createStore();
    await vi.waitFor(() => expect(store.ready()).toBe(true));
    const saving = store.stamp('entry', Date.now() - 1000, 540);
    await vi.waitFor(() => expect(commit).toBeDefined());
    expect(store.days()).toEqual([]);
    expect(store.saving()).toBe(true);
    commit!();
    expect(await saving).toBe(true);
    commit = undefined;
    const changing = store.changeTarget(360);
    await vi.waitFor(() => expect(commit).toBeDefined());
    expect(store.days()[0].target).toBe(540);
    commit!();
    expect(await changing).toBe(true);
    expect(store.days()[0].target).toBe(360);
    const restored = createStore();
    await vi.waitFor(() => expect(restored.ready()).toBe(true));
    expect(restored.days()).toEqual(store.days());
  });

  it('impedisce le timbrature quando IndexedDB non è disponibile', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('Unavailable'); } });
    const store = createStore();
    await vi.waitFor(() => expect(store.error()).not.toBe(''));
    expect(store.ready()).toBe(false);
    expect(await store.stamp('entry', Date.now(), 540)).toBe(false);
  });
});

/** Simula commit e abort di IndexedDB conservando le giornate tra istanze del servizio. */
function localArchive(initial: Workday[]) {
  let saved = structuredClone(initial);
  const archive = { fail: false };
  vi.stubGlobal('indexedDB', {
    open: () => {
      const db = {
        transaction: () => {
          const transaction = {
            error: new Error('Scrittura fallita'),
            oncomplete: () => {}, onabort: () => {},
            objectStore: () => ({
              getAll: () => {
                const request = { result: structuredClone(saved), onsuccess: () => {} };
                queueMicrotask(() => request.onsuccess());
                return request;
              },
              put: (day: Workday) => queueMicrotask(() => {
                if (archive.fail) { transaction.onabort(); return; }
                saved = [...saved.filter(item => item.date !== day.date), structuredClone(day)];
                transaction.oncomplete();
              }),
            }),
          };
          return transaction;
        },
      };
      const request = { result: db, onsuccess: () => {} };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  });
  return archive;
}

/** Prepara una giornata conclusa oggi e una giornata storica da preservare. */
function sampleDays(): Workday[] {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return [
    { date: '2025-01-01', target: 360, stamps: [{ kind: 'entry', time: 1000 }, { kind: 'finish', time: 2000 }] },
    { date, target: 540, mealVoucher: true, stamps: [{ kind: 'entry', time: Date.now() - 2000 }, { kind: 'finish', time: Date.now() - 1000 }] },
  ];
}

describe('Correzione della giornata corrente', () => {
  it('annulla la chiusura e ripristina la modifica anche alla riapertura', async () => {
    const days = sampleDays();
    localArchive(days);
    const store = createStore();
    await vi.waitFor(() => expect(store.ready()).toBe(true));
    expect(await store.clearToday(false)).toBe(true);
    expect(store.days().find(day => day.date === days[1].date)?.stamps).toEqual(days[1].stamps.slice(0, 1));
    expect(store.days().find(day => day.date === days[1].date)?.mealVoucher).toBeUndefined();
    expect(store.days().find(day => day.date === days[0].date)).toEqual(days[0]);
    const restored = createStore();
    await vi.waitFor(() => expect(restored.ready()).toBe(true));
    expect(restored.days()).toEqual(store.days());
    expect(await store.clearToday(false)).toBe(true);
    expect(store.days().find(day => day.date === days[1].date)?.stamps).toEqual([]);
    expect(await store.clearToday(false)).toBe(false);
  });

  it('resetta soltanto oggi e conserva durata e storico anche alla riapertura', async () => {
    const days = sampleDays();
    localArchive(days);
    const store = createStore();
    await vi.waitFor(() => expect(store.ready()).toBe(true));
    expect(await store.clearToday(true)).toBe(true);
    expect(store.days()).toContainEqual({ date: days[1].date, target: days[1].target, stamps: [] });
    expect(store.days()).toContainEqual(days[0]);
    const restored = createStore();
    await vi.waitFor(() => expect(restored.ready()).toBe(true));
    expect(restored.days()).toEqual(store.days());
  });

  it('mantiene i dati originali e mostra un errore se il salvataggio fallisce', async () => {
    const days = sampleDays();
    const archive = localArchive(days);
    const store = createStore();
    await vi.waitFor(() => expect(store.ready()).toBe(true));
    archive.fail = true;
    expect(await store.clearToday(true)).toBe(false);
    expect(store.days()).toEqual(days);
    expect(store.error()).not.toBe('');
    expect(store.saving()).toBe(false);
  });
});

/** Simula transazioni atomiche per verificare importazione e cancellazione. */
function batchArchive(initial: Workday[]) {
  let saved = structuredClone(initial);
  const controls = { fail: false };
  vi.stubGlobal('indexedDB', { open: () => {
    const request = { result: { transaction: (_name: string, mode?: string) => {
      let pending = structuredClone(saved);
      const transaction = {
        error: new Error('Commit fallito'), oncomplete: () => {}, onabort: () => {},
        objectStore: () => ({
          getAll: () => {
            const read = { result: structuredClone(saved), onsuccess: () => {} };
            queueMicrotask(() => read.onsuccess());
            return read;
          },
          put: (day: Workday) => { pending = [...pending.filter(item => item.date !== day.date), day]; },
          clear: () => { pending = []; },
        }),
      };
      if (mode === 'readwrite') setTimeout(() => {
        if (controls.fail) transaction.onabort();
        else { saved = structuredClone(pending); transaction.oncomplete(); }
      }, 0);
      return transaction;
    } }, onsuccess: () => {} };
    queueMicrotask(() => request.onsuccess());
    return request;
  } });
  return controls;
}

describe('Gestione dell’intero archivio', () => {
  it('importa solo giornate mancanti e le conserva alla riapertura', async () => {
    const days = sampleDays();
    batchArchive([days[0]]);
    const store = createStore();
    await vi.waitFor(() => expect(store.ready()).toBe(true));
    expect(await store.updateArchive([{ ...days[0], target: 1 }, days[1]])).toBe(true);
    expect(store.days()).toEqual(days);
    const restored = createStore();
    await vi.waitFor(() => expect(restored.ready()).toBe(true));
    expect(restored.days()).toEqual(days);
  });

  it('cancella tutto in modo persistente e blocca operazioni concorrenti', async () => {
    batchArchive(sampleDays());
    const store = createStore();
    await vi.waitFor(() => expect(store.ready()).toBe(true));
    const clearing = store.updateArchive(null);
    expect(store.days()).toHaveLength(2);
    expect(await store.updateArchive(null)).toBe(false);
    expect(await clearing).toBe(true);
    expect(store.days()).toEqual([]);
    const restored = createStore();
    await vi.waitFor(() => expect(restored.ready()).toBe(true));
    expect(restored.days()).toEqual([]);
  });

  it('conserva lo storico quando il commit fallisce', async () => {
    const days = sampleDays();
    const controls = batchArchive(days);
    const store = createStore();
    await vi.waitFor(() => expect(store.ready()).toBe(true));
    controls.fail = true;
    expect(await store.updateArchive(null)).toBe(false);
    expect(store.days()).toEqual(days);
    expect(store.error()).not.toBe('');
    expect(store.saving()).toBe(false);
    const restored = createStore();
    await vi.waitFor(() => expect(restored.ready()).toBe(true));
    expect(restored.days()).toEqual(days);
  });
});

describe('Schede concorrenti e giornate incomplete', () => {
  it('rifiuta una scrittura obsoleta e ricarica le timbrature salvate dall’altra scheda', async () => {
    batchArchive([]);
    const first = createStore();
    const second = createStore();
    await vi.waitFor(() => expect(first.ready() && second.ready()).toBe(true));
    const time = new Date().setHours(0, 0, 0, 0);
    expect(await first.stamp('entry', time, 540)).toBe(true);
    expect(await second.stamp('entry', time, 360)).toBe(false);
    expect(second.days()).toEqual(first.days());
    expect(second.error()).toContain('altra scheda');
    expect(await second.stamp('pause', time, 360)).toBe(true);
    expect(await first.changeTarget(360)).toBe(false);
    expect(first.days()[0].stamps).toHaveLength(2);
    const restored = createStore();
    await vi.waitFor(() => expect(restored.ready()).toBe(true));
    expect(restored.days()).toEqual(second.days());
  });

  it('completa una giornata passata in lavoro o in pausa e conserva la chiusura', async () => {
    const date = '2025-01-02';
    const at = (hour: number) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();
    for (const paused of [false, true]) {
      const day: Workday = { date, target: 540, stamps: [{ kind: 'entry', time: at(9) }] };
      if (paused) day.stamps.push({ kind: 'pause', time: at(16) });
      batchArchive([day]);
      const store = createStore();
      await vi.waitFor(() => expect(store.ready()).toBe(true));
      expect(await store.stamp('finish', at(8), 540, date)).toBe(false);
      expect(store.days()[0]).toEqual(day);
      expect(await store.stamp('finish', at(17), 540, date)).toBe(true);
      expect(store.days()[0].stamps.at(-1)).toEqual({ kind: 'finish', time: at(17) });
      expect(store.days()[0].mealVoucher).toBe(paused);
      expect(await store.stamp('finish', at(18), 540, date)).toBe(false);
      const restored = createStore();
      await vi.waitFor(() => expect(restored.ready()).toBe(true));
      expect(restored.days()).toEqual(store.days());
    }
  });
});

it('recupera rientro, altra pausa e uscita senza modificare oggi', async () => {
  const date = '2025-01-02';
  const at = (hour: number) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();
  batchArchive([{ date, target: 540, stamps: [{ kind: 'entry', time: at(9) }, { kind: 'pause', time: at(12) }] }]);
  const store = createStore();
  await vi.waitFor(() => expect(store.ready()).toBe(true));
  for (const [kind, hour] of [['entry', 13], ['pause', 15], ['entry', 16], ['finish', 19]] as const) {
    expect(await store.stamp(kind, at(hour), 540, date)).toBe(true);
  }
  expect(store.days()).toHaveLength(1);
  expect(store.days()[0].stamps.map(stamp => stamp.kind)).toEqual(['entry', 'pause', 'entry', 'pause', 'entry', 'finish']);
  expect(store.days()[0].mealVoucher).toBe(true);
  expect(await store.stamp('entry', at(20), 540, date)).toBe(false);
  expect(await store.stamp('entry', at(9), 540, '2025-01-01')).toBe(false);
});
