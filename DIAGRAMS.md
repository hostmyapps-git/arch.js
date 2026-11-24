# Diagramme und Visualisierungen

`index.html` öffnen und **Seven diagram renderers** auswählen. Das editierbare
[Beispiel](examples/diagrams.arch) enthält sieben Ansichten desselben Modells.
**Capability taxonomy** ergänzt zwei automatisch angeordnete C1-Baumansichten
aus [taxonomy.arch](examples/taxonomy.arch).
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
`edges`. Beim Tree-Renderer enthalten Beziehungen wie im Connected-Layout
SVG-Pfade, Punkte und Labelmaße; die übrigen Spezialrenderer liefern semantische
Beziehungen ohne diesen `d`-/Routing-Vertrag. Interne Hilfsdaten im Layoutobjekt
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

## Taxonomie / Baum: `tree`

```arch
view taxonomy "Capability Taxonomy" {
  viewpoint C1
  diagram tree {
    relations [CapabilityGeneralization]
    parentDirection auto
    orientation down
    levelGap 96
    siblingGap 48
    padding [24, 56, 32, 16]
    curve rounded
    showLabels true
    sharePath stereotypes
  }
}
```

`relations` ist optional und wählt Hierarchiebeziehungen anhand ihrer Typen samt
Untertypen aus. Andere Beziehungen werden in dieser View weggelassen; sichtbare
Nodes ohne Hierarchiebeziehung bleiben als einzelne Bäume erhalten. Ohne Filter
bilden alle sichtbaren Beziehungen die Hierarchie.

- `parentDirection auto` (Standard): Bei Zeichenstil `generalization` ist das
  Ziel der Elternknoten, sonst die Quelle. `source` oder `target` überschreibt
  dies für alle ausgewählten Beziehungen. Die Modellrichtung und ihre Marker
  bleiben erhalten: Eine Generalisierung zeigt weiterhin vom Kind zum Elternteil.
- `direction down` (Standard), `up`, `right` oder `left`: Anordnung vom Elternteil
  zu den Kindern; Wurzeln stehen entsprechend oben, unten, links oder rechts.
  `orientation` ist ein Alias; nicht beide gleichzeitig setzen. Diese Einstellung
  gehört in den Tree-Block, unabhängig vom View-`direction` und der Pfeilrichtung.
- `levelGap` / `siblingGap`: Mindestabstände in SVG-Einheiten, jeweils 16–800;
  Standard 96/48. Unterschiedliche Kartengrößen und Kantenlabels vergrößern den
  nötigen Platz. Eltern werden über der Mitte des ersten/letzten Kindes
  zentriert. Unterbäume werden anhand ihrer tatsächlich belegten Bereiche je
  Ebene zusammengeschoben: Ein Geschwisterknoten ohne tiefe Nachkommen kann
  freien Platz oberhalb eines breiten Unterbaums nutzen. Karten und automatische
  Labels behalten ihren Mindestabstand; überlappende Nachkommen verhindern ein
  weiteres Zusammenschieben. Geschwister und Wurzeln
  folgen der Elementreihenfolge im Modell.
- `padding 24` setzt dieselbe Außenpolsterung auf allen Seiten.
  `padding [24, 56, 32, 16]` setzt oben, rechts, unten und links einzeln.
  Die Klammern sind optional. Standard sind 48 SVG-Einheiten pro Seite. Werte von 0 bis 10000000 sind
  zulässig. Die Abstände zwischen den Karten bleiben davon unabhängig.
- `curve rounded` (Standard) oder `orthogonal`; `showLabels true` (Standard)
  oder `false`. Keine manuellen `place`-/`route`-/`routes`-Blöcke und keine
  grafischen Referenzkarten. Profilkonfigurierte Referenztexte bleiben in Labels
  beziehungsweise Tooltips erhalten.
- `sharePath none` (Standard), `stereotypes` oder `all`: gemeinsame Abschnitte
  bei gleichem Start-/Zielknoten. `stereotypes` bündelt exakt gleiche Typen,
  `all` auch verschiedene Typen mit kompatibler Darstellung. Semantische Kanten
  und einzelne Labels bleiben erhalten. Die Bündelung braucht freie Korridore
  und genug Labelplatz. `curve rounded` rundet die äußeren Knicke ab und führt
  die seitlichen Linien mit Bögen in den gemeinsamen Stamm. Einzelrouten sind
  in Connected-Views verfügbar.

Die Node-Karten verwenden die vorhandenen Templates/Icons und Styles:
`fontSize`, Mindest-`width`/`height`, `iconPosition`, Feldschalter, Farben,
`opacity`, `display logo` und `display none` für Nicht-Container. Packages werden
als flache Karten dargestellt; Modellcontainment ist hier keine Baumbeziehung.
Beim Ausblenden eines Packages verschwinden weiterhin seine Modellnachkommen.

Ein Tree darf ein Wald mit mehreren Wurzeln sein. Jede Node hat höchstens einen
Hierarchie-Elternteil. Selbstkanten, Zyklen, parallele Hierarchiekanten und
bidirektionale Beziehungen sind Strukturfehler, auch im Entwurfsmodus. Für
Mehrfachvererbung/Querbeziehungen dient `connected`; alternativ begrenzen
`relations`, `include`/`exclude` oder `display none` die sichtbare Hierarchie.
Fachliche Modell-/Viewpoint-Regeln bleiben unverändert aktiv.

Auch das C2-Beispiel von S.91 besitzt eine Baumstruktur: EnterprisePhase →
EnterpriseVision → Goals/Capability. [naf41-enterprise-vision.arch](examples/naf41-enterprise-vision.arch)
zeigt sie als vollständigen Tree sowie als gemischte Connected-Ansichten mit
Tree-Gruppe und externer Capability. Relationstypen bestimmen die fachliche
Aussage; der Renderer wählt die Anordnung.

