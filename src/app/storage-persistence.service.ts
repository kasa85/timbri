import { Injectable, computed, signal } from '@angular/core';

type PersistenceState = 'checking' | 'active' | 'available' | 'denied' | 'unsupported' | 'error';

@Injectable({ providedIn: 'root' })
export class StoragePersistenceService {
  readonly state = signal<PersistenceState>('checking');
  readonly requesting = signal(false);
  readonly message = computed(() => ({
    checking: 'Verifica della protezione in corso…',
    active: 'Protezione attiva: l’archivio è protetto dalla rimozione automatica per liberare spazio.',
    available: 'Protezione non attiva: il browser potrebbe rimuovere l’archivio per liberare spazio.',
    denied: 'Protezione non concessa dal browser. Prova ad aprire Timbrì dalla Home e ripeti la richiesta.',
    unsupported: 'Questo browser non supporta la protezione dell’archivio.',
    error: 'Impossibile verificare o attivare la protezione. Riprova.',
  })[this.state()]);
  readonly canRequest = computed(() => ['available', 'denied', 'error'].includes(this.state()) && !this.requesting());

  /** Controlla all’avvio la persistenza senza richiedere permessi. */
  constructor() { void this.check(); }

  /** Legge la protezione effettiva e gestisce browser privi della Storage API. */
  private async check(): Promise<void> {
    if (!navigator.storage?.persisted || !navigator.storage?.persist) {
      this.state.set('unsupported');
      return;
    }
    try { this.state.set(await navigator.storage.persisted() ? 'active' : 'available'); }
    catch { this.state.set('error'); }
  }

  /** Richiede la persistenza al tocco dell’utente senza interferire con le timbrature. */
  async protect(): Promise<void> {
    if (!this.canRequest()) return;
    this.requesting.set(true);
    try { this.state.set(await navigator.storage.persist() ? 'active' : 'denied'); }
    catch { this.state.set('error'); }
    finally { this.requesting.set(false); }
  }
}
