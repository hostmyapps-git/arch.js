# arch.js — Technische Spezifikation

Version 0.1.0 · 14.11.2026

## Zweck und Lieferumfang

Eine menschenlesbare Sprache beschreibt Architekturmodelle und deren Ansichten.
Die Bibliothek erzeugt eigenständig Inline-SVG im Browser und SVG-Strings in Node.
Lieferumfang: `arch.js`, `arch.min.js`, `index.html`, `test.md`, editierbare
Beispiele und Quellcode. Keine Laufzeitabhängigkeiten, kein Server-Rendering,
kein CDN und keine Netzwerkanfrage zum Rendern.

Das Modell trennt fachliche Typen, Beschreibungen und Beziehungen von Position,
Template und Kantenführung. Die Begriffe orientieren sich an gängigen
Architekturwerkzeugen; die Implementierung beansprucht keine vollständige
NAF-, ArchiMate-, UML- oder UAF-Konformität. Referenzmaterial liegt unter
`ReferenceDocs/`. Konzeptionelle Referenzen:
[Graphviz](https://graphviz.org/documentation/) und
[Mermaid](https://github.com/mermaid-js/mermaid/tree/develop/packages/mermaid/src/docs).

## Generische Architekturprofile

Frameworks werden als Datenprofile modelliert. Der Kern kennt nur generische
Sprach-/Layoutregeln und eine feste Sammlung grafischer Templates/Kantenstile.
Die 13 Knoten- und 7 Beziehungstypen sind die Definition des
eingebauten Standardprofils `default`, keine Beschränkung eigener Metamodelle.
Es gibt keine eingebauten Sonderfälle für konkrete Frameworks.

Auswahl entweder pro API-Aufruf (`options.profile` als registrierte ID oder
Profilobjekt) oder mit genau einem `config`-Block innerhalb von `architecture`.
API-Auswahl hat Vorrang vor einer Dokumentauswahl oder Inline-Regeln, ohne diese
zu vermischen. Ohne API-Parameter gilt `config { profile ID }`, andernfalls eine
Inline-Definition, andernfalls `default`. Registrierung lädt keine URLs.

```js
arch.registerProfile('company', {
  version: '1',
  nodeTypes: {
    actor: { template: 'person' },
    product: { template: 'application', attributes: { owner: { required: true } } }
  },
  relationTypes: { uses: { from: ['actor'], to: ['product'], style: 'flow' } },
  defaultRelation: 'uses'
});
arch.render('#diagram', source, { profile: 'company' });
```

Dieselben Regeln lassen sich vereinfacht inline ausdrücken:

```arch
architecture "Portal" {
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
    actor user "User"
    product portal "Portal" { owner "Team Commerce" }
    relation visit user -> portal "Uses"
  }
}
```

JSON und `config` werden in dasselbe validierte Schema übersetzt. Unterstützt:
Mehrfachvererbung/abstrakte Typen, skalare und flache mehrwertige Attribute
(`string`, `number`, `integer`, `boolean`, `reference`), Pflichtwerte, Enums,
Zahlen-/Textlängengrenzen, typisierte Modellreferenzen, URI-/Kalender-/Zeitformate,
skalare Feldvergleiche, erlaubte Relationsendpunkte einschließlich bedingter
Paare und Ausschlüsse, Selbstbeziehungen und gerichtete Zyklen,
Container-Kindtypen, eingehende/ausgehende Kardinalitäten sowie
Viewpoint-Whitelists/Pflichttypen und Allokationen pro sichtbarem Element. Eine vollständige
Beschreibung aller Felder, Defaults, Grenzen und Beispiele steht in
`profiles/README.md`. Beispielprofil: `profiles/enterprise.json`.

`parse()` speichert das aufgelöste Profil als eingefrorenen JSON-kompatiblen
Snapshot in `model.profile`. Implizite Relationstypen werden konkret aufgelöst.
Späteres Ändern einer Registry-ID ändert frühere Modelle nicht. Layout und
Rendering validieren erneut; ein explizites `options.profile` erlaubt einen
bewussten Profilwechsel. `getProfile()` liefert eine unabhängige Kopie.
Inline-Profile werden nicht global registriert. `registerProfile()` validiert
atomar und verhindert Vererbungszyklen, unbekannte Referenzen und nicht
unterstützte Schemafelder. Es gibt keine ausführbaren Regeln und kein `eval`.

`validate(sourceOrModel, options)` liefert `{ valid, profile, diagnostics }`.
Semantische Diagnosen werden gesammelt und enthalten Quellzeile/-spalte sowie
gegebenenfalls Element-ID, Attribut und View-ID. Syntax-/Schema-/Strukturfehler
liefern zunächst eine Diagnose. `parse`/Rendering werfen `ArchError` mit erster
Diagnose und bei semantischen Fehlern zusätzlich der vollständigen Liste.

Profile prüfen nur die deklarierten Regeln. Das Beispielprofil beansprucht keine
Standardkonformität. Komplexe Ausdrucks-/Pfad-/Zeitregeln, Einheiten,
verschachtelte Listen/Objektattribute bleiben
künftige Erweiterungen des generischen Schemas bzw. Renderers.

### Erweiterte generische Regelstruktur

- Typ-`extends`: String oder Liste; Attribute aller Eltern zusammenführen,
  unterschiedliche geerbte Attributregeln erfordern eine lokale Entscheidung.
  Andere Einstellungen stammen ohne lokale Angabe aus dem ersten Elternteil.
  Geerbte Knoten-`comparisons` werden vereinigt; `abstract` wird nicht vererbt.
- Attribute: `many`, `minItems`, `maxItems`, `uniqueItems`; bei `reference`
  `targets` einschließlich Untertypen. Referenzen zeigen auf Modellknoten-IDs,
  werden global geprüft und erzeugen keine automatische SVG-Kante.
- String-`format`: `date`, `date-time`, `uri`. Kalenderdaten und Zeitzonen
  werden geprüft; Speicherung bleibt String. Knoten-`comparisons` verwenden
  `{ left, op, right }` mit `<`, `<=`, `=`, `!=`, `>=`, `>` für kompatible
  skalare Felder. Fehlende Werte überspringen nur den Vergleich.
- Relations-`pairs`: alternative `{ from, to, fromExclude?, toExclude? }`-Paare,
  zusätzlich zu globalen Endpunktregeln. `acyclic` prüft gerichtete Zyklen
  einschließlich abgeleiteter Relationstypen über das ganze Modell.
- Viewpoint-`connections`: `{ nodes, relations, direction, min, max }` prüft
  Beziehungen mit sichtbaren Endpunkten pro sichtbarem passendem Knoten.
- `pairs`, `comparisons`, `connections` sind JSON-Regeln. Der vereinfachte
  Inline-Block unterstützt Mehrfachvererbung, die erweiterten Attributfelder
  und `acyclic`; komplexere Profile werden registriert und per ID gewählt.

### UAF-/NAF-Datenprofile

`profiles/uaf.json` ist ein separates generiertes Profil mit ID `uaf`, Version
`1.0.0-arch.1`. Grundlage ist die normative UAFP-XMI für UAF 1.0, lokal unter
`ReferenceDocs/uaf/UAFP-1.0.xmi`. Alle 211 nativen Stereotypen einschließlich
33 abstrakter Typen, nativer Mehrfachvererbung und schreibbarer Attribute werden
übernommen. 2 explizite Adapter (`Package`, `Requirement`) ergeben 213 Knotentypen.
100 native Attributdefinitionen sowie 23 explizite Adapterfelder werden geprüft;
7 abgeleitete Quellfelder bleiben nicht schreibbar und werden nicht berechnet.
Native Multiplizitäten gelten, Metamodell-Defaults werden nicht materialisiert.

43 binäre Relationsabbildungen übernehmen ausgewählte native Endpunktregeln
oder ausdrücklich dokumentierte Adapter. Bedingte Paare für `IsCapableToPerform`,
`PerformsInContext` und `Implements` verhindern unzulässige Kreuzkombinationen.
Die Abbildung einer Beziehung als Kante ist von einem gleichnamigen nativen
Beziehungsknoten getrennt. UML-Basiseigenschaften sind nur im ausdrücklich
deklarierten Adapterumfang vorhanden.

`profiles/naf4-uaf.json` erweitert `uaf` um 20 strukturelle Viewpoint-Regelsätze
auf Basis der NATO-UAF-Leitlinie von März 2019, Version 1.0.0. Es verlangt für
jede View einen unterstützten `viewpoint`. Das Basisprofil `uaf` erlaubt freie
Views. Beide Profile sind keine vollständige UAF-/NAF-Konformitätsprüfung;
insbesondere keine UAF-1.3-/NAFv4.1-Implementierung. Die Darstellung nutzt die
vorhandenen Templates als Standard. Spezialrenderer werden explizit je View gewählt.

`scripts/build-uaf.mjs` prüft vor jedem Build die Quellen aus
`profiles/uaf/sources.lock.json`, extrahiert den Katalog und ergänzt
`uml-adapters.json`, `relations.json`, `naf-viewpoints.json` aus demselben
Verzeichnis. Es erzeugt beide Profil-JSONs und die Abdeckungsnachweise
`coverage.json` / `COVERAGE.md`. Diese dokumentieren auch 125 nicht als
vollständig umgesetzt ausgewiesene native Regeln und die zwei bewusst nicht
binär abgebildeten Beziehungen `ProtectsInContext` / `SameAs` mit unaufgelösten
Quelltypen. Die vollständige Anleitung steht unter
[profiles/uaf/README.md](profiles/uaf/README.md).

## Sprache

### Semantische Darstellung

Profile unterstützen `styleGroups: { NAME: { backgroundColor: HEX } }` und
Knotentypen die Felder `styleGroup` / `backgroundColor`. Farben sind geprüfte
Hexwerte (3/6 Stellen). Vorrang: View-`style.backgroundColor` vor direkter
Typfarbe vor Gruppenfarbe vor Theme. Leere Gruppen sind neutral. Gruppen
werden bei Profilvererbung nach Namen ersetzt; Typfelder werden vom ersten
Elternteil geerbt. Unbekannte Gruppen sind Fehler. Inline unterstützt
`styleGroup NAME { backgroundColor "#rrggbb" }` und `type T { styleGroup NAME }`.
Snapshots enthalten die Gruppen, sodass Laufzeit- und JSON-Modelle reproduzierbar
bleiben. Alle Templates und SVG-Exports verwenden die Hintergrundfarbe.

Explizite Hintergründe verwenden `fill-opacity="0.2"`; Text und Rahmen bleiben
deckend. Text/Rahmen sind schwarz oder weiß nach größtem WCAG-Kontrast zur
sichtbaren Mischfarbe mit dem Theme beziehungsweise den übergeordneten
Containern. Akzentfarben mit
weniger als 4,5:1 Kontrast werden durch die Textfarbe ersetzt. Ohne gesetzten
Hintergrund gilt die bisherige Theme-Darstellung.

`profiles/uaf/presentation.json` steuert die UAF-Gruppen nach Quellpaketen und
optional pro Typ. Strategic=Lime, Services=Violet, Operational=Slateblue,
Resources=Darkorange, Metadaten/Standards/Übersicht/Dictionary/Parameters=Gold;
weitere Pakete und die Adapter bleiben neutral. Alle nativen Typen sind explizit
zugeordnet, einschließlich mehrfach erbender Typen. Diese Konvention ist
konfigurierbar und keine zusätzliche fachliche Konformitätsregel.

```arch
architecture "Customer platform" {
  description "A shared model with explicit presentation."
  model {
    person customer "Customer"
    package platform "Digital platform" {
      application portal "Customer portal" {
        description "Self-service web application"
        technology "TypeScript"
        icon core.browser
      }
      database store "Customer data"
    }
    relation visits customer -> portal "Uses" { type flow }
    relation saves portal -> store "Reads / writes" { type access }
  }
  view overview "System overview" {
    direction right
    theme light
    place customer at (0, 140)
    place platform at (330, 0)
    style portal { accent "#6366f1" }
    route visits {
      from right
      to left
      via (270, 190), (270, 150)
      curve rounded
      label (280, 175)
    }
  }
}
```

### Lexik und Grammatik

- UTF-8, Groß-/Kleinschreibung relevant; Strings in doppelten Anführungszeichen
  mit JSON-Escapes (`\n`, `\"`, `\\`, `\uXXXX`).
- IDs: `[A-Za-z_][A-Za-z0-9_.-]*`. Alle Element- und Beziehungs-IDs sind global
  eindeutig; Ansichts-IDs haben einen eigenen Namensraum.
- Kommentare: `# …` oder `// …` bis Zeilenende, außerhalb von Strings.
- Whitespace und Zeilenumbrüche sind frei; Semikolons sind optionale Trenner.
- Zahlen sind endlich, dezimal, optional negativ; Koordinaten/Größen in
  SVG-Einheiten mit Bereich ±10.000.000. Eigene Zahlenattribute dürfen größere
  endliche Werte enthalten. Strings müssen gültige XML-Unicodezeichen
  enthalten. Die DSL-Eingabe ist auf 2.000.000 Zeichen begrenzt.
- Genau ein `architecture "Titel" { … }`, genau ein `model { … }`.
  Null bis mehrere `view ID "Titel" { … }`, optional ein `config { … }` an
  beliebiger Stelle im Architekturblock. Ohne View entsteht `default`.
- Elemente: `TYP ID "Titel"` mit optionalem Attributblock.
  Nur durch das Profil als Container definierte Typen dürfen Kinder enthalten.
  Im Standardprofil ist das `package`. Beziehungen dürfen im Modell oder
  innerhalb von Packages stehen, die Endpunkte sind immer globale IDs.
- Beziehung: `relation ID QUELLE -> ZIEL "Titel" { type TYP }`.
  Leere Beschriftung `""` ist erlaubt. Attribute sind optional. Ohne expliziten
  Typ gilt die `defaultRelation` des Profils; ohne diese ist `type` erforderlich.
- Modellattribute: `description`, `technology`, `icon`, `stereotype`, `tags`
  (jeweils String oder unquotiertes Wort). `tags` ist ein dokumentierender String.
  Weitere Attribute sind profildefiniert und als skalare Werte oder flache
  Listen `[WERT, WERT]` erlaubt (maximal 4000 Einträge je Liste). Sie
  werden in `element.attributes` mit separaten `attributeLocs` gespeichert.
- Elementtypen des Standardprofils: `person`, `system`, `application`, `service`, `component`,
  `database`, `queue`, `interface`, `capability`, `process`, `artifact`, `node`,
  `package`.
- Beziehungstypen des Standardprofils: `flow` (Standard), `dependency`, `association`, `access`,
  `composition`, `realization`, `generalization`. Typen werden validiert und
  grafisch unterschieden; Generalisierung verwendet ein durchgezogenes hohles
  Dreieck, Realisierung ein gestricheltes.

### Ansichten und Layout

- `direction right|down`, `theme light|dark`, `spacing ZAHL` (24–400; Standard 80).
- Optional `viewpoint ID` bindet eine View an Regeln des ausgewählten Profils.
  Geprüft werden alle Views einschließlich impliziter Container-Vorfahren.
  `requireViewpoint: true` im Profil verlangt eine Bindung für jede View.
- `include ID, ID, …` wählt Elemente aus; Packages schließen ihre Nachkommen ein,
  Kinder ihre Vorfahren. Ohne `include` sind alle Elemente sichtbar.
- `place ID at (X, Y)`; optional `size (BREITE, HOEHE)` (Mindestmaß 160 × 96).
  Die Höhe wächst bei langen Texten über das angegebene Mindestmaß hinaus.
  Positionen innerhalb eines Packages beziehen sich auf dessen **Inhaltsursprung**:
  links 28, oben 72 Einheiten nach Package-Ursprung. Mehrzeilige Package-Titel
  vergrößern den Kopf und verschieben den Inhaltsursprung entsprechend nach unten.
  Negative Kinderkoordinaten erweitern den inneren Ursprung um ihren negativen
  Mindestwert; die relativen Abstände der Kinder bleiben erhalten. Top-Level ist
  absolut. Package-Größen wachsen mindestens bis zu ihren sichtbaren Kindern.
- `style ID { template TYP; accent "#rrggbb"; icon PACK.NAME }` überschreibt
  ausschließlich die Darstellung. Die 13 Standardtypen sind zugleich die
  verfügbaren Templates. Fachliche Typen wählen im Profil ein Template;
  Container behalten ihren Containercharakter und akzeptieren nur `package`.
- `route RELATION { from PORT; to PORT; via (X,Y), …; curve ART;
  label (X,Y); path "SVG-PFAD" }`.
- Ports: `auto|top|right|bottom|left` oder absolutes Tupel `(X,Y)`.
  Wegpunkte und Labelpositionen sind **absolute** Diagrammkoordinaten.
- Kurven: `orthogonal` (Standard), `straight`, `rounded`, `bezier`.
  Wegpunkte werden bei orthogonal/straight/rounded exakt durchlaufen;
  Rundungen schneiden Ecken mit Radius bis 10 ab. Bezier akzeptiert ohne
  Wegpunkte automatisch bestimmte Kontrollpunkte oder genau zwei explizite
  Kontrollpunkte. `path` hat Vorrang vor Ports, Wegpunkten und Kurven.
- SVG-Pfade unterstützen M/L/H/V/C/S/Q/T/A/Z, absolut und relativ. Syntax und
  Zahlen werden validiert; keine URL-/Markup-/CSS-Inhalte. Bei freien Pfaden
  empfiehlt sich eine explizite Labelposition. Export enthält ihre Pfadgrenzen.
- Auto-Layout: rekursiv von innen nach außen, gerichtete Rangbildung auf
  Package-Ebene; Zyklen werden deterministisch aufgebrochen. Gleichrangige
  Elemente werden entlang der Nebenachse gestapelt. Manuelle Positionen haben
  Vorrang; unpositionierte Geschwister werden kollisionsfrei ergänzt.
- Das Layout ist deterministisch und verändert das Modell nicht. Der Algorithmus
  ist ein kompaktes Schichtenlayout, kein globaler Crossing-/Obstacle-Optimizer.
  Automatische Kanten können andere Elemente kreuzen; dafür existieren Wegpunkte.
- Selbstkanten und parallele Beziehungen erhalten eigene Standardpfade.

## API

Browser: `<script src="arch.min.js"></script>` stellt `window.arch` bereit.
Node/ESM: `import * as arch from './src/arch.js'`.

| Aufruf | Ergebnis |
| --- | --- |
| `parse(source, { profile })` | validiertes Modell `{ title, description, nodes, edges, views, profile, config? }` |
| `validate(sourceOrModel, { profile })` | Bericht `{ valid, profile: { id, version } oder null, diagnostics }` |
| `registerProfile(name, definition)` | atomare Registrierung und unabhängige Kopie des expandierten Profils |
| `getProfiles()` / `getProfile(id)` | registrierte Namen / unabhängiger Profil-Snapshot |
| `layout(model, { view, profile })` | validiertes Layout mit absoluten Boxen, Pfaden, Profil-ID/-Version und Begrenzungen |
| `renderToString(sourceOrModel, { view, theme, idPrefix, profile })` | eigenständiger SVG-String |
| `render(target, sourceOrModel, options)` | ersetzt Inhalt eines DOM-Elements; gibt SVG zurück |
| `renderAll({ root, selector, …options })` | rendert `pre > code.language-arch` und `[data-arch]`; gibt SVG-Liste zurück |
| `renderMarkdown(markdown, options)` | sicherer HTML-String für Absätze, Überschriften und Code-Fences, darin Inline-SVG |
| `registerIconPack(name, pack)` | prüft und registriert ein JSON-Iconpack atomar |
| `getIconPacks()` | Namen registrierter Iconpacks |
| `renderIconToString(name, { size, title })` | einzelnes Icon als zugängliches, eigenständiges SVG; Standardgröße 24, Bereich größer 0 bis 512 |
| `ArchError` | Fehler mit `message`, `line`, `column`, `code` |

`view` ist eine Ansichts-ID; Standard ist die erste View. Unbekannte IDs und
ungültige Attribute sind Fehler. SVG-Pfade und Iconreferenzen werden beim Rendern
der betroffenen Ansicht geprüft. `theme` überschreibt die View; dunkle Darstellung
hellt Akzentfarben für besseren Kontrast auf. `idPrefix` muss
allein aus Buchstaben, Ziffern, Unterstrichen und Bindestrichen bestehen und mit
Buchstabe/Unterstrich beginnen. Automatische Präfixe verhindern Marker-Kollisionen
zwischen mehreren Inline-SVGs. Öffentliche Datenobjekte sind JSON-kompatibel.

`renderAll` ist explizit aufzurufen, idempotent, kein automatischer DOM-Scan.
Bei `data-arch` steht der Quelltext in `textContent`. Fehler werden pro Element
als Text ausgegeben; andere Diagramme werden weiter gerendert.

### Icons und Sicherheit

Eingebautes `core`-Pack; zusätzliche Packs haben das Format:

```json
{
  "width": 24,
  "height": 24,
  "icons": {
    "cloud": { "paths": ["M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-11-1A5 5 0 0 0 6 18Z"] }
  }
}
```

Pro Icon optional eigene positive `width`/`height`. `paths` enthält ausschließlich
validierte SVG-Pfaddaten; keine rohen SVG-Fragmente. String-Pfade verwenden die
bisherige Linienzeichnung (`fill: none`, `stroke: currentColor`, Stärke 1.6,
runde Linienenden/-verbindungen). Zusätzlich sind strukturierte Pfade erlaubt:

```json
{ "d": "M2 2h20v20H2Z", "fill": "currentColor", "stroke": "none", "fillRule": "evenodd" }
```

Zulässige optionale Zeichenattribute: `fill`, `stroke` (nur `none` oder
`currentColor`), `strokeWidth` (0–64), `linecap` (`butt|round|square`), `linejoin`
(`miter|round|bevel`), `fillRule` (`nonzero|evenodd`), `opacity`, `fillOpacity`,
`strokeOpacity` (jeweils 0–1). Unbekannte Attribute sind Fehler. Registrierung
kopiert und friert die validierten Daten atomar ein. Maximal 20.000 Namen pro
Pack, 64 Pfade pro Icon, Dimensionen größer 0 bis 4096. Icon-Namen dürfen mit
Ziffern beginnen, z.B. `bootstrap.123`; Packnamen beginnen mit Buchstabe oder `_`.
Fehlende Icons führen zu einem Fehler mit Pack-/Iconname.
Alle Texte werden XML-escaped. Farben akzeptieren ausschließlich Hexfarben.
Keine Ausführung von DSL/JavaScript, kein `foreignObject`, kein `eval` und keine
externen Ressourcen. Markdown akzeptiert kein Raw-HTML. SVG erhält zugänglichen
Titel/Beschreibung und skaliert über `viewBox` ohne abgeschnittene negative Koordinaten.

### Bootstrap, Lucide und Tabler

Die vollständigen Iconify-JSONs liegen unverändert unter `icons/upstream/`.
`icons/sources.lock.json` pinnt Revision
`d0290276f8f74436ebcfa5f8ff38a8dcc91a0ef5`, Download-URLs, Lizenzen und
SHA-256-Prüfsummen. Die festen Lizenzquellen und vollständigen Texte liegen
unter `icons/licenses/`; Details: `icons/README.md`.

`scripts/iconpacks.mjs` konvertiert beim Build `path`, `circle`, `ellipse` und
`rect`, übernimmt vererbte Zeichenattribute, wendet Matrix-Transformationen an
und löst lokale `defs`-/`use`-Referenzen sowie Aliasnamen auf. Die Konvertierung
verwendet ausschließlich die Build-Abhängigkeiten `@xmldom/xmldom` 0.9.12 und
`svgpath` 2.6.0. Der Laufzeitrenderer erhält nur validierte Pfadobjekte.
Nicht unterstützte Geometrie/Attribute führen zu einem Buildfehler; es wird
nichts stillschweigend ausgelassen. Rohes SVG wird nicht in die Ausgabe injiziert.

Ergebnis: `icons/bootstrap.json` (2.090 Namen), `icons/lucide.json` (2.377),
`icons/tabler.json` (6.788), insgesamt 11.255 Icons/Aliase. Zusätzlich erzeugt
der Build das optionale `icons/iconpacks.js`, das nach `arch.js` alle drei Packs
ohne Fetch registriert. Die Bibliotheksbundles enthalten die externen Packs
nicht, damit das Einbetten einzelner oder eigener Packs schlank bleibt.

`npm run icons:download` ist der ausdrückliche Netzwerk-Schritt für den erneuten
Download der festgeschriebenen Quellen; vorhandene Hashes werden vor dem
Schreiben geprüft. Normale Builds benötigen keine Netzwerkverbindung.

## Beispieloberfläche

`index.html` ist auch über `file://` verwendbar. Klassische lokale Script-Tags,
keine Fetch-Abhängigkeit zum Start. Beispiele werden beim Build aus `examples/`
in `demo/examples.js` eingebettet. Layout: Navigation, Quelleneditor, SVG-Canvas,
Informationsleiste. Funktionen: Live-Rendering mit Debounce, Beispiele,
Ansichten, hell/dunkel, Zoom/Fit, SVG- und Quelltextdownload, Tastaturkürzel
Ctrl/Cmd+Enter, Fehler mit Zeile/Spalte. Kleine Displays erhalten gestapelte Paneele.
Die Seite lädt zusätzlich `icons/iconpacks.js`, zeigt 18 vergrößerte Icons als
direkten Packvergleich und bietet JSON-Downloads. Das Beispiel
`examples/iconpacks.arch` verwendet alle drei Packs mit vier auswählbaren Views.
Weitere Beispiele: `examples/profiles.arch` (Inline-Definition) und
`examples/external-profile.arch` (registriertes JSON), jeweils zwei Views.
`examples/uaf.arch` ergänzt neun UAF-/NAF-Ansichten; mit dem neuen Diagrammbeispiel insgesamt neun Modelle mit
31 Views. Profile `uaf` und `naf4-uaf` sind im PROFILE-Selektor verfügbar.
Die Seite lädt `profiles/profiles.js` und bietet oben einen PROFILE-Selektor,
der den API-Parameter demonstriert. Fehler erhalten den letzten gültigen
Previewstand und deaktivieren den Export bis zur Korrektur.

## Reproduktion und Verifikation

Voraussetzung Node.js >=22 und npm. `package-lock.json` pinnt alle Werkzeuge.

```sh
npm ci
npx playwright install chromium
npm run build
npm test
npm run test:browser
npm start
```

`npm start`: lokaler statischer Server auf `http://127.0.0.1:4173`, keine
Schreib-API. `PORT` überschreibt den Port. `npm run check` baut und führt beide
Testsuiten aus. Browser-Test startet seinen eigenen Server und erzeugt
Screenshots unter `test-results/`. `npm run build` erzeugt beide Browserbundles
und die eingebetteten Beispiele deterministisch. Alle `profiles/*.json` werden
beim Build nach ihren Abhängigkeiten geordnet, validiert und als optionales
`profiles/profiles.js` eingebettet. Zusätzlich entstehen Einzelscripts
`profiles/{enterprise-demo,uaf,naf4-uaf}.js`; Basisprofile sind zuerst zu laden.
Normale Builds lesen ausschließlich lokale, festgeschriebene Quellen.
Tests decken Grammatik,
Diagnosen, Isolation der Views, Layout, Routing, Iconvalidierung, Escaping,
Markdown, beide Bundles und echte Browserinteraktion ab.

## Verifizierter Implementierungsstand

Die beschriebene Version ist implementiert. Prüfung am 14.11.2026 mit Node.js
26.13.0, npm 11.20.0, esbuild 0.28.2, Playwright 1.65.1 und dem dazugehörigen
Chromium auf macOS/ARM64. Laufzeitbibliothek ohne npm-Abhängigkeiten.

- 65 Unit-/Integrationstestgruppen erfolgreich, einschließlich Parserfehlern,
  deterministischer/isolierter Layouts, Routing, Iconpacks, Unicode, Escaping,
  Markdown und Vergleich beider Bundles.
- Alle neun Beispiele und 31 Ansichten im echten Browser geprüft.
- Profilregistry, JSON-/Inline-Definitionen, Parameterpriorität, unveränderliche
  Snapshots, Vererbung, Datentypen, Attribute, Container, Kardinalitäten und
  Viewpoint-Regeln geprüft. Browserprüfung deckt Profilwechsel, Fehlerkorrektur
  und Profilweitergabe durch sämtliche Einbettungs-APIs ab.
- UAF-Katalog gegen die native XMI geprüft; Quellenhashes, bedingte Endpunktpaare,
  Referenzen, Multiplizitäten, Datums-/Enum-/Pflichtattribute und alle 20
  unterstützten NAF-Viewpoints mit unabhängigen gültigen Architekturen geprüft.
  Negative Fälle prüfen falsche Richtungen/Typkombinationen, fehlende Referenzen
  und Allokationen sowie ungültige Sichttypen. Offline-UAF-Start und Live-
  Fehlerkorrektur im Browser geprüft. Keine externe Konformitätszertifizierung.
- Alle 11.255 Icon-/Aliasnamen registriert und als SVG gerendert; Originale und
  Lizenzen gegen SHA-256 geprüft. Der Browser vergleicht 17 kritische Icons
  rasterisiert mit den Original-SVGs (Füllregeln, Kreise, Referenzen, Transformationen).
  Packgalerie, JSON-Download und Icon-Beispiel auch per `file://` geprüft.
- Text- und Pfadbegrenzungen sowie lange Texte/Unicode/eigene Stereotypen in
  allen zwölf Nicht-Container-Templates bei Mindestbreite geprüft.
- Live-Editing, Entwurfswechsel, Fehlermeldungen und Wiederherstellung, Ansichten,
  Zoom, Farbschema, Hilfedialog, Markdown und idempotentes `renderAll` geprüft.
- SVG-/Quelltextdownloads inhaltlich geprüft. Desktop und 390-Pixel-Mobillayout
  geprüft, keine horizontale Seitenüberbreite. Screenshots visuell kontrolliert.
- Direkter Start per `file://` erfolgreich, keine externen HTTP-Anfragen und keine
  JavaScript-Fehler. Chromium ist der automatisiert geprüfte Browser; weitere
  Browser-Engines wurden nicht separat geprüft.

Bewusste Grenzen: kein vollständiger CommonMark-Parser, kein globaler
Kantenkreuzungsoptimierer, keine interaktive Drag-and-drop-Änderung des Modells,
keine dauerhafte Speicherung im Editor. Änderungen lassen sich als Quelltext
herunterladen. Sehr große Ansichten sollten in kleinere Views aufgeteilt werden.
Pfadbegrenzungen sind konservativ, insbesondere bei freien Bögen/Bezierkurven;
dadurch kann zusätzlicher Leerraum entstehen. Das Original `USERSPEC.md` bleibt
unverändert. Das Arbeitsprotokoll steht in `PROGRESS.md`.

## Erweiterte Diagrammrenderer

View-Syntax: `diagram TYPE { OPTION WERT … }`; Listen werden als `[ID, ID]`
angegeben. Ohne Einstellung gilt weiterhin `connected`. Zusätzlich sind
`sequence`, `state`, `activity`, `matrix`, `heatmap`, `timeline`, `class` enthalten.
Das JSON-Modell speichert die Einstellung in `view.diagram: { type, … }`.
Die existierenden APIs wählen weiterhin die View über `options.view`.

Parser und generische Validierung weisen unbekannte Typen/Einstellungen,
ungültige Referenzen und lokale Diagrammfehler zurück. Profilregeln bleiben
wirksam. Die spezialisierten Layouts liefern Bounds und semantische Knoten/
Beziehungen; deren Kanten sind keine gerouteten Connected-SVG-Pfade.
`place` und `route` sind bei Spezialdiagrammen nicht erlaubt.

`src/diagrams.js` implementiert die unabhängigen Layouts und sicheren SVG-
Primitive. Geordnete Nachrichten, Kontrollknoten/Lanes, gerichtete Matrixzählung,
hierarchische Wertkacheln, UTC-Zeitintervalle/Meilensteine sowie explizit
zugeordnete Klassenbereiche/Ports werden unterstützt. Keine neuen Abhängigkeiten.
Vollständige Syntax, Defaults, Prüfregeln und bewusste semantische Grenzen
stehen in [DIAGRAMS.md](DIAGRAMS.md). Das Beispiel `examples/diagrams.arch` enthält
sieben Views. Es gibt keine automatische vollständige UML-/BPMN-/NAF-Konformität.

Die Klassenansicht verwendet 380 Einheiten breite Karten mit abgerundeten Ecken,
zum Theme passenden Schatten, abgesetztem Kopfbereich, Anzahl-Badges pro Detailbereich
und Monospace-Signaturen. Die Höhe wächst mit den Einträgen; Ports bleiben
als Beziehungsendpunkte am Kartenrand sichtbar.
