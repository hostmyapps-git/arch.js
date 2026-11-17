# arch.js

Eine lesbare Architektursprache mit äquivalenter JSON-Eingabe und eigenständigem Inline-SVG-Renderer. Modelle
und Ansichten sind getrennt: ein Modell, mehrere Darstellungen, automatische
Layouts oder freie Positionen bis zum einzelnen SVG-Kantenpfad.

arch.js eignet sich für versionierte Architekturmodelle, deren Elemente in
mehreren Views wiederkehren und gegen eigene Fachregeln geprüft werden sollen.
JSON-Profile beschreiben Typen und Regeln; die Darstellung bleibt viewlokal.
Browserbundles rendern lokal, Node liefert dieselbe SVG-Ausgabe.

Die Layoutautomatik und Spezialnotationen haben einen begrenzten Umfang;
UAF-/NAF-Profile sind keine vollständige Konformitätsprüfung. Vorteile, Grenzen
und die Einordnung gegenüber **Mermaid.js, PlantUML, Graphviz und D2/D2.js**:
[COMPARISON.md](COMPARISON.md).

Dokumentation: [Sprach-/API-Spezifikation](SPEC.md), [JSON-Format](JSON.md), [Meta-View](META.md), [Hilfe und Rezepte](HELP.md),
[Diagrammrenderer](DIAGRAMS.md), [Profildefinitionen](profiles/README.md),
[Iconformate](icons/README.md), [Prüfstand](PROGRESS.md), [Roadmap](ROADMAP.md).

## Sofort ausprobieren

`index.html` im Browser öffnen. Die gebauten Dateien sind bereits enthalten;
Installation und Server sind dafür nicht erforderlich. Die Beispieloberfläche
bietet dreizehn editierbare Modelle mit 48 Ansichten, die eingebaute Hilfereferenz, Live-Vorschau, Zoom,
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

Mit `exclude data` innerhalb der View lassen sich Elemente ausblenden.
`exclude` gewinnt immer gegenüber `include` und entfernt bei Packages auch die
Nachkommen. Beziehungen zu ausgeblendeten Elementen verschwinden ebenfalls.
Das Beispiel **Start from scratch** zeigt dies in seiner zweiten Ansicht.
Farben akzeptieren auch alle CSS3-Farbnamen, beispielsweise:

```arch
style backend { backgroundColor Gold accent SlateBlue opacity 0.45 }
```

`opacity` steuert nur die Füllung (0–1); Schrift und Rahmen bleiben deckend.

Packages dürfen weitere Packages enthalten (bis zu 32 Ebenen). Ihre IDs werden
wie andere Nodes per `style` gestaltet, einschließlich `backgroundColor`,
`opacity`, `fontSize`, `width`/`height` und `iconPosition`. Größen sind Mindestgrößen;
der Inhalt kann den Container vergrößern. Eigene Profile steuern erlaubte Kinder
über `contains`. Beispiel: [bidirectional.arch](examples/bidirectional.arch).

## Bidirektionale Beziehungen und Entwürfe

```arch
relation exchange a <-> b "Exchange" { type flow }
```

`<->` beschreibt eine Beziehung mit gemeinsamer ID, Beschriftung und Attributen.
Das Profil muss `directions [forward, both]` erlauben. Im Standardprofil gilt
dies für `flow`, `dependency`, `access` und `association`. Neue eigene
Relationstypen erlauben standardmäßig nur `forward`. Details: `@help model`,
`@help relations . TYPE` und [Profilformat](profiles/README.md).

```arch
config { profile naf41-uaf validation draft }
```

`validation draft` erlaubt das Rendern unvollständiger Modelle: fehlende
Pflichtattribute, Viewpoints, erforderliche Typen/Beziehungen und unterschrittene
Verbindungs-Mindestzahlen erscheinen unter dem Diagramm als Hinweise, auch im
SVG-Export. Unbekannte/abstrakte Typen, ungültige Werte/Referenzen, überschrittene
Höchstzahlen, Zyklen sowie Syntax-/Strukturfehler bleiben blockierend.
Standard ist `validation strict`; die API-Option `validation` überschreibt die
Konfiguration. `validate()` liefert bei einem unvollständigen Entwurf
`valid: true`, `conformant: false` und `warning`-Diagnosen.
Beispiel: [draft.arch](examples/draft.arch).

## Nodes und Kanten gestalten

