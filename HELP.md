# Eingebaute Hilfe

Die Hilfe ist Teil von `arch.js` und `arch.min.js` und funktioniert offline.
Alle eingebauten Hilfetexte und Fehlermeldungen erscheinen auf Englisch.
Diese Datei ergänzt die Laufzeithilfe um Rezepte und Grenzen. Die vollständige
Sprach-/API-Referenz steht in [SPEC.md](SPEC.md), die Unterstützung je Renderer
in [DIAGRAMS.md](DIAGRAMS.md). Vorteile, Grenzen und Vergleich mit anderen
Diagrammwerkzeugen: [COMPARISON.md](COMPARISON.md).

Schreibe einen einzelnen Befehl in einen `arch`-Codeblock:

```arch
@help
```

Die Hilfe funktioniert auch auf oberster Ebene innerhalb einer Architektur:

```arch
architecture "Test" {
  @help profiles
  model {}
}
```

Der Befehl endet am Zeilenende, an einem Semikolon oder an der schließenden
Architekturklammer. Genau ein Hilfebefehl ist erlaubt. Er zeigt die Hilfe
anstelle des Diagramms. Der übrige Quelltext wird syntaktisch gelesen; fachliche
Modellregeln werden in diesem Hilfemodus nicht geprüft. Der `model`-Block ist
dabei optional. `config { profile ... }` wählt auch hier das Profil für die Hilfe;
`options.profile` hat Vorrang.

Das ergibt eine markierbare SVG-Referenz mit den gültigen Themen und Eingaben.
Die bestehenden Funktionen `render`, `renderToString`, `renderAll` und
`renderMarkdown` unterstützen diese Blöcke ohne zusätzlichen Loader. In der
Beispieloberfläche gibt es dafür **Language reference**.

## Befehle

Eckige Klammern bedeuten optionale Parameter; sie werden beim Aufruf weggelassen.
Jeder Codeblock enthält genau einen Hilfebefehl, eigenständig oder auf oberster
Ebene des `architecture`-Blocks.

| Befehl | Inhalt |
| --- | --- |
| `@help` | Themenübersicht und Beispiele |
| `@help syntax` | Grundregeln und vollständiges Startbeispiel |
| `@help json` | Gleichwertige JSON-Syntax, Zuordnung zur DSL und vollständiges Beispiel |
| `@help meta` | Meta-View, DSL-/JSON-Übersetzung, Fehlerstellen und Korrekturkandidaten |
| `@help model` | Elemente, Container, Beziehungen, Standardattribute |
| `@help profiles [PROFILE]` | Registrierte Profile bzw. deren Übersicht |
| `@help aliases [PROFILE]` | Aliasnamen und kanonische Typziele |
| `@help mappings [PROFILE]` | Dokumentierte Metamodellzuordnungen mit Versionen und Grenzen |
| `@help types [PROFILE [TYPE]]` | Knotentypen bzw. expandierte Typdefinition |
| `@help relations [PROFILE [RELATION]]` | Relationstypen bzw. Endpunkt- und Attributregeln |
| `@help connections [PROFILE [TYPE]]` | Erlaubte eingehende/ausgehende Relationen für einen Knotentyp |
| `@help viewpoints [PROFILE [VIEWPOINT]]` | Viewpoints bzw. erlaubte/erforderliche Inhalte |
| `@help iconpacks [PACK [FILTER [PAGE]]]` | Packs, Iconnamen, Suche und Seiten |
| `@help diagrams [TYPE]` | Alle Diagrammtypen bzw. gültige Einstellungen eines Renderers |
| `@help views` | Ansichten, Renderauswahl, include/exclude, Richtung, Theme und Abstand |
| `@help routing` | Positionen, Ports, Kurven, SVG-Pfade, Zuordnungspfeile und Label-Icons |
| `@help styles` | Templates, Iconposition, Feldsichtbarkeit, Schrift/Mindestgröße, Farben und Fülltransparenz |
| `@help colors [FILTER]` | 147 CSS3-Farbnamen mit Hexwerten, optional gefiltert |
| `@help templates` | Grafische Knotentemplates und Kantenstile |
| `@help config` | Profilwahl, Inline-Profile und unterstützte Regelfelder |
| `@help api` | JavaScript-API und Optionen |

Aliase: `icons` → `iconpacks`, `profile` → `profiles`, `nodes` → `types`,
`edges` → `relations`, `diagram` → `diagrams`, `view` → `views`, `style` → `styles`.

Für automatische Taxonomien: `@help diagrams tree`. Die C1-View kann mit
`diagram tree { relations [CapabilityGeneralization] }` ohne manuelle Positionen
gerendert werden. `parentDirection auto` erkennt Generalisierungsziele als Eltern;
`direction down|up|left|right` (Alias `orientation`), `levelGap`, `siblingGap`, `curve rounded|orthogonal`
und `showLabels` steuern die Ausgabe. Vorhandene Node-Styles sind verfügbar.
Die Hilfe nennt Grenzen für Zyklen und Mehrfachvererbung sowie Alternativen über
Typfilter/ausgeblendete Kanten oder `diagram connected`.

Für C2-Phasen: `@help connections naf41-uaf EnterprisePhase` zeigt
`DesiresCapability`, `DesiresVision` und `DesiresGoal`. `@help relations naf41-uaf
DesiresVision` erklärt Phase→Vision aus dem Beispiel auf S.91. Die Anordnung
funktioniert als Tree. Für eine gemischte Anordnung in Connected-Views:
`tree hierarchy { nodes [horizon, vision, goalA, goalB] direction up }`.
Die Capability bleibt außerhalb und kann automatisch oder per `place` positioniert
werden. `place hierarchy at (300, 0)` verschiebt den gesamten Tree; Mitglieder
werden automatisch angeordnet. Mehrere Gruppen mit eigenen Richtungen sind
möglich. `@help views` erklärt Mitgliedschaft, Routen und Grenzen.
`CapabilityGeneralization` gilt nur zwischen Capabilities.

