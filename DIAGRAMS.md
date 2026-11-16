# Diagramme und Visualisierungen

`index.html` öffnen und **Seven diagram renderers** auswählen. Das editierbare
[Beispiel](examples/diagrams.arch) enthält sieben Ansichten desselben Modells.
Alle Renderer sind in `arch.js` / `arch.min.js` enthalten. Diese Browserbundles
benötigen keine zusätzlichen Laufzeitscripts und funktionieren auch über
`file://`. Direkte Node-Quellimporte verwenden die npm-Abhängigkeiten aus
`package.json`.

Eine View wählt ihren Renderer mit `diagram TYPE { … }`. Ohne diese Angabe
bleibt die bisherige Darstellung `connected` aktiv. Modell, Profil und
Viewpoint-Validierung bleiben für alle Renderer wirksam. Die Diagrammwahl
ersetzt keine fachliche Profildefinition.

Dieselben Einstellungen sind in der [JSON-Syntax](JSON.md) verfügbar, etwa
`"diagram": { "type": "sequence", "participants": ["operator", "api"] }`.
Rendererabhängige Einschränkungen gelten für beide Eingabeformen identisch.

Zusätzlich kann eine View die Architekturquelle statt eines Diagramms anzeigen:
`view source "JSON" { @meta json }` oder `@meta dsl`. Quellenviews sind Teil
derselben Renderauswahl und des gemeinsamen SVG-Exports, aber keine fachliche
Diagrammnotation. Nur Format und Theme gelten; keine Filter, Viewpoints oder
Layout-/Styleoptionen. Beispiel und Regeln: [META.md](META.md),
[meta.arch](examples/meta.arch).

```arch
architecture "Mission request" {
  model {
    person operator "Operator"
    service api "Mission API"
    relation request operator -> api "Create mission"
    relation response api -> operator "Accepted"
  }
  view interaction "Mission creation" {
    diagram sequence {
      participants [operator, api]
      messages [request, response]
      returns [response]
    }
  }
}
```

Darstellung über die vorhandene API:

```js
const model = arch.parse(source);
const graph = arch.layout(model, { view: 'interaction' });
const svg = arch.renderToString(model, { view: 'interaction', theme: 'dark' });
arch.render('#diagram', model, { view: 'interaction' });
```

`layout()` liefert auch bei Spezialdiagrammen `bounds`, sichtbare `nodes` und
`edges`. Diese Beziehungen sind semantische Daten; sie besitzen nicht den
`d`-/Routing-Vertrag des Connected-Layouts. Interne Hilfsdaten im Layoutobjekt
sind keine zusätzliche öffentliche Schnittstelle. SVG ist das Exportformat.
Markdown-/DOM-Adapter verwenden dieselben Renderer.

