import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  readonly enabled = signal(false);
  readonly phone = signal('');
  readonly number = computed(() => this.phone().trim().replace(/^00/, '+').replace(/[\s().-]/g, '').replace(/^\+/, ''));
  readonly valid = computed(() => /^[1-9]\d{6,14}$/.test(this.number()));
  readonly ready = computed(() => this.enabled() && this.valid());

  /** Ripristina numero e preferenza senza richiedere accesso alla rubrica. */
  constructor() {
    try {
      this.phone.set(localStorage.getItem('timbri-whatsapp-phone') ?? '');
      this.enabled.set(localStorage.getItem('timbri-whatsapp-enabled') === '1');
    } catch { /* Le preferenze restano disponibili nella sessione. */ }
  }

  /** Conserva l’attivazione separatamente dalle notifiche di sistema. */
  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    this.save('timbri-whatsapp-enabled', enabled ? '1' : '0');
  }

  /** Salva il numero inserito, mantenendo visibile il formato originale. */
  setPhone(phone: string): void {
    this.phone.set(phone);
    this.save('timbri-whatsapp-phone', phone);
  }

  /** Prepara il messaggio con l’ora timbrata e la data per le giornate recuperate. */
  link(time: number): string | null {
    if (!this.ready() || !Number.isFinite(time)) return null;
    const date = new Date(time);
    const hour = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const today = date.toDateString() === new Date().toDateString();
    const text = today ? `Ho finito di lavorare alle ${hour}. Sto uscendo!`
      : `Ho concluso la giornata lavorativa del ${date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} alle ${hour}.`;
    return `https://wa.me/${this.number()}?text=${encodeURIComponent(text)}`;
  }

  /** Apre WhatsApp nella stessa finestra, evitando popup dopo il salvataggio asincrono. */
  open(url: string): void { window.location.assign(url); }

  /** Mantiene utilizzabili le preferenze anche se lo storage non è disponibile. */
  private save(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* Preferenza valida per la sessione. */ }
  }
}
