# Externe Iconpacks

Die drei vollständigen JSON-Sammlungen wurden von
[Iconify icon-sets](https://github.com/iconify/icon-sets/tree/d0290276f8f74436ebcfa5f8ff38a8dcc91a0ef5/json)
heruntergeladen. Feste Quellrevision:
`d0290276f8f74436ebcfa5f8ff38a8dcc91a0ef5` (12.11.2026).
Downloads und Integration: 14.11.2026.

| Pack / DSL-Präfix | Original-Icons | Aliasnamen | Nutzbare Namen | Lizenz |
| --- | ---: | ---: | ---: | --- |
| Bootstrap / `bootstrap` | 2.084 | 6 | 2.090 | MIT |
| Lucide / `lucide` | 2.132 | 245 | 2.377 | ISC; einzelne abgeleitete Feather-Icons zusätzlich MIT |
| Tabler / `tabler` | 6.594 | 194 | 6.788 | MIT |
| **Gesamt** | **10.810** | **445** | **11.255** | |

Die Zahlen stammen aus den tatsächlich gespeicherten Dateien, einschließlich
der vom Anbieter als verborgen markierten historischen Icons. Sie können von
aktuellen Webseiten und deren Zählweise abweichen. Bootstrap-Metadaten nennen
Version 1.13.2, Tabler 3.51.0. Lucide nennt keine Versionsnummer im JSON; dort
identifiziert die feste Iconify-Revision den Stand.

## Dateien und Herkunft

- `upstream/bootstrap.json`, `upstream/lucide.json`, `upstream/tabler.json`:
  unveränderte Original-JSONs mit Iconify-`body`-SVG und Aliasdefinitionen.
- `bootstrap.json`, `lucide.json`, `tabler.json`: automatisch daraus erzeugte,
  direkt mit `arch.registerIconPack()` verwendbare JSON-Dateien im arch.js-Format.
- `iconpacks.js`: optionales lokales Browser-Script, das alle drei Packs nach
  `arch.js` registriert. Funktioniert auch über `file://`.
- `sources.lock.json`: exakte URLs, Revision, Mengen und SHA-256-Prüfsummen für
  Originaldateien und Lizenztexte.
- `licenses/*.txt`: vollständige Hinweise der ursprünglichen Urheber. Lucide
  enthält auch die MIT-Hinweise für die von Feather abgeleiteten Icons.

Originalprojekte: [Bootstrap Icons](https://github.com/twbs/icons),
[Lucide](https://github.com/lucide-icons/lucide),
[Tabler Icons](https://github.com/tabler/tabler-icons).
Bei Weitergabe der Iconpacks die zugehörigen Lizenztexte beilegen.

## Verwendung

Alle Packs, ohne Fetch und ohne Server:

```html
<script src="arch.min.js"></script>
<script src="icons/iconpacks.js"></script>
```

Einzelnes Pack über HTTP laden:

```js
const response = await fetch('./icons/lucide.json');
if (!response.ok) throw new Error(`Iconpack: HTTP ${response.status}`);
arch.registerIconPack('lucide', await response.json());
```

Node.js:

```js
import { readFile } from 'node:fs/promises';
import * as arch from './src/arch.js';
arch.registerIconPack('tabler', JSON.parse(await readFile('icons/tabler.json', 'utf8')));
```

Danach in der DSL:

```arch
person customer "Kunde" { icon bootstrap.person }
application portal "Portal" { icon lucide.app-window }
service cloud "Cloud" { icon tabler.cloud }
```

Oder ein einzelnes Icon als SVG:

```js
const svg = arch.renderIconToString('lucide.cloud', { size: 32, title: 'Cloud' });
```

Die Bibliotheksbundles enthalten weiterhin nur das kleine `core`-Pack. Das
optionale Script mit allen drei Sammlungen ist etwa 5,9 MB groß (unkomprimiert).
Für kleinere Anwendungen nur die benötigte JSON-Datei registrieren oder daraus
ein Objekt mit ausgewählten `icons` bilden.

## Reproduktion

```sh
npm ci
npm run build
npm test
```

Der normale Build arbeitet vollständig mit den lokalen Originaldateien. Er
verifiziert alle gespeicherten Prüfsummen, wandelt SVG-Geometrien in Pfade um,
löst lokale `defs`/`use`-Referenzen und Aliase auf und validiert jedes Icon mit
dem Laufzeitvalidator. Es werden keine Icons stillschweigend ausgelassen.
Originale Linien-/Füllstile, Strichstärken, Deckkraft und Füllregeln bleiben
erhalten. Die Ursprungssammlung und ihre Dateien werden dabei nicht verändert.

Ein ausdrücklicher erneuter Netzwerkdownload ist möglich mit:

```sh
npm run icons:download
npm run build
```

JSONs und Lizenztexte stammen aus festen Revisionen bzw. dem festen Tabler-Tag.
Der Downloader prüft gegen die vorhandenen Hashes, bevor er Dateien ersetzt.
Ein bewusstes Versionsupdate erfordert die Prüfung und gemeinsame Anpassung
von Quellrevision/URLs und Lockdatei. Fremde rohe SVG-Fragmente werden zur
Laufzeit nicht akzeptiert; die Original-Iconify-JSONs sind Build-Eingaben.