Eine ganze Beziehung wird innerhalb der gewünschten View ausgeblendet mit
`style EDGE_ID { display none }`; `display standard` zeigt sie wieder.
Linie, Label/Icon und Zuordnungspfeile verschwinden. Das Modell und seine
Profilregeln bleiben vollständig; die ausgeblendete Beziehung zählt weiterhin
für Kardinalitäten. Andere Kantenoptionen stehen im `route`-Block.

Dasselbe gilt für Nodes: `style NODE_ID { display none }` entfernt die Karte
und ihre angrenzenden Kanten. Bei Packages verschwinden auch alle Nachkommen;
`include` hebt dies nicht auf. Die Einstellung gilt für alle Diagrammrenderer
und wird in JSON als `style.NODE_ID.display: "none"` beschrieben. Die gesamten
Modell-/Profilregeln bleiben erhalten; `display standard` stellt die normale
Darstellung in dieser View wieder her.

Innerhalb einer Connected-View, beispielsweise der obigen View `detail`:
Die vorhandenen `style api`- und `route reads`-Blöcke dabei durch diese ersetzen.

```arch
style api {
  icon core.cloud iconPosition right
  showStereotype false showDescription false showTechnology false
  fontSize 16 width 280 height 160
}
routes { curve straight icon core.cloud iconPosition top showLabel false }
route reads { showLabel true iconPosition left }
```

`routes` gibt die gemeinsamen Werte vor; eine konkrete `route` überschreibt
einzelne Eigenschaften unabhängig von der Reihenfolge. Nodes unterstützen
`showIcon`, `showLabel`, `showStereotype`, `showDescription`, `showTechnology`.
`showLabel` schaltet den Titeltext; Typ-/Stereotypzeile und Detailtexte haben
eigene Schalter. `width`/`height` sind Mindestgrößen, keine feste Textbegrenzung.

An Kanten wählen `showIcon` und `showLabel` Icon und Text getrennt aus.
`label none` blendet das gesamte Relationslabel einschließlich Icon aus;
`icon none` entfernt nur das Icon. `display logo` reduziert einen Node auf
Rechteck und Icon. Diese Optionen gehören zum Connected-Renderer.
Rezepte für gemeinsame InformationElements und deren Zuordnungspfeile:
[HELP.md](HELP.md). Beispiele: [Nodes](examples/node-presentation.arch),
[Kantenlabels](examples/edge-label-visibility.arch),
[Zuordnungsrouten](examples/naf41-walker-routing.arch).


## Dieselbe Architektur als JSON

Die bestehenden APIs akzeptieren neben der DSL auch JSON-Strings und Objekte:

```js
arch.render('#diagram', {
  architecture: {
    name: 'Test',
    config: { views: 'all' },
    model: {
      elements: { api: { type: 'service', name: 'API' } }
    },
    views: { overview: { name: 'Overview' } }
  }
});
```

`name` enthält den Titel, Objektschlüssel sind IDs. `config`, `place`, `style`,
`routes`, `route` und die Diagrammeinstellungen entsprechen der DSL. Packages
können `elements` und `relations` enthalten; Beziehungen referenzieren IDs.
Listen mit `id` pro Eintrag erlauben eine ausdrückliche Definitionsreihenfolge.
JSON wird durch dieselbe Grammatik und dieselben Fachregeln geprüft.

In der Demo **JSON architecture** auswählen oder `@help json` aufrufen.
Vollständige Zuordnung, Inline-Profile, Zuordnungspfeile und API-Beispiele:
[JSON.md](JSON.md). Dateien: [Standardprofil](examples/json-architecture.json),
[NAFv4.1](examples/json-naf41.json). Markdown verwendet dafür weiterhin
`arch`-Code-Fences; gewöhnliche `json`-Fences bleiben Code.

Im View-Menü zeigt **Meta view · JSON/DSL** die jeweils andere Notation.
Syntaxfehler erscheinen mit markierter Quellzeile, JSON-Pfad und
Korrekturkandidaten; konkrete Typkandidaten berücksichtigen das Profil.
Übersetzungen lassen sich kopieren und herunterladen. API:
`arch.translate(source)` und `arch.inspectSource(source)`.
Verhalten und Grenzen: [META.md](META.md), eingebaute Hilfe: `@help meta`.

Für eine Quellenansicht **innerhalb der Architektur und im SVG-Export**:

```arch
view source "Architecture as JSON" {
  @meta json
}
```