`propertyFields [expression, unit, value]` in einer View zeigt Properties auf
Connected-/Tree-/Class-Karten. `style criterion {propertyFields [expression]}`
überschreibt die Auswahl pro Node; `[]` leert sie. `@help styles` erläutert Werte,
Umbruch und Rangfolge Style → View → Diagramm. Connected behält manuelles Routing.
Class-Karten unterstützen ebenfalls `place`, berechnete Koordinaten und
Mindestgrößen; Ports folgen ihren Ownern. `@help diagrams class` nennt Grenzen:
Details werden nicht einzeln positioniert; Class hat weiterhin kein
`route`/`routes`/`via`, keine Tree-Gruppen oder grafischen Zuordnungslinien.

`@help routing` erläutert Koordinatenreferenzen und Offsets:
`place maritime at (coverage.x + 20, vision.y - 40)` oder
`place maritime at (hierarchy.x - maritime.width - 80, vision.centerY - maritime.height / 2)`.
Anker: `x`, `y`, `width`, `height`, `right`, `bottom`, `centerX`, `centerY`.
Referenzen gelten für sichtbare Nodes/Tree-Gruppen derselben View, unabhängig
von der Deklarationsreihenfolge. `+`, `-`, `*`, `/`, Klammern und unäre Vorzeichen
sind erlaubt. Punktrechnung geht vor Strichrechnung; Division durch null ist ein
Fehler. Referenzsubtraktionen funktionieren auch kompakt, etwa
`service.y-service.height`. IDs mit Punkten/Bindestrichen bleiben gültig: Die
längste passende deklarierte ID hat Vorrang. Bei einer ID `root.x-offset`
ist `root.x-offset.y` deren y-Koordinate; `root.x - offset.y` erzwingt die
Subtraktion. Ein pauschales Entfernen oder Trennen von Bindestrichen ist deshalb
keine geeignete Normalisierung. Berechnungen funktionieren ebenfalls für `via`, einschließlich gemeinsamer
`routes`-Vorgaben und Zuordnungslinien. Via verwendet absolute Diagrammkoordinaten
nach Positionierung der Nodes und Gruppen. Größen-, Endpunkt- und Labelpunkte
bleiben numerisch. Die Hilfe erklärt Inhaltskoordinaten in Packages, Grenzen
der automatischen Anordnung und die Fehlermeldungskette bei Zirkelbezügen.
Themen sind unabhängig von Groß-/Kleinschreibung; registrierte IDs und Namen
müssen exakt geschrieben werden. `#`-/`//`-Kommentare und JSON-Strings als
Parameter sind erlaubt. Innerhalb von `model` oder `view` ist `@help` nicht erlaubt.

## Iconpacks und Suche

```arch
@help iconpacks
```

Zeigt die **aktuell erfolgreich registrierten** Packs einschließlich der Anzahl
aller Icon- und Aliasnamen. Ohne zusätzliche Registrierung ist `core` verfügbar.
Die Hilfe lädt weder Dateien noch URLs und kennt keine externe Preview-cfg.

```arch
@help iconpacks core
```

Zeigt gültige Referenzen wie `core.service`. Für große Packs gibt es maximal
100 Namen pro Seite, eine Trefferzahl und bei Bedarf den Befehl zur nächsten
Seite. `FILTER` sucht als Teilstring, unabhängig von Groß-/Kleinschreibung.
`"*"` bedeutet alle Namen:

```arch
@help iconpacks lucide cloud
```

```arch
@help iconpacks tabler "*" 2
```

Diese beiden Beispiele benötigen zuvor registrierte Packs. Die Namen entsprechen
dem ersten Argument von `registerIconPack`, nicht zwingend dem JSON-`prefix`.

## Profile und Regeln

```arch
@help profiles
```

Die Profilübersicht nennt Version und Anzahl der Knoten-/Relationstypen und
Viewpoints. Eine Detailabfrage liefert die kompilierten Regeln, einschließlich
geerbter Attribute, Pflichtwerte, Enums, Grenzen und typisierter Referenzen:

```arch
@help types default service
```

Nach Registrierung der separaten UAF-/NAF-Profile:

```arch
@help types uaf Capability
```

```arch
@help relations uaf Implements
```

```arch
@help viewpoints naf4-uaf C1
```

Das neue NAFv4.1-Anwendungsprofil beschreibt alle 47 aktuellen Viewpoint-IDs
mit Quellen, strukturellen Regeln und Prüfgrenzen:

```arch
@help profiles naf41-uaf
```

```arch
@help viewpoints naf41-uaf C7
```

```arch
@help connections naf41-uaf OperationalPerformer
```

Das ausführbare Beispiel und die dokumentierten Anwendungsadapter stehen in
[profiles/naf41/README.md](profiles/naf41/README.md). Die Profilhilfe ist auf
Englisch. Erfolgreiche Validierung bescheinigt die implementierten
Strukturprüfungen, keine vollständige NAF-/UAF-Konformität.

Für das Cr-Beispiel auf S.103:

```arch
@help viewpoints naf41-uaf Cr
@help connections naf41-uaf EnterprisePhase
@help types naf41-uaf CapabilityIncrement
```

Die Abfragen jeweils als eigenes Hilfedokument verwenden.
`AggregatesEnterprisePhase` verbindet Gesamtphase → Teilphase,
`TriggersEnterprisePhase` auslösende → folgende Phase. Beide sind gerichtete,
azyklische Anwendungsadapter. Cr braucht keine sichtbaren Milestone-Knoten,
wenn diese wie auf S.103 implizite Properties sind. Vollständiges Beispiel:
[Capability Roadmap](examples/naf41-capability-roadmap.arch).
Es verwendet Connected mit `place`, `via` und gemeinsamen Aggregationspfaden.
Ein Tree über alle Beziehungen würde Hierarchie und Trigger vermischen;
für eine Tree-Gruppe nur `relations [AggregatesEnterprisePhase]` auswählen.

