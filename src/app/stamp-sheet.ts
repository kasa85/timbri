import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IonModal, IonContent, IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonDatetime } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, logoWhatsapp } from 'ionicons/icons';
import { dayKey } from './workday';
import { WorkdayService } from './workday.service';
import { WhatsappService } from './whatsapp.service';

@Component({
  selector: 'app-stamp-sheet',
  imports: [DatePipe, IonModal, IonContent, IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonDatetime],
  template: `  <ion-modal #entrySheet class="personal-sheet entry-sheet" aria-labelledby="entry-title" [isOpen]="opened()" [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="true" (didDismiss)="opened.set(false)">
    <ng-template>
      <ion-content [forceOverscroll]="false">
        <section class="personal-panel">
          <header class="personal-heading"><h2 id="entry-title">{{ working() ? 'Timbra uscita' : 'Timbra entrata' }}</h2><ion-button fill="clear" shape="round" aria-label="Chiudi senza timbrare" (click)="entrySheet.dismiss()"><ion-icon slot="icon-only" name="close-outline" /></ion-button></header>
          @if (working()) {
            <ion-segment class="exit-segment" aria-label="Tipo di uscita" [disabled]="store.saving()" [class.finish-selected]="exitKind() === 'finish'" [value]="exitKind()" (ionChange)="selectExitKind($event.detail.value)">
              <ion-segment-button value="pause"><ion-label>Pausa</ion-label></ion-segment-button>
              <ion-segment-button value="finish"><ion-label>Fine giornata</ion-label></ion-segment-button>
            </ion-segment>
          }
          <p class="entry-hint">{{ date() | date:'d MMMM yyyy':'':'it' }} · Conferma l’ora della timbratura o modificala.</p>
          <ion-datetime aria-label="Ora della timbratura" presentation="time" locale="it-IT" hourCycle="h23" [preferWheel]="true" [min]="minimum()" [max]="maximum()" [value]="draftTime()" (ionChange)="updateTime($event.detail.value)" />
          @if (store.error()) { <p role="alert">{{ store.error() }}</p> }
          <div [class.stamp-confirm-actions]="working() && exitKind() === 'finish' && whatsapp.enabled()">
            <ion-button expand="block" shape="round" class="personal-confirm" [class.confirm-pause]="working() && exitKind() === 'pause'" [class.confirm-finish]="working() && exitKind() === 'finish'" [disabled]="confirming() || store.saving() || (working() && !exitKind())" (click)="confirm(entrySheet)">Conferma</ion-button>
            @if (working() && exitKind() === 'finish' && whatsapp.enabled()) {
              <ion-button expand="block" shape="round" class="personal-confirm confirm-whatsapp" aria-label="Conferma e notifica su WhatsApp" [disabled]="confirming() || store.saving() || !whatsapp.ready()" (click)="confirm(entrySheet, true)"><ion-icon slot="start" name="logo-whatsapp" aria-hidden="true" />Conferma</ion-button>
            }
          </div>
          @if (working() && exitKind() === 'finish' && whatsapp.enabled() && !whatsapp.valid()) {
            <p role="status" class="entry-hint">Inserisci un numero con prefisso internazionale in Impostazioni → WhatsApp per notificare.</p>
          }
        </section>
      </ion-content>
    </ng-template>
  </ion-modal>`,
})
export class StampSheet {
  protected readonly store = inject(WorkdayService);
  protected readonly whatsapp = inject(WhatsappService);
  protected readonly confirming = signal(false);
  protected readonly opened = signal(false);
  protected readonly date = signal(dayKey(new Date()));
  protected readonly target = signal(540);
  protected readonly now = signal(new Date());
  protected readonly draftTime = signal('');
  protected readonly exitKind = signal<'pause' | 'finish' | undefined>(undefined);
  private readonly day = computed(() => this.store.days().find(day => day.date === this.date()));
  protected readonly working = computed(() => this.day()?.stamps.at(-1)?.kind === 'entry');
  protected readonly minimum = computed(() => {
    const last = this.day()?.stamps.at(-1);
    return last ? this.localTime(new Date(last.time)) : `${this.date()}T00:00`;
  });
  protected readonly maximum = computed(() => this.date() === dayKey(this.now()) ? this.localTime(this.now()) : `${this.date()}T23:59`);

  /** Mantiene aggiornato il limite odierno e registra l’icona condivisa. */
  constructor() {
    addIcons({ closeOutline, logoWhatsapp });
    const timer = window.setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));
  }

  /** Apre lo stesso selettore per oggi o per una giornata storica incompleta. */
  open(date: string, target: number): void {
    if (!this.store.ready() || this.store.saving()) return;
    this.now.set(new Date());
    this.date.set(date);
    this.target.set(target);
    this.exitKind.set(undefined);
    this.store.error.set('');
    this.draftTime.set(date === dayKey(this.now()) ? this.maximum() : this.minimum());
    this.opened.set(true);
  }

  /** Formatta l’orario per le ruote Ionic mantenendo la data locale. */
  private localTime(date: Date): string {
    return `${dayKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  /** Conserva la data selezionata anche quando Ionic restituisce soltanto una variazione d’ora. */
  protected updateTime(value: string | string[] | null | undefined): void {
    if (typeof value === 'string') this.draftTime.set(`${this.date()}T${value.slice(11, 16)}`);
  }

  /** Accetta soltanto una scelta esplicita tra pausa e fine giornata. */
  protected selectExitKind(value: string | number | undefined): void {
    this.exitKind.set(value === 'pause' || value === 'finish' ? value : undefined);
  }

  /** Salva la timbratura e apre WhatsApp solo dopo la conferma riuscita della fine giornata. */
  protected async confirm(sheet: IonModal, notify = false): Promise<void> {
    const kind = this.working() ? this.exitKind() : 'entry';
    if (!kind || this.store.saving() || this.confirming()) return;
    const time = new Date(this.draftTime()).getTime();
    const url = notify && kind === 'finish' ? this.whatsapp.link(time) : null;
    if (notify && !url) return;
    this.confirming.set(true);
    try {
      if (!await this.store.stamp(kind, time, this.target(), this.date())) return;
      await sheet.dismiss(undefined, 'confirm');
      if (url) this.whatsapp.open(url);
    } finally { this.confirming.set(false); }
  }
}
