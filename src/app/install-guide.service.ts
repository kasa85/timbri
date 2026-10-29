import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class InstallGuideService {
  readonly open = signal(false);
  readonly updateReady = signal(false);
  readonly checkingUpdate = signal(false);
  readonly updatesEnabled = inject(SwUpdate).isEnabled;
  readonly updateStatus = signal('');
  readonly prompt = signal<InstallPrompt | null>(null);
  readonly offline = signal('Preparazione offline in corso…');
  readonly iphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  readonly android = /Android/.test(navigator.userAgent);
  private readonly updates = inject(SwUpdate);

  /** Propone la guida una sola volta e osserva installazione e cache dell’app. */
  constructor() {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    try { this.open.set(!standalone && !localStorage.getItem('timbri-install-guide-seen')); }
    catch { this.open.set(!standalone); }
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      this.prompt.set(event as InstallPrompt);
    });
    window.addEventListener('appinstalled', () => { this.prompt.set(null); this.close(); });
    if (!this.updates.isEnabled) {
      this.offline.set('L’uso offline sarà disponibile nella versione pubblicata in HTTPS.');
      this.updateStatus.set('La verifica degli aggiornamenti è disponibile nella versione pubblicata.');
      return;
    }
    const subscription = this.updates.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY') {
        this.updateReady.set(true);
        this.updateStatus.set('Nuova versione pronta. Tocca Aggiorna per usarla.');
      }
      if (event.type === 'VERSION_READY' || event.type === 'NO_NEW_VERSION_DETECTED') this.offline.set('Disponibile offline');
      if (event.type === 'VERSION_INSTALLATION_FAILED') this.offline.set('Preparazione non completata. Riapri Timbrì con una connessione.');
    });
    const resume = () => { if (document.visibilityState === 'visible') void this.checkForUpdate(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    });
    void this.checkForUpdate();
  }

  /** Verifica all’avvio, al rientro e su richiesta, evitando controlli sovrapposti. */
  async checkForUpdate(): Promise<void> {
    if (!this.updatesEnabled || this.checkingUpdate()) return;
    this.checkingUpdate.set(true);
    this.updateStatus.set('Verifica degli aggiornamenti in corso…');
    try {
      const found = await this.updates.checkForUpdate();
      if (found) this.updateReady.set(true);
      this.updateStatus.set(this.updateReady() ? 'Nuova versione pronta. Tocca Aggiorna per usarla.' : 'Stai usando l’ultima versione disponibile.');
    } catch {
      this.updateStatus.set('Impossibile verificare gli aggiornamenti. Controlla la connessione e riprova.');
    } finally { this.checkingUpdate.set(false); }
  }

  /** Ricarica la pagina per usare la versione già scaricata. */
  reload(): void { window.location.reload(); }

  /** Riapre la stessa guida dalle impostazioni. */
  show(): void { this.open.set(true); }

  /** Ricorda la chiusura anche quando si usa il gesto o il pulsante indietro. */
  close(): void {
    this.open.set(false);
    try { localStorage.setItem('timbri-install-guide-seen', '1'); } catch { /* Resta chiusa nella sessione corrente. */ }
  }

  /** Apre la conferma nativa soltanto dopo il tocco dell’utente. */
  async install(): Promise<void> {
    const prompt = this.prompt();
    if (!prompt) return;
    this.prompt.set(null);
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === 'accepted') this.close();
    } catch { /* Le istruzioni manuali restano disponibili nel dialog. */ }
  }
}
