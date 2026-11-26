# Externe Iconpacks

## Iconify direkt laden

`arch.registerIconPack(name, json)` erkennt jetzt auch originale Iconify-
Sammlungen mit `icons.NAME.body`. Es ist keine Vorabkonvertierung nötig:

```js
const response = await fetch("./iconpacks/fa6-solid.json");
if (!response.ok) throw new Error(`HTTP ${response.status}`);
arch.registerIconPack("fa6-solid", await response.json());
```

```arch
service api "API" { icon fa6-solid.cloud }
```

Für eingebettete Packs genügt weiterhin
`arch.registerIconPack(pack.name, JSON.parse(pack.content))`. Der vorhandene
`loadArchIconPacks(cfg)`-Loader benötigt keine Formatkonvertierung mehr.
Die Größen bleiben Zahlen. Registrierung ist synchron und atomar: Fehler
enthalten Pack-/Iconname und ersetzen keinen bereits gültigen Pack.

Die Library selbst lädt keine URLs. Fetch oder die Inline-Einbettung bleiben
Aufgabe deiner Umgebung; dieselben Original-JSONs können für Mermaid und arch.js
verwendet werden. Konvertierte arch.js-Packs bleiben ebenfalls unterstützt.
Eine Sammlung sollte einheitlich `body`-Icons oder `paths`-Icons enthalten.

### SVG-Unterstützung und Grenzen

Unterstützt sind Pfade, Kreise, Ellipsen, Rechtecke, Linien, Polygone/Polylinien,
Gruppen, SVG-Transformationen und lokale `defs`-/`use`-Referenzen. Feste
Farben bleiben erhalten, monochrome Icons verwenden `currentColor`.
Lineare/radiale Gradienten, Clip-Pfade, Masken, Patterns und geprüfte Filter
(`feFlood`, `feBlend`, `feGaussianBlur`, `feOffset`, `feColorMatrix`, `feMerge`,
`feMergeNode`, `feMorphology`, `feComposite`) werden sicher rekonstruiert.
Präsentationsstile werden auf erlaubte Attribute begrenzt; Inline-Stile haben
Vorrang vor entsprechenden Präsentationsattributen. Eingebettete Stylesheets
mit einfachen Klassenselektoren (`.cls-1`, auch kommagetrennte Listen) und
erlaubten Präsentationsstilen werden lokal in Attribute aufgelöst. Bei mehreren
Treffern entscheidet die Reihenfolge der Regeln; Inline-Stile haben Vorrang.
Stylesheet und Quellklassen werden nicht in das Dokument übernommen.
Andere Selektoren, `@import`, CSS-Variablen und `!important` werden abgewiesen.
Maximal 512 Regeln mit jeweils 64 Klassenselektoren pro Icon.

