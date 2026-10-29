import { Injectable, signal } from '@angular/core';

interface OneSignalSdk {
  init(options: Record<string, unknown>): Promise<void>;
  Notifications: { requestPermission(): Promise<void>; isPushSupported(): boolean };
  User: { PushSubscription: {
    id?: string;
    optedIn: boolean;
    optIn(): Promise<void>;
    addEventListener(event: 'change', callback: () => void): void;
  } };
}

@Injectable({ providedIn: 'root' })
export class PushTestService {
  readonly appId = '6b5b69bc-0c05-46c2-b8fd-3550b6e09b53';
  readonly apiKey = signal('');
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly subscribed = signal(false);
  readonly subscriptionId = signal('');
  readonly message = signal('Caricamento di OneSignal…');
  private sdk?: OneSignalSdk;

  /** Recupera la chiave solo dallo storage locale e prepara il servizio di prova. */
  constructor() {
    try { this.apiKey.set(localStorage.getItem('timbri-onesignal-key') ?? ''); } catch { /* Disponibile solo nella sessione. */ }
    void this.initialize();
  }

  /** Salva o rimuove la chiave su questo dispositivo senza trasmetterla al caricamento. */
  setKey(value: string): void {
    const key = value.trim();
    this.apiKey.set(key);
    try {
      if (key) localStorage.setItem('timbri-onesignal-key', key);
      else localStorage.removeItem('timbri-onesignal-key');
    } catch { this.message.set('Chiave disponibile per questa sessione; salvataggio locale non riuscito.'); }
  }

  /** Carica l’SDK ufficiale una volta e registra un worker con scope separato da Angular. */
  private async initialize(): Promise<void> {
    if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) {
      this.message.set('Apri Timbrì dalla Home su iPhone o usa un browser con supporto alle notifiche push.');
      return;
    }
    try {
      this.sdk = await new Promise<OneSignalSdk>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Timeout SDK')), 20000);
        const host = window as unknown as { OneSignalDeferred?: Array<(sdk: OneSignalSdk) => void> };
        host.OneSignalDeferred ??= [];
        host.OneSignalDeferred.push(sdk => { window.clearTimeout(timer); resolve(sdk); });
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        script.defer = true;
        script.onerror = () => { window.clearTimeout(timer); reject(new Error('SDK non disponibile')); };
        document.head.append(script);
      });
      const worker = new URL('onesignal/OneSignalSDKWorker.js', document.baseURI);
      await this.sdk.init({
        appId: this.appId,
        serviceWorkerPath: worker.pathname,
        serviceWorkerParam: { scope: new URL('./', worker).pathname },
        notifyButton: { enable: false },
        welcomeNotification: { disable: true },
        promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
      });
      if (!this.sdk.Notifications.isPushSupported()) throw new Error('Push non supportate');
      this.sdk.User.PushSubscription.addEventListener('change', () => this.syncSubscription());
      this.syncSubscription();
      this.loaded.set(true);
      this.message.set('OneSignal pronto. Puoi abilitare la ricezione su questo dispositivo.');
    } catch {
      this.message.set('OneSignal non disponibile. Verifica connessione e configurazione, poi riapri la pagina. Su iPhone usa l’app dalla Home.');
    }
  }

  /** Allinea lo stato quando OneSignal completa o modifica la registrazione del dispositivo. */
  private syncSubscription(): void {
    const subscription = this.sdk?.User.PushSubscription;
    this.subscribed.set(!!subscription?.id && !!subscription.optedIn);
    this.subscriptionId.set(subscription?.id ?? '');
  }

  /** Programma un avviso personale; la chiave idempotente consente di recuperare risposte perse. */
  async schedule(title: string, body: string, at: number, requestId: string, subscriptionId: string): Promise<string> {
    const response = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${this.apiKey()}` },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ app_id: this.appId, include_subscription_ids: [subscriptionId], target_channel: 'push',
        headings: { en: title, it: title }, contents: { en: body, it: body }, send_after: new Date(at).toISOString(),
        ttl: 60, web_url: new URL('#/home', document.baseURI).href, idempotency_key: requestId }),
    });
    if (!response.ok) throw new Error('Programmazione rifiutata');
    const result = await response.json() as { id?: string; errors?: unknown };
    if (!result.id || result.errors) throw new Error('Programmazione non confermata');
    return result.id;
  }

  /** Cancella un avviso precedentemente programmato senza coinvolgere altri dispositivi. */
  async cancel(id: string): Promise<void> {
    const response = await fetch(`https://api.onesignal.com/notifications/${encodeURIComponent(id)}?app_id=${this.appId}`, {
      method: 'DELETE', keepalive: true, headers: { Authorization: `Key ${this.apiKey()}` }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Cancellazione non confermata');
  }

  /** Richiede il permesso al tocco e abilita solo la ricezione, senza inviare messaggi. */
  async enable(): Promise<void> {
    if (!this.sdk || !this.loaded() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.sdk.Notifications.requestPermission();
      if (Notification.permission !== 'granted') {
        this.message.set('Permesso non concesso. Controlla le impostazioni delle notifiche del dispositivo.');
        return;
      }
      await this.sdk.User.PushSubscription.optIn();
      this.syncSubscription();
      this.message.set(this.subscribed() ? 'Dispositivo registrato per ricevere notifiche.' : 'Registrazione in corso. Attendi la conferma della ricezione.');
    } catch { this.message.set('Registrazione non riuscita. Controlla il permesso e riprova.'); }
    finally { this.busy.set(false); }
  }

  /** Programma su OneSignal una singola push al solo dispositivo corrente, senza timer nell’app. */
  async test(): Promise<void> {
    const subscriptionId = this.sdk?.User.PushSubscription.id;
    if (!this.subscribed() || !subscriptionId || !this.apiKey() || this.busy()) return;
    this.busy.set(true);
    this.message.set('Programmazione della prova…');
    try {
      const response = await fetch('https://api.onesignal.com/notifications?c=push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Key ${this.apiKey()}` },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          app_id: this.appId,
          include_subscription_ids: [subscriptionId],
          target_channel: 'push',
          headings: { en: 'Timbrì · Prova push', it: 'Timbrì · Prova push' },
          contents: { en: 'La notifica è stata inviata da OneSignal.', it: 'La notifica è stata inviata da OneSignal.' },
          send_after: new Date(Date.now() + 15000).toISOString(),
          ttl: 60,
          web_url: new URL('#/home', document.baseURI).href,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      if (!response.ok) {
        this.message.set(response.status === 401 || response.status === 403
          ? 'Chiave non valida o non autorizzata per questa app OneSignal.'
          : `OneSignal ha rifiutato la prova (HTTP ${response.status}). Controlla la configurazione nel pannello.`);
        return;
      }
      const result = await response.json() as { id?: string; errors?: unknown };
      this.message.set(result.id && !result.errors
        ? 'Prova programmata tra circa 15 secondi. Ora metti l’app in background o blocca lo schermo.'
        : 'OneSignal non ha confermato la programmazione. Verifica la sottoscrizione nel pannello.');
    } catch {
      this.message.set('Impossibile confermare la prova: possibile errore di rete o CORS. Controlla Delivery nel pannello OneSignal prima di riprovare.');
    } finally { this.busy.set(false); }
  }
}