Für S1 stehen `Service` und `ServiceSpecification` zur Verfügung. Der erste
Name ist ein Alias des zweiten mit identischer Typsemantik; ActualService bleibt separat.
`@help connections naf41-uaf Service` zeigt die geerbten Beziehungen.
Spezialisierung: `ServiceGeneralization`, spezialisiert → allgemein.
Policy-Erfüllung: `SatisfiesServicePolicy`, Service → ServicePolicy.
Gruppierung: `GroupsService` (Gruppe → Service) und `AggregatesServiceGroup`
(Gruppe → Untergruppe). Die vorhandene inverse `ServicePolicySatisfiedBy`
bleibt gültig. ServicePolicy benötigt `ruleKind`, beispielsweise `Constraint`.
[Beispiel von S.105](examples/naf41-service-taxonomy.arch).

`@help types`, `relations` und `viewpoints` verwenden ohne explizite Profil-ID
`options.profile`, andernfalls `default`. Ein explizites Profil im Befehl
wählt gezielt dieses Profil. Abstrakte Typen sind in der Liste gekennzeichnet;
sie können nicht direkt im Modell instanziiert werden. Die Hilfe spiegelt die
registrierten Profilregeln wider und erweitert deren fachlichen Umfang nicht.

### Kandidaten für abstrakte Typen

```arch
@help types uaf OperationalAgent
```

Bei abstrakten Knoten- und Relationstypen zeigt die Hilfe zuerst **Concrete
subtypes**: alle konkreten direkten und indirekten Untertypen, auch bei
Mehrfachvererbung. Bei `OperationalAgent` sind dies im mitgelieferten UAF-Profil
`KnownResource`, `OperationalArchitecture`, `OperationalMitigation` und
`OperationalPerformer`. Für abstrakte Beziehungen gilt entsprechend
`@help relations PROFILE TYPE`.

Auch Fehlermeldungen nennen diese Kandidaten und den passenden Hilfebefehl.
Die strukturierten Diagnosen enthalten zusätzlich `candidates` (vollständige
Namensliste) und `help` (Befehl). Die Meldung selbst zeigt bei großen Listen
die ersten zwölf Namen und die Anzahl weiterer Treffer.

Mit `.` als Profilparameter verwendest du das aktuell ausgewählte Profil,
einschließlich lokaler Inline-Definitionen:

```arch
architecture "Local" {
  config {
    type Agent { abstract true }
    type Performer { extends Agent template person }
  }
  @help types . Agent
}
```

Die Kandidaten sind instanziierbare Untertypen. Attribut-, Container-, Endpunkt-
und Viewpoint-Regeln gelten weiterhin; die Kandidatenliste ist keine Zusage,
dass ein Typ ohne weitere Angaben in jedem Kontext gültig ist.

### Erlaubte Beziehungen für einen Knotentyp

Bidirektionale Beziehungen verwenden `relation ID a <-> b "Label"`.
`@help model` erklärt die Semantik; `@help relations . TYPE` zeigt die
Profilfreigabe `directions`. `[forward, both]` erlaubt beide Arten, `[both]`
verlangt eine bidirektionale Beziehung. Neue eigene Typen sind standardmäßig
vorwärts gerichtet. Die Übersicht `@help connections` nennt ebenfalls die
erlaubten Richtungen; Quelle/Ziel bezeichnen weiterhin die geschriebenen Rollen.

Für die Modellierung unvollständiger Architekturen: `config { validation draft }`.
`@help model` und `@help config` erklären, welche fehlenden Anforderungen zu
Warnungen werden und welche Fehler weiterhin blockieren. Der Hinweisbereich
steht unter dem Diagramm und ist Bestandteil des SVG-Exports.

`style EDGE_ID { display none }` blendet die ganze Beziehung pro View aus,
`display standard` zeigt sie wieder. `@help routing` beschreibt den Unterschied
zu `route EDGE_ID { label none }`, das lediglich das Label ausblendet.

Auch Nodes unterstützen `style NODE_ID { display none }`. Bei Packages werden
alle Nachkommen ausgeblendet, einschließlich ihrer Beziehungen. `@help styles`
erklärt diese Sichtbarkeit unabhängig von `showLabel` und den anderen
Einzelfeldern. Die Modell-/Profilanforderungen gelten weiterhin.

```arch
@help connections uaf OperationalPerformer
```

Die Übersicht unterscheidet **Outgoing relationships** (der abgefragte Typ ist
Quelle) und **Incoming relationships** (er ist Ziel). Jede Zeile nennt den
konkreten Relationstyp, alle konkreten Gegenstellen und einen Detailbefehl wie
`@help relations uaf IsCapableToPerform`. `allowSelf` und `acyclic` werden
ebenfalls angezeigt.

Die Ermittlung berücksichtigt Typvererbung, `from`/`to`, alternative `pairs`
und deren `fromExclude`/`toExclude`. Abstrakte Relationstypen und abstrakte
Gegenstellen werden ausgelassen. Die Abfrage funktioniert auch für eigene
Profile und mit `.` für das aktuell ausgewählte Profil:

```arch
architecture "Relations" {
  config { profile uaf }
  @help connections . OperationalPerformer
}
```

Die Liste beschreibt Endpunkttypen. Ob eine konkrete Beziehung im Modell
gültig ist, hängt zusätzlich von Pflichtattributen, Selbstbeziehungen,
Kardinalitäten, Zyklen, Containern und Viewpoint-Regeln ab. Ein abstrakter
abgefragter Typ zeigt seine geerbte Kompatibilität; für die genauen Regeln
einer Instanz den konkreten Untertyp abfragen. Ohne TYPE zeigt der Befehl
die verfügbaren Knotentypen und eine Eingabehilfe.

## JavaScript und Dokumentmodell

```js
console.log(arch.help());
console.log(arch.help('iconpacks core'));
console.log(arch.help('types', { profile: 'uaf' }));

const svg = arch.renderToString('@help diagrams sequence', {
  theme: 'dark',
  idPrefix: 'sequence-reference'
});

const document = arch.parse('@help types default service');
document.kind;             // 'help'
document.help;             // { topic: 'types', parameters: ['default', 'service'] }
document.views[0].id;      // 'help'
arch.validate(document);  // { valid: true, profile: ..., diagnostics: [] }
arch.layout(document);    // kind: 'help', rows, sections, bounds; nodes/edges leer
```

