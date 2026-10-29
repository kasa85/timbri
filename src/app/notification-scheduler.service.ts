import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { PushTestService } from './push-test.service';
import { WorkdayService } from './workday.service';
import { dayKey } from './workday';
import { NotificationPlan, NotificationPreferences, notificationPlans } from './notification-plans';

interface ScheduledNotification extends NotificationPlan { date: string; subscription: string; requestId: string; id?: string; }
interface SavedSchedule { entries: ScheduledNotification[]; completed: string[]; }

@Injectable({ providedIn: 'root' })
export class NotificationSchedulerService {
  readonly push = inject(PushTestService);
  private readonly store = inject(WorkdayService);
  readonly preferences = signal<NotificationPreferences>(this.read('timbri-push-preferences', { exit: false, pause: false, voucher: false }));
  readonly syncing = signal(false);
  readonly status = signal('');
  private saved = this.read<SavedSchedule>('timbri-push-schedule', { entries: [], completed: [] });
  private dirty = false;

  /** Osserva i dati salvati e ritenta la sincronizzazione al rientro o al ritorno della rete. */
  constructor() {
    effect(() => {
      this.store.days(); this.store.ready(); this.store.saving(); this.preferences();
      this.push.loaded(); this.push.subscribed(); this.push.subscriptionId(); this.push.apiKey();
      untracked(() => void this.synchronize());
    });
    const resume = () => { if (document.visibilityState === 'visible') void this.synchronize(); };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    });
  }

  /** Salva la scelta; la sincronizzazione cancella anche gli avvisi appena disabilitati. */
  setEnabled(kind: keyof NotificationPreferences, enabled: boolean): void {
    this.preferences.update(value => ({ ...value, [kind]: enabled }));
    try { localStorage.setItem('timbri-push-preferences', JSON.stringify(this.preferences())); }
    catch { this.status.set('Preferenza valida solo per questa sessione: salvataggio locale non riuscito.'); }
  }

  /** Serializza cancellazioni e invii, ricalcolando il piano se arrivano altre modifiche. */
  async synchronize(): Promise<void> {
    this.dirty = true;
    if (this.syncing() || !this.store.ready() || this.store.saving()) return;
    this.syncing.set(true);
    try {
      while (this.dirty && this.store.ready() && !this.store.saving()) {
        this.dirty = false;
        await this.reconcile();
      }
    } catch {
      this.status.set('Avvisi non sincronizzati. Potrebbero restare attivi gli orari precedenti. Controlla connessione e chiave, poi premi Riprova.');
    } finally { this.syncing.set(false); }
  }

  /** Recupera invii incerti con la stessa chiave, poi sostituisce soltanto gli avvisi cambiati. */
  private async reconcile(): Promise<void> {
    const date = dayKey(new Date());
    const now = Date.now();
    const preferences = this.preferences();
    if (!Object.values(preferences).some(Boolean) && !this.saved.entries.length) {
      this.status.set('Avvisi automatici disattivati.');
      return;
    }
    if (!this.push.loaded() || !this.push.subscribed() || !this.push.apiKey()) {
      this.status.set('Avvisi non sincronizzati: servono una API key e un dispositivo registrato. Gli avvisi già programmati potrebbero restare attivi.');
      return;
    }
    const subscription = this.push.subscriptionId();
    // Gli avvisi scaduti non vengono riprogrammati al rientro nell’app.
    for (const entry of this.saved.entries) {
      if (entry.id && entry.at <= now) {
        const key = `${entry.date}:${entry.kind}`;
        if (!this.saved.completed.includes(key)) this.saved.completed.push(key);
      }
    }
    this.saved.completed = this.saved.completed.filter(key => key.startsWith(`${date}:`));
    const desired = notificationPlans(this.store.days().find(day => day.date === date), preferences)
      .filter(plan => plan.at > now && !this.saved.completed.includes(`${date}:${plan.kind}`));
    for (const entry of [...this.saved.entries]) {
      const unchanged = entry.subscription === subscription && entry.date === date && desired.some(plan => this.samePlan(entry, plan));
      if (!entry.id && entry.at + 60000 > now) {
        entry.id = await this.push.schedule(entry.title, entry.body, entry.at, entry.requestId, entry.subscription);
        this.persist();
      }
      if (unchanged) continue;
      // Prova a cancellare anche le notifiche scadute da poco, ancora in attesa di consegna.
      if (entry.id && entry.at + 60000 > now) await this.push.cancel(entry.id);
      this.saved.entries = this.saved.entries.filter(item => item !== entry);
      this.persist();
    }
    for (const plan of desired) {
      if (this.saved.entries.some(entry => entry.subscription === subscription && entry.date === date && this.samePlan(entry, plan))) continue;
      // In caso di modifica durante una richiesta, il giro successivo usa i dati più recenti.
      if (this.dirty) return;
      const entry: ScheduledNotification = { ...plan, date, subscription, requestId: crypto.randomUUID() };
      this.saved.entries.push(entry);
      this.persist();
      entry.id = await this.push.schedule(plan.title, plan.body, plan.at, entry.requestId, subscription);
      this.persist();
    }
    this.persist();
    this.status.set(desired.length ? `${desired.length} avvisi programmati su OneSignal.` : 'Avvisi sincronizzati. Nessun avviso in attesa per lo stato attuale.');
  }

  /** Confronta anche i testi per aggiornare un avviso quando cambia il contenuto. */
  private samePlan(left: NotificationPlan, right: NotificationPlan): boolean {
    return left.kind === right.kind && left.at === right.at && left.title === right.title && left.body === right.body;
  }

  /** Salva gli identificativi prima e dopo le richieste, per recuperare interruzioni o risposte perse. */
  private persist(): void { localStorage.setItem('timbri-push-schedule', JSON.stringify(this.saved)); }

  /** Ripristina i dati locali senza bloccare l’avvio se il browser non li rende disponibili. */
  private read<T>(key: string, fallback: T): T {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
  }
}