`contrast-color(currentColor)` sowie dieselbe Funktion mit festen Hex-/benannten
Farben werden als Zeichenfarbe akzeptiert, auch in Inline-Stilen. Die Funktion
bleibt im SVG und wird vom Browser ausgewertet; ältere SVG-Viewer ohne diese
CSS-Funktion benötigen feste Farben. Grundlage:
[CSS Color 5](https://www.w3.org/TR/css-color-5/#contrast-color).

Iconify-Dimensionen einschließlich `left`/`top`, Sammlungsdefaults sowie
Alias-Ketten mit `rotate`, `hFlip`, `vFlip` werden aufgelöst. Interne SVG-IDs
werden je Instanz umbenannt. Bei `renderIconToString()` kann optional ein
eindeutiges `idPrefix` angegeben werden; sonst erzeugt die Library eines.

Vollständige SVG-Exporte innerhalb von `body` werden ebenfalls unterstützt.
Ein XML-Kopf und ausschließlich der bekannte öffentliche SVG-1.1-DOCTYPE
werden vor dem Parsen entfernt; eine DTD wird niemals geladen. Editor-Metadaten
wie `version`, `xml:space` und unbenutzte Namespace-Deklarationen werden gefiltert.
`data-*`-Attribute wie `data-name` werden ebenfalls als Metadaten akzeptiert und
beim Import weggelassen; ihre Werte beeinflussen weder Zeichnung noch Referenzen.
Sie sind keine erlaubten Inline-CSS-Eigenschaften.
Absolute SVG-Größen beziehungsweise die `viewBox` liefern fehlende Dimensionen;
`width="100%"` / `height="100%"`, `px`-Längen und Präsentationsstile werden
berücksichtigt. Ein eigener SVG-Viewport pro Icon hält Prozentangaben auch
innerhalb größerer Architekturdiagramme korrekt.

`enable-background` wird als SVG-Attribut und in Inline-Stilen geprüft und
erhalten: `accumulate`, `inherit`, `new` sowie `new x y width height` mit vier
endlichen Zahlen und nichtnegativer Breite/Höhe. Inline-Stile haben auch hier
Vorrang vor dem Attribut. Grundlage ist die
[SVG-1.1-Definition](https://www.w3.org/TR/SVG11/filters.html#EnableBackgroundProperty).
Die Library implementiert keine eigene Hintergrundpuffer-/Filtersemantik;
deren Darstellung übernimmt der Browser. Externe Referenzen und unbekannte
Stile werden durch diese Unterstützung nicht freigeschaltet.

Script, Eventhandler, `foreignObject`, Bilder, `feImage`, Animationen,
Stylesheets und externe Referenzen sind nicht erlaubt. Andere nicht unterstützte
Elemente/Attribute lösen einen Fehler aus; es wird kein ungeprüftes Markup
in die Seite eingefügt. Zulässig sind ausschließlich lokale Referenzen.
Fehlende lokale Ziele bleiben lokal und werden wie im SVG nicht gezeichnet;
ein fehlendes schließendes `)` bei rein lokalen `url(#id`-Werten wird gemäß
CSS-EOF-Verhalten normalisiert. Referenzzyklen und übermäßige Expansion werden
abgewiesen. Maximal 20.000 Namen pro Sammlung, 1.000.000 Zeichen/4096 Elemente
pro Icon, 64 Verschachtelungsebenen und 64 Alias-Verknüpfungen.

Die Browserbundles enthalten den XML-Parser und die Pfadnormalisierung bereits.
Es werden keine zusätzlichen Scripts/CDNs benötigt. Bei direktem Node-Import
von `src/arch.js` werden die in package.json gepinnten Abhängigkeiten verwendet.
Lizenztexte: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md); sie stehen auch
im Kopf der ausgelieferten Bundles.

### Originale Testpacks und Attribution

Zusätzlich zu den drei Packs unten liegen zwei unveränderte Iconify-Originale
unter `icons/upstream/`. Revision, SHA-256-Werte, Autoren und Lizenzen stehen in
[iconify-sources.lock.json](iconify-sources.lock.json). Sie werden nicht automatisch
in `icons/iconpacks.js` oder die Library eingebettet.

| Original | Icons + Aliase | Autor | Lizenz |
| --- | ---: | --- | --- |
| Font Awesome 6 Solid | 1.407 + 1 | [Dave Gandy / Font Awesome](https://github.com/FortAwesome/Font-Awesome) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Logos | 2.305 + 9 | [Gil Barbara](https://github.com/gilbarbara/logos) | [CC0](https://raw.githubusercontent.com/gilbarbara/logos/master/LICENSE.txt) |

Die Original-JSONs enthalten ihre Anbieter-Metadaten und bleiben unverändert.
`tests/iconify.test.mjs` prüft alle fünf Originalsammlungen: insgesamt 14.977
Icon-/Aliasnamen. Browserprüfungen vergleichen farbige Logos, Gradienten, Masken,
Patterns/Filter und Font-Awesome-Icons rasterisiert mit den Original-SVGs.
Die SVG-Verarbeitung orientiert sich am
[IconifyJSON-Format](https://iconify.design/docs/types/iconify-json.html).

## Mitgelieferte konvertierte Sammlungen

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
  `arch.core.min.js` oder `arch.min.js` registriert. Funktioniert auch über `file://`.
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
<script src="arch.core.min.js"></script>
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
von Quellrevision/URLs und Lockdatei. Original-Iconify-JSONs können zusätzlich direkt zur Laufzeit registriert werden;
der beschriebene Build erzeugt weiterhin die drei kompatiblen Pfad-Packs.

## Abgleich mit bereitgestellten Referenzpacks

`icons/reference-iconpacks.lock.json` dokumentiert die fünf vom Nutzer unter
`ReferenceDocs/iconpacks/` bereitgestellten Dateien samt Hashes: Affinity,
Font Awesome 6 Solid, Logos, Lucide und Tabler. Die Originaldateien bleiben
unverändert und werden nicht automatisch in die Library übernommen. Der
zusätzliche Referenztest liest alle lokal vorhandenen Dateien und prüft
sämtliche 12.608 Icon-/Aliasnamen; fehlende Referenzdateien werden diagnostiziert.
Der unabhängige Basistest verwendet weiterhin die fünf festgeschriebenen
Originalsammlungen unter `icons/upstream/`.

Affinity enthält 43 vollständige SVG-Editor-Exporte statt normaler Iconify-
Fragmente. Tests prüfen ihre Header-/ViewBox-/Style-Strukturen und vergleichen
unter anderem `bug`, `camera`, `client`, `router`, `shield` im Browser rasterisiert
mit den Originalen. Die bekannten Standardheader werden entfernt, aktive oder
beliebige andere Doctype-/Entitätsdeklarationen bleiben verboten.
