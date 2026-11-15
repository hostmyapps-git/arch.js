# arch.js

Eine lesbare Architektursprache mit eigenständigem Inline-SVG-Renderer. Modelle
und Ansichten sind getrennt: ein Modell, mehrere Darstellungen, automatische
Layouts oder freie Positionen bis zum einzelnen SVG-Kantenpfad.

## Sofort ausprobieren

`index.html` im Browser öffnen. Die gebauten Dateien sind bereits enthalten;
Installation und Server sind dafür nicht erforderlich. Die Beispieloberfläche
bietet neun editierbare Modelle, 31 Ansichten, Live-Vorschau, Zoom,
helle/dunkle Darstellung sowie SVG- und Quelltextexport. Ctrl/Cmd+Enter rendert
und passt das Diagramm ein. Geänderte Beispiele bleiben beim Wechsel in der
laufenden Sitzung erhalten.

Alternativ lokal starten:

```sh
npm start
```

Dann `http://127.0.0.1:4173` öffnen. Die Dokumentationslinks zeigen Markdowndateien;
für die vollständige Formatierung diese Dateien in einem Markdown-Viewer öffnen.

## Im Browser einbetten

```html
<div id="diagram"></div>
<script src="arch.min.js"></script>
<script>
  const source = `architecture "My system" {
    model {
      person user "User"
      service api "API" { technology "REST" }
      database data "Data"
      relation calls user -> api "Calls"
      relation reads api -> data "Reads" { type access }
    }
  }`;
  arch.render('#diagram', source);
</script>
```

Eine zweite Ansicht ergänzt beispielsweise:

```arch
view detail "Detail" {
  include api, data
  place api at (0, 0)
  place data at (360, 100) size (240, 160)
  style api { template component accent "#8b5cf6" }
  route reads {
    from right
    to left
    via (280, 60), (280, 180)
    curve rounded
    label (280, 120)
  }
}
```

Dieser Block steht innerhalb von `architecture`, neben `model`.
Darstellung mit `arch.render('#diagram', source, { view: 'detail' })`.

## Frameworks als Profile

Eigene fachliche Typen und Regeln werden als Profile definiert. Die 13 bisherigen
Typen sind das Standardprofil; der Renderer behält unabhängig davon seine
grafischen Templates. Es sind keine Frameworkspezifika im Kern erforderlich.

Profil per API-Parameter auswählen:

```js
const profile = await (await fetch('./profiles/enterprise.json')).json();
arch.registerProfile('enterprise-demo', profile);
arch.render('#diagram', source, { profile: 'enterprise-demo' });
const report = arch.validate(source, { profile: 'enterprise-demo' });
// report.valid, report.diagnostics: Fehler mit Element, Attribut und Quellposition
```

Oder ein vereinfachtes eigenes Profil direkt im Dokument definieren:

```arch
architecture "Company portal" {
  config {
    type actor { template person }
    type product {
      template application
      attribute owner { required true }
    }
    relation uses { from actor to product style flow }
    defaultRelation uses
  }
  model {
    actor user "Customer"
    product portal "Portal" { owner "Team Commerce" }
    relation visits user -> portal "Uses"
  }
}
```

Unterstützt werden typisierte Attribute, Listen und Referenzen,
Pflichtwerte/Enums/Grenzen, Datumsvergleiche, Mehrfachvererbung,
abstrakte Typen, Relationsendpunkte, Container-Kindtypen, Kardinalitäten und
Viewpoints mit erlaubten und verpflichtenden Typen. Validierung erfolgt zur
Laufzeit auch vor dem Rendern. Fehlerhafte Modelle ersetzen die gültige Vorschau
nicht. Ohne eigenes Profil bleibt die bisherige Syntax kompatibel.

Die API-Auswahl hat Vorrang vor Dokumentregeln. Alternativ wählt
`config { profile enterprise-demo }` ein bereits registriertes Profil.
Für `file://` lädt die Beispielseite `profiles/profiles.js`, das der Build aus
den lokalen JSON-Dateien erzeugt. Die Library enthält nur das Standardprofil.

In `index.html` zeigen **Your own framework** und **Reusable JSON profile**
beide Varianten. Der PROFILE-Selektor demonstriert den API-Parameter und dessen
Validierung. Vollständige Syntax, Schema, Prioritäten und Grenzen:
[profiles/README.md](profiles/README.md). Die Engine validiert die deklarierten
Regeln; eine vollständige Standardkonformität wird nicht beansprucht.

## UAF und NAFv4

Die Profile [uaf.json](profiles/uaf.json) und
[naf4-uaf.json](profiles/naf4-uaf.json) werden als externe Daten geladen.
Sie enthalten 211 native UAF-1.0-Typen, zwei explizite Adaptertypen,
43 binäre Beziehungsabbildungen und 20 ausgewählte strukturelle
NAF-Viewpoint-Regelsätze. Das Beispiel **NAF · UAF architecture** zeigt neun
Ansichten vom Fähigkeitsmodell bis zur Implementierung.

```html
<script src="arch.min.js"></script>
<script src="profiles/uaf.js"></script>
<script src="profiles/naf4-uaf.js"></script>
```

```arch
config { profile naf4-uaf }
```

Jede View dieses Profils benötigt eine Bindung wie `viewpoint C1` oder
`viewpoint L4`. Das Basisprofil `uaf` erlaubt auch freie Views.
Grundlage ist die NATO-UAF-Leitlinie von März 2019 mit UAF 1.0.
Die fünf semantischen Hintergrundfarben und die Typzuordnung sind in
[profiles/uaf/presentation.json](profiles/uaf/presentation.json) konfigurierbar.
Die View **Semantic background colors** zeigt alle Gruppen.
Versionsbindung, Ladevarianten, vollständiges Minimalbeispiel und ausdrücklich
offene Regeln: [UAF-Anleitung](profiles/uaf/README.md) und
[Abdeckungsnachweis](profiles/uaf/COVERAGE.md). Dies ist keine vollständige
NAFv4.1-/UAF-1.3-Implementierung.