Dieser Block steht neben `model` im Architekturblock. `@meta dsl` zeigt die DSL;
`config { views all }` kombiniert Quellen- und Diagrammviews. Die Kurzform
`@meta json` direkt in `architecture` erzeugt eine View mit ID `meta-json`.
Beispiel: [meta.arch](examples/meta.arch).

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

Das separate Profil **`naf41-uaf`** ergänzt alle 47 aktuellen NAFv4.1-Viewpoint-IDs
mit ausführbaren Strukturregeln und englischer Profilhilfe. Es verwendet die
NATO-Ausgabe 2026.03 und berücksichtigt die ADMBw-MDG 2026.05 als Vergleichsquelle.
Das neue Beispiel **NAFv4.1 · Search & Rescue** zeigt neun verknüpfte Ansichten.
Nach dem UAF-Basisscript `profiles/naf41-uaf.js` laden und im Dokument
`config { profile naf41-uaf }` auswählen; `profiles/profiles.js` enthält es bereits.

Die C2-Bezeichnung `Goal` ist als Untertyp von UAF `EnterpriseGoal` verfügbar.
Beide funktionieren mit `SpecifiesGoal` und denselben C2-Regeln. Beispiel:
`Goal coverage "Increase Coverage"` und
`relation goalLink vision -> coverage "Specifies" { type SpecifiesGoal }`.
`@help types naf41-uaf Goal` und `@help connections naf41-uaf Goal` erläutern die
Abbildung. Nach einem Profilupdate auch die Profil-JSON/-Scripts neu laden.

C2 unterstützt alle drei `desires`-Ziele aus dem Cut-out auf S.90:
`DesiresCapability` (Phase → Capability), `DesiresVision` (Phase → Vision)
und `DesiresGoal` (Phase → Goal). Eine direkte Phase→Capability-Verbindung ist
nicht zwingend, wenn die Phase eine Vision oder ein Goal adressiert. Das
[C2-Beispiel](examples/naf41-enterprise-vision.arch) zeigt die Beziehungen von
S.91 als aufwärts wachsende Tree-Gruppe mit externer Capability, vollständigen
Tree und mit manueller, dem PDF ähnlicher Anordnung.
C3 erlaubt reine Generalisierungs-/Gruppierungskontexte: Nicht jede sichtbare
Capability benötigt eine eigene `CapabilityDependency`. Mindestens eine solche
Abhängigkeit bleibt im Anwendungsprofil Pflichtinhalt der View. Das entspricht
dem SAR-Kontext auf S.93, ohne Vollständigkeit aller fachlich relevanten
Abhängigkeiten automatisch behaupten zu können.
C7 behandelt `EffectivenessCriterion` und dessen Untertypen als optionale
Ergänzung ohne pauschale Pflicht zu `CharacterizesCapability`/`EvaluatesCriterion`.
Gewöhnliche AssessmentCriteria behalten die vollständige Pflichtkette.
`EvaluatesCriterion` folgt weiterhin Measure → AssessmentCriterion aus S.98.
Das [vollständige Cr-Beispiel](examples/naf41-capability-roadmap.arch) bildet
S.103 mit Increment, Horizon 2030, IOC/MOC/FOC, `aggregates` und `triggers` nach.
Es ist in der Demo als **NAFv4.1 · Capability Roadmap** verfügbar. Milestones dürfen
wie im PDF implizite Properties sein. Die neuen Phasenbeziehungen sind explizite
Anwendungsadapter; [Abbildung und Migration](profiles/naf41/CR-MAPPING.md) erklären
die Trennung von UAF/ADMBw und die korrigierte Increment-Vererbung.

S1 akzeptiert `Service` als konkreten Untertyp von UAF `ServiceSpecification`,
entsprechend S.104–105. `ServiceGeneralization` führt vom spezialisierten zum
allgemeinen Service, `SatisfiesServicePolicy` vom Service zur Policy.
[Vollständiges S1-Beispiel](examples/naf41-service-taxonomy.arch), auch in der
Demo als **NAFv4.1 · Service Taxonomy**. `ServicePolicy` benötigt weiterhin
`ruleKind`; das Beispiel wählt ausdrücklich `Constraint`.

Anleitung, Abbildung und offene Semantik:
[profiles/naf41/README.md](profiles/naf41/README.md). Hilfebefehl:
`@help viewpoints naf41-uaf C7`. Dies ist ein dokumentiertes Anwendungsprofil,
keine vollständige normative Konformitätsprüfung.

