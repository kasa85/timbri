import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AlertController, ToastController, IonContent, IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon, IonCard, IonCardContent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { colorPaletteOutline, phonePortraitOutline, sunnyOutline, moonOutline, todayOutline, arrowUndoOutline, trashOutline, warningOutline, downloadOutline, cloudUploadOutline } from 'ionicons/icons';
import { InstallGuideService } from './install-guide.service';
import { ThemeService } from './theme.service';
import { WorkdayService } from './workday.service';
import { exportCsv, importCsv } from './archive-csv';
import { dayKey, StampKind } from './workday';

@Component({
  selector: 'app-impostazioni',
  imports: [DatePipe, IonContent, IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon, IonCard, IonCardContent],
  template: `<ion-content><main class="page settings-page"><h1>Impostazioni</h1>
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><span class="settings-symbol"><ion-icon name="color-palette-outline" /></span><div><h2>Aspetto</h2><p>Scegli come vedere Timbrì.</p></div></header>
      <ion-segment class="appearance-segment" aria-label="Tema dell’app" [value]="theme.appearance()" (ionChange)="selectAppearance($event.detail.value)">
        @for (option of appearances; track option.value) {
          <ion-segment-button [value]="option.value"><ion-icon [name]="option.icon" /><ion-label>{{ option.label }}</ion-label></ion-segment-button>
        }
      </ion-segment>
      <p class="settings-note">Con Sistema, Timbrì segue l’aspetto del telefono.</p>
    </ion-card-content></ion-card>
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
    <ion-card class="settings-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><span class="settings-symbol"><ion-icon name="phone-portrait-outline" /></span><div><h2>Installazione e uso offline</h2><p>Timbrì sulla Home del tuo telefono.</p></div></header>
      <p role="status">{{ guide.offline() }}</p>
      <ion-button expand="block" fill="outline" shape="round" (click)="guide.show()">Apri la guida</ion-button>
    </ion-card-content></ion-card>
    <ion-card class="settings-card danger-card"><ion-card-content class="settings-group">
      <header class="settings-heading"><span class="settings-symbol"><ion-icon name="warning-outline" /></span><div><h2>Zona pericolosa</h2><p>Cancellazione definitiva dello storico</p></div></header>
      <div class="archive-warning"><strong>Attenzione: perderai tutte le giornate.</strong><p>Verranno eliminate tutte le timbrature, anche quelle di oggi, gli obiettivi salvati e i buoni pasto. Questa operazione non può essere annullata.</p></div>
      <p class="settings-note">Esporta prima un backup CSV per poter recuperare i dati. Il tema scelto resta invariato.</p>
      <ion-button class="day-action" color="danger" expand="block" shape="round" [disabled]="!store.ready() || store.saving() || busy() || !store.days().length" (click)="confirmResetArchive()"><ion-icon slot="start" name="trash-outline" />Elimina tutto lo storico</ion-button>
      @if (store.error()) { <p class="settings-error" role="alert">{{ store.error() }}</p> }
    </ion-card-content></ion-card>
    <p class="version">Timbrì · 0.1.0</p>
  </main></ion-content>`,
})
export class Impostazioni {
  protected readonly guide = inject(InstallGuideService);
  protected readonly theme = inject(ThemeService);
  protected readonly store = inject(WorkdayService);
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
    addIcons({ colorPaletteOutline, phonePortraitOutline, sunnyOutline, moonOutline, todayOutline, arrowUndoOutline, trashOutline, warningOutline, downloadOutline, cloudUploadOutline });
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
