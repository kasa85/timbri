import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, IonModal, IonContent, IonButton, IonToast } from '@ionic/angular';
import { InstallGuideService } from './install-guide.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { ThemeService } from './theme.service';
import { StoragePersistenceService } from './storage-persistence.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, IonModal, IonContent, IonButton, IonToast],
  template: `<ion-app><ion-router-outlet />
    <ion-toast [isOpen]="guide.updateReady()" message="Nuova versione disponibile" position="top" [buttons]="updateButtons" />
    <ion-modal class="install-guide-modal" [isOpen]="guide.open()" (didDismiss)="guide.close()" aria-labelledby="install-guide-title">
      <ng-template><ion-content><section class="install-guide">
        <img src="icons/icon-192.png" width="64" height="64" alt="" />
        <h1 id="install-guide-title">Timbrì, sempre con te</h1>
        <p>Aggiungi Timbrì alla Home per aprirla come un’app e usarla anche offline.</p>
        @if (guide.iphone) {
          <ol><li>Apri questo sito in <strong>Safari</strong>.</li><li>Tocca <strong>Condividi</strong> (nel menu della pagina, se necessario).</li><li>Scegli <strong>Aggiungi alla schermata Home</strong>, lascia attivo <strong>Apri come app web</strong> se presente e tocca <strong>Aggiungi</strong>.</li></ol>
        } @else if (guide.android) {
          <ol><li>Apri questo sito in <strong>Chrome</strong>.</li><li>Tocca il menu <strong>⋮</strong> e scegli <strong>Installa app</strong> o <strong>Aggiungi a schermata Home</strong> (anche sotto “Installa e crea scorciatoia”).</li><li>Conferma l’installazione e apri Timbrì dalla nuova icona.</li></ol>
        } @else {
          <p>Dal telefono, apri questo sito in Safari su iPhone o Chrome su Android e scegli “Aggiungi alla schermata Home” dal menu del browser. Sul computer, cerca “Installa” nel menu o nella barra degli indirizzi.</p>
        }
        <div class="install-offline" role="status"><strong>{{ guide.offline() }}</strong><p>La prima volta, apri Timbrì dalla Home con una connessione e attendi che sia disponibile offline. Le timbrature vengono salvate su questo dispositivo.</p></div>
        @if (guide.prompt()) { <ion-button expand="block" shape="round" (click)="guide.install()">Installa Timbrì</ion-button> }
        <ion-button expand="block" fill="outline" shape="round" (click)="guide.close()">Ho capito</ion-button>
        <p class="install-guide-note">Puoi ritrovare questa guida in Impostazioni → Installazione e uso offline.</p>
      </section></ion-content></ng-template>
    </ion-modal>
  </ion-app>`,
})
export class App {
  private readonly notificationScheduler = inject(NotificationSchedulerService);
  protected readonly updateButtons = [{ text: 'Aggiorna', handler: () => this.guide.reload() }];
  private readonly persistence = inject(StoragePersistenceService);
  protected readonly guide = inject(InstallGuideService);
  protected readonly theme = inject(ThemeService);
}