## Markdown und vorhandene Code-Fences

`test.md` enthält lauffähige Beispiele. `arch.renderMarkdown(markdown)` erzeugt
sicheres HTML für Überschriften, Absätze und Code-Fences einschließlich `arch`.
Der kleine Adapter ist bewusst kein vollständiger CommonMark-Parser.

Für einen vorhandenen Markdown-Renderer einfach dessen Codeblöcke rendern:

```js
arch.renderAll(); // pre > code.language-arch und [data-arch]
```

Fehler werden pro Block lesbar angezeigt. Weitere Blöcke werden weiter gerendert.

## Eingebaute Hilfe

Hilfe, generierte Beschriftungen und Fehlermeldungen der Bibliothek sind auf
Englisch. Eigene Modelltexte können in jeder Sprache geschrieben werden.

Ein eigener `arch`-Block kann statt einer Architektur einen Hilfebefehl enthalten:

```arch
@help
```

Weitere Eingaben sind zum Beispiel `@help iconpacks`, `@help profiles`,
`@help types default service` oder `@help diagrams sequence`. Die Hilfe zeigt
gültige Syntax und die tatsächlich registrierten Packs/Profile als Inline-SVG.
`@help connections uaf OperationalPerformer` zeigt erlaubte eingehende und
ausgehende Relationen mit konkreten Gegenstellen und Detailbefehlen.
Der Befehl kann auch als eigene Zeile direkt innerhalb von `architecture`
stehen, zum Beispiel vor `model {}`; er zeigt dann die Hilfe statt des Diagramms.
Iconlisten unterstützen Suche und Seiten: `@help iconpacks tabler "*" 2`.
In JavaScript liefert `arch.help('iconpacks core')` denselben Inhalt als Text.
Alle Befehle und Parameter: [HELP.md](HELP.md). Die Beispieloberfläche enthält
zusätzlich die editierbare **Language reference**.

## Views zum Rendern auswählen

Ohne Auswahl wird die erste View gerendert. Im Architektur-Quelltext kannst du
alle Views oder eine geordnete Auswahl festlegen:

```arch
config { views all }
```

```arch
config { profile naf41-uaf views [overview, detail] }
```

Für genau eine View genügt `config { views detail }`. Mehrere Views erscheinen
mit ihren Titeln untereinander innerhalb eines eigenständigen SVGs. Die Liste
bestimmt die Reihenfolge; `all` verwendet die Reihenfolge der Definitionen.
Ein konkreter API-Aufruf hat Vorrang:

```js
arch.render(container, source, { views: 'all' });
arch.render(container, source, { views: ['detail', 'overview'] });
arch.render(container, source, { view: 'detail' });
```

Priorität: `options.view` → `options.views` → `config.views` → erste View.
Im Dropdown zeigt **Configured views** die Konfiguration; einzelne Views können
weiterhin separat ausgewählt werden. SVG-Download, Markdown und `renderAll`
unterstützen die Auswahl ebenfalls. Beispiel:
[multiple-views.arch](examples/multiple-views.arch). Hilfe: `@help views`, `@help config`.

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
übergeben werden. `registerIconPack()` akzeptiert sowohl konvertierte
arch.js-Packs als auch originale Iconify-JSONs mit `body`, einschließlich
farbiger Logos, Gradienten und Alias-Transformationen. Dein bestehender
Iconpack-Loader kann die Originaldateien direkt übergeben; eine Konvertierung
ist nicht mehr nötig. [Details und Grenzen](icons/README.md).
Format und vollständige API: [SPEC.md](SPEC.md).

## Node.js und Entwicklung

```js
import { parse, renderToString } from './src/arch.js';
const model = parse(source);
const svg = renderToString(model, { view: 'detail', theme: 'dark' });
```

Voraussetzung Node.js >=22. Browserbundles sind eigenständig. Direkte Node-
Importe verwenden die gepinnten XML-/SVG-Pakete aus `dependencies`;
Build-/Browser-Testwerkzeuge bleiben Entwicklungsabhängigkeiten.

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
`profiles/{enterprise-demo,uaf,naf4-uaf,naf41-uaf}.js`. Quell-XMI und Referenz-PDFs sind
lokal enthalten und per SHA-256 festgeschrieben; normale Builds benötigen kein Netz.
Browser-Screenshots landen unter
`test-results/`. Details, Entscheidungen und Prüfergebnisse:
[SPEC.md](SPEC.md), [PROGRESS.md](PROGRESS.md).

