import { Injectable, signal } from '@angular/core';
import { appendStamp, dayKey, StampKind, Workday } from './workday';

@Injectable({ providedIn: 'root' })
export class WorkdayService {
  readonly days = signal<Workday[]>([]);
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  private readonly database = this.open();

  /** Carica lo storico locale prima di abilitare le timbrature. */
  constructor() { void this.restore(); }

  /** Crea l’unico archivio IndexedDB dell’app. */
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('timbri', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('days', { keyPath: 'date' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Legge tutte le giornate salvate e segnala eventuali problemi di accesso. */
  private async restore(): Promise<void> {
    try {
      const db = await this.database;
      const days = await new Promise<Workday[]>((resolve, reject) => {
        const request = db.transaction('days').objectStore('days').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      this.days.set(days);
      this.ready.set(true);
    } catch { this.error.set('Archivio locale non disponibile. Riapri l’app per riprovare.'); }
  }

  /** Salva un nuovo obiettivo finché la giornata non è stata conclusa. */
  async changeTarget(target: number): Promise<boolean> {
    if (!this.ready() || this.saving()) return false;
    const day = this.days().find(day => day.date === dayKey(new Date()));
    if (!day || day.stamps.at(-1)?.kind === 'finish') return false;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.save({ ...day, target }, day);
      return true;
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Durata non salvata. Riprova.'); return false; }
    finally { this.saving.set(false); }
  }

  /** Rimuove l’ultima timbratura o tutte quelle di oggi, conservando l’obiettivo. */
  async clearToday(reset: boolean): Promise<boolean> {
    if (!this.ready() || this.saving()) return false;
    const day = this.days().find(day => day.date === dayKey(new Date()));
    if (!day?.stamps.length) return false;
    this.saving.set(true);
    this.error.set('');
    try {
      const { mealVoucher, ...current } = day;
      await this.save({ ...current, stamps: reset ? [] : day.stamps.slice(0, -1) }, day);
      return true;
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Modifica non salvata. Riprova.'); return false; }
    finally { this.saving.set(false); }
  }

  /** Importa solo giornate assenti oppure cancella lo storico in un’unica transazione. */
  async updateArchive(imported: Workday[] | null): Promise<boolean> {
    if (!this.ready() || this.saving()) return false;
    this.saving.set(true);
    this.error.set('');
    try {
      const db = await this.database;
      let updated: Workday[] = [];
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('days', 'readwrite');
        const store = transaction.objectStore('days');
        if (imported === null) store.clear();
        else {
          // Legge nel medesimo commit per non sovrascrivere dati aggiunti da un’altra scheda.
          const request = store.getAll();
          request.onsuccess = () => {
            const existing: Workday[] = request.result;
            const additions = imported.filter(day => !existing.some(item => item.date === day.date));
            additions.forEach(day => store.put(day));
            updated = [...existing, ...additions];
          };
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      this.days.set(updated);
      return true;
    } catch { this.error.set('Archivio non modificato. Operazione non riuscita: riprova.'); return false; }
    finally { this.saving.set(false); }
  }

  /** Confronta e salva nella stessa transazione, impedendo sovrascritture da schede obsolete. */
  private async save(day: Workday, expected: Workday | undefined): Promise<void> {
    const db = await this.database;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('days', 'readwrite');
      const store = transaction.objectStore('days');
      const request = store.getAll();
      request.onsuccess = () => {
        const saved: Workday[] = request.result;
        const current = saved.find(item => item.date === day.date);
        // Una scheda non aggiornata deve rileggere la giornata prima di modificarla.
        if (JSON.stringify(current) !== JSON.stringify(expected)) {
          this.days.set(saved);
          reject(new Error('La giornata è cambiata in un’altra scheda. Controlla i dati aggiornati e riprova.'));
          return;
        }
        store.put(day);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    this.days.update(days => [...days.filter(item => item.date !== day.date), day]);
  }

  /** Pubblica la nuova giornata soltanto dopo il completamento del salvataggio. */
  async stamp(kind: StampKind, time: number, target: number, date = dayKey(new Date())): Promise<boolean> {
    if (!this.ready() || this.saving()) return false;
    this.saving.set(true);
    this.error.set('');
    try {
      const expected = this.days().find(day => day.date === date);
      if (date > dayKey(new Date()) || (date < dayKey(new Date()) && !expected?.stamps.length)) throw new Error('Giornata non disponibile.');
      const current = expected ?? { date, target, stamps: [] };
      const updated = appendStamp(current, kind, time, Date.now());
      await this.save(updated, expected);
      return true;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Salvataggio non riuscito. Riprova.');
      return false;
    } finally { this.saving.set(false); }
  }
}
