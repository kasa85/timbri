import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { IonContent, IonCard, IonCardContent, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonSelect, IonSelectOption, IonButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, closeCircle, removeCircleOutline, chevronForwardOutline, timeOutline } from 'ionicons/icons';
import { StampSheet } from './stamp-sheet';
import { WorkdayService } from './workday.service';
import { dayKey, StampKind, Workday } from './workday';
import { registerDuration, registerRows, RegisterView } from './registro-data';

@Component({
  selector: 'app-registro',
  imports: [DatePipe, IonContent, IonCard, IonCardContent, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonSelect, IonSelectOption, IonButton, StampSheet],
  template: `<ion-content><main class="page register-page" aria-label="Registro presenze">
    <h1>Registro presenze</h1>
    <ion-segment class="register-segment" aria-label="Vista del registro" [value]="view()" (ionChange)="selectView($event.detail.value)">
      <ion-segment-button value="day"><ion-label>Giorno</ion-label></ion-segment-button>
      <ion-segment-button value="week"><ion-label>Settimana</ion-label></ion-segment-button>
      <ion-segment-button value="month"><ion-label>Mese</ion-label></ion-segment-button>
    </ion-segment>
    <ion-card class="register-card"><ion-card-content>
      <header class="register-heading">
        <ion-select justify="end" aria-label="Periodo del registro" interface="popover" [disabled]="!periods().length" placeholder="Nessun periodo" [value]="selectedPeriod()" (ionChange)="selectPeriod($event.detail.value)">
          @for (period of periods(); track period.value) { <ion-select-option [value]="period.value">{{ period.label }}</ion-select-option> }
        </ion-select>
      </header>
      @if (store.error()) { <p class="register-note" role="alert">{{ store.error() }}</p> }
      @if (rows().length) {
        <table class="presence-table"><caption class="visually-hidden">Presenze, ore lavorate, buoni pasto e balance del periodo selezionato</caption>
          <thead><tr><th scope="col">Data</th><th scope="col">Giornata</th><th scope="col"><abbr title="Ore lavorate">Ore lav</abbr></th><th scope="col"><abbr title="Buoni pasto">BP</abbr></th><th scope="col">Balance</th><th scope="col"><span class="visually-hidden">Dettagli</span></th></tr></thead>
          <tbody>
            @for (row of rows(); track row.key) {
              <tr class="presence-row" [class.is-provisional]="row.provisional">
                <th scope="row">{{ row.label }}</th>
                <td><span class="day-pill">{{ view() === 'day' ? duration(row.days[0].target) : row.days.length + ' gg' }}</span></td>
                <td class="worked-value">{{ row.incomplete ? '—' : duration(row.work) }}</td>
                <td>
                  @if (view() !== 'day') { <span class="voucher-total">{{ row.vouchers }}</span> }
                  @else {
                    <ion-icon class="voucher-icon" [class.voucher-earned]="row.vouchers > 0" [class.voucher-missed]="!row.provisional && !row.vouchers && row.voucherEligible" [name]="row.provisional ? 'remove-circle-outline' : row.vouchers ? 'checkmark-circle' : row.voucherEligible ? 'close-circle' : 'remove-circle-outline'" [attr.aria-label]="row.provisional ? 'Buono pasto provvisorio' : row.vouchers ? 'Buono pasto maturato' : row.voucherEligible ? 'Buono pasto non maturato' : 'Buono pasto non previsto'" role="img" />
                  }
                </td>
                <td class="balance-value" [class.balance-positive]="row.balance > 0" [class.balance-negative]="row.balance < 0">{{ row.incomplete ? '—' : duration(row.balance, true) }}</td>
                <td><button class="register-expand" [attr.aria-label]="'Dettagli ' + row.label" [attr.aria-expanded]="expanded() === row.key" (click)="toggleDetails(row.key)"><ion-icon name="chevron-forward-outline" [class.is-expanded]="expanded() === row.key" /></button></td>
              </tr>
              @if (expanded() === row.key) {
                <tr class="register-details"><td colspan="6">
                  @for (day of row.days; track day.date) {
                    <section><strong>{{ day.date | date:'EEEE d MMMM':'':'it' }}</strong>
                      @for (stamp of day.stamps; track $index) { <p><span>{{ stampLabel(stamp.kind) }}</span><time>{{ stamp.time | date:'HH:mm' }}</time></p> }
                      @if (isIncomplete(day)) {
                        <p role="status">Giornata da completare: ore e saldo in attesa dell’uscita.</p>
                        <ion-button size="small" [disabled]="store.saving() || !store.ready()" (click)="stampSheet.open(day.date, day.target)">Completa giornata</ion-button>
                      }
                    </section>
                  }
                </td></tr>
              }
            }
          </tbody>
          @if (view() !== 'day') { <tfoot><tr><th scope="row">Totale</th><td>{{ totals().days }} gg</td><td>{{ duration(totals().work) }}</td><td>{{ totals().vouchers }}</td><td [class.balance-positive]="totals().balance > 0" [class.balance-negative]="totals().balance < 0">{{ duration(totals().balance, true) }}</td><td></td></tr></tfoot> }
        </table>
      } @else {
        <div class="register-empty"><ion-icon name="time-outline" /><h2>{{ store.ready() ? 'Nessuna presenza' : 'Caricamento…' }}</h2><p>{{ view() === 'day' ? 'Le timbrature del periodo compariranno qui.' : 'Nessuna giornata conclusa nel periodo selezionato.' }}</p></div>
      }
    </ion-card-content></ion-card>
  </main></ion-content>
  <app-stamp-sheet #stampSheet />`,
})
export class Registro {
  protected readonly store = inject(WorkdayService);
  protected readonly now = signal(new Date());
  protected readonly view = signal<RegisterView>('day');
  protected readonly month = signal(dayKey(new Date()).slice(0, 7));
  protected readonly year = signal(String(new Date().getFullYear()));
  protected readonly expanded = signal<string | null>(null);
  protected readonly duration = registerDuration;
  protected readonly rows = computed(() => registerRows(this.store.days(), this.view(), this.selectedPeriod() ?? '', this.now().getTime()));
  protected readonly totals = computed(() => this.rows().reduce((total, row) => ({ days: total.days + row.days.length, work: total.work + row.work, vouchers: total.vouchers + row.vouchers, balance: total.balance + row.balance }), { days: 0, work: 0, vouchers: 0, balance: 0 }));
  protected readonly availableMonths = computed(() => [...new Set(this.store.days()
    .filter(day => day.stamps.length > 0).map(day => day.date.slice(0, 7)))].sort().reverse());
  protected readonly periods = computed(() => {
    if (this.view() === 'month') return [...new Set(this.availableMonths().map(month => month.slice(0, 4)))].map(value => ({ value, label: value }));
    return this.availableMonths().map(value => ({
      value,
      label: new Date(`${value}-01T12:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
    }));
  });
  protected readonly selectedPeriod = computed(() => {
    const selected = this.view() === 'month' ? this.year() : this.month();
    return this.periods().find(period => period.value === selected)?.value ?? this.periods()[0]?.value;
  });

  /** Registra le icone e aggiorna i valori provvisori della giornata in corso. */
  constructor() {
    addIcons({ checkmarkCircle, closeCircle, removeCircleOutline, chevronForwardOutline, timeOutline });
    const timer = window.setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));
  }

  /** Cambia vista mantenendo l’anno del periodo attualmente selezionato. */
  protected selectView(value: string | number | undefined): void {
    if (value !== 'day' && value !== 'week' && value !== 'month') return;
    const period = this.selectedPeriod();
    if (value === 'month' && period) this.year.set(period.slice(0, 4));
    else if (this.view() === 'month' && period) this.month.set(this.availableMonths().find(month => month.startsWith(period)) ?? '');
    this.view.set(value);
    this.expanded.set(null);
  }

  /** Seleziona il mese o l’anno dei riepiloghi, chiudendo i dettagli aperti. */
  protected selectPeriod(value: string | number | undefined): void {
    if (typeof value !== 'string' || !this.periods().some(period => period.value === value)) return;
    if (this.view() === 'month') this.year.set(value);
    else this.month.set(value);
    this.expanded.set(null);
  }

  /** Individua le giornate passate che richiedono un orario di chiusura esplicito. */
  protected isIncomplete(day: Workday): boolean {
    return day.date < dayKey(this.now()) && day.stamps.length > 0 && day.stamps.at(-1)?.kind !== 'finish';
  }

  /** Espande o richiude le timbrature della riga selezionata. */
  protected toggleDetails(key: string): void { this.expanded.update(current => current === key ? null : key); }

  /** Mostra il nome italiano della timbratura nei dettagli. */
  protected stampLabel(kind: StampKind): string { return { entry: 'Entrata', pause: 'Pausa', finish: 'Fine giornata' }[kind]; }
}