## Weitere Diagrammtypen

Neben dem Knoten-Kanten-Renderer sind acht weitere Darstellungen
enthalten: Tree/Taxonomie, Sequenz, Zustand, Aktivität/Swimlanes, Matrix, Capability Map/Heatmap,
Zeitachse/Gantt und Klassenansicht mit Detailbereichen und Ports.

Eine Taxonomie wird automatisch mit zentrierten Eltern über ihren Kindern
angeordnet; Generalisierungen behalten ihre Richtung vom Kind zum Elternteil:

```arch
view c1 "C1" {
    viewpoint C1
    diagram tree {
        relations [CapabilityGeneralization]
        orientation down
    }
}
```

`place` und `route` entfallen in dieser View. `direction down|up|left|right`
(Alias `orientation`) legt die Wachstumsrichtung fest;
`parentDirection auto|source|target` bestimmt den Eltern-Endpunkt.
`levelGap`, `siblingGap`, `showLabels` und `curve` steuern die Darstellung.
Mehrere Bäume und einzelne Nodes sind möglich. Zyklen, mehrere Eltern pro Node,
parallele Hierarchiebeziehungen und bidirektionale Hierarchien werden abgewiesen.
Andere Beziehungen lassen sich über `relations` filtern oder per `display none`
ausblenden. Nodes unterstützen ihre vorhandenen Styles. In der Demo:
**Capability taxonomy**, Quelle: [taxonomy.arch](examples/taxonomy.arch).
Hilfe: `@help diagrams tree`.

Für gemischte Ansichten kann eine Connected-View einzelne Trees enthalten:

```arch
tree hierarchy {
    nodes [horizon, vision, manpower, coverage, response]
    direction up
}
place hierarchy at (300, 0)  // optional: gesamte Gruppe
place maritime at (0, 250)  // optional: externe Karte
```

Mehrere Gruppen mit eigener Richtung sind möglich. Die übrigen Nodes und
Beziehungen bleiben erhalten und frei positionierbar; ohne `place` werden sie
automatisch angeordnet. Mitglieder werden ausschließlich durch den Tree
positioniert. Gruppen sind unsichtbare Layoutbereiche, keine Modell-Packages.
Syntax und Grenzen: [DIAGRAMS.md](DIAGRAMS.md), Hilfe: `@help views`.

`place` unterstützt auch Koordinatenreferenzen mit `+`, `-`, `*` und `/`:

```arch
place maritime at (coverage.x + 20, vision.y - 40)
place maritime at (hierarchy.x - maritime.width - 80, vision.centerY - maritime.height / 2)
```

Verfügbar sind `.x`, `.y`, `.width`, `.height`, `.right`, `.bottom`, `.centerX`
und `.centerY` sichtbarer Nodes oder Tree-Gruppen derselben View. Automatische
Tree-Mitglieder sind ebenfalls referenzierbar. Die Reihenfolge der `place`-Zeilen
ist beliebig; Zirkelbezüge werden mit ihrer Koordinatenkette gemeldet.
Automatisches Layout erfolgt zuerst, Referenzpositionierung danach, Kantenrouting
zuletzt. Manuelle Ergebnisse lösen keine erneute Kollisionsvermeidung aus.
JSON erhält Ausdrücke als Strings. Details: `@help routing`.
Punktrechnung geht vor Strichrechnung; Klammern sind möglich. Division durch null
und nichtendliche Rechenergebnisse werden als Fehler gemeldet.

Auch `via` akzeptiert diese Berechnungen:

```arch
route requires {
    from left to right
    via (vision.x - 40, vision.centerY),
        (maritime.right + 40, maritime.centerY)
    curve rounded
}
```

Das funktioniert ebenfalls in `routes`-Vorgaben und bei Zuordnungslinien wie
`route information -> requires`. Die Punkte verwenden die endgültigen absoluten
Diagrammkoordinaten, auch innerhalb von Packages. JSON bewahrt die Ausdrücke
als Strings. Endpunkt- und Labelpositionen bleiben numerisch.

In `index.html` zeigt **Seven diagram renderers** alle sieben Ansichten.
Eine View wählt beispielsweise `diagram sequence { messages [request, response] }`.
Syntax, Konfiguration und genaue Grenzen: [DIAGRAMS.md](DIAGRAMS.md).