`help(query, options)` gibt einen Textstring zurück; `query` enthält das Thema
und seine Parameter **ohne** `@help`. Architekturmodelle behalten ihre bisherige
Form; Hilfedokumente sind durch `kind: 'help'` unterscheidbar. Wie bei
Architekturen bleibt das ausgewählte Profil als Snapshot im geparsten Dokument.
Die Iconpackliste wird bei jeder Ausgabe aus der aktuellen Registry gelesen.
Explizite Profil-IDs im Befehl werden ebenfalls bei der Ausgabe aufgelöst.

Unbekannte Themen, Profile, Typen, Packs, Seiten oder zusätzliche Parameter
ergeben verständliche Diagnosen. `validate` liefert diese als Bericht;
Rendering und `help` werfen `ArchError`. `renderAll` isoliert Fehler weiterhin
pro Codeblock. SVG unterstützt `theme: 'light' | 'dark'`, die Ansicht `help`
und einen validierten `idPrefix`. Text wird escaped, lange Zeilen werden
umgebrochen; keine ausführbaren HTML-Inhalte oder Netzwerkanfragen.

## Gemeinsame Referenzkarten

`@help views` beschreibt auch die Darstellung von InformationElements an Kanten:

```arch
view transfer "Data transfer" {
  referenceDisplay nodes
  referenceOccurrences shared
}
```

`shared` ist der Standard: eine Karte je Element, verbunden mit allen tragenden
Kanten. Mit `referenceOccurrences perEdge` erscheint eine Karte je Kante;
wiederholte Karten zeigen dieselbe Element-ID. Bereits sichtbare und explizit
platzierte Modellkarten bleiben gemeinsam. Diese Darstellung gilt für Connected-Views.

## Zuordnungspfeile routen

In einer Connected-View kannst du jeden Pfeil zwischen einem InformationElement
und seiner tragenden Relation separat steuern:

```arch
route data -> pickup {
  from left
  to 0.5
  via (370, -125), (370, 132)
  curve rounded
}
```

`data` ist die Element-ID, `pickup` die Relations-ID. `to` wählt eine Position
entlang des tatsächlichen Relationspfads: `0` ist dessen Anfang, `1` sein Ende.
Ohne `to` bleibt die automatische Ankerposition bestehen. `from` akzeptiert
`auto`, `top`, `right`, `bottom`, `left` oder einen absoluten Punkt `(X,Y)`.
Alle Wegpunkte sind absolute Diagrammkoordinaten, auch innerhalb eines Clusters.
`straight` verbindet ohne `via` zwei unterschiedliche Nodes direkt zwischen
den gewählten Ports, auch bei parallelen oder gegenläufigen Beziehungen.
Es gibt dabei keinen automatischen Versatz; identische Ports können überlappen.
Explizite `via`-Punkte bleiben Zwischenpunkte; Selbstkanten behalten ihre Schleife.

Bei grafischen Referenzkarten prüft die automatische Relationsbeschriftung
beide Seiten der Verbindung und bevorzugt die Seite mit weniger Konflikten
zu Karten, Zuordnungspfeilen und deren Beschriftungen. Damit kann das Label
auch oberhalb bzw. links liegen. Explizite `label (X,Y)`-Angaben bleiben fest.
Dies ist eine lokale Platzierungsheuristik, keine globale Kollisionsoptimierung.

`curve` unterstützt `orthogonal`, `straight`, `rounded` und `bezier`; bei Bezier
sind explizite `via`-Punkte die beiden Kontrollpunkte. Ein optionales `path`
ersetzt den vollständigen SVG-Pfad einschließlich seiner Endpunkte.
Manuelle Routen ersetzen die automatische Hindernisumgehung.

Die Syntax funktioniert bei `shared` und `perEdge`; die fachlichen Beziehungen
bleiben unverändert. Vollständiges Beispiel:
[naf41-walker-routing.arch](examples/naf41-walker-routing.arch).

## Gemeinsame Routing-Vorgaben

### Andockpositionen an Knotenseiten

```arch
route hasLocation {
  from bottom 1/2
  to left 0.25
  curve rounded
}
```

Alle vier Seiten `top`, `right`, `bottom`, `left` akzeptieren eine Position
zwischen 0 und 1, als Dezimalzahl oder Bruch (`1/2`, `3/4`, auch mit Leerzeichen).
Auf `top`/`bottom` läuft sie von links nach rechts, auf `left`/`right` von oben
nach unten. Ohne Wert gilt die Mitte (0.5); 0 und 1 liegen an den Ecken.
Die Position folgt dem Knoten auch beim Verschieben oder Ändern seiner Größe.
`auto` akzeptiert keine Position; Division durch null ist ungültig.

Für Zuordnungspfeile gilt zum Beispiel:

```arch
route data -> pickup { from right 1/4 to 1/2 }
```

`from` wählt hier die Position an der Karte, `to` weiterhin den Anteil entlang
der tragenden Relation. Auch `routes { from bottom 1/2 }` ist möglich. Eine
konkrete Endpunktangabe ersetzt Seite und Position zusammen; `from left` nutzt
daher die linke Mitte, unabhängig von einer geerbten Position. Freie `path`-
Angaben haben Vorrang. Explizit positionierte Ports werden nicht automatisch
mit `sharePath` gebündelt. `@help routing` enthält die Syntax ebenfalls.

### Vorgaben und Überschreibungen

Innerhalb einer Connected-View setzt `routes` Vorgaben für alle fachlichen Kanten
und Zuordnungspfeile, auch ohne einzelne Routing-Blöcke:

```arch
routes { curve straight }

route pickup { curve rounded }
route data -> pickup { from left }
```

Hier verwendet `pickup` abgerundete Ecken; der Zuordnungspfeil übernimmt
`straight` und startet links an der Karte. Konkrete Angaben haben pro Eigenschaft
Vorrang; die Reihenfolge der Blöcke ist beliebig.