### Tree-Gruppen innerhalb einer Connected-View

Ein benannter Tree verhält sich wie eine unsichtbare Layoutgruppe innerhalb
der View. Er legt keine neuen Modellelemente oder Packages an:

```arch
view c2 "C2" {
  viewpoint C2
  tree hierarchy {
    nodes [horizon, vision, manpower, coverage, response]
    direction up
    parentDirection source
    padding [24, 56, 32, 16]
  }
  // Optional: komplette Gruppe und externe Karte frei positionieren
  place hierarchy at (300, 0)
  place maritime at (0, 250)
  route requires { from left to right }
}
```

Ohne `place` werden Gruppe und übrige Karten automatisch angeordnet.
Direkt verbundene externe Karten auf oberster Ebene stehen neben ihrer Gruppe,
ausgerichtet am verbundenen Mitglied. Bei vertikalen Trees links, bei horizontalen
unterhalb; bei Konflikten werden sie versetzt. Andere Karten und Gruppen verwenden
das Connected-Layout. Das ist eine Heuristik, kein globaler Kantenkreuzungsoptimierer.

Mehrere Gruppen sind möglich, jede mit eigener Richtung und denselben Tree-Optionen.
`nodes` bestimmt nur die Mitgliedschaft; `include`/`exclude` wählt weiterhin den
Inhalt der gesamten View. Die Reihenfolge in `nodes` bestimmt die Reihenfolge
der Geschwister/Wurzeln. `relations` wählt die internen Hierarchiekanten einschließlich
Untertypen; andere sichtbare Beziehungen bleiben als reguläre Connected-Kanten
erhalten. Auch Verbindungen zwischen Gruppen bleiben erhalten.

Mitglieder müssen sichtbare Nicht-Container mit demselben Modellparent sein.
Eine Node darf höchstens einer Gruppe angehören. Gruppen können innerhalb eines
Packages liegen, aber nicht über Package-Grenzen hinweg. Die Package-Semantik
und Darstellung bleiben erhalten. Einzelne Mitglieder erhalten kein `place`;
`place GRUPPE` positioniert den Ursprung ihrer Bounding Box einschließlich
Layoutabstand. Innerhalb eines Packages sind die Koordinaten relativ zum Inhalt.
Bei benannten Gruppen gehört `padding` zur Box, die `place` und
Koordinatenreferenzen verwenden. Die Connected-View berechnet ihren eigenen
äußeren SVG-Rand.
Die Gruppengröße ergibt sich automatisch; `size` und Gruppen-Styles sind nicht
verfügbar. Styling erfolgt weiterhin auf den Nodes und Beziehungen.

Interne Hierarchiekanten erhalten Tree-Routen. `route` kann Ports, Stützpunkte,
Kurve, Labelposition/-Icon und Sichtbarkeit wie gewohnt überschreiben.
Für `curve`, Labeltext und `sharePath` gilt: konkrete Route vor Gruppen-`curve`/`showLabels`/`sharePath`
vor View-`routes`. `showLabels false` blendet Text aus; `label none` entfernt
das gesamte Label einschließlich Icon. Grafische Referenzkarten und ihre Routen
bleiben verfügbar. Ausgeblendete Nodes/Kanten nehmen nicht am Layout teil,
das vollständige Modell bleibt Gegenstand der Profilprüfung.
`tree hierarchy {nodes [a,b,c] sharePath stereotypes}` bündelt die ausgewählten
internen Hierarchiekanten; externe Kanten behalten die View-/Einzelroutenvorgaben.
Vergleich der Modi und beider Tree-Formen:
[tree-shared-paths.arch](examples/tree-shared-paths.arch).
Das kompakte Layout gilt automatisch für ganze Trees und benannte Gruppen,
in allen vier Richtungen und auch für Wälder. Beispiel:
[compact-tree.arch](examples/compact-tree.arch). Manuell überschriebene Routen
und Labelpositionen bleiben in benannten Gruppen ausdrücklich steuerbar.

Tree-Gruppen sind nur im Connected-Renderer verfügbar. Pro Gruppe gelten
dieselben Strukturgrenzen wie für ganze Trees: keine Zyklen, Mehrfacheltern,
Selbstkanten, parallelen oder bidirektionalen Hierarchiekanten. Querbeziehungen
gegebenenfalls über `relations` aus der Hierarchie herausfiltern.

Beispiel mit automatischer und manueller Gruppenposition:
[naf41-enterprise-vision.arch](examples/naf41-enterprise-vision.arch).
Laufzeithilfe: `@help views`, `@help diagrams tree`, `@help routing`.

Die View `relative` im C2-Beispiel positioniert Maritime SAR relativ zur Gruppe
und zur automatisch angeordneten Vision:

```arch
place hierarchy at (300, 0)
place maritime at (hierarchy.x - maritime.width - 80, vision.centerY - maritime.height / 2)
```

Damit bleibt die externe Karte 80 Einheiten links von der Gruppenbox und auf
mittlerer Höhe der Vision, auch wenn sich deren Tree-Position oder Kartengröße ändert.
Alle Connected-`place`-Positionen unterstützen solche Referenzen, nicht nur Trees.
Zirkuläre Gruppenreferenzen auf eigene Mitglieder sind Fehler; eine Gruppe muss
unabhängig positioniert sein. `+`, `-`, `*`, `/` und Klammern sind möglich;
Punkt vor Strich und Division-durch-null-Prüfung gelten. Nach Auflösung werden die Kanten neu geroutet;
automatische Karten werden nicht zur Vermeidung manueller Überschneidungen umgelegt.

