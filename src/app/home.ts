import { calculateDay, dayKey, timelineSegments } from './workday';
import { StampSheet } from './stamp-sheet';
import { WorkdayService } from './workday.service';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IonContent, IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardContent, IonModal, IonRange } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { timeOutline, briefcase, cafe, pieChart, logOutOutline, logInOutline, closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  imports: [DatePipe, IonContent, IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardContent, IonModal, IonRange, StampSheet],
  template: `<ion-content [forceOverscroll]="false"><main class="page home-page" aria-label="Home">
    <header class="home-header">
      <img class="home-logo home-logo-light" src="brand/timbri-logo-ui.png" alt="Timbrì" width="300" height="120">
      <img class="home-logo home-logo-dark" src="brand/timbri-logo-dark.png" alt="Timbrì" width="300" height="120">
    </header>
    <p class="today-date">{{ now() | date:'EEEE d MMMM':'':'it' }}</p>
    <ion-segment #scheduleSegment aria-label="Obiettivo giornaliero" [disabled]="!store.ready() || store.saving() || metrics().state === 'finished'" [value]="selectedSchedule()" (ionChange)="selectSchedule($event.detail.value)">
      <ion-segment-button value="6"><ion-label>6h</ion-label></ion-segment-button>
      <ion-segment-button value="9"><ion-label>9h</ion-label></ion-segment-button>
      <ion-segment-button value="custom" (click)="openPersonal()"><ion-label>Personale</ion-label></ion-segment-button>
    </ion-segment>
    <section class="daily-progress" aria-label="Avanzamento del lavoro giornaliero">
      <div [class]="'progress-ring ' + ('state-' + metrics().state)">
        <svg class="timeline-ring" viewBox="0 0 240 240" aria-hidden="true">
          <defs>
            <linearGradient id="work-arc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="var(--ring-work-start)" /><stop offset="100%" stop-color="var(--ring-work-end)" /></linearGradient>
            <linearGradient id="pause-arc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="var(--ring-pause-start)" /><stop offset="100%" stop-color="var(--ring-pause-end)" /></linearGradient>
          </defs>
          <circle class="ring-track" cx="120" cy="120" r="107" />
          <circle class="ring-track-edge" cx="120" cy="120" r="115" />
          <circle class="ring-track-edge" cx="120" cy="120" r="99" />
          @for (arc of timelineArcs(); track $index) {
            <path class="ring-arc-edge" [attr.d]="arc.path" />
            <path class="ring-arc" [attr.d]="arc.path" [attr.stroke]="'url(#' + arc.type + '-arc)'" />
          }
        </svg>
        <ion-icon name="time-outline" aria-hidden="true" />
        <strong>{{ now() | date:'HH:mm' }}</strong>
        <span class="clock-status">{{ status() }}</span>
      </div>
    </section>
    <div class="summary-grid">
      @for (item of summary(); track item.label) {
        <ion-card class="summary-card"><ion-card-content>
          <span class="metric-icon" [class]="'metric-icon ' + item.color"><ion-icon [name]="item.icon" aria-hidden="true" /></span>
          <div><p>{{ item.label }}</p><strong>{{ item.value }}</strong></div>
        </ion-card-content></ion-card>
      }
    </div>
    @if (store.error()) { <p role="alert">{{ store.error() }}</p> }
    <ion-button class="stamp-button" expand="block" shape="round" [disabled]="!store.ready() || store.saving() || metrics().state === 'finished'" (click)="stampSheet.open(today(), target())"><ion-icon slot="start" [name]="metrics().state === 'working' ? 'log-out-outline' : 'log-in-outline'" />{{ metrics().state === 'finished' ? 'Giornata conclusa' : metrics().state === 'working' ? 'Timbra uscita' : 'Timbra entrata' }}</ion-button>
  </main></ion-content>
  <ion-modal #personalSheet class="personal-sheet" aria-labelledby="personal-title" [isOpen]="personalOpen()" [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="true" (didDismiss)="personalOpen.set(false); scheduleSegment.value = selectedSchedule()">
    <ng-template>
      <ion-content [forceOverscroll]="false">
        <section class="personal-panel">
          <header class="personal-heading"><h2 id="personal-title">Orario personale</h2><ion-button fill="clear" shape="round" aria-label="Chiudi senza salvare" (click)="personalSheet.dismiss()"><ion-icon slot="icon-only" name="close-outline" /></ion-button></header>
          <p class="personal-value" aria-live="polite">{{ formatMinutes(draftMinutes()) }}</p>
          <ion-range aria-label="Durata della giornata personale" [min]="0" [max]="600" [step]="15" [value]="draftMinutes()" [ticks]="false" (ionInput)="updateDraft($event.detail.value)">
            <ion-label slot="start">0h</ion-label><ion-label slot="end">10h</ion-label>
          </ion-range>
          <p class="personal-hint">Regola la durata a intervalli di 15 minuti</p>
          <ion-button expand="block" shape="round" class="personal-confirm" [disabled]="store.saving()" (click)="confirmPersonal(personalSheet)">Conferma</ion-button>
        </section>
      </ion-content>
    </ng-template>
  </ion-modal>
  <app-stamp-sheet #stampSheet />`,
})
export class Home {
  protected readonly now = signal(new Date());
  protected readonly today = computed(() => dayKey(this.now()));
  protected readonly schedule = signal('9');
  protected readonly customMinutes = signal(480);
  protected readonly draftMinutes = signal(480);
  protected readonly personalOpen = signal(false);
  protected readonly store = inject(WorkdayService);
  protected readonly day = computed(() => this.store.days().find(day => day.date === dayKey(this.now())));
  protected readonly target = computed(() => this.day()?.target ?? (this.schedule() === 'custom' ? this.customMinutes() : Number(this.schedule()) * 60));
  protected readonly metrics = computed(() => calculateDay(this.day() ?? { date: dayKey(this.now()), target: this.target(), stamps: [] }, this.now().getTime()));
  // Mostra soltanto i minuti extra completati oltre l’obiettivo netto.
  protected readonly extra = computed(() => Math.max(0, Math.floor(this.metrics().work - this.target())));
  protected readonly status = computed(() => ({ idle: 'Non timbrato', working: 'In lavoro', paused: 'In pausa', finished: 'Giornata conclusa' })[this.metrics().state]);
  protected readonly selectedSchedule = computed(() => this.day() ? (this.target() === 360 ? '6' : this.target() === 540 ? '9' : 'custom') : this.schedule());
  // Disegna prima gli archi più recenti: le estremità precedenti restano sopra nelle giunzioni.
  protected readonly timelineArcs = computed(() => timelineSegments(this.day(), this.now().getTime())
    .map(segment => ({ type: segment.type, path: this.arcPath(segment.start, segment.end) })).reverse());
  protected readonly summary = computed(() => [
    { label: 'Lavorato', value: this.formatMinutes(this.metrics().work), icon: 'briefcase', color: 'status-work' },
    { label: 'Pausa', value: this.formatMinutes(this.metrics().pause), icon: 'cafe', color: 'status-pause' },
    { label: this.extra() > 0 ? 'Extra' : 'Rimanente', value: this.extra() > 0 ? `+${this.formatMinutes(this.extra())}` : this.formatMinutes(this.metrics().remaining), icon: 'pie-chart', color: this.extra() > 0 ? 'status-work' : 'status-remaining' },
    { label: 'Uscita stimata', value: this.metrics().exit === null ? '—' : new Date(this.metrics().exit!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), icon: 'log-out-outline', color: 'status-neutral' },
  ]);