Erlaubt sind `from`, `to`, `via`, `curve`, `label`, `path`, `icon`, `iconPosition`, `showIcon`, `showLabel`, `sharePath`, `color`, `width` und `dasharray`. Ein `to`-Port oder
absoluter Zielpunkt gilt für fachliche Kanten; ein `to`-Wert von 0 bis 1 für
Zuordnungspfeile. `label` gilt nur für fachliche Kanten. Konkrete Angaben zu
`from`, `to`, `via` oder `curve` ersetzen einen geerbten freien `path`.
Ein konkret gesetzter `path` steuert den gesamten Pfad. `routes {}` lässt das
bisherige automatische Routing bestehen. Siehe auch `@help routing`.

## Farbe, Breite und Strichmuster von Routen

```arch
routes { color "#64748b" width 2 dasharray [8, 4] }
route cr.6 { color red width 3 dasharray none }
route data -> pickup { color blue width 1.5 dasharray [2, 3] }
```

Die Optionen gelten in Connected-Views einschließlich benannter Tree-Gruppen.
Einzelrouten überschreiben Vorgaben feldweise. `color` akzeptiert CSS3-Farbnamen
und `"#RGB"`/`"#RRGGBB"`; Hexwerte müssen in Anführungszeichen stehen. Die Farbe
gilt für Linie und Pfeilspitzen, während Labeltexte/-rahmen und Icons ihre
bisherigen Farben behalten. Ohne Vorgabe gilt die Kantenfarbe des Themes.

`width` ist eine SVG-Strichbreite von 0,1 bis 64 (Standard 1,5). Pfeilspitzen
skalieren mit; die Exportgrenzen berücksichtigen breite Marker.
`dasharray [8, 4]` bedeutet 8 Einheiten Strich, 4 Einheiten Lücke. Zulässig sind
1–32 nichtnegative Zahlen bis 10000, davon mindestens eine positiv. Ungerade
Listen werden wie in SVG verdoppelt. Auch `"8 4"` und `"8,4"` sind möglich.
`dasharray none` oder `[]` erzwingt eine durchgezogene Linie; Einheiten/Prozentwerte
sind nicht erlaubt. Ohne Vorgabe bleiben Dependency-/Realization-Kanten bei
`6 5`, andere Kanten und Zuordnungslinien durchgezogen.

Zuordnungslinien übernehmen dieselben Vorgaben und erlauben eigene Overrides.
Reine Stiländerungen erhalten ihre automatische Hindernisumgehung und einen
geerbten freien `path`. `sharePath` bündelt nur übereinstimmende Farben, Breiten
und Strichmuster. JSON verwendet dieselben Felder und Zahlenlisten.
Beispiel: [Route line styles](examples/route-styles.arch), auch in der Demo.

## Gemeinsame Kantenpfade

```arch
routes { sharePath stereotypes }
route special { sharePath none }
```

`none` ist der Standard. `stereotypes` bündelt nur exakt gleiche Relationstypen,
`all` auch unterschiedliche Typen mit kompatiblem Linienstil und Pfeilrichtung.
Gemeinsamer Start- oder Zielknoten und passende Ports sind erforderlich.
Einzelne `route`-Eigenschaften haben Vorrang. Labels/Icons bleiben je Beziehung
sichtbar; der gemeinsame Abschnitt und seine Pfeilspitze werden einmal gezeichnet.

Die Option gilt in Connected-Views einschließlich benannter Tree-Gruppen.
Gemeinsame Abzweige sind rechtwinklig, auch bei `curve rounded`. Es handelt sich
um eine automatische Anordnung bei ausreichend freiem Platz: Hindernisse,
zu wenig Labelplatz, manuelle `via`/`path`, absolute Endpunkte, explizit
positionierte Seitenports, `straight`/`bezier`,
parallele Beziehungen und Kanten zwischen Containern bleiben unabhängig.
Fan-in hat Vorrang vor Fan-out. Grafische Zuordnungslinien werden nicht gebündelt;
sie folgen weiterhin dem vollständigen Pfad ihrer jeweiligen Beziehung.

JSON: `"routes": {"sharePath": "stereotypes"}`. Beispiel:
[Shared paths / C8](examples/shared-paths.arch). Laufzeithilfe: `@help routing`.

Für C8 unterstützt das Profil zusätzlich `Constraint` als Untertyp von
`StrategicConstraint`: `Constraint assumption "C2 unit must be available"`.
`relation applies assumption -> capability "applies to" {type ConstrainsCapability}`
verbindet ihn mit der Capability. `@help connections naf41-uaf Constraint`
zeigt zulässige Beziehungen, `@help types naf41-uaf Constraint` die Attribute.

## Icons an Edge-Labels

In Connected-Views kannst du ein Icon innerhalb des Labelrahmens platzieren:

```arch
routes { icon core.cloud iconPosition left }

route pickup {
  icon core.shield
  iconPosition top
}

route delivery { icon none }
```

`iconPosition` unterstützt `top`, `left`, `bottom`, `right`, relativ zum
Beschriftungstext. Standard ist `left`. Konkrete Angaben überschreiben die
Vorgaben feldweise; `icon none` deaktiviert ein geerbtes Icon. Iconnamen stammen
wie bei Knoten aus registrierten Packs (`PACK.NAME`). Die Darstellung erhält
Farben und Seitenverhältnis und funktioniert auch ohne Labeltext.

Labelgröße und SVG-Grenzen berücksichtigen das Icon. Diese Optionen gelten für
Labels fachlicher Kanten; Zuordnungspfeile erhalten keine Labels. Node-Icons
werden unabhängig über `style NODE_ID { iconPosition ... }` positioniert.

Beispiel mit allen vier Positionen: [edge-label-icons.arch](examples/edge-label-icons.arch).
Siehe auch `@help routing`.

## Labels ausblenden

`label none` blendet Text, Rahmen und Icon eines fachlichen Relationslabels aus:

```arch
routes { label none }
route pickup { label (450, 100) }
route delivery { label none }
```

Hier sind alle Labels ausgeblendet; die konkrete Position blendet das Label von
`pickup` einschließlich eines eventuell geerbten Icons wieder ein. Die
Reihenfolge der Blöcke ist beliebig. Ausgeblendete Labels belegen keinen Platz
im Layout. Modell, Kanten-Tooltips, InformationElements und Zuordnungspfeile
bleiben erhalten. Beispiel: [edge-label-visibility.arch](examples/edge-label-visibility.arch).