Auch `via` kann die endgültigen Node-/Gruppenkoordinaten verwenden:

```arch
route requires {
  from left to right
  via (vision.x - 40, vision.centerY), (maritime.right + 40, maritime.centerY)
  curve rounded
}
```

Normale Kanten, interne Tree-Kanten, Zuordnungslinien und `routes`-Vorgaben
unterstützen dieselben Ausdrücke. Via-Punkte sind immer absolut in der View,
einschließlich Referenzen auf Package-Inhalte. Die Auflösung erfolgt nach
Node-/Gruppenpositionierung und Package-Größenberechnung. Die Regeln für zwei
Bezier-Stützpunkte und die Übersteuerung durch `path` gelten weiterhin.
Quell-/Zielpunktkoordinaten und Labelpositionen bleiben numerisch.

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
diagram state { initial start final [done, cancelled] }
```

Zustände erscheinen als abgerundete Rechtecke. `initial` zeichnet einen
ausgefüllten Punkt, `final` zeichnet Punkte mit Außenring. `final done, cancelled`
und `final [done, cancelled]` sind gleichwertig. `final done` reicht für einen
Endzustand. Die frühere Schreibweise `finals` bleibt beim Einlesen gültig.
Das Diagramm setzt den Initialknoten oben und Endzustände unten. Reguläre Zustände folgen der
Modellreihenfolge. Initial- und Endknoten müssen verschieden sein. In den
Initialknoten darf kein Übergang hineinführen, aus Endzuständen keiner hinaus.
Ihre Verbindungen stammen aus den modellierten `relation`-Übergängen.
Der Renderer stellt eine flache Region dar. In UML hat jede Region höchstens
einen Initialknoten. [UML 2.5.1, Abschnitt 14.2.3.7](https://www.omg.org/spec/UML/2.5.1/PDF)

Mit `place ID at (X, Y)` positionierst du normale Zustände und modellierte
Initial- und Endknoten an der linken oberen Ecke ihrer Symbolfläche. Die
Ausdrücke können Maße und Koordinaten sichtbarer Zustände und virtueller
Punkte verwenden. Zustände ohne `place` werden automatisch angeordnet.
Der Renderer berechnet die Übergänge nach der Platzierung neu.

```arch
place waiting at (0, 0)
place located at (waiting.x, waiting.bottom + 120)
place rescued at (waiting.right + 220, waiting.y)
```

Virtuelle Start- und Endpunkte samt Pfeilen können direkt in der View stehen.
Die Endpunkte auf der Zustandsseite sind sichtbare Modellelemente. Der Name
in Anführungszeichen ist ein optionaler sichtbarer Titel. Für mehrere virtuelle
Endpunkte wiederholst du `final` mit einer eigenen ID pro Punkt.

```arch
view l5State "State transitions" {
  viewpoint L5
  diagram state {
    initial virtual start "Start" -> waiting
    final waiting -> virtual end "End" { event shutdown }
  }
  place virtual start at (waiting.x, waiting.y - 100)
  place virtual end at (waiting.right + 340, 520)
  route virtual start {
    from bottom to top 1/4
    curve rounded
    via (start.centerX, waiting.y - 40), (waiting.x + waiting.width/4, waiting.y - 40)
  }
}
```

`event shutdown` referenziert optional ein modelliertes Ereignis. Ein
virtueller Initialpunkt belegt dieselbe Rolle wie ein modellierter Initialpunkt.
Alle virtuellen IDs sind pro View eindeutig und bleiben außerhalb des Modells.
Ohne `place virtual` ordnet der Renderer die Punkte automatisch an. `at` gibt
die linke obere Ecke der Symbolfläche in View-Koordinaten an und erlaubt
Ausdrücke mit sichtbaren Zuständen und virtuellen Punkten als Ankern.

Mit `route virtual ID { … }` steuerst du den Pfeil des virtuellen Punkts.
Beim Initialpunkt verläuft er **vom Punkt zum Zustand**, beim Endpunkt
**vom Zustand zum Punkt**. Einen modellierten Übergang steuerst du per
`route RELATION_ID { … }`. Beide Varianten unterstützen `from`, `to`, `via` und `curve`
direkt im View-Block. `from` und `to` akzeptieren eine Seite mit optionaler
Position zwischen 0 und 1, etwa `top 1/4`, oder ein absolutes Koordinatenpaar.
Bei Kreisen folgt der gewählte Anschluss dem sichtbaren Rand. Koordinaten und
Seitenpositionen können auf sichtbare Zustände und virtuelle Punkte verweisen.

- `curve rounded` (Standard) rundet die Ecken der rechtwinkligen Route.
- `curve orthogonal` verbindet die Wegpunkte mit rechtwinkligen Ecken.
- `curve straight` verbindet Anschlüsse und Wegpunkte mit geraden Segmenten.
  Eine Selbstschleife ohne Wegpunkte verwendet den automatischen Schleifenpfad.
- `curve bezier` zeichnet eine kubische Bézierkurve. Mit `via` gibst du
  genau zwei Kontrollpunkte an. Ohne `via` berechnet der Renderer sie aus
  den Anschlüssen.

Bei rein automatischer Anordnung verlaufen Übergänge zwischen
aufeinanderfolgenden Zuständen senkrecht.
Rücksprünge, Schleifen und weitere parallele Übergänge erhalten getrennte
Pfade und Andockpunkte. Ihre Beschriftungen stehen neben dem jeweiligen Pfad
in freien Bereichen zwischen den Zustandszeilen.

Ein Profil kann einen Relationstyp mit `stateTrigger` als Zustandsübergang
kennzeichnen. Der Wert nennt ein Referenzattribut mit dem auslösenden Ereignis.
In einer so typisierten View zeichnet der Renderer diese Übergänge und die
zugehörigen Zustände sowie explizite Initial- und Endknoten. Der Ereignisname
steht in einem farblich abgesetzten Feld, das eine kurze Linie mit dem Pfeil
verbindet. Der Übergangstitel
steht darunter. Kontext wie Besitzer und Ereignis-Objekte kann in der
View für die Profilprüfung ausgewählt bleiben. In generischen Views ohne diese
Kennzeichnung bilden die ausgewählten Elemente und Beziehungen das Diagramm.

`examples/naf41-logical-states.arch` zeigt das L5-Modell als Connected-View
und als Zustandsdiagramm. `LogicalStateTransition` verwendet `event` für
kompakte Trigger. Zusammengesetzte und orthogonale Zustände, Ein-/Austrittspunkte
an ihrem Rand, History, Entry-/Exit-Aktionen und ausführbare Zustandsautomaten
sind noch nicht enthalten.

## Aktivität / Swimlanes: `activity`

```arch
diagram activity {
  lanes [operations, crew]
  laneAttribute owner
  layout auto
  initial start
  final [end]
  decisions [decision]
  forks [split]
  joins [merge]
}
```

Alle Listen sind optional. Die Titel der in `lanes` angegebenen Knoten
beschriften die Verantwortungsbereiche. `laneAttribute` legt fest, aus
welchem Attribut die Zuordnung gelesen wird. Ohne diese Angabe verwendet
arch.js `owner` oder leitet die Lane aus `PerformsOperationalActivity` und
`IsCapableToPerform` ab. Bei mehreren passenden Performern ist eine explizite
Zuordnung erforderlich. Performer-Beziehungen und `HoldsRole` zwischen Lanes
bleiben in der Viewpoint-Validierung erhalten. Das Diagramm zeigt die
Aktivitäten und ihre Ablaufkanten. Ohne Lanes entsteht ein Aktivitätsdiagramm
ohne Verantwortungsbereiche.

`layout auto` ist der Standard. Sobald sichtbare Beziehungen mit
`activityFlow true` im Profil vorhanden sind, bestimmen sie die Ablaufstufen.
`layout flow` wählt dieselbe Ablaufanordnung ausdrücklich. Ohne markierte
Kanten gilt die Modellreihenfolge, die sich auch mit `layout model` festlegen
lässt. `naf41-uaf` markiert `OperationalControlFlow` und `LogicalControlFlow`.

Zweige auf derselben Stufe können sich über mehrere Lanes eine Zeile teilen.
Innerhalb einer Lane erhalten sie Unterzeilen in Modellreihenfolge. Ein
Zusammenführungsknoten folgt der spätesten Vorgängerstufe. Schleifen bilden
Gruppen mit stabiler Modellreihenfolge, und Aktivitäten ohne sichtbare
Ablaufkante folgen danach. Die Stufen geben eine Leserichtung für den Ablauf an.

Entscheidungen erhalten Rauten und benötigen mindestens zwei ausgehende
Beziehungen. Forks und Joins
werden als Balken dargestellt und benötigen mindestens zwei Ausgänge bzw.
Eingänge. Ein Element darf nur eine dieser Kontrollknotenarten besitzen.
Start/Ende verhalten sich wie im Zustandsdiagramm. Kantenbeschriftungen sitzen
auf dem tatsächlichen Pfad. Wenn Platz vorhanden
ist, wird die Ziel-Lane bevorzugt. Die Lane-Trennlinie lässt an der Kreuzung
Platz für die Kante.
Vorwärtskanten biegen zwischen den Aktivitäten ab, Rückkanten laufen links
und Selbstschleifen rechts um die Aktivität.

Einzelne Kanten kannst du im View-Block mit `from`, `to` und `via` führen.
`route l4.7 { from bottom 1/4 to top 3/4 }` dockt bei einem Viertel der
Quellunterseite und drei Vierteln der Zieloberseite an. `from` und `to`
akzeptieren `auto`, alle vier Seiten mit optionaler berechenbarer Position
zwischen `0` und `1` sowie absolute Koordinatenpaare `(X,Y)`. Ohne Seitenposition
liegt der Andockpunkt in der Mitte. Wegpunkte sind optionale Zwischenpunkte
in absoluten View-Koordinaten. Der rechtwinklige Pfad durchläuft sie in
Listenreihenfolge. Ausdrücke können sichtbare Aktivitäten und Lanes referenzieren.
Die Darstellung simuliert keine BPMN-Tokens, Guards oder Parallelität.

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
Meilenstein, Zeiträume einen Balken. Ein `LogicalMilestone` mit `date` lässt
sich mit `diagram timeline { startAttribute date endAttribute date }` direkt
darstellen. Mit `datedOnly true` bleiben Elemente, bei denen beide Datumsfelder
leer sind, Teil der fachlichen Viewpoint-Validierung und erscheinen ohne
eigene Zeile. Ein Element mit nur einem gesetzten Datumsfeld benötigt auch
das zweite. Mit `style ID1, ID2 { display none }` kann man gezielt Elemente
ausblenden. Zeilen folgen der Modellreihenfolge und zeigen
links Name und Zeitraum. Balken, Meilenstein-Rauten und Abhängigkeitspfeile liegen
auf einer Zeitachse, deren UTC-Raster sich am Datumsbereich orientiert. Auch kurze
Zeiträume bleiben sichtbar. Es gibt noch keine Terminplanung, Ressourcenberechnung, kritischen
Pfade, Ist-/Soll-Baselines oder persistente Modellversionierung.

## Properties auf normalen Karten

Connected- und Tree-Views akzeptieren `propertyFields [expression, unit, value]`
direkt in der View oder im `diagram connected/tree { … }`-Block. Pro Node kann
`style criterion { propertyFields [expression] }` die Auswahl ersetzen;
`propertyFields []` leert sie. Rangfolge: Node-Style vor View vor Diagramm.
Erlaubt sind deklarierte Attribute und öffentliche Properties `id`, `type`,
`title`, `description`, `technology`, `stereotype`, `tags`. Globale Listen dürfen
Attribute verschiedener projizierter Typen kombinieren; Node-Listen werden gegen
ihren Typ geprüft. Unbekannte Namen, Duplikate und mehr als 128 Felder sind Fehler.

Nur vorhandene Werte erscheinen; 0, false und Listen bleiben erhalten. Text wird
escaped und umgebrochen. Kartenhöhe und Package-Header wachsen vor Layout,
Koordinatenauflösung und Routing. Referenzkarten übernehmen die Properties.
Templates, Icons, Schriftgröße, Tree-Gruppen und manuelle Routen bleiben nutzbar.
`display logo` unterdrückt alle Texte einschließlich Properties; andere
Sichtbarkeitsschalter sind unabhängig von der Property-Auswahl.

Beispiel für beide Varianten: [property-fields.arch](examples/property-fields.arch).

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
Kopfbereich. View-/Node-`propertyFields` gelten auch hier mit derselben Rangfolge.
`place CLASS_ID at (X, Y)` akzeptiert feste und berechnete absolute Koordinaten;
optional `size` setzt Mindestmaße. Karten bleiben mindestens 380 Einheiten breit
und wachsen für ihren Inhalt. Unplatzierte Karten behalten ihre Reihenposition.
Packages sind flache Class-Karten; Ports bewegen sich mit ihrem Owner und sind
Koordinatenanker. Details werden nicht einzeln platziert oder mit eigenen
`propertyFields`-Styles versehen. Negative Koordinaten bleiben exportierbar.
`route`/`routes`/`via`, Tree-Gruppen und grafische Zuordnungslinien sind nicht
verfügbar. Kanten folgen den endgültigen Karten-/Portpositionen automatisch.

Die Karten verwenden außerdem Monospace-Signaturen. Detailbereiche besitzen feine Trennlinien
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

Unplatzierte Klassenkarten werden nebeneinander angeordnet. `place` überschreibt
einzelne Positionen; manuelle Überlappungen sind möglich. Klassenviews bieten
keine manuellen Kantenrouten. Für automatische Taxonomieebenen dient `tree`,
für Karten mit manuellem Routing `connected`.

## Gemeinsame Regeln und Grenzen

Bidirektionale Beziehungen (`<->`, Profilfreigabe `directions`) werden in
Connected- und Klassenviews als eine Linie mit zwei Pfeilspitzen dargestellt.
Matrizen zählen sie in beiden Richtungen, Selbstbeziehungen einmal je Zelle.
Sichtbare bidirektionale Beziehungen werden in Sequenz-, Zustands-, Aktivitäts-
und Timeline-Views mit einem Hinweis auf zwei gerichtete Beziehungen abgewiesen.
Heatmaps werten Kanten nicht aus. `style EDGE_ID {display none}` blendet Kanten
in allen Darstellungen aus; Profil-/Modellregeln gelten weiterhin.

`style NODE_ID {display none}` entfernt Nodes und angrenzende Kanten. Packages
verbergen ihre Nachkommen. Explizite Teilnehmer-/Zeilen-/Detail-Listen der
Fachrenderer werden für die Darstellung gefiltert; zugeordnete Inhalte folgen
ausgeblendeten Lanes beziehungsweise Heatmap-Eltern. Die vollständige
Modellprüfung und die strukturellen Rendererregeln bleiben aktiv.

`validation draft` erlaubt sicher unvollständige Profilanforderungen und hängt
Warnungen unter das Diagramm. Spezifische strukturelle Rendereranforderungen
bleiben verbindlich; beispielsweise benötigt eine Timeline weiterhin gültige
Zeitwerte. Die Darstellung ist kein Konformitätsnachweis.

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
| `display logo`, Node-`iconPosition`, `showIcon`/`showLabel` und weitere Feldschalter | Ja | Tree: ja; übrige Spezialrenderer: abgewiesen |
| Node-`fontSize`, `width`, `height` im Style | Ja, Größen sind Mindestwerte; auch arithmetische Referenzen auf sichtbare Karten/Styles | Tree: ja; übrige Spezialrenderer: eigene Maße |
| Template-/Iconwahl | Vorhandene Templates und registrierte Icons | Tree verwendet dieselben Karten/Templates; sonst bestimmt die Spezialnotation die Form |
| Hintergrund-/Akzentfarben und `opacity` | Im Node-/Package-Style | Je nach gezeichnetem Primitive: Karten und Timeline-Balken verwenden Hintergrund/Fülltransparenz; Heatmap verwendet ihre Wertskala, Klasse zusätzlich Akzente. Keine allgemeine Übertragung aller Styles. |
| `backgroundImage` auf der Zeichenfläche | Ja | Ja, in allen Diagrammtypen |
| `backgroundImage` auf Elementkarten | Ja, einschließlich Packages, Referenzkarten und Logo-Modus | Auf Karten in Tree, Class, Sequence, State und Activity. Matrixzellen, Heatmap-Felder, Timeline-Balken und Zustands-/Aktivitätssymbole verwenden ihre eigene Darstellung. |

`showLabel` bedeutet bei einem Connected-Node nur den Titel, bei einer Route
deren Labeltext. Stereotyp, Beschreibung, Technologie und Icon haben eigene
Schalter. `label none` an einer Route entfernt dagegen den gesamten Labelrahmen
mit Text und Icon. Syntaxbeispiele stehen in [HELP.md](HELP.md).

- `include` wählt Elemente aus. `exclude` entfernt Elemente einschließlich ihrer
  Nachkommen oder einzelne Beziehungen anhand ihrer ID. Beziehungen mit ausgeblendeten Endpunkten
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
ursprünglichen Spezialrenderer sowie für Tabellen und Sankey. Die Tests prüfen
beide Themes, Profildaten, Escaping, Snapshot-Isolation und Bundle-Gleichheit.
Chromium prüft auch die neuen NAF-Ansichten einschließlich des Rasters in
beiden Themes. Die Screenshots liegen unter `test-results/diagram-*.png`
und `test-results/coverage-*.png`.

`tests/tree-groups.test.mjs` prüft gemischte C2-Ansichten, mehrere Gruppen,
Package-Containment, vier Richtungen, unveränderte Modellidentität,
Hierarchiefilter/Querbeziehungen, Routen/Referenzkarten, JSON und Bundle-Gleichheit.
Die Browser-Suite prüft die Gruppenansichten in beiden Themes einschließlich
Label-/Kartengrenzen und eigenständigem SVG-Export.

`tests/tree.test.mjs` prüft Taxonomien/Wälder, vertikale/horizontale Ausrichtungen,
asymmetrische Unterbäume, Größen/Styles, Relationstypvererbung, ausgeblendete
Elemente, Strukturfehler, JSON/Metaview, 1.000 Hierarchieebenen, leere Views,
Entwurfsmodus, gestapelte Views und beide Bundles. Chromium prüft die C1-Ansichten
einschließlich Schrift-/Labelgrenzen, Themes und eigenständigem SVG-Export.

Gemeinsame Kantenpfade in Connected-Views (einschließlich benannter Tree-Gruppen):
`routes { sharePath stereotypes }`. Der exakte Relationstyp bestimmt die
Bündelung; `all` erlaubt unterschiedliche Typen mit kompatibler Darstellung,
`none` deaktiviert sie (Standard). Einzelrouten überschreiben die Vorgabe.
Labels/Icons und IDs bleiben pro Beziehung erhalten. Die Automatik benötigt
freie Korridore und Labelplatz; manuelle `via`/`path`, `straight`/`bezier` und
containerübergreifende Kanten bleiben unabhängig. Gemeinsame Junctions werden
rechtwinklig gezeichnet. Details: [HELP.md](HELP.md), `@help routing`.
Ganze Tree-Views akzeptieren denselben Modus in `diagram tree {sharePath stereotypes}`;
benannte Gruppen können ihn lokal überschreiben.

Das [Cr-Beispiel nach NAFv4.1 S.103](examples/naf41-capability-roadmap.arch)
kombiniert Phasenaggregation und Trigger in einer Connected-View. Die Hierarchie
und die Reihenfolge sind verschiedene Beziehungstypen; ein vollständiger Tree
über beide ist ungeeignet. `place` erhält die gestufte Anordnung, `via` die
Triggerwege und `sharePath stereotypes` bündelt die Aggregationslinien. Die
Darstellung erklärt das Modell; ein zeitbasierter Plan braucht tatsächliche Daten.

Connected-Routen einschließlich interner Tree-Gruppen-Kanten unterstützen
`color`, `width` und `dasharray`, sowohl in `routes` als auch pro `route` und
Zuordnungslinie. Beispielsweise `routes {color blue width 2 dasharray [8,4]}`
und `route edge {dasharray none}`. Farben/Breiten gelten auch für Pfeilspitzen.
Gemeinsame Pfade verlangen übereinstimmende Farben, Breiten und Muster. Andere
Renderer erhalten dadurch keine Routing-Blöcke. Siehe [Linienstile](HELP.md)
und [Beispiel](examples/route-styles.arch).

Das [S1-Beispiel nach S.105](examples/naf41-service-taxonomy.arch) verwendet eine
Connected-View mit Tree-Gruppe für ServiceGeneralization. Die Pfeile zeigen vom
spezialisierten zum allgemeinen Service; die Policy steht außerhalb der Gruppe.
`SatisfiesServicePolicy` verbindet Service → Policy. So werden fachliche
Spezialisierung und Policy-Erfüllung nicht zu einer gemeinsamen Hierarchie vermischt.

Aliasnamen bleiben in Stereotypbeschriftung und `data-type` erhalten. So können
Service und ServiceSpecification dieselbe Fachsemantik besitzen und dennoch
mit der im Modell gewählten Schreibweise erscheinen. `sharePath stereotypes`
fasst Relationsaliase mit ihrer kanonischen Relation zusammen; echte Untertypen
bleiben getrennte Stereotypen. Regeln und Versionsbindung:
[Aliase und Mappings](profiles/naf41/ALIASES.md).

Das [S2-Beispiel von S.108](examples/naf41-service-structure.arch) enthält neun
Knoten und acht Relationen. Connected mit expliziten `place`-/`route`-Angaben
zeigt Node, fünf Services, Interface, Function und PhysicalActiveResource.
Die beiden ServiceDependency-Kanten und die ServiceAggregation-Verzweigung
bleiben fachlich getrennt von ConsumesService/EnablesService/RealizesService.
Eine unbeschränkte Tree-View wäre für diese Mischung keine geeignete Hierarchie.

`ServiceAggregation` wird als durchgezogene gerichtete Verbindung mit Pfeil zum
Mitglied dargestellt. `ServiceComposition` behält seine Kompositionsnotation;
beide Relationsnamen sind eigenständige Typen und keine Aliase.

Das [S3-Beispiel von S.110](examples/naf41-service-interfaces.arch) verwendet
Connected mit neun Knoten und neun gerichteten Beziehungen. Der Parameter
Geographic Location erscheint einmal und ist über zwei has-Kanten mit beiden
Operationen verbunden. DataProductType konkretisiert PhysicalPassiveResource
und DataElement. Resource hat im Beispiel keinen involves-Bezug. Class-
Parameterkompartimente benötigen weiterhin einen skalaren owner; sie leiten
keine Mehrfachzuordnung aus has-Kanten ab.

### Objektifizierte Nachrichten und Kontext in Sequenzen

```arch
diagram sequence {
  participants [coordinationLine, sarLine]
  orderAttribute order
  showContext true
}
```

Nachrichten können typisierte Referenzen auf eigene Modellelemente tragen.
Der Sequence-Renderer zeichnet diese als Karten an der jeweiligen Nachricht,
mit beschrifteter Zuordnung, sofern das Profil referenceConnectorLabels setzt.
showContext (Standard false) ergänzt die übrigen ausgewählten Elemente und
Beziehungen in einem Kontextbereich. Die Karten sind keine weiteren Lifelines.
Mit sequenceMessage markierte Relationstypen werden automatisch als Nachrichten
ausgewählt; deren Endpunkte liefern die Standard-Lifelines. Ohne solche
Markierung bleibt das bisherige generische Verhalten erhalten.

orderAttribute verlangt eindeutige positive Integerwerte für die ausgewählten
Nachrichten und sortiert danach. Ohne Option gelten messages-Listenreihenfolge
oder Deklarationsreihenfolge. Die übrigen Regeln für returns/asyncMessages
bleiben erhalten. Manuelles place/route gehört weiterhin in Connected-Views.
Beispiel: [S6](examples/naf41-service-sequence.arch).

## Wiederverwendete Views

`extends SOURCE` übernimmt Auswahl und Darstellung mit lokalen Overrides.
Connected-Views können Connected-/Tree-Views über `embed SOURCE [as GROUP]`
als unveränderten Teilbereich aufnehmen. `place GROUP` und Gruppen-/Node-
Koordinatenreferenzen verbinden Einbettungen mit dem äußeren Diagramm.
Ohne Optionen nahtlos; `{frame true}` aktiviert Rahmen und Quellview-Titel.
Mehrere Einbettungen können denselben Modellknoten zeigen. `GROUP.NODE`
adressiert eine bestimmte Karte. Andere Quellrenderer sowie Meta-/Help-Views
werden abgewiesen. [Regeln und Beispiele](HELP.md#views-wiederverwenden-extends-und-embed).

## L2 Needlines und Objektifizierung

Connected-Views zeichnen `Needline`-Kanten direkt zwischen Nodes, ohne zusätzliche
Objektkarten zu verlangen. `needline OBJECT_ID` auf einer solchen Kante bindet
eine optionale Needline-Karte; der vorhandene Referenzrenderer ergänzt die
„is equal to“-Zuordnung. Sie unterstützt `route OBJECT_ID -> EDGE_ID`,
Seitenpositionen, Brüche, via und freie Pfade. Die explizite semantische
`ConveysLogicalResource`-Beziehung führt vom Needline-Objekt zur logischen
Payload. Objektkarte und bekannte Payload können in einer View fehlen.
Vollständige Legacy-Endpunktreferenzen bleiben modellierbar, erzeugen aber
keine automatischen Kanten. Beispiele: [L2](examples/naf41-needlines.arch) und
[Cut-out](examples/naf41-needlines-cutout.arch).

## Tabellarische Ansichten mit `table`

```arch
view glossary "Glossary" {
  viewpoint A1
  include [sar, wbr]
  diagram table { fields [title, type, definition] }
}
```

`mode elements` ist die Voreinstellung. Mit `mode relationships` wird aus
jeder sichtbaren Beziehung eine Zeile. In diesem Modus zeigen `source` und
`target` die Namen der Endpunkte. `fields` bestimmt die Spaltenreihenfolge.
Neben den Standardfeldern stehen die im Profil deklarierten Attribute der
ausgewählten Typen zur Verfügung.

## Gewichtete Flüsse mit `sankey`

```arch
diagram sankey { relations [LogicalInteraction] weightAttribute volume }
```

Der Renderer zeichnet die Endpunkte der gefilterten Beziehungen und skaliert
die Breite der Bänder nach deren Gewicht. Ohne `weightAttribute` zählt jede
Beziehung als eine Einheit. Bei angegebenem Attribut benötigt jede gezeichnete
Beziehung einen positiven numerischen Wert. Für Zyklen oder bidirektionale
Beziehungen eignet sich `connected`. Das [L3-Beispiel](examples/naf41-interactions-cutout.arch)
enthält beide Darstellungen desselben Informationsaustauschs.

## NAF-Viewpoints mit `nafgrid`

| Ebene | Verantwortung |
| --- | --- |
| arch.js-Kern | Validiert die Rasteroptionen, ordnet Produkte und Diagramme anhand ihres Viewpoints zu, berechnet Anordnung und Darstellung und macht die Kacheln im Dashboard navigierbar. `viewpointGrid` bietet ein automatisches Standardraster. |
| Profil | Definiert die Viewpoints und ihre Regeln. Das NAF-Profil liefert die Zeilen, Spalten, Zellpositionen, Stilgruppen und die vertikale Zelle für `L2-L3`. Eigene Profilraster können Darstellungsvorgaben setzen. |
| Architektur-DSL | Wählt das Profil und den Diagrammtyp, modelliert Produkte und deklariert Diagramme. `viewpoint` ordnet ein Diagramm zu, `include` legt die Auswahl fest und der `diagram`-Block steuert die Anzeige für diese View. |

Das [interaktive Beispiel](examples/viewpoint-grid.arch) ist in der Studio-Demo
unter **How viewpoint grids work** verfügbar. Im View-Menü kannst du zwischen
dem vollständigen Raster, modellierten Diagrammen, der Auswahl und einem
leeren Raster wechseln.

```arch
NafViewpoint logicalStructure "Logical Structure" { nafViewpoint L2 }
View logicalScenario "SAR Logical Scenario" { viewpoint logicalStructure }
```

Das Profil `naf41-uaf` definiert die Matrix in `viewpointGrid` und aktiviert
`diagram nafgrid` für `viewpoint A2`. **Products** zeigt die in der View enthaltenen
modellierten `View`-Elemente. Der Zellcode kommt aus `nafViewpoint`, aus der
ID eines gewöhnlichen `Viewpoint` oder aus dessen Titel, etwa
`"L2 Logical Scenario"`. Produkte ohne passende Zellzuordnung erscheinen
unter der Matrix.

**Diagrams** erfasst die deklarierten `view`-Blöcke nach ihrem `viewpoint`.
Wähle Diagramme über ihre IDs im `include` der Raster-View aus. Dieselbe
Liste kann auch Modellelemente enthalten. Ein enthaltenes `View`-Produkt
wird ebenfalls ausgewählt, wenn ein ausgewähltes Diagramm es über
`represents logicalScenario` referenziert.

```arch
view shortlist "Delivery shortlist" {
  viewpoint A2
  include [l2, p2]
  diagram nafgrid { show selected }
}
```

`show all` zeigt standardmäßig das vollständige Raster. `show selected`
beschränkt das Raster und die Kacheldetails im Dashboard auf die Auswahl.
Mit `include []` und `show selected` erhältst du ein leeres Raster.
`show modeled` zeigt nur Kacheln, für deren Viewpoint ein Diagramm im DSL
deklariert ist. Mit `viewpoints` kannst du die Viewpoint-Codes in jedem
Anzeigemodus einschränken. Beide Listenschreibweisen sind möglich.

```arch
view modeledGrid "Modeled NAF views" {
  viewpoint A2
  include []
  diagram nafgrid {
    show modeled
    viewpoints [L2, P2]
    diagrams list
  }
}
```

Im Beispiel zeigt das Raster nur vorhandene L2- und P2-Diagramme.
`include []` erzeugt ein Raster ohne markierte Auswahl und ohne modellierte
Produkte. In `show modeled` sind die Diagramme dann normal lesbar.

Die NAF-Kacheln verwenden dieselben Stilgruppen und dieselbe
Fülldeckkraft von 20 % wie farbige Knoten. Ein stärkerer Rahmen kennzeichnet
ausgewählte Kacheln. Eine graue Fläche mit 90 % Deckkraft dämpft die
Füllung und Beschriftung der übrigen Kacheln. Das gilt auch bei
`products none diagrams none`.
Die Kachel `L2-L3` ist schmal und trägt einen um 90° gedrehten Viewpoint-Code.
Ein Klick öffnet im Dashboard die zugehörigen Produkte und Diagramme.
Die Auswahl bleibt beim Navigieren erhalten.

```arch
diagram nafgrid { products list diagrams count }
```

`count` (Standard), `list` und `none` sind für beide Optionen verfügbar. Die Einstellung
steuert die sichtbaren Angaben in der Kachel. Die Detailansicht im Dashboard
enthält weiterhin die zugehörigen Einträge.

### Standardraster und eigene Profilraster

`diagram viewpointGrid` ordnet die Viewpoints eines Profils automatisch an.
Ein registriertes JSON-Profil kann unter `diagrams` eigene Namen und Layouts
für denselben Renderer angeben. Ein Eintrag ohne `layout` verwendet das
Standardraster. Beispiel als Ausschnitt eines Profils mit dem Viewpoint `L2`.

```json
{
  "diagrams": {
    "deliveryGrid": {
      "renderer": "viewpointGrid",
      "layout": {
        "title": "Delivery overview",
        "columns": ["Structure"],
        "rows": [
          { "title": "Logical", "color": "#21658b", "darkColor": "#87cff0" }
        ],
        "cells": [
          { "id": "L2", "row": 0, "col": 0, "products": "list" }
        ]
      }
    }
  }
}
```

Verwende dafür `diagram deliveryGrid`. `products` und `diagrams` können am
Layout oder an einzelnen Zellen gesetzt werden. Das Layout kann außerdem
`show` vorgeben. Optionen im `diagram`-Block haben Vorrang vor Zell- und
Layoutvorgaben.

Eine Zeile kann mit `"styleGroup": "logical"` die Knotenpalette einer
Stilgruppe übernehmen. Alternativ sind `color` und `darkColor` für eigene
Zeilenfarben verfügbar. `"vertical": true` stellt eine Zelle schmal mit
gedrehtem Viewpoint-Code dar.

[Beispiel mit A1–Ar](examples/naf41-foundation-viewpoints.arch).

Die [Darstellungsmatrix](profiles/naf41/COVERAGE.md#representation-by-viewpoint)
ordnet die Renderer den Repräsentationsformen aller 47 Viewpoints zu.
