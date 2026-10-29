import { Injectable, computed, inject, signal } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { PushTestService } from './push-test.service';
import { dayKey } from './workday';

@Injectable({ providedIn: 'root' })
export class ExitNotificationService {
  private readonly push = inject(PushTestService);
  private readonly toasts = inject(ToastController);
  readonly recipient = signal('');
  readonly enabled = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly valid = computed(() => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.recipient()));
  readonly ready = computed(() => this.valid() && !!this.push.apiKey());

  /** Ripristina il destinatario e la scelta di inviare l’avviso da questo telefono. */
  constructor() {
    try {
      this.recipient.set(localStorage.getItem('timbri-exit-recipient') ?? '');
      this.enabled.set(localStorage.getItem('timbri-exit-enabled') === '1');
    } catch { /* Le preferenze restano disponibili nella sessione. */ }
  }

  /** Salva il codice condiviso dal telefono che riceverà gli avvisi. */
  setRecipient(value: string): void {
    this.recipient.set(value.trim());
    this.save('timbri-exit-recipient', this.recipient());
  }

  /** Abilita o disabilita gli invii automatici alla conferma dell’uscita. */
  setEnabled(value: boolean): void {
    this.enabled.set(value);
    this.save('timbri-exit-enabled', value ? '1' : '0');
  }

  /** Conserva le preferenze anche quando lo storage non è disponibile. */
  private save(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* Valido per questa sessione. */ }
  }

  /** Copia il codice di ricezione senza richiedere una chiave API al destinatario. */
  async copyCode(): Promise<void> {
    if (!this.push.subscribed()) return;
    try {
      await navigator.clipboard.writeText(this.push.subscriptionId());
      this.message.set('Codice copiato. Condividilo con chi deve avvisarti.');
    } catch { this.message.set('Copia non disponibile: seleziona e copia il codice qui sopra.'); }
  }

  /** Verifica il destinatario con una push immediata, senza registrare timbrature. */
  async test(): Promise<void> {
    await this.send('Timbrì · Prova avviso', 'Il collegamento funziona: riceverai qui gli avvisi di uscita.');
  }

  /** Avvisa soltanto per l’uscita odierna, dopo il salvataggio della timbratura. */
  async notify(time: number): Promise<void> {
    if (!this.enabled() || !Number.isFinite(time) || dayKey(new Date(time)) !== dayKey(new Date())) return;
    const hour = new Date(time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    await this.send('Timbrì · Fine giornata', `Ho finito di lavorare alle ${hour}. Sto uscendo!`);
  }

  /** Invia al solo destinatario e distingue la conferma OneSignal dalla ricezione effettiva. */
  private async send(title: string, body: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      if (!this.ready()) throw new Error('Configurazione incompleta');
      await this.push.schedule(title, body, Date.now(), crypto.randomUUID(), this.recipient());
      this.message.set('Avviso accettato da OneSignal.');
    } catch {
      this.message.set('Avviso non confermato. Controlla connessione, chiave API e codice destinatario in Impostazioni → Notifiche.');
    } finally { this.busy.set(false); }
    try {
      const toast = await this.toasts.create({ message: this.message(), duration: 5000, position: 'bottom' });
      await toast.present();
    } catch { /* L’esito resta consultabile nelle impostazioni. */ }
  }
}
