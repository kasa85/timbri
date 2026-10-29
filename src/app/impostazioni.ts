import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { WorkSettingsForm } from './work-settings-form';
import { WorkSettingsService } from './work-settings.service';
import { registerDuration } from './registro-data';
import { DatePipe } from '@angular/common';
import { version } from '../../package.json';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AlertController, ToastController, IonContent, IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon, IonCard, IonCardContent, IonToggle, IonInput } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { colorPaletteOutline, phonePortraitOutline, sunnyOutline, moonOutline, todayOutline, arrowUndoOutline, trashOutline, warningOutline, downloadOutline, cloudUploadOutline, timeOutline, cafeOutline, ticketOutline, folderOutline, chevronForwardOutline, chevronBackOutline } from 'ionicons/icons';
import { InstallGuideService } from './install-guide.service';
import { WhatsappService } from './whatsapp.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { ExitNotificationService } from './exit-notification.service';
import { PushTestService } from './push-test.service';
import { ThemeService } from './theme.service';
import { WorkdayService } from './workday.service';
import { StoragePersistenceService } from './storage-persistence.service';
import { exportCsv, importCsv } from './archive-csv';
import { dayKey, StampKind } from './workday';

@Component({
  selector: 'app-impostazioni',
  imports: [RouterLink, WorkSettingsForm, DatePipe, IonContent, IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon, IonCard, IonCardContent, IonToggle, IonInput],
  template: `<ion-content><main class="page settings-page">
    @if (section()) { <a class="settings-back" [routerLink]="notificationSection() ? '/impostazioni/notifiche' : '/impostazioni'"><ion-icon name="chevron-back-outline" aria-hidden="true" />{{ notificationSection() ? 'Notifiche' : 'Impostazioni' }}</a> }
    <h1>{{ title() }}</h1>

    @if (!section()) {
      <p class="settings-section-label">Preferenze</p>
      <nav class="settings-menu" aria-label="Preferenze">
        @for (item of preferenceItems(); track item.path) {
          <a class="settings-menu-row" [routerLink]="['/impostazioni', item.path]">
            <span [class]="'settings-menu-icon ' + item.color"><ion-icon [name]="item.icon" aria-hidden="true" /></span>
            <span class="settings-menu-copy"><strong>{{ item.title }}</strong><span>{{ item.summary }}</span></span>
            <ion-icon class="settings-chevron" name="chevron-forward-outline" aria-hidden="true" />
          </a>
        }
      </nav>
      <p class="settings-section-label">App e dati</p>
      <nav class="settings-menu" aria-label="App e dati">
        @for (item of appItems; track item.path) {
          <a class="settings-menu-row" [routerLink]="['/impostazioni', item.path]">
            <span [class]="'settings-menu-icon ' + item.color"><ion-icon [name]="item.icon" aria-hidden="true" /></span>
            <span class="settings-menu-copy"><strong>{{ item.title }}</strong><span>{{ item.summary }}</span></span>
            <ion-icon class="settings-chevron" name="chevron-forward-outline" aria-hidden="true" />
          </a>
        }
      </nav>
    }
    @if (section() === 'orari' || section() === 'pausa' || section() === 'buono') {
      <app-work-settings-form [section]="section()!" />
    }
    @if (section() === 'aspetto') {
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><span class="settings-symbol"><ion-icon name="color-palette-outline" /></span><div><h2>Aspetto</h2><p>Scegli come vedere Timbrì.</p></div></header>
      <ion-segment class="appearance-segment" aria-label="Tema dell’app" [value]="theme.appearance()" (ionChange)="selectAppearance($event.detail.value)">
        @for (option of appearances; track option.value) {
          <ion-segment-button [value]="option.value"><ion-icon [name]="option.icon" /><ion-label>{{ option.label }}</ion-label></ion-segment-button>
        }
      </ion-segment>
      <p class="settings-note">Con Sistema, Timbrì segue l’aspetto del telefono.</p>
    </ion-card-content></ion-card>
    }
    @if (section() === 'dati') {
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><span class="settings-symbol"><ion-icon name="today-outline" /></span><div><h2>Giornata corrente</h2><p>{{ now() | date:'d MMMM yyyy':'':'it' }}</p></div></header>
      <div class="settings-day-summary">
        @if (lastStamp(); as stamp) {
          <p>Ultima timbratura</p><strong>{{ stampLabel(stamp.kind) }} · {{ stamp.time | date:'HH:mm' }}</strong>
        } @else { <p>{{ store.ready() ? 'Nessuna timbratura oggi.' : 'Caricamento della giornata…' }}</p> }
      </div>
      <ion-button class="day-action" color="danger" fill="outline" expand="block" shape="round" [disabled]="!lastStamp() || store.saving() || !store.ready()" (click)="confirmClear(false)"><ion-icon slot="start" name="arrow-undo-outline" />Annulla ultima timbratura</ion-button>
      <ion-button class="day-action" color="danger" expand="block" shape="round" [disabled]="!lastStamp() || store.saving() || !store.ready()" (click)="confirmClear(true)"><ion-icon slot="start" name="trash-outline" />Resetta giornata</ion-button>
      <p class="settings-note">Le modifiche riguardano solo oggi. La durata scelta resta salvata.</p>
      @if (store.error()) { <p class="settings-error" role="alert">{{ store.error() }}</p> }
    </ion-card-content></ion-card>
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><span class="settings-symbol"><ion-icon name="download-outline" /></span><div><h2>Importa / esporta CSV</h2><p>Una copia dei tuoi dati, sempre con te.</p></div></header>
      <p>Esporta giornate, timbrature, durata obiettivo e buoni pasto. Importa un CSV di Timbrì per recuperare le giornate mancanti: quelle già presenti vengono mantenute.</p>
      <ion-button class="day-action" expand="block" fill="outline" shape="round" [disabled]="!store.ready() || store.saving() || busy() || !store.days().length" (click)="downloadCsv()"><ion-icon slot="start" name="download-outline" />Esporta storico CSV</ion-button>
      <input #csvFile type="file" accept=".csv,text/csv" hidden (change)="prepareImport(csvFile)" />
      <ion-button class="day-action" expand="block" fill="outline" shape="round" [disabled]="!store.ready() || store.saving() || busy()" (click)="csvFile.click()"><ion-icon slot="start" name="cloud-upload-outline" />Importa CSV</ion-button>
      @if (transferError()) { <p class="settings-error" role="alert">{{ transferError() }}</p> }
    </ion-card-content></ion-card>
    <ion-card class="settings-card danger-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><span class="settings-symbol"><ion-icon name="warning-outline" /></span><div><h2>Zona pericolosa</h2><p>Cancellazione definitiva dello storico</p></div></header>
      <div class="archive-warning"><strong>Attenzione: perderai tutte le giornate.</strong><p>Verranno eliminate tutte le timbrature, anche quelle di oggi, gli obiettivi salvati e i buoni pasto. Questa operazione non può essere annullata.</p></div>
      <p class="settings-note">Esporta prima un backup CSV per poter recuperare i dati. Il tema scelto resta invariato.</p>
      <ion-button class="day-action" color="danger" expand="block" shape="round" [disabled]="!store.ready() || store.saving() || busy() || !store.days().length" (click)="confirmResetArchive()"><ion-icon slot="start" name="trash-outline" />Elimina tutto lo storico</ion-button>
      @if (store.error()) { <p class="settings-error" role="alert">{{ store.error() }}</p> }
    </ion-card-content></ion-card>
    }
    @if (section() === 'whatsapp') {
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><div><h2>Avvisa su WhatsApp</h2><p>Un messaggio quando chiudi la giornata.</p></div></header>
      <p>Con “Conferma e notifica” salvi l’uscita e apri la chat con il messaggio pronto. Per inviarlo, premi Invia in WhatsApp.</p>
      <ion-toggle class="settings-toggle" justify="space-between" [checked]="whatsapp.enabled()" (ionChange)="whatsapp.setEnabled($event.detail.checked)">Avvisa su WhatsApp</ion-toggle>
      <ion-input label="Numero WhatsApp" labelPlacement="stacked" type="tel" autocomplete="tel" placeholder="+39 333 1234567" [value]="whatsapp.phone()" (ionInput)="whatsapp.setPhone($event.detail.value ?? '')" />
      <p class="settings-note">Inserisci il numero completo di prefisso internazionale. Numero e preferenza vengono salvati su questo dispositivo.</p>
      @if ((whatsapp.phone() || whatsapp.enabled()) && !whatsapp.valid()) {
        <p class="settings-error" role="status">Inserisci un numero valido con prefisso internazionale, ad esempio +39 333 1234567.</p>
      }
    </ion-card-content></ion-card>
    }
    @if (section() === 'notifiche' && !notificationSection()) {
      <nav class="settings-menu" aria-label="Notifiche">
        @for (item of notificationItems; track item.path) {
          <a class="settings-menu-row" [routerLink]="['/impostazioni/notifiche', item.path]">
            <span [class]="'settings-menu-icon ' + item.color"><ion-icon [name]="item.icon" aria-hidden="true" /></span>
            <span class="settings-menu-copy"><strong>{{ item.title }}</strong><span>{{ item.summary }}</span></span>
            <ion-icon class="settings-chevron" name="chevron-forward-outline" aria-hidden="true" />
          </a>
        }
      </nav>
    }
    @if (section() === 'notifiche' && notificationSection() === 'ricevi') {
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><div><h2>Ricevi avvisi di uscita</h2><p>Configura il telefono che riceve le notifiche.</p></div></header>
      <p>Non serve una chiave API. Abilita le notifiche e condividi il tuo codice con chi deve avvisarti. Su iPhone installa Timbrì sulla Home e aprila da lì.</p>
      <ion-button expand="block" shape="round" [disabled]="!push.loaded() || push.busy() || push.subscribed()" (click)="push.enable()">{{ push.subscribed() ? 'Ricezione abilitata' : 'Abilita ricezione' }}</ion-button>
      @if (push.subscribed()) {
        <ion-input label="Il tuo codice destinatario" labelPlacement="stacked" [readonly]="true" [value]="push.subscriptionId()" />
        <ion-button expand="block" fill="outline" shape="round" (click)="exitNotification.copyCode()">Copia codice destinatario</ion-button>
        <p class="settings-note">Se reinstalli l’app o cancelli i dati, verifica il codice e condividilo di nuovo se cambia.</p>
      }
      <p role="status">{{ push.message() }}</p>
    </ion-card-content></ion-card>
    }
    @if (section() === 'notifiche' && notificationSection() === 'invio') {
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><div><h2>Avvisa quando esco</h2><p>Configura il telefono da cui timbri.</p></div></header>
      <p>Inserisci il codice condiviso dal destinatario e la tua chiave API in “Configurazione e prove”. Alla conferma della fine giornata di oggi invieremo automaticamente una push. Le pause e le giornate recuperate non inviano avvisi.</p>
      <ion-input label="Codice destinatario" labelPlacement="stacked" autocomplete="off" autocapitalize="off" [spellcheck]="false" [value]="exitNotification.recipient()" (ionInput)="exitNotification.setRecipient($event.detail.value ?? '')" />
      @if (exitNotification.recipient() && !exitNotification.valid()) { <p role="status">Il codice non è valido: copia il codice completo dal telefono del destinatario.</p> }
      <ion-toggle justify="space-between" [checked]="exitNotification.enabled()" (ionChange)="exitNotification.setEnabled($event.detail.checked)">Invia avviso alla conferma dell’uscita</ion-toggle>
      @if (exitNotification.enabled() && !push.apiKey()) { <p role="status">Inserisci la tua chiave API per inviare gli avvisi.</p> }
      <ion-button expand="block" fill="outline" shape="round" [disabled]="!exitNotification.ready() || exitNotification.busy()" (click)="exitNotification.test()">Prova avviso al destinatario</ion-button>
      <p role="status">{{ exitNotification.message() }}</p>
      <p class="settings-note">L’invio richiede connessione. Se fallisce, la timbratura resta salvata; controlla il destinatario prima di avvisarlo in altro modo.</p>
    </ion-card-content></ion-card>
      <p class="settings-note"><a routerLink="/impostazioni/notifiche/configurazione">Apri configurazione e prove</a> per impostare la chiave API e verificare le push.</p>
    }
    @if (section() === 'notifiche' && notificationSection() === 'configurazione') {
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><div><h2>Prova push con OneSignal</h2><p>Verifica gli avvisi con l’app in background.</p></div></header>
      <p>Inserisci la App API Key dell’app OneSignal di Timbrì. La chiave resta salvata su questo dispositivo e viene usata per le prove e per sincronizzare gli avvisi automatici con OneSignal.</p>
      <ion-input label="App API Key" labelPlacement="stacked" type="password" autocomplete="off" autocapitalize="off" [spellcheck]="false" [value]="push.apiKey()" (ionInput)="push.setKey($event.detail.value ?? '')" />
      <ion-button expand="block" fill="clear" shape="round" [disabled]="!push.apiKey() || push.busy()" (click)="push.setKey('')">Rimuovi chiave dal dispositivo</ion-button>
      <ion-button expand="block" fill="outline" shape="round" [disabled]="!push.loaded() || push.busy() || push.subscribed()" (click)="push.enable()">{{ push.subscribed() ? 'Dispositivo registrato' : 'Abilita push su questo dispositivo' }}</ion-button>
      <ion-button expand="block" shape="round" [disabled]="!push.subscribed() || !push.apiKey() || push.busy()" (click)="push.test()">{{ push.busy() ? 'Operazione in corso…' : 'Prova push tra 15 secondi' }}</ion-button>
      <p role="status">{{ push.message() }}</p>
      <p class="settings-note">Su iPhone apri Timbrì dalla Home. La prova richiede una connessione; la chiave salvata nel browser è accessibile al codice della PWA. Usa una chiave dedicata al tuo account personale.</p>
    </ion-card-content></ion-card>
    }
    @if (section() === 'notifiche' && notificationSection() === 'promemoria') {
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><div><h2>Avvisi di lavoro e pausa</h2><p>Notifiche programmate con OneSignal.</p></div></header>
      <p>Gli avvisi seguono obiettivo e pause accumulate. Per il buono pasto restano necessari i requisiti di lavoro. Le soglie di pausa coincidenti producono un solo avviso.</p>
      <ion-toggle class="settings-toggle" justify="space-between" [checked]="notificationScheduler.preferences().exit" [disabled]="!push.loaded() || !push.subscribed() || !push.apiKey()" (ionChange)="notificationScheduler.setEnabled('exit', $event.detail.checked)">Orario di uscita raggiunto</ion-toggle>
      <ion-toggle class="settings-toggle" justify="space-between" [checked]="notificationScheduler.preferences().pause" [disabled]="!push.loaded() || !push.subscribed() || !push.apiKey()" (ionChange)="notificationScheduler.setEnabled('pause', $event.detail.checked)">Pausa minima completata</ion-toggle>
      <ion-toggle class="settings-toggle" justify="space-between" [checked]="notificationScheduler.preferences().voucher" [disabled]="!push.loaded() || !push.subscribed() || !push.apiKey()" (ionChange)="notificationScheduler.setEnabled('voucher', $event.detail.checked)">Pausa per buono pasto completata</ion-toggle>
      <p role="status">{{ notificationScheduler.status() }}</p>
      <ion-button expand="block" fill="outline" shape="round" [disabled]="notificationScheduler.syncing()" (click)="notificationScheduler.synchronize()">{{ notificationScheduler.syncing() ? 'Sincronizzazione…' : 'Riprova sincronizzazione' }}</ion-button>
      <p class="settings-note">Ogni modifica richiede connessione. Se la sincronizzazione fallisce, potrebbe arrivare un avviso con l’orario precedente. Ricevi al massimo un avviso per tipo al giorno.</p>
    </ion-card-content></ion-card>
      <p class="settings-note"><a routerLink="/impostazioni/notifiche/configurazione">Apri configurazione e prove</a> per impostare la chiave API e verificare le push.</p>
    }
    @if (section() === 'offline') {
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><div><h2>Aggiornamenti</h2><p>Versione installata: {{ version }}</p></div></header>
      <p role="status">{{ guide.updateStatus() }}</p>
      <ion-button expand="block" fill="outline" shape="round" [disabled]="!guide.updatesEnabled || guide.checkingUpdate()" (click)="guide.checkForUpdate()">{{ guide.checkingUpdate() ? 'Verifica in corso…' : 'Verifica aggiornamenti' }}</ion-button>
      @if (guide.updateReady()) {
        <ion-button expand="block" shape="round" (click)="guide.reload()">Aggiorna</ion-button>
      }
    </ion-card-content></ion-card>
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><span class="settings-symbol"><ion-icon name="phone-portrait-outline" /></span><div><h2>Installazione e uso offline</h2><p>Timbrì sulla Home del tuo telefono.</p></div></header>
      <p role="status">{{ guide.offline() }}</p>
      <ion-button expand="block" fill="outline" shape="round" (click)="guide.show()">Apri la guida</ion-button>
    </ion-card-content></ion-card>
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><span class="settings-symbol"><ion-icon name="download-outline" /></span><div><h2>Protezione archivio</h2><p>Conserva le timbrature sul dispositivo.</p></div></header>
      <p role="status">{{ persistence.message() }}</p>
      @if (persistence.state() !== 'active' && persistence.state() !== 'unsupported') {
        <ion-button expand="block" fill="outline" shape="round" [disabled]="!persistence.canRequest()" (click)="persistence.protect()">{{ persistence.requesting() ? 'Richiesta in corso…' : 'Proteggi archivio' }}</ion-button>
      }
      <p class="settings-note">La protezione non impedisce la cancellazione manuale dei dati e non recupera lo storico se perdi il telefono. Esporta periodicamente un backup CSV.</p>
    </ion-card-content></ion-card>
    }
    <p class="version">Timbrì · {{ version }}</p>
  </main></ion-content>`,
})
export class Impostazioni {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly section = computed(() => this.params().get('section'));
  protected readonly notificationSection = computed(() => this.section() === 'notifiche' ? this.params().get('notificationSection') : null);
  protected readonly notificationItems = [
    { path: 'promemoria', title: 'Promemoria personali', icon: 'time-outline', color: 'settings-orange', summary: 'Uscita prevista, pausa e buono pasto sul tuo telefono' },
    { path: 'invio', title: 'Avvisa quando esco', icon: 'phone-portrait-outline', color: 'settings-teal', summary: 'Destinatario e prova dell’avviso di fine giornata' },
    { path: 'ricevi', title: 'Ricevi avvisi', icon: 'download-outline', color: 'settings-blue', summary: 'Abilita la ricezione e condividi il tuo codice' },
    { path: 'configurazione', title: 'Configurazione e prove', icon: 'folder-outline', color: 'settings-gray', summary: 'Chiave API e test delle notifiche OneSignal' },
  ];
  protected readonly settings = inject(WorkSettingsService);
  protected readonly title = computed(() => this.notificationItems.find(item => item.path === this.notificationSection())?.title ?? ({ orari: 'Orari di lavoro', pausa: 'Pausa obbligatoria', buono: 'Buono pasto', aspetto: 'Aspetto', dati: 'Gestione dati', offline: 'Installazione e offline', notifiche: 'Notifiche', whatsapp: 'WhatsApp' })[this.section() ?? ''] ?? 'Impostazioni');
  protected readonly preferenceItems = computed(() => {
    const config = this.settings.value();
    return [
      { path: 'orari', title: 'Orari di lavoro', icon: 'time-outline', color: 'settings-blue', summary: `${registerDuration(config.firstTarget)} e ${registerDuration(config.secondTarget)} · Predefinito ${registerDuration(config.defaultSchedule === 'first' ? config.firstTarget : config.secondTarget)}` },
      { path: 'pausa', title: 'Pausa obbligatoria', icon: 'cafe-outline', color: 'settings-purple', summary: config.pauseEnabled ? `${config.pauseMinutes} min per giornate oltre ${registerDuration(config.pauseAbove)}` : 'Disattivata' },
      { path: 'buono', title: 'Buono pasto', icon: 'ticket-outline', color: 'settings-teal', summary: config.voucherEnabled ? `Oltre ${registerDuration(config.voucherAbove)} nette · Pausa ${config.voucherPause} min` : 'Disattivato' },
      { path: 'aspetto', title: 'Aspetto', icon: 'color-palette-outline', color: 'settings-orange', summary: { system: 'Segue il sistema', light: 'Chiaro', dark: 'Scuro' }[this.theme.appearance()] },
    ];
  });
  protected readonly appItems = [
    { path: 'notifiche', title: 'Notifiche', icon: 'time-outline', color: 'settings-orange', summary: 'Promemoria personali, invio e ricezione avvisi' },
    { path: 'whatsapp', title: 'WhatsApp', icon: 'phone-portrait-outline', color: 'settings-teal', summary: 'Avvisa qualcuno quando chiudi la giornata' },
    { path: 'dati', title: 'Gestione dati', icon: 'folder-outline', color: 'settings-blue', summary: 'Giornata corrente, backup e storico' },
    { path: 'offline', title: 'Installazione e offline', icon: 'phone-portrait-outline', color: 'settings-gray', summary: 'Guida e protezione dell’archivio' },
  ];
  protected readonly version = version;
  protected readonly guide = inject(InstallGuideService);
  protected readonly whatsapp = inject(WhatsappService);
  protected readonly push = inject(PushTestService);
  protected readonly exitNotification = inject(ExitNotificationService);
  protected readonly notificationScheduler = inject(NotificationSchedulerService);
  protected readonly theme = inject(ThemeService);
  protected readonly store = inject(WorkdayService);
  protected readonly persistence = inject(StoragePersistenceService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  protected readonly busy = signal(false);
  protected readonly transferError = signal('');
  protected readonly now = signal(new Date());
  protected readonly lastStamp = computed(() => this.store.days().find(day => day.date === dayKey(this.now()))?.stamps.at(-1));
  protected readonly appearances = [
    { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
    { value: 'light', label: 'Chiaro', icon: 'sunny-outline' },
    { value: 'dark', label: 'Scuro', icon: 'moon-outline' },
  ];

  /** Registra le icone e aggiorna la data anche se la pagina resta aperta a mezzanotte. */
  constructor() {
    addIcons({ colorPaletteOutline, phonePortraitOutline, sunnyOutline, moonOutline, todayOutline, arrowUndoOutline, trashOutline, warningOutline, downloadOutline, cloudUploadOutline, timeOutline, cafeOutline, ticketOutline, folderOutline, chevronForwardOutline, chevronBackOutline });
    const timer = window.setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));
  }