## Node-Icons positionieren und Felder auswählen

```arch
style fighter {
  iconPosition right
  showIcon true
  showLabel true
  showStereotype false
  showDescription false
  showTechnology false
}
```

Alle `show...`-Schalter sind standardmäßig `true`. `showLabel` steuert den
Node-Titel, `showStereotype` die Typ-/Stereotypzeile. `iconPosition` akzeptiert
`top`, `left`, `bottom`, `right`; Kartenmaße und Texte passen sich an. Ohne
Angabe bleibt die bisherige Templateposition bestehen. Bei Packages bleiben
Icons im Kopfbereich; ausgeblendete Kopftexte verbergen keine Kinder.

Im Modus `display logo` wird das Icon ohne Positionsangabe zentriert, sonst
innerhalb des gepolsterten Rechtecks an der gewählten Seite ausgerichtet.
Dieser Modus blendet weiterhin alle Texte aus; mit `showIcon false` bleibt
nur das Rechteck. Für frei kombinierbare Textfelder verwende `display standard`.
Die Optionen gelten für Connected-Views und deren Referenzkarten; Modellwerte
und Tooltips bleiben erhalten.

## Berechnete Node-Styles

In Connected- und Tree-Views akzeptieren `width`, `height` und `fontSize`
arithmetische Ausdrücke:

```arch
style source { width 240 height 100 fontSize 15 }
style target {
  width source.width + 80
  height 2 * source.height
  fontSize source.style.fontSize * 1.2
}
```

`source.height` liefert die gemessene Kartenhöhe einschließlich sichtbarer
Inhalte; `source.style.height` bleibt der explizit konfigurierte Mindestwert
100. Entsprechend sind `.width`, `.fontSize` und `.style.width/.fontSize`
verfügbar. Effektive Schriftgröße ohne Override: 15. `.style` benötigt einen
expliziten Wert in dieser View; es gibt dafür keinen impliziten Standardwert.

Erlaubt sind `+`, `-`, `*`, `/`, Vorzeichen und Klammern. Vorwärtsreferenzen
auf sichtbare Nodes sind möglich; Zyklen (auch über Textumbruch/Höhenmessung),
Division durch null und ungültige Ergebnisse werden mit einer Fehlermeldung
abgewiesen. Mindestwerte: Breite 160, Höhe 96; Obergrenze jeweils 10000000.
Schriftgröße: 6–64. Höchstens 32 Terme, 16 Klammerebenen und 2048 Zeichen.
Punkte/Bindestriche in IDs bleiben erlaubt; die längste deklarierte passende
ID wird verwendet. Leerzeichen um Minus vermeiden mehrdeutige Schreibweisen.

Die Berechnung erfolgt vor Positionierung und Routing. Finale Paketgrößen
und Tree-Gruppenmaße sind deshalb keine Messreferenzen; explizite Paketwerte
wie `packageId.style.height` sind möglich. Positionsfelder und Routenstyles
gehören nicht zu diesen Styleausdrücken. In JSON stehen Ausdrücke als Strings;
DSL-/JSON-/Meta-Ausgabe bewahrt die Referenzen. Laufzeithilfe: `@help styles`.
Vollständiges Beispiel: [style-expressions.arch](examples/style-expressions.arch).

## Route-Icon und Text getrennt auswählen

```arch
routes { icon core.cloud showIcon true showLabel false }
route pickup { showIcon false showLabel true }
```

`showIcon` und `showLabel` sind standardmäßig `true`; `showLabel` steuert den
Labeltext. So lassen sich nur Icon, nur Text oder beide darstellen. Beide
Schalter auf `false` blenden auch den Rahmen aus. Einzelne `route`-Angaben
überschreiben die Vorgaben pro Eigenschaft. `label none` blendet weiterhin das
ganze Label aus, unabhängig von diesen Schaltern.

Vollständiges Beispiel: [node-presentation.arch](examples/node-presentation.arch).
Details unter `@help styles` und `@help routing`.

## Eine, mehrere oder alle Views rendern

```arch
config {
  profile naf41-uaf
  views all
}
```

`views all` rendert alle definierten Views untereinander, in Definitionsreihenfolge.
Für eine Teilmenge oder eine einzelne View:

```arch
config { views [detail, overview] }
```

```arch
config { views detail }
```

Die Liste bestimmt die Reihenfolge. IDs müssen existieren und eindeutig sein;
leere Listen sind nicht erlaubt. Das Feld kann mit registrierten oder Inline-
Profilen kombiniert werden und funktioniert auch ohne Profilangabe. Ohne
Auswahl bleibt die erste View der Standard. Eine View mit der ID `all` kannst
du über `views [all]` gezielt auswählen.

Die API unterstützt dieselbe Auswahl:

```js
arch.render(container, source, { views: 'all' });
arch.renderToString(source, { views: ['detail', 'overview'] });
arch.renderToString(source, { view: 'detail' });
```

Priorität: `options.view` → `options.views` → `config.views` → erste View.
Mehrere ausgewählte Views erzeugen ein einzelnes SVG mit Überschriften und
getrennten inneren Viewports; eigene Themes und Renderer bleiben erhalten.
`theme` im API-Aufruf überschreibt alle ausgewählten Views. Ein `idPrefix`
wird für jede enthaltene View erweitert, damit Marker-/Icon-IDs eindeutig bleiben.
Das gilt auch für Markdown, `renderAll`, den SVG-Download und `render()`.

`layout()` gibt bei mehreren Views `kind: 'views'` mit `layouts`, `sections`,
gemeinsamen `bounds` und nach IDs vereinigten `nodes`/`edges` zurück. Bei einer
View bleibt das Layoutformat unverändert. `@help` bleibt eine einzelne Hilfeseite.
Die Beispieloberfläche bietet **Configured views** und die einzelnen Views im
Dropdown; die konfigurierte Ausgabe wird auf die Breite eingepasst und kann
vertikal gescrollt werden. Beispiel: [multiple-views.arch](examples/multiple-views.arch).