Properties auf normalen Karten erlauben weiterhin freie Positionierung und Routing:

```arch
propertyFields [expression, unit, value]
style timeToFind { propertyFields [expression] width 340 }
place timeToFind at (0, 0)
place elapsed at (timeToFind.x, timeToFind.bottom + 80)
```

Das sind Anweisungen innerhalb einer Connected-View für vorhandene Nodes.
Die Auswahl gilt auch für Tree-Karten und Package-Header. Jede Karte zeigt
vorhandene Werte, einschließlich 0, false und Listen. Node-Style überschreibt
View-Auswahl, diese das Diagramm; `propertyFields []` leert die Auswahl.

Class-Karten behalten ihre gegliederten Bereiche und unterstützen ebenfalls
`place`, berechnete Koordinaten und Mindestgrößen:

```arch
diagram class { propertyFields [expression, unit, value] }
place timeToFind at (0, 0)
place elapsed at (timeToFind.right + 80, timeToFind.y)
```

Class-Ports bewegen sich mit ihrem Owner; Details werden nicht einzeln platziert.
Class-Kanten bleiben automatisch. `route`/`routes`/`via`, Tree-Gruppen und grafische
Zuordnungslinien bleiben Connected vorbehalten. Vollständiges C5-Beispiel mit
beiden Varianten: [property-fields.arch](examples/property-fields.arch).
Hilfe: `@help styles`, `@help diagrams class`.
Weiterführende Funktionen stehen in [ROADMAP.md](ROADMAP.md).

## Grenzen

Das deterministische Schichtenlayout eignet sich für kleine bis mittlere
Architekturansichten. Es optimiert Kantenkreuzungen nicht global. Für präzise
Kompositionen stehen manuelle Koordinaten, Ports, Wegpunkte und SVG-Pfade bereit.
Maximal 1000 Elemente, 4000 Beziehungen und 32 Package-Ebenen pro DSL-Dokument.
Diese Parsergrenzen sind keine Leistungszusage. Keine vollständige
NAF-/UAF-/ArchiMate-/UML-Implementierung, kein nativer PNG-/PDF-Export, keine
DSL-Modulimports und kein mitgelieferter Rendering-CLI. Die Oberfläche speichert
Änderungen nur während der Sitzung; Quelltext zum Aufbewahren herunterladen.

`validate()` prüft Modell- und Viewregeln; Icons und freie SVG-Pfade können erst
beim Rendern fehlschlagen. `renderAll` isoliert Fehler pro Codeblock;
`renderToString`, `render` und `renderMarkdown` reichen Fehler an den Aufrufer
weiter. Einbettungen sollten sie abfangen. Details: [SPEC.md](SPEC.md).
Vollständige Einordnung und Alternativen: [COMPARISON.md](COMPARISON.md).

Gemeinsame Kantenabschnitte lassen sich in Connected-Views aktivieren:

```arch
routes { sharePath stereotypes }
route special { sharePath none }
```

`stereotypes` bündelt nur exakt gleiche Relationstypen mit gemeinsamem Start-
oder Zielknoten; `all` erlaubt auch verschiedene Typen mit kompatibler Darstellung.
Standard ist `none`. Die Bündelung funktioniert auch in benannten Tree-Gruppen,
behält einzelne Labels/Icons und benötigt freien Platz. Manuelle `via`/`path`
und `straight`/`bezier` bleiben unabhängig; gemeinsame Junctions sind rechtwinklig.
Siehe [C8-Beispiel](examples/shared-paths.arch) und `@help routing`.
Das Profil `naf41-uaf` akzeptiert darin `Constraint` entsprechend S.101 der
NAFv4.1 als Untertyp von `StrategicConstraint`.

Linienstile für Connected-Routen (auch benannte Tree-Gruppen) sind viewlokal:

```arch
routes { color "#64748b" width 2 dasharray [8, 4] }
route cr.6 { color red width 3 dasharray none }
```

Einzelrouten überschreiben Vorgaben feldweise. Linie und Pfeilspitzen werden
gemeinsam gefärbt; Label-/Iconfarben bleiben erhalten. `dasharray none` macht
die Linie durchgezogen. Zuordnungslinien unterstützen dieselben Felder.
Unterschiedliche Farben/Breiten/Muster verhindern gemeinsame `sharePath`-Abschnitte.
[Beispiel](examples/route-styles.arch), Demo **Route line styles**, `@help routing`.
