# Timbrì — nuovi asset

- `timbri-brand-original.png`: riferimento originale fornito dall’utente.
- `timbri-icon-transparent.png`: icona separata, con trasparenza esterna al riquadro colorato.
- `timbri-logo-transparent.png`: logo orizzontale separato su sfondo trasparente.

Preparati con lo strumento integrato imagegen. L’interfaccia e le icone PWA precedenti non sono state sostituite, in attesa del concept visuale.

## Prompt utilizzati

1. Estrai soltanto l’icona arrotondata a sinistra, conservando colibrì, orologio, colori, proporzioni e riquadro sfumato. Rimuovi logo destro, sfondo esterno e ombra; restituisci un PNG con trasparenza reale e piccolo margine.
2. Estrai soltanto il logo orizzontale a destra, conservando colibrì, orologio, scritta Timbrì, accento, colori, proporzioni e spaziature. Rimuovi icona sinistra, sfondo e ombre esterne; conserva le parti chiare del colibrì e restituisci un PNG con trasparenza reale.

Questi PNG sono estrazioni elaborate da imagegen, non sorgenti vettoriali originali.

## Icona app unificata

Le icone attive in `public/icons/` e `public/favicon.ico` usano il colibrì con l’orologio circolare del logo esteso, sullo sfondo sfumato ciano, blu e viola. Il master è `public/icons/timbri-ios.png`; `timbri-original.png` resta il riferimento storico.

Preparata con imagegen integrato usando `timbri-logo-ui.png` come riferimento del simbolo e la precedente icona come riferimento dello sfondo. Prompt: sostituire colibrì e orologio bianco separato con il colibrì e l’orologio circolare integrato del logo esteso, conservando colori, posa e dettagli; rimuovere la scritta, centrare il simbolo con margine del 12% e mantenere lo sfondo sfumato. Le dimensioni derivate sono 512, 192 e 180 px; la favicon è 32 px.

## Variante per il tema scuro

Le lancette, il perno centrale e le tacche dell’icona app sono ora bianco ghiaccio `#edf5ff`, come nel logo scuro. Correzione con imagegen integrato: modificare soltanto questi dettagli blu dell’orologio, conservando forme e posizioni; mantenere invariati colibrì, occhio scuro, arco ciano, sfondo e inquadratura. Dal master corretto sono stati ricavati nuovamente i formati PWA, Apple e favicon.

`timbri-logo-dark.png` è la variante trasparente usata nella Home con tema scuro, anche quando segue il sistema. Il tema chiaro continua a usare `timbri-logo-ui.png`; non viene applicato l’alone CSS.

Creata con lo strumento integrato imagegen. Prompt: sostituire il blu scuro della scritta e dei dettagli dell’orologio con bianco ghiaccio #edf5ff, mantenendo tipografia, proporzioni, colibrì e accenti turchesi. Sfondo realmente trasparente, bordi puliti, senza ombre, aloni o residui esterni.