## Häufige Stolperstellen

Die vorhandenen APIs akzeptieren jetzt auch JSON-Strings und JSON-Quellobjekte
mit `architecture`-Hülle. Syntax und Rezepte stehen in [JSON.md](JSON.md).
`@help json` zeigt dieselbe Referenz auf Englisch. Ein Hilfedokument kann selbst
als `{ "@help": "json" }` beschrieben werden. In Markdown bleibt die Fence-
Sprache `arch`, auch wenn der Inhalt JSON ist.

Im View-Menü übersetzt **Meta view · JSON/DSL** in die jeweils andere Notation.
Auch fehlerhafte Quellen lassen sich dort untersuchen: markierter Ausschnitt,
Sprung zur Zeile und konkrete Vorschläge. Lesbare Syntax bleibt trotz fachlicher
Fehler übersetzbar; Vorschläge werden nicht automatisch angewendet. Details und
API: [META.md](META.md), `@help meta`.

Für die Darstellung innerhalb einer Architektur statt nur im Editor eine
Quellenview deklarieren: `view source "JSON" { @meta json }` oder `@meta dsl`.
Sie ist mit `views all` gemeinsam mit Diagrammen als SVG exportierbar. Die
Direktive direkt in `architecture` erzeugt die ID `meta-json` bzw. `meta-dsl`.

