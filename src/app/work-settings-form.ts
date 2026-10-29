import { Component, inject, input } from '@angular/core';
import { IonCard, IonCardContent, IonInput, IonSelect, IonSelectOption, IonToggle } from '@ionic/angular';
import { WorkSettingsService } from './work-settings.service';
import { registerDuration } from './registro-data';

type DurationSetting = 'firstTarget' | 'secondTarget' | 'pauseAbove' | 'pauseMinutes' | 'voucherAbove' | 'voucherPause';

@Component({
  selector: 'app-work-settings-form',
  imports: [IonCard, IonCardContent, IonInput, IonSelect, IonSelectOption, IonToggle],
  template: `
    <ion-card class="settings-card"><ion-card-content class="settings-group settings-fields">
      @switch (section()) {
        @case ('orari') {
          <ion-input label="Primo orario (ore)" labelPlacement="stacked" type="number" inputmode="decimal" min="0.25" max="24" step="0.25" [value]="settings.value().firstTarget / 60" (ionChange)="setDuration('firstTarget', $event.detail.value, 60)" />
          <ion-input label="Secondo orario (ore)" labelPlacement="stacked" type="number" inputmode="decimal" min="0.25" max="24" step="0.25" [value]="settings.value().secondTarget / 60" (ionChange)="setDuration('secondTarget', $event.detail.value, 60)" />
          <ion-select label="Orario predefinito" labelPlacement="stacked" interface="popover" [value]="settings.value().defaultSchedule" (ionChange)="setDefault($event.detail.value)">
            <ion-select-option value="first">Primo · {{ duration(settings.value().firstTarget) }}</ion-select-option>
            <ion-select-option value="second">Secondo · {{ duration(settings.value().secondTarget) }}</ion-select-option>
          </ion-select>
          <p class="settings-note">Le due durate compaiono nella Home. Puoi sempre scegliere un orario personale per la singola giornata.</p>
        }
        @case ('pausa') {
          <ion-toggle [checked]="settings.value().pauseEnabled" (ionChange)="settings.update({ pauseEnabled: $event.detail.checked })">Pausa obbligatoria</ion-toggle>
          @if (settings.value().pauseEnabled) {
            <ion-input label="Per giornate superiori a (ore)" labelPlacement="stacked" type="number" inputmode="decimal" min="0" max="24" step="0.25" [value]="settings.value().pauseAbove / 60" (ionChange)="setDuration('pauseAbove', $event.detail.value, 60)" />
            <ion-input label="Durata minima della pausa (minuti)" labelPlacement="stacked" type="number" inputmode="numeric" min="0" max="1440" step="1" [value]="settings.value().pauseMinutes" (ionChange)="setDuration('pauseMinutes', $event.detail.value)" />
          }
          <p class="settings-note">La soglia si riferisce alla durata prevista della giornata. La pausa mancante viene aggiunta all’uscita stimata; non blocca la timbratura di fine giornata.</p>
        }
        @case ('buono') {
          <ion-toggle [checked]="settings.value().voucherEnabled" (ionChange)="settings.update({ voucherEnabled: $event.detail.checked })">Buono pasto</ion-toggle>
          @if (settings.value().voucherEnabled) {
            <ion-input label="Lavoro netto superiore a (ore)" labelPlacement="stacked" type="number" inputmode="decimal" min="0" max="24" step="0.25" [value]="settings.value().voucherAbove / 60" (ionChange)="setDuration('voucherAbove', $event.detail.value, 60)" />
            <ion-input label="Pausa minima per il buono (minuti)" labelPlacement="stacked" type="number" inputmode="numeric" min="0" max="1440" step="1" [value]="settings.value().voucherPause" (ionChange)="setDuration('voucherPause', $event.detail.value)" />
          }
          <p class="settings-note">Conta il lavoro effettivo e la somma di tutte le pause. Il buono viene assegnato alla chiusura della giornata. Imposta 0 minuti se non è richiesta una pausa.</p>
        }
      }
      @if (settings.error()) { <p class="settings-error" role="alert">{{ settings.error() }}</p> }
    </ion-card-content></ion-card>
    <p class="settings-footnote">Le modifiche si salvano automaticamente sul dispositivo e si applicano alle nuove giornate. La giornata già iniziata e lo storico mantengono le proprie regole.</p>
  `,
})
export class WorkSettingsForm {
  readonly section = input.required<string>();
  protected readonly settings = inject(WorkSettingsService);
  protected readonly duration = registerDuration;

  /** Converte le ore in minuti e lascia al servizio la validazione prima del salvataggio. */
  protected setDuration(key: DurationSetting, value: string | number | null | undefined, multiplier = 1): void {
    const minutes = value == null || String(value).trim() === '' ? NaN : Number(value) * multiplier;
    this.settings.update({ [key]: minutes });
  }

  /** Accetta soltanto uno dei due orari rapidi come scelta iniziale. */
  protected setDefault(value: unknown): void {
    if (value === 'first' || value === 'second') this.settings.update({ defaultSchedule: value });
  }
}
