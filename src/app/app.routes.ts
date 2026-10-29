import { Routes } from '@angular/router';
import { Tabs } from './tabs';

export const routes: Routes = [{
  path: '', component: Tabs, children: [
    { path: 'home', loadComponent: () => import('./home').then(m => m.Home) },
    { path: 'registro', loadComponent: () => import('./registro').then(m => m.Registro) },
    { path: 'impostazioni', loadComponent: () => import('./impostazioni').then(m => m.Impostazioni) },
    { path: 'impostazioni/:section', loadComponent: () => import('./impostazioni').then(m => m.Impostazioni) },
    { path: 'oggi', redirectTo: 'home', pathMatch: 'full' },
    { path: 'archivio', redirectTo: 'registro', pathMatch: 'full' },
    { path: '', redirectTo: 'home', pathMatch: 'full' },
  ],
}, { path: '**', redirectTo: 'home' }];