| Beobachtung | Erklärung / nächster Schritt |
| --- | --- |
| Nur eine View erscheint | Ohne Auswahl gilt die erste View. `config { views all }` setzen; ein API-`view` oder die manuelle Dropdown-Auswahl hat Vorrang. |
| Eine nicht ausgewählte View verursacht einen Modellfehler | Profil- und Viewregeln gelten für das ganze Dokument. Die Renderauswahl unterdrückt keine Validierungsfehler. |
| `@help` zeigt kein Diagramm | Beabsichtigt: Genau eine Hilfeseite ersetzt die Diagrammausgabe. Für Hilfe und Diagramm getrennte Codeblöcke verwenden. Die Direktive steht auf Architektur-Ebene, nicht im `model`-/`view`-Block. |
| `OperationalAgent` ist abstrakt | Einen konkreten Untertyp wählen; `@help types naf41-uaf OperationalAgent` zeigt die Typdefinition und Kandidaten. |
| Erlaubte Kanten eines Typs sind unklar | `@help connections naf41-uaf OperationalPerformer` zeigt gerichtete Möglichkeiten. Das Profil muss vorher registriert sein. |
| Ein Style funktioniert in einer Matrix/Sequenz nicht | Connected-Präsentationsoptionen gelten dort nicht. Die [Unterstützungstabelle](DIAGRAMS.md#gemeinsame-regeln-und-grenzen) nennt abgewiesene und rendererabhängige Optionen. |
| `showLabel false` lässt andere Node-Texte stehen | Nur der Titel wird ausgeblendet. `showStereotype`, `showDescription`, `showTechnology` separat setzen; Logo-Modus hat überhaupt keine sichtbaren Texte. |
| `showIcon true` zeigt trotz `label none` kein Kantenicon | `label none` versteckt das ganze Label. Für ein Icon ohne Text `showLabel false` verwenden und `label none` entfernen bzw. durch eine konkrete Labelposition überschreiben. |
| Ein InformationElement erscheint mehrfach | Mit `referenceOccurrences shared` wird eine Karte je Identität verwendet (Standard); `perEdge` erzeugt bewusst Kopien mit ID. In verschiedenen Views wird das Element jeweils neu dargestellt. |
| `validate()` gelingt, Rendering schlägt fehl | Iconnamen und freie SVG-Pfade werden erst beim Rendern der betroffenen View geprüft. Pack registrieren, Namen/Pfad korrigieren und Renderfehler im Aufrufer abfangen. |

Eine Mehrfachview-Ausgabe ist eine gemeinsame SVG-Ausgabe; ein Renderfehler in
einer ausgewählten View verhindert sie vollständig. Unabhängige DOM-Codeblöcke
werden durch `renderAll()` getrennt behandelt. `renderMarkdown()` bietet diese
Fehlerisolation nicht. API-Vertrag: [SPEC.md](SPEC.md#prüfgrenzen-und-fehlerverhalten).

## Aliasnamen, Mappings und Versionen

`@help aliases naf41-uaf` listet Aliasnamen und ihre kanonischen Ziele.
`@help mappings naf41-uaf` zeigt dokumentierte Framework-/Versionszuordnungen.
`@help types naf41-uaf Service` zeigt Aliasidentität und vollständige Regeln;
`@help connections naf41-uaf Service` berücksichtigt die gemeinsame Identität.
Jeweils einen Befehl pro Hilfedokument verwenden; `.` wählt das Dokumentprofil.

Eine geladene Revision lässt sich mit
`config { profile "naf41-uaf@4.1.0-arch.16" }` festlegen. Auch die Hilfebefehle
akzeptieren diesen qualifizierten Profilnamen. Unqualifizierte IDs bleiben
möglich. `arch.getProfileVersions('naf41-uaf')` zeigt geladene Revisionen;
es werden keine historischen Dateien automatisch geladen.

Aliase werden im externen JSON-Profil definiert, nicht im Inline-config-Block.
Mappings allein akzeptieren keine zusätzlichen Modelltypen. Details und Beispiele:
[Aliase und Mappings](profiles/naf41/ALIASES.md).

## S2: logische Knoten und physische Ressourcen

Ab `naf41-uaf@4.1.0-arch.11` sind `Node` und `PhysicalActiveResource` direkt
verwendbar. Node ist ein Alias von LogicalNode; PhysicalActiveResource ein
konkreter Untertyp von ResourcePerformer. Für Letzteren ist
`isStandardConfiguration true|false` weiterhin ausdrücklich anzugeben.

`@help types naf41-uaf Node`, `@help types naf41-uaf PhysicalActiveResource`
und `@help viewpoints naf41-uaf S2` erklären Typen und Grenzen. Jeweils einen
Befehl pro Hilfedokument verwenden. Die Richtungen des Beispiels sind:
`ConsumesService` Node → Service, `EnablesService` ServiceFunction → Service,
`RealizesService` PhysicalActiveResource → Service. Die nativen UAF-Beziehungen
Consumes, IsCapableToPerform und Implements behalten ihre bisherigen Regeln.
Vollständiges Beispiel: [S2 Service Structure](examples/naf41-service-structure.arch).

Für `aggregates` in S2 ist ab Profilrevision `4.1.0-arch.12`
`ServiceAggregation` verfügbar: Gesamtservice → Mitgliedservice. Beispiel:

```arch
relation groups documentManagement -> storage "aggregates" {
  type ServiceAggregation
}
```

`@help relations naf41-uaf ServiceAggregation` zeigt Endpunkte und Regeln.
Die Beziehung ist eigenständig und erlaubt gemeinsam referenzierte Mitglieder;
Selbstbezüge/Zyklen sind verboten. `ServiceComposition` bleibt als separater
Typ für Komposition erhalten. Beide zählen zu den strukturellen S2-Verbindungen.

## S3: ServiceOperation und DataProductType

Seit `naf41-uaf@4.1.0-arch.13` sind beide Namen verfügbar. ServiceOperation ist
ein Alias von ServiceMethod; DataProductType spezialisiert DataElement und
PhysicalPassiveResource. „Position Report“ ist ein Element dieses Datenprodukttyps.

`HasServiceOperationParameter` verbindet Operation → Parameter,
`InvolvesPhysicalResource` Parameter → physische passive Ressource/Datenprodukt.
Ein Parameter darf mehreren Operationen zugeordnet sein. In S3 ist die
Ressourcenzuordnung optional; bestehende owner-/resource-Referenzen bleiben
nutzbar. S7 verlangt weiterhin beide Zuordnungen, über Kanten oder Referenzen.

Jeweils einzeln: `@help types naf41-uaf ServiceOperation`,
`@help types naf41-uaf DataProductType`, `@help viewpoints naf41-uaf S3`.
[Ausführbares Beispiel von S.110](examples/naf41-service-interfaces.arch).

## S4: Service Functions

Das Profil unterstützt das Beispiel auf S.112 und die gerichteten Beziehungen
des Cut-outs auf S.111. Die Zuordnungen und Grenzen sind in der
[S4-Profilbeschreibung](profiles/naf41/README.md#s4-functions-aggregation-and-service-context-pp111112) dokumentiert.

```arch
relation enables storing -> service "enables" {type EnablesService}
relation contains storing -> persisting "aggregates" {type ServiceFunctionAggregation}
```

Teilfunktionen benötigen keine zusätzliche direkte Servicekante, wenn ein
ausgewählter Aggregationsvorfahr den Service ermöglicht. Isolierte Funktionen
bleiben Fehler; mehrere Aggregationseltern sind erlaubt, Zyklen nicht.
ServiceProvider und ServiceConsumer bilden die optionalen Rollen des Cut-outs ab.
Alle Relationstypen: @help viewpoints naf41-uaf S4.

Beispiele: [Service Functions](examples/naf41-service-functions.arch) und
[S4 Cut-out](examples/naf41-service-functions-cutout.arch), auch im Demo-Menü.

## S5: Transition als Element und als Kante

```arch
ServiceStateTransition loss "In Service to Out of Service"
ServiceEvent denial "Denial of Service"
relation change inService -> outOfService "" {
  type ServiceStateTransition
  transition loss
}
relation trigger denial -> loss "triggers" {type TriggersServiceStateTransition}
```

Knoten und Relation dürfen denselben Typnamen haben, brauchen aber eigene IDs.
Die Kante definiert Anfangs-/Endzustand; transition verbindet das zugehörige
Element mit ihr. Die Zuordnung wird als is equal to beschriftet und lässt sich
mit `route loss -> change {from top to 1/2}` routen. Eine S5-View verlangt
genau eine ausgewählte Übergangskante je ausgewähltem Transitionselement.

HasServiceState ordnet Service → Zustand zu. Die bisherige owner-Referenz
ist alternativ gültig. HasServiceMode ordnet Funktion → Modus zu; alternativ
bleibt die function-Referenz möglich. StateEnablesServiceFunction und
EnablesService bilden die enables-Kanten des Cut-outs ab. GroupsServiceState
und AggregatesServiceStateGroup ermöglichen Gruppen und Untergruppen.

Die bisherige kompakte Übergangskante mit optionalem event bleibt gültig.
[Beispiel S.115](examples/naf41-service-states.arch),
[vollständiger Cut-out](examples/naf41-service-states-cutout.arch),
[Profilregeln und Grenzen](profiles/naf41/README.md#s5-objectified-transitions-and-state-context-pp113115).

`@help types naf41-uaf ServiceStateTransition` erklärt das Element,
`@help relations naf41-uaf ServiceStateTransition` die Kante.

## S6: ServiceInteraction als Element

```arch
ServiceInteraction request "Request Sortie"
relation message coordinationLine -> sarLine "Request Sortie" {
  type ServiceInteraction
  order 1
  interaction request
}
```

RepresentsService ordnet Lifeline → Service zu; alternativ bleibt die
represents-Referenz gültig. TriggersServiceInteraction verbindet Event →
Interaktionselement, InteractionRelatesOperation verbindet Interaktionselement →
ServiceOperation. Das Element ist über interaction an genau eine ausgewählte
Nachrichtenkante gebunden; is equal to erscheint als Zuordnung.

`diagram sequence {orderAttribute order showContext true}` zeigt die
Objektkarten und den ausgewählten Service-/Interface-/Operations-/Ereigniskontext.
Der Renderer erkennt ServiceInteraction-Nachrichten über generische Profilmetadaten.
Alte kompakte Nachrichten mit event/operation bleiben gültig.
[Beispiel](examples/naf41-service-sequence.arch),
[Cut-out](examples/naf41-service-sequence-cutout.arch).
`@help viewpoints naf41-uaf S6` und `@help diagrams sequence`.
