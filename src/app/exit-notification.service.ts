import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { WorkdayService } from './workday.service';
import { calculateDay, dayKey } from './workday';
import { DEFAULT_RULES } from './work-settings';

export type NotificationKind = 'exit' | 'pause' | 'voucher';

@Injectable({ providedIn: 'root' })
export class ExitNotificationService {
  private readonly store = inject(WorkdayService);
  readonly supported = window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator;
  readonly enabled = signal(this.read('timbri-exit-enabled') === '1');
  readonly pauseEnabled = signal(this.read('timbri-pause-enabled') === '1');
  readonly voucherEnabled = signal(this.read('timbri-voucher-enabled') === '1');
  /** Abilita la prova quando almeno un tipo di avviso è attivo. */
  readonly anyEnabled = () => this.enabled() || this.pauseEnabled() || this.voucherEnabled();
  readonly message = signal('');
  readonly testing = signal(false);
  private sending = false;
  private readonly notified = new Map<NotificationKind, string>();
  private testTimer?: number;

  /** Controlla l’uscita anche fuori dalla Home e ricontrolla al ritorno nell’app. */
  constructor() {
    effect(() => { this.store.days(); this.enabled(); this.pauseEnabled(); this.voucherEnabled(); void this.check(); });
    const timer = window.setInterval(() => void this.check(), 10000);
    const resume = () => void this.check();
    document.addEventListener('visibilitychange', resume);
    inject(DestroyRef).onDestroy(() => {
      window.clearInterval(timer);
      window.clearTimeout(this.testTimer);
      document.removeEventListener('visibilitychange', resume);
    });
  }

  /** Chiede il permesso solo dopo il tocco e conserva la preferenza locale. */
  async toggle(kind: NotificationKind = 'exit'): Promise<void> {
    const preference = kind === 'exit' ? this.enabled : kind === 'pause' ? this.pauseEnabled : this.voucherEnabled;
    if (preference()) {
      preference.set(false);
      this.write(`timbri-${kind}-enabled`, '0');
      if (!this.anyEnabled()) {
        window.clearTimeout(this.testTimer);
        this.testing.set(false);
      }
      this.message.set('Avviso disattivato.');
      return;
    }
    if (!this.supported) return;
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') {
        this.message.set('Permesso non concesso. Puoi abilitarlo dalle impostazioni del browser o del dispositivo.');
        return;
      }
      preference.set(true);
      this.write(`timbri-${kind}-enabled`, '1');
      this.message.set('Avviso attivato.');
    } catch { this.message.set('Impossibile attivare le notifiche su questo dispositivo.'); }
  }

  /** Lascia quindici secondi per passare in background prima della prova. */
  test(): void {
    if (!this.anyEnabled() || this.testing()) return;
    this.testing.set(true);
    this.message.set('Prova tra 15 secondi: puoi mettere l’app in background o bloccare lo schermo.');
    this.testTimer = window.setTimeout(async () => {
      try {
        await this.show('Notifica di prova', 'Gli avvisi di Timbrì funzionano su questo dispositivo.', 'timbri-test');
        this.message.set('Notifica di prova inviata.');
      } catch { this.message.set('Notifica non inviata. Controlla i permessi e apri la versione pubblicata dalla Home.'); }
      finally { this.testing.set(false); }
    }, 15000);
  }

  /** Controlla uscita e pause accumulate, raggruppando le soglie di pausa raggiunte insieme. */
  private async check(): Promise<void> {
    if (!this.supported || !this.anyEnabled() || Notification.permission !== 'granted' || !this.store.ready() || this.store.saving() || this.sending) return;
    const now = Date.now();
    const date = dayKey(new Date(now));
    const day = this.store.days().find(item => item.date === date);
    if (!day) return;
    const metrics = calculateDay(day, now);
    const rules = day.rules ?? DEFAULT_RULES;
    const due: NotificationKind[] = [];
    let title = '';
    let body = '';
    if (metrics.state === 'working' && this.enabled() && metrics.exit !== null && metrics.exit <= now && !this.wasNotified('exit', date)) {
      due.push('exit');
      title = 'Puoi uscire';
      body = 'Hai raggiunto l’orario di uscita previsto per oggi.';
    }
    if (metrics.state === 'paused') {
      if (this.pauseEnabled() && rules.pauseEnabled && day.target > rules.pauseAbove && metrics.pause >= rules.pauseMinutes && !this.wasNotified('pause', date)) due.push('pause');
      if (this.voucherEnabled() && rules.voucherEnabled && metrics.pause >= rules.voucherPause && !this.wasNotified('voucher', date)) due.push('voucher');
      title = due.length === 2 ? 'Pause completate' : due[0] === 'pause' ? 'Pausa minima completata' : 'Pausa per buono pasto completata';
      body = due.includes('voucher')
        ? `${due.length === 2 ? 'Hai completato anche la pausa minima. ' : ''}Hai raggiunto la pausa richiesta per il buono pasto. Restano necessari i requisiti di lavoro della giornata.`
        : 'Hai raggiunto i minuti di pausa obbligatoria previsti per oggi.';
    }
    if (!due.length) return;
    this.sending = true;
    try {
      await this.show(title, body, `timbri-${due.join('-')}-${date}`);
      for (const kind of due) {
        this.notified.set(kind, date);
        this.write(`timbri-${kind}-notified`, date);
      }
    } catch { this.message.set('Avviso non inviato. Controlla i permessi delle notifiche.'); }
    finally { this.sending = false; }
  }

  /** Evita duplicati tra controlli e riaperture, anche senza storage disponibile. */
  private wasNotified(kind: NotificationKind, date: string): boolean {
    return this.notified.get(kind) === date || this.read(`timbri-${kind}-notified`) === date;
  }

  /** Mostra una notifica persistente usando il service worker già installato. */
  private async show(title: string, body: string, tag: string): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) throw new Error('Service worker non disponibile');
    await registration.showNotification(title, { body, tag, icon: new URL('icons/icon-192.png', document.baseURI).href });
  }

  /** Legge le preferenze senza bloccare l’app se lo storage è disabilitato. */
  private read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  /** Salva le preferenze quando il browser consente lo storage locale. */
  private write(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* La preferenza resta valida nella sessione corrente. */ }
  }
}
