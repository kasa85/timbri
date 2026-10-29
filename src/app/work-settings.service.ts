import { Injectable, signal } from '@angular/core';
import { DEFAULT_SETTINGS, validDayRules, WorkSettings } from './work-settings';

@Injectable({ providedIn: 'root' })
export class WorkSettingsService {
  private readonly current = signal<WorkSettings>({ ...DEFAULT_SETTINGS });
  readonly value = this.current.asReadonly();
  readonly error = signal('');

  /** Ripristina solo impostazioni complete e valide dal dispositivo. */
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem('timbri-work-settings') ?? 'null');
      if (saved && this.valid(saved)) this.current.set(saved);
    } catch { /* In assenza di preferenze leggibili conserva i valori originali. */ }
  }

  /** Salva la preferenza prima di renderla disponibile alle nuove giornate. */
  update(patch: Partial<WorkSettings>): void {
    const next = { ...this.current(), ...patch };
    if (!this.valid(next)) {
      this.error.set('Inserisci durate valide: orari da 15 min a 24h, soglie e pause da 0 a 1440 min.');
      return;
    }
    try {
      localStorage.setItem('timbri-work-settings', JSON.stringify(next));
      this.current.set(next);
      this.error.set('');
    } catch { this.error.set('Impossibile salvare le impostazioni sul dispositivo.'); }
  }

  /** Verifica le durate rapide e il riferimento alla scelta predefinita. */
  private valid(value: WorkSettings): boolean {
    return validDayRules(value)
      && [value.firstTarget, value.secondTarget].every(minutes => Number.isInteger(minutes) && minutes >= 15 && minutes <= 1440)
      && (value.defaultSchedule === 'first' || value.defaultSchedule === 'second');
  }
}