  /** Scarica un CSV completo compatibile con il ripristino dell’archivio. */
  protected downloadCsv(): void {
    const url = URL.createObjectURL(new Blob([exportCsv(this.store.days())], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `timbri-storico-${dayKey(new Date())}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Controlla il file e mostra il riepilogo prima di importare le giornate mancanti. */
  protected async prepareImport(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy() || this.store.saving()) return;
    this.busy.set(true);
    this.transferError.set('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Il file supera il limite di 10 MB.');
      const days = importCsv(await file.text());
      const existing = days.filter(day => this.store.days().some(item => item.date === day.date)).length;
      const alert = await this.alerts.create({
        header: 'Importare lo storico?',
        message: `${days.length} giornate nel file: ${days.length - existing} da aggiungere, ${existing} già presenti da mantenere. Nessuna giornata esistente verrà sovrascritta.`,
        buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Importa', handler: () => { void this.applyArchive(days); } }],
      });
      await alert.present();
      await alert.onDidDismiss();
    } catch (error) { this.transferError.set(error instanceof Error ? error.message : 'Impossibile leggere il file CSV.'); }
    finally { this.busy.set(false); }
  }

  /** Richiede una conferma scritta prima di cancellare tutte le giornate salvate. */
  protected async confirmResetArchive(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Eliminare TUTTO lo storico?',
      subHeader: 'Azione definitiva e irreversibile',
      message: 'Perderai anche la giornata corrente e tutti i buoni pasto. Esporta prima un backup CSV. Digita ELIMINA per confermare.',
      inputs: [{ name: 'confirmation', placeholder: 'Digita ELIMINA', attributes: { 'aria-label': 'Digita ELIMINA per confermare la cancellazione', autocomplete: 'off' } }],
      buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Elimina definitivamente', role: 'destructive', handler: data => {
        if (data.confirmation !== 'ELIMINA') return false;
        void this.applyArchive(null);
        return true;
      } }],
    });
    await alert.present();
  }

  /** Notifica il successo solo dopo il commit dell’intera operazione. */
  private async applyArchive(days: import('./workday').Workday[] | null): Promise<void> {
    if (!await this.store.updateArchive(days)) return;
    const toast = await this.toasts.create({ message: days === null ? 'Tutto lo storico è stato eliminato.' : 'Importazione completata. Le giornate già presenti sono state mantenute.', duration: 3000, position: 'bottom' });
    await toast.present();
  }

  /** Applica soltanto i temi previsti dal selettore. */
  protected selectAppearance(value: string | number | undefined): void {
    if (value === 'system' || value === 'light' || value === 'dark') this.theme.setAppearance(value);
  }

  /** Traduce il tipo di timbratura per riepilogo e conferma. */
  protected stampLabel(kind: StampKind): string {
    return { entry: 'Entrata', pause: 'Pausa', finish: 'Fine giornata' }[kind];
  }

  /** Richiede conferma indicando esattamente quale azione verrà eseguita. */
  protected async confirmClear(reset: boolean): Promise<void> {
    const stamp = this.lastStamp();
    if (!stamp || this.store.saving()) return;
    const time = new Date(stamp.time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const date = dayKey(new Date());
    const alert = await this.alerts.create({
      header: reset ? 'Resettare la giornata?' : 'Annullare l’ultima timbratura?',
      message: reset ? 'Tutte le timbrature di oggi saranno eliminate. La durata scelta resterà salvata. Questa operazione non può essere annullata.' : `Verrà rimossa la timbratura ${this.stampLabel(stamp.kind)} delle ${time}. La giornata tornerà allo stato precedente.`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: reset ? 'Resetta giornata' : 'Rimuovi timbratura', role: 'destructive', handler: () => {
          // Evita di modificare un’altra giornata o una timbratura cambiata durante la conferma.
          if (dayKey(new Date()) === date && this.lastStamp() === stamp) void this.clearToday(reset);
        } },
      ],
    });
    await alert.present();
  }

  /** Mostra la conferma di riuscita solo dopo il salvataggio locale. */
  private async clearToday(reset: boolean): Promise<void> {
    if (!await this.store.clearToday(reset)) return;
    const toast = await this.toasts.create({ message: reset ? 'Giornata resettata.' : 'Ultima timbratura annullata.', duration: 2200, position: 'bottom' });
    await toast.present();
  }
}