Mit `config { views all }` können Connected- und Spezialviews gemeinsam
untereinander erscheinen; `views [interaction, overview]` bestimmt eine
Teilmenge und Reihenfolge. API-Priorität und vollständiges Beispiel:
[HELP.md](HELP.md#eine-mehrere-oder-alle-views-rendern),
[multiple-views.arch](examples/multiple-views.arch).
Bei mehreren Views liefert `layout()` einen Verbund mit `kind: 'views'`;
die einzelnen Layouts stehen in `layouts`, ihre Positionen in `sections`.
Die vereinigten `nodes`/`edges` ersetzen nicht die viewlokale Geometrie.

## Sequenz: `sequence`

- `participants [ID, …]`: Reihenfolge der Lebenslinien; Standard: sichtbare
  Knoten in Modellreihenfolge.
- `messages [RELATION_ID, …]`: zeitliche Reihenfolge; Standard: sichtbare
  Beziehungen in Modellreihenfolge. Bei expliziter Liste werden nur diese
  Nachrichten gezeichnet. Eine Beziehung kann nur einmal vorkommen;
  wiederholte Aufrufe benötigen eigene Beziehungs-IDs.
- `returns [RELATION_ID, …]`: gestrichelte Rückgaben.
- `asyncMessages [RELATION_ID, …]`: asynchrone Nachrichten mit offenem Pfeil.
- Andere Nachrichten sind synchron und erhalten eine kurze Aktivierungsmarkierung
  am Empfänger. Selbstnachrichten werden als Schleife dargestellt.

Beide Endpunkte jeder Nachricht müssen als Teilnehmer enthalten sein. Rückgaben
und asynchrone Nachrichten müssen in der Nachrichtenauswahl vorkommen und dürfen
sich nicht überschneiden. Die kurzen Aktivierungsmarkierungen sind keine
vollständige Berechnung von Ausführungsintervallen. Interaktionsfragmente wie
`alt`, `loop`, `par`, Objekterzeugung und -zerstörung sind noch nicht enthalten.

## Zustand: `state`

```arch
diagram state { initial start finals [end] }
```

Sichtbare Elemente bilden Zustände oder explizit ausgewählte Pseudoknoten,
Beziehungen bilden gerichtete Übergänge. `initial` und `finals` markieren
Initial-/Endpseudoknoten; sie ersetzen deren normale Karte durch die entsprechende
Notation. Anfangs- und Endknoten müssen verschieden sein. In den Initialknoten
darf kein Übergang hineinführen, aus Endknoten keiner hinausführen.

Übergangstitel können Ereignisse/Guards dokumentieren. Schleifen werden
gezeichnet. Hierarchische/orthogonale Zustände, History-Pseudoknoten,
Entry-/Exit-Aktionen und ausführbare Zustandsautomaten sind noch nicht enthalten.

## Aktivität / Swimlanes: `activity`

```arch
diagram activity {
  lanes [operations, crew]
  laneAttribute owner
  initial start
  finals [end]
  decisions [decision]
  forks [split]
  joins [merge]
}
```

Alle Listen sind optional. `lanes` sind sichtbare Modellknoten, deren Titel die
Verantwortungsbereiche beschriften. Alle anderen sichtbaren Knoten benötigen
bei vorhandenen Lanes eine Zuordnung über das Attribut `owner` oder das mit
`laneAttribute` gewählte Feld. Dieses Feld muss das verwendete Profil erlauben;
empfohlen ist eine typisierte Referenz. Lane-Knoten sind keine Ablaufendpunkte.
Ohne Lanes entsteht ein Aktivitätsdiagramm ohne Verantwortungsbereiche.

Aktivitäten werden in Modellreihenfolge angeordnet. Entscheidungen erhalten
Rauten und benötigen mindestens zwei ausgehende Beziehungen. Forks und Joins
werden als Balken dargestellt und benötigen mindestens zwei Ausgänge bzw.
Eingänge. Ein Element darf nur eine dieser Kontrollknotenarten besitzen.
Start/Ende verhalten sich wie im Zustandsdiagramm. Kantenbeschriftungen können
Bedingungen dokumentieren. Die Darstellung ist keine vollständige BPMN-
Implementierung und simuliert keine Tokens, Guards oder Parallelität.

## Beziehungs-/Traceability-Matrix: `matrix`

```arch
diagram matrix {
  rows [serviceA, serviceB]
  columns [capabilityA, capabilityB]
  relations [supports, implements]
}
```

Zeilen und Spalten sind geordnete Listen sichtbarer Knoten; ohne Angabe werden
alle sichtbaren Knoten verwendet. Eine Zelle zählt gerichtete Beziehungen vom
Zeilenelement zum Spaltenelement. Mehrere Beziehungen werden als Anzahl
angezeigt; Tooltips enthalten ihre Typen und Beschriftungen. `relations` filtert
nach Relationstypen einschließlich Untertypen. Ohne Filter zählen alle Typen,
eine leere Filterliste zählt keine. Höchstens 100 Zeilen und 100 Spalten.

Die Matrix zeigt direkte Beziehungen; transitive Erreichbarkeit, interaktive
Zellnavigation und automatische Aggregation von Hierarchieebenen bleiben offen.

## Capability Map / Heatmap: `heatmap`

```arch
diagram heatmap {
  valueAttribute maturity
  parentAttribute parentCapability
  min 0
  max 5
  colorLow "#fee2e2"
  colorHigh "#16a34a"
}
```

`valueAttribute` ist verpflichtend und benennt ein numerisches Modellattribut.
Der Wertebereich ist standardmäßig 0–5; `min < max` muss gelten. Vorhandene Werte
müssen endlich sein und im Bereich liegen. Fehlende Werte werden neutral mit
`—` dargestellt. Die Legende zeigt die Skala. Niedrige/hohe Farben sind als
Hexwerte oder CSS3-Farbnamen konfigurierbar; Zwischenfarben werden linear interpoliert.

`parentAttribute` referenziert einen sichtbaren Elternknoten. Ohne diese Option
wird die vorhandene Containerhierarchie genutzt. Eltern werden als übergeordnete
Kacheln mit eingebetteten Kindern dargestellt; der Platz richtet sich nach der
Anzahl der Blätter. Zyklen, unsichtbare Eltern und mehr als 32 Verknüpfungen in
einer Elternkette sind Fehler. Elternwerte werden nicht aus Kindern berechnet.
Die Wertfarbe ersetzt in dieser Ansicht die semantische Bereichsfarbe;
Füllungen verwenden standardmäßig `fill-opacity="0.2"`; ein View-`style` mit
`opacity` kann dies pro Kachel überschreiben. Größenkodierung nach Geschäftswert
und mehrere Bewertungsdimensionen sind noch nicht enthalten.

## Zeitachse / Gantt / Migrationsroadmap: `timeline`

```arch
diagram timeline { startAttribute start endAttribute end }
```

Jeder sichtbare Knoten benötigt ein Start-/Enddatum über die konfigurierten
Attribute (Standard: `start`, `end`). ISO-Kalenderdaten oder ISO-Datumszeiten mit
Zeitzone werden akzeptiert. Für zusätzliche Schema-Prüfungen sollten die Felder
im Profil mit `format date` oder `format date-time` definiert werden.
Start muss vor oder gleich Ende liegen. Gleiche Werte erzeugen einen
Meilenstein, Zeiträume einen Balken. Beziehungen werden als Abhängigkeiten
gezeichnet. Zeilen folgen der Modellreihenfolge; die Achse wird aus den Daten
gebildet und in UTC beschriftet. Auch Zeiträume mit nur einem Datumstag bleiben
sichtbar. Es gibt noch keine Terminplanung, Ressourcenberechnung, kritischen
Pfade, Ist-/Soll-Baselines oder persistente Modellversionierung.

## Klassen-/Detailansicht: `class`

```arch
diagram class {
  attributes [identifier, status]
  methods [launch]
  functions [allocate]
  interfaces [contract]
  ports [port]
  parameters [target]
  ownerAttribute owner
  signatureAttribute signature
}
```

Die Listen enthalten IDs eigenständiger Modellelemente. Das Profil legt ihre
fachlichen Typen und zulässigen Attribute fest. `ownerAttribute` (Standard:
`owner`) ordnet Details ihrem sichtbaren Hauptelement zu. Parameter gehören zu
einer ausgewählten Methode/Funktion. Alle übrigen ausgewählten Knoten werden
als Hauptkarten gezeichnet. Ein Detail darf nur in einer Bereichsliste stehen.

`signatureAttribute` (Standard: `signature`) liefert den darzustellenden Text;
ohne dieses Attribut gilt der Titel. Zugeordnete Parameter werden in leere
Klammern der Signatur eingesetzt oder angehängt. Eine Signatur ist
Darstellungstext, kein ausführbarer Ausdruck oder geparster Programmiertyp.

Für vorhandene Eigenschaftswerte am Hauptelement dient die getrennte Option
`propertyFields`. Hier werden Attributnamen statt Modellelement-IDs angegeben:

```arch
diagram class { propertyFields [source, target, conveyed] }
```

Das zeigt beispielsweise die Referenz-IDs einer Needline als eigene
Eigenschaftenzeilen. Skalare Werte und Listen werden dargestellt; fehlende
optionale Werte erzeugen keine Zeile, `0` und `false` bleiben sichtbar.
Unbekannte Namen und Duplikate werden zurückgewiesen. Eigenschaftsnamen müssen
zu einem sichtbaren Knotenschema gehören oder öffentliche Felder wie `title`
und `description` sein. Die Darstellung erzeugt keine zusätzlichen Beziehungen.

Die Karten verwenden abgerundete Ecken, dezente Schatten, einen abgesetzten
Kopfbereich sowie Monospace-Signaturen. Detailbereiche besitzen feine Trennlinien
und Anzahl-Badges. Die Gestaltung passt sich beiden Themes und semantischen
Hintergrundfarben an.

Die Karten enthalten getrennte Bereiche für Attribute, Methoden, Funktionen,
Interfaces und Ports. Ports erhalten zusätzlich kleine Quadrate am Rand und
können Beziehungsendpunkte sein. Ihre vollständige Verbindungskompatibilität
muss das Profil definieren. Interface-Listen ersetzen keinen vollständigen
Provided-/Required-Interface- oder Lollipop-Renderer. Beziehungen zwischen
Hauptkarten und Ports werden gezeichnet; Verbindungen zwischen beliebigen
anderen Details werden nicht zusätzlich gezeichnet. Keine automatische
Übernahme sämtlicher UML-Eigentumsregeln oder vollständige Klassendiagramm-
Konformität.

## Gemeinsame Regeln und Grenzen

Connected-Views können über `referenceDisplay nodes` referenzierte Elemente
als Karten mit Pfeilen zur tragenden Beziehung darstellen. `labels` verwendet
Referenztext, `both` kombiniert beides; ohne View-Override gilt die
Relationsvorgabe. `style ID { display logo icon "lucide.plane" }` reduziert
ein Nicht-Container-Element auf Rechteck und Logo.

Die Darstellungsoptionen sind nicht zwischen allen Renderern austauschbar:

| Funktion | Connected | Spezialrenderer |
| --- | --- | --- |
| Gemeinsames Modell, Profil-/Viewpoint-Regeln, `include`/`exclude` | Ja | Ja, zusätzlich diagrammspezifische Strukturprüfungen |
| Theme, SVG und Auswahl mehrerer Views | Ja | Ja |
| `place`, `route`, `routes` | Ja | Abgewiesen; Diagrammtyp und Listen/Reihenfolgen bestimmen das Layout |
| `referenceDisplay nodes/both`, `referenceOccurrences`, Zuordnungsrouten | Ja | Abgewiesen; keine grafischen Referenzkarten |
| `display logo`, Node-`iconPosition`, `showIcon`/`showLabel` und weitere Feldschalter | Ja | Abgewiesen |
| Node-`fontSize`, `width`, `height` im Style | Ja, Größen sind Mindestwerte | Abgewiesen; eigene Maße je Renderer |
| Template-/Iconwahl | Vorhandene Templates und registrierte Icons | Nicht als Connected-Templates/Icons dargestellt; die Spezialnotation bestimmt die Form |
| Hintergrund-/Akzentfarben und `opacity` | Im Node-/Package-Style | Je nach gezeichnetem Primitive: Karten und Timeline-Balken verwenden Hintergrund/Fülltransparenz; Heatmap verwendet ihre Wertskala, Klasse zusätzlich Akzente. Keine allgemeine Übertragung aller Styles. |

`showLabel` bedeutet bei einem Connected-Node nur den Titel, bei einer Route
deren Labeltext. Stereotyp, Beschreibung, Technologie und Icon haben eigene
Schalter. `label none` an einer Route entfernt dagegen den gesamten Labelrahmen
mit Text und Icon. Syntaxbeispiele stehen in [HELP.md](HELP.md).

- `include` wählt aus; `exclude` entfernt Elemente einschließlich ihrer
  Nachkommen und hat immer Vorrang. Beziehungen mit ausgeblendeten Endpunkten
  verschwinden. Container-Vorfahren werden nur für überlebende Auswahlen ergänzt.
  Fachliche Viewpoint-Pflichten werden auf die verbleibende Ansicht angewendet.
  Referenzen der
  Diagrammkonfiguration müssen in der View sichtbar sein. Die Wahl eines
  Renderers fügt keine Elemente automatisch hinzu.
- Jeder Diagrammtyp hat eigene erlaubte Einstellungen. Unbekannte Felder,
  ungültige Farben/Listen und doppelte IDs sind Fehler. `validate()` meldet
  Diagrammfehler; Parse/Layout/Rendering weisen ungültige Eingaben zurück.
- `place` und `route` gehören zum Connected-Renderer und sind in Spezialansichten
  nicht zulässig. Deren Layout ist durch Diagrammtyp und Reihenfolgen bestimmt.
- Fachliche Typen bleiben unverändert. Die Spezialnotation bestimmt die Form;
  die bisherigen grafischen Templates und Iconwahl werden dort nicht verwendet.
  Profil-/View-Hintergrundfarben gelten für Karten und Timeline-Balken;
  `style ID { opacity 0.5 }` steuert deren Fülltransparenz zwischen 0 und 1. Die
  Heatmap verwendet ihre Wertskala. Themes und SVG-Ausgabe sind eigenständig.
- Lange Beschriftungen werden umgebrochen; allgemeine Labels zeigen höchstens
  zwei Zeilen mit Ellipse. Tooltips enthalten den vollständigen Text.
  Klassenbereiche wachsen für mehrzeilige Details mit. Große Diagramme können
  gezoomt, als SVG exportiert oder in kleinere Views aufgeteilt werden.
- Die Renderer verbessern die Darstellung und enthalten die genannten lokalen
  Strukturprüfungen. Sie schließen die offenen UAF-/NAF-Metamodellregeln nicht
  automatisch und ändern die dokumentierte Fachprofil-Teilabdeckung nicht.

Für detaillierte UML-Interaktionen, ausführbare Prozessmodelle oder automatische
Layoutoptimierung gelten die hier beschriebenen Grenzen. Die Einordnung
gegenüber Mermaid, PlantUML, Graphviz und D2 steht in
[COMPARISON.md](COMPARISON.md); noch nicht implementierte Funktionen stehen in
[ROADMAP.md](ROADMAP.md).

## Verifizieren

`npm run check` baut beide Bundles und prüft alte wie neue Beispiele.
`tests/diagrams.test.mjs` enthält positive und negative Fälle für alle sieben
Renderer, beide Themes, Profilvalidierung, Escaping, Snapshot-Isolation und
Bundle-Gleichheit. Browserprüfungen testen alle sieben Ansichten in beiden
Themes auf abgeschnittene SVG-Inhalte sowie Live-Fehlerkorrektur. Screenshots
liegen unter `test-results/diagram-*-light.png` bzw. `*-dark.png`.