## Markdown und vorhandene Code-Fences

`test.md` enthält lauffähige Beispiele. `arch.renderMarkdown(markdown)` erzeugt
sicheres HTML für Überschriften, Absätze und Code-Fences einschließlich `arch`.
Der kleine Adapter ist bewusst kein vollständiger CommonMark-Parser.

Für einen vorhandenen Markdown-Renderer einfach dessen Codeblöcke rendern:

```js
arch.renderAll(); // pre > code.language-arch und [data-arch]
```

Fehler werden pro Block lesbar angezeigt. Weitere Blöcke werden weiter gerendert.

## JSON-Icons

Bootstrap, Lucide und Tabler sind vollständig heruntergeladen und integriert:

| Pack | Icons und Aliasnamen | JSON |
| --- | ---: | --- |
| Bootstrap Icons | 2.090 | [bootstrap.json](icons/bootstrap.json) |
| Lucide | 2.377 | [lucide.json](icons/lucide.json) |
| Tabler Icons | 6.788 | [tabler.json](icons/tabler.json) |

In `index.html` zeigt die Icongalerie die drei Zeichenstile. Das Beispiel
**Three icon libraries** verwendet alle drei Packs im Architekturmodell.
Die Galerie verlinkt die direkt registrierbaren JSON-Dateien zum Download.

```html
<script src="arch.min.js"></script>
<script src="icons/iconpacks.js"></script>
```

```arch
service cloud "Cloud" { icon bootstrap.cloud }
application portal "Portal" { icon lucide.app-window }
person customer "Kunde" { icon tabler.user }
```

Das zusätzliche Script lädt alle Packs lokal, auch über `file://`. Die schlanke
Bibliothek enthält weiterhin nur `core`; einzelne externe Packs lassen sich
alternativ über HTTP als JSON laden und registrieren. Originale, Lizenzen,
Prüfsummen, Versionsstände und Reproduktionsbefehle: [icons/README.md](icons/README.md).

Das eingebaute `core`-Pack enthält Icons für alle Templates sowie `cloud`,
`shield` und `globe`. Ein eigenes Pack kann als Objekt registriert werden:

```js
const pack = await (await fetch('./icons/example.json')).json();
arch.registerIconPack('brand', pack);
// DSL: service edge "Edge" { icon brand.cloud }
```

Fetch benötigt einen HTTP-Server; das Pack kann alternativ direkt als JS-Objekt
übergeben werden. Iconpacks akzeptieren ausschließlich geprüfte SVG-Pfaddaten.
Format und vollständige API: [SPEC.md](SPEC.md).

## Node.js und Entwicklung

```js
import { parse, renderToString } from './src/arch.js';
const model = parse(source);
const svg = renderToString(model, { view: 'detail', theme: 'dark' });
```

Voraussetzung Node.js >=22. Abhängigkeiten sind nur für Entwicklung/Tests nötig.

```sh
npm ci
npx playwright install chromium
npm run check
```

Einzelne Schritte: `npm run build`, `npm test`, `npm run test:browser`.
Build erzeugt `arch.js`, `arch.min.js`, `demo/examples.js` sowie die drei
konvertierten Iconpack-JSONs und `icons/iconpacks.js`. Quellen liegen
unter `src/`, Beispielmodelle unter `examples/`, Profile unter `profiles/`.
Der Build erzeugt auch die UAF-/NAF-JSON-Profile mit Abdeckungsnachweis sowie
die lokalen Registrierungsscripts `profiles/profiles.js` und
`profiles/{enterprise-demo,uaf,naf4-uaf}.js`. Quell-XMI und Referenz-PDFs sind
lokal enthalten und per SHA-256 festgeschrieben; normale Builds benötigen kein Netz.
Browser-Screenshots landen unter
`test-results/`. Details, Entscheidungen und Prüfergebnisse:
[SPEC.md](SPEC.md), [PROGRESS.md](PROGRESS.md).

## Weitere Diagrammtypen

Neben dem Knoten-Kanten-Renderer sind jetzt sieben eigenständige Darstellungen
enthalten: Sequenz, Zustand, Aktivität/Swimlanes, Matrix, Capability Map/Heatmap,
Zeitachse/Gantt und Klassenansicht mit Detailbereichen und Ports.

In `index.html` zeigt **Seven diagram renderers** alle sieben Ansichten.
Eine View wählt beispielsweise `diagram sequence { messages [request, response] }`.
Syntax, Konfiguration und genaue Grenzen: [DIAGRAMS.md](DIAGRAMS.md).
Weiterführende Funktionen stehen in [ROADMAP.md](ROADMAP.md).

## Grenzen

Das deterministische Schichtenlayout eignet sich für kleine bis mittlere
Architekturansichten. Es optimiert Kantenkreuzungen nicht global. Für präzise
Kompositionen stehen manuelle Koordinaten, Ports, Wegpunkte und SVG-Pfade bereit.
Maximal 1000 Elemente, 4000 Beziehungen und 32 Package-Ebenen pro DSL-Dokument.
Keine vollständige NAF-/UAF-/ArchiMate-/UML-Implementierung. Die Oberfläche
speichert Änderungen nur während der Sitzung; Quelltext zum Aufbewahren herunterladen.
