import { Injectable, signal } from '@angular/core';

export type Appearance = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly appearance = signal<Appearance>('system');
  private readonly system = window.matchMedia('(prefers-color-scheme: dark)');

  /** Ripristina la preferenza e segue i cambiamenti del tema del telefono. */
  constructor() {
    try {
      const saved = localStorage.getItem('timbri-appearance');
      if (saved === 'system' || saved === 'light' || saved === 'dark') this.appearance.set(saved);
    } catch { /* Il tema funziona anche quando lo storage non è disponibile. */ }
    this.apply();
    this.system.addEventListener('change', () => this.apply());
  }

  /** Applica e conserva la scelta effettuata nelle impostazioni. */
  setAppearance(value: Appearance): void {
    this.appearance.set(value);
    try { localStorage.setItem('timbri-appearance', value); } catch { /* Preferenza valida per la sessione. */ }
    this.apply();
  }

  /** Allinea palette Ionic, controlli del browser e colore della barra di sistema. */
  private apply(): void {
    const dark = this.appearance() === 'dark' || (this.appearance() === 'system' && this.system.matches);
    document.documentElement.classList.toggle('ion-palette-dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101729' : '#f5f7fc');
  }
}
