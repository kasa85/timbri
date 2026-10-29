import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class InstallGuideService {
  readonly open = signal(false);
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
      return;
    }
    this.updates.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY' || event.type === 'NO_NEW_VERSION_DETECTED') this.offline.set('Disponibile offline');
      if (event.type === 'VERSION_INSTALLATION_FAILED') this.offline.set('Preparazione non completata. Riapri Timbrì con una connessione.');
    });
    void this.updates.checkForUpdate().catch(() => this.offline.set('Impossibile verificare l’offline. Riprova con una connessione.'));
  }

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
