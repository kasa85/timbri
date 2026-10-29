import { Component, afterNextRender, DestroyRef, ElementRef, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular';
import { registerTabBarEffect } from '@rdlabo/ionic-theme-ios27';
import { addIcons } from 'ionicons';
import { homeOutline, timeOutline, settingsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar class="main-tabs tab-bar-position-center" slot="bottom" aria-label="Navigazione principale">
        <ion-tab-button tab="home" href="/home"><ion-icon name="home-outline" aria-hidden="true" /><ion-label>Home</ion-label></ion-tab-button>
        <ion-tab-button tab="registro" href="/registro"><ion-icon name="time-outline" aria-hidden="true" /><ion-label>Registro</ion-label></ion-tab-button>
        <ion-tab-button tab="impostazioni" href="/impostazioni"><ion-icon name="settings-outline" aria-hidden="true" /><ion-label>Impostazioni</ion-label></ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>`,
})
export class Tabs {
  /** Registra le icone e attiva l’effetto vetro dopo il rendering della barra. */
  constructor() {
    addIcons({ homeOutline, timeOutline, settingsOutline });
    const host = inject(ElementRef<HTMLElement>);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const bar = host.nativeElement.querySelector('ion-tab-bar');
      const effect = bar ? registerTabBarEffect(bar) : undefined;
      destroyRef.onDestroy(() => effect?.destroy());
    });
  }
}
