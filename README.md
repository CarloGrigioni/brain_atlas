# NeuroAtlas

Esploratore 3D del cervello umano con React, TypeScript, Vite, React Three Fiber, drei, Three.js e Tailwind CSS 4. Progetto locale, senza backend o risorse CDN a runtime.

## Avvio

Node.js 22.12+ (oppure 20.19+).

```sh
npm install
npm run dev
```

Aprire **http://127.0.0.1:5173**, o l'indirizzo stampato da Vite. Le dipendenze sono già installate nella workspace corrente: basta `npm run dev`.

```sh
npm run build       # TypeScript + build di produzione in dist/
npm run preview     # Serve la build di produzione
npm run check:asset # Verifica licenza, hash e integrità geometrica
```

## Esplorazione

- Trascinamento per ruotare; rotellina o pinch per lo zoom.
- Autorotazione lenta, sospesa durante l'interazione e per 1,8 secondi dopo il rilascio.
- Pulsanti di autorotazione, zoom, reset e schermo intero dove supportato.
- Con la scena a fuoco: `+`, `−`, `R` per zoom e reset. Pulsanti accessibili da tastiera.
- `prefers-reduced-motion` disabilita autorotazione e presentazione animata; il reset diventa immediato.
- Fonte e limiti dell'asset consultabili in “Model & credits”.
- Spunta “Colori anatomici” per distinguere corteccia prefrontale, lobi frontale, parietale, temporale e occipitale, cervelletto e tronco, con legenda. Colori illustrativi basati sui pesi di regione del GLB; i confini sono sfumati secondo la segmentazione della sorgente. La corteccia prefrontale è una suddivisione frontale. Disattivando la spunta si ripristina il materiale avorio.
- Spunta “Esplodi parti”, cursore “Separazione” e pulsante “Ricomponi” per una vista esplosa progressiva. Le cinque regioni corticali vengono separate nei due emisferi, insieme a cervelletto e tronco (12 parti). Ogni triangolo corticale è assegnato al gruppo con maggior peso medio di regione nella sorgente. È una separazione illustrativa della superficie: i confini sono approssimati a livello di triangolo e le superfici rimangono aperte, senza inventare tessuto interno o facce di taglio. Geometria e normali originali sono conservate. La preferenza di movimento ridotto rende il passaggio immediato.
- “Emisferi cerebrali”: Entrambi, Solo sinistro, Solo destro. Nasconde le parti corticali dell'altro emisfero usando i metadati delle partizioni, senza rimuovere cervelletto e tronco. Funziona con colori e vista esplosa; ripristinare Entrambi conserva camera, zoom e separazione. Non introduce sezioni MRI o strutture interne aggiuntive.
- “Parti da visualizzare” offre sette spunte indipendenti: si possono visualizzare una regione, due o tre, tutte tranne una, oppure qualsiasi combinazione. Le regioni selezionate vengono centrate e inquadrate insieme. “Seleziona tutte” ripristina il modello completo senza cambiare camera, colori o separazione. Con zero spunte compare un messaggio e il pulsante “Mostra tutte le parti”. Il filtro emisferi si combina con la selezione ed è disabilitato quando sono selezionati soltanto cervelletto/tronco. Il menu supporta tastiera, Escape e chiusura cliccando all'esterno.

## Anatomia e provenienza

Modello reale derivato da MRI: **OpenNeuro ds006128**, snapshot **1.0.11**, soggetto **sub-01**, di **Susanne Stoll e colleghi**, dati con licenza **CC0 1.0 Universal**.

Superfici e conversione GLB: [StarKnightt / brain-explorer](https://github.com/StarKnightt/brain-explorer), da superfici FreeSurfer e segmentazioni MRI. Solo l'asset anatomico è riutilizzato; nessun codice applicativo upstream è incluso.

Il GLB contiene corteccia bilaterale, cervelletto e tronco encefalico. NeuroAtlas conserva vertici e normali, applica una trasformazione uniforme e aggiunge ombreggiatura ambientale precalcolata. Materiali e illuminazione sono illustrativi. Il file locale pesa circa **7,2 MB**; non richiede texture o decoder esterni.

- [Attribuzione completa](public/models/ATTRIBUTION.md)
- [Manifest upstream e checksum delle sorgenti](public/models/manifest.json)
- [Dichiarazione CC0 del dataset](docs/model-source/dataset_description.json)
- [Modifiche e checksum NeuroAtlas](docs/model-source/neuroatlas-asset.json)
- [Licenza CC0 locale](public/models/CC0-1.0.txt)
- [Dataset originale](https://doi.org/10.18112/openneuro.ds006128.v1.0.11)

**Limiti:** anatomia di un individuo, non un atlante universale. La superficie è ridotta rispetto ai dati MRI originali. Cervelletto e tronco sono involucri di segmentazione: **le fini lamelle cerebellari e i nuclei del tronco non sono risolti**. Non vengono inventati dettagli mancanti. Non è uno strumento diagnostico. Selezione delle aree, etichette e circuiti non sono implementati.

## Architettura e prestazioni

`BrainModel` gestisce caricamento e materiale. `BrainScene` contiene camera, luci e OrbitControls. `App` gestisce controlli, caricamento, errori, accessibilità e crediti. Gli attributi corticali `_REGION_WEIGHTS` e `_REGION_WEIGHT4` e i metadati dei nodi sono conservati per le estensioni future.

Rendering su richiesta quando fermo, DPR limitato a 1,75, una luce con shadow map, ambient occlusion precalcolata, senza postprocessing. Le prestazioni dipendono dalla GPU; occorre WebGL con accelerazione hardware. Il primo avvio deve caricare il GLB locale.

## Verifica nel browser

```sh
node scripts/smoke-test.mjs
```

Con il server già avviato, usa Chrome installato su Windows. Su altri sistemi impostare `CHROME_PATH` al proprio eseguibile; `TEST_URL` può cambiare il server. Verifica rendering, controlli, layout mobile, movimento ridotto, assenza di richieste esterne, errori console e recupero da caricamento fallito. Screenshot e risultati in `test-results/` (ignorata).

`node scripts/check-explosion.mjs` (Node 22.18+) verifica la conservazione esatta dei triangoli nelle partizioni della vista esplosa e l'integrità di vertici e normali.

Per rigenerare l'ombreggiatura dalla copia originale inclusa:

```sh
node scripts/bake-ao.mjs
npm run check:asset
```

Il baking avviene offline e non serve per avviare o compilare l'app.