  /** Registra le icone e mantiene l’orologio aggiornato, liberando il timer all’uscita. */
  constructor() {
    addIcons({ timeOutline, briefcase, cafe, pieChart, logOutOutline, logInOutline, closeOutline });
    const timer = window.setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));
  }

  /** Costruisce un arco SVG a partire da due angoli, con origine a mezzogiorno. */
  private arcPath(start: number, end: number): string {
    const point = (angle: number) => {
      const radians = (angle - 90) * Math.PI / 180;
      return `${120 + 107 * Math.cos(radians)} ${120 + 107 * Math.sin(radians)}`;
    };
    return `M ${point(start)} A 107 107 0 ${end - start > 180 ? 1 : 0} 1 ${point(end)}`;
  }

  /** Aggiorna e salva gli obiettivi fissi anche durante il lavoro o la pausa. */
  protected async selectSchedule(value: string | number | undefined): Promise<void> {
    if (value !== '6' && value !== '9') return;
    if (this.day() && !await this.store.changeTarget(Number(value) * 60)) return;
    this.schedule.set(value);
  }

  /** Apre il pannello con l’ultimo valore personale confermato. */
  protected openPersonal(): void {
    if (this.metrics().state === 'finished' || this.store.saving()) return;
    this.draftMinutes.set(this.day()?.target ?? this.customMinutes());
    this.personalOpen.set(true);
  }

  /** Mantiene la bozza entro dieci ore con scatti esatti di quindici minuti. */
  protected updateDraft(value: number | { lower: number; upper: number }): void {
    if (typeof value === 'number') this.draftMinutes.set(Math.max(0, Math.min(600, Math.round(value / 15) * 15)));
  }

  /** Applica la bozza soltanto alla conferma e chiude il pannello. */
  protected async confirmPersonal(sheet: IonModal): Promise<void> {
    if (this.day() && !await this.store.changeTarget(this.draftMinutes())) return;
    this.customMinutes.set(this.draftMinutes());
    this.schedule.set('custom');
    void sheet.dismiss(undefined, 'confirm');
  }

  /** Formatta i minuti per il valore del pannello personale. */
  protected readonly formatMinutes = (minutes: number): string => {
    minutes = Math.floor(minutes);
    const remainder = minutes % 60;
    return `${Math.floor(minutes / 60)}h${remainder ? ` ${remainder}m` : ''}`;
  };
}
