# Timbrì

PWA per smartphone con Angular 22, Ionic 9, tema iOS Liquid Glass e Inter locale.

## Avvio

Richiede Node 22.22.3 o una versione supportata da Angular 22.

```sh
npm install
npm start
```

Per accedere dal telefono sulla stessa rete: `npm start -- --host 0.0.0.0`.

## Produzione e PWA

`npm run build` genera `dist/timbri/browser`. Le rotte dell’app usano il frammento `#` e funzionano anche su hosting statico. Installazione e service worker richiedono HTTPS (oppure localhost). La struttura dell’app è disponibile offline dopo la prima visita online e l’attivazione del service worker; in sviluppo il service worker è disabilitato.

Home presenta il riepilogo iniziale a zero e il selettore dell’obiettivo; Registro è inizialmente vuoto. Il pulsante di timbratura è disabilitato in attesa di definire la funzionalità. Le rotte precedenti /oggi e /archivio reindirizzano a /home e /registro. Impostazioni consente di scegliere il tema Sistema, Chiaro o Scuro, conservato sul dispositivo. Le icone derivano dalla bozza fornita; l’originale è conservato in `public/icons`.

## GitHub Pages e release

Repository: https://github.com/kasa85/timbri. Sito: https://kasa85.github.io/timbri/.
Il workflow Pages esegue test e build e pubblica quando viene inviato un tag `v*`;
si può anche avviare manualmente dalla scheda Actions.
Il routing usa `#` per supportare link diretti e aggiornamenti su hosting statico.

Dopo aver salvato le modifiche in un commit su `main`:

```sh
npm run release -- --dry-run
npm run release
```

Lo script propone la patch successiva, accetta una versione maggiore alternativa e,
dopo conferma, aggiorna package e lockfile, crea commit e tag e fa push atomico.
Test e build vengono eseguiti da GitHub Actions. Un normale push senza tag non pubblica.
Se il push fallisce dopo il commit, controllare lo stato e riprovare il push del tag già
creato, senza aumentare nuovamente la versione.

`npm run build:pages` prepara localmente `dist/timbri/browser` con base `/timbri/`.
In GitHub, Pages deve usare **GitHub Actions** come origine.
