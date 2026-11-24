# Architektur als JSON

arch.js akzeptiert dieselbe Architektur als Text-DSL oder als JSON-Dokument.
Die Struktur folgt den vorhandenen Sprachblöcken; fachliche Regeln, Defaults,
Viewauswahl, Layouts und SVG-Ausgabe sind identisch. JSON benötigt keinen
gesonderten Renderer und keinen zusätzlichen Loader.

```json
{
  "architecture": {
    "name": "Test",
    "config": { "views": "all" },
    "model": {
      "elements": {
        "user": { "type": "person", "name": "User" },
        "api": { "type": "service", "name": "API", "technology": "REST" }
      },
      "relations": {
        "calls": { "from": "user", "to": "api", "name": "Calls" }
      }
    },
    "views": {
      "overview": {
        "name": "Overview",
        "place": { "user": { "at": [0, 0] }, "api": { "at": [400, 0] } },
        "routes": { "curve": "straight" }
      }
    }
  }
}
```

Die Beispieloberfläche enthält **JSON architecture**, mit Package und Matrix.
Dateien: [json-architecture.json](examples/json-architecture.json),
[json-naf41.json](examples/json-naf41.json). Das NAF-Beispiel benötigt die
registrierten Profile `uaf` und `naf41-uaf`; in `index.html` sind sie geladen.
Eingebaute englische Referenz: `@help json`.

## Eingabe über die vorhandenen APIs

```js
const document = JSON.parse(jsonText);
const model = arch.parse(document);                 // oder arch.parse(jsonText)
const report = arch.validate(document);
const graph = arch.layout(document, { views: 'all' });
const svg = arch.renderToString(document);
arch.render('#diagram', document);
```

Ein String, der nach führendem Leerraum mit `{` oder `[` beginnt, wird als JSON
gelesen. Gültige Architekturquellen haben die Hülle `architecture`; Array-Wurzeln
werden zurückgewiesen. Ein übergebenes Objekt wird ohne Mutation verarbeitet.
Registrierung, Profilparameter und API-Overrides funktionieren wie bei der DSL.
Die Editor-Quelltextausgabe speichert JSON als `.json`, DSL weiterhin als `.arch`.

`parse()` liefert weiterhin das bisherige normalisierte Modell mit `title`,
`nodes`, `edges` und `views`. Dieses API-Modell ist **nicht** das hier beschriebene
Quellformat. Bereits geparste Modelle und deren JSON-Serialisierung bleiben als
Eingabe für `validate`, `layout` und Rendering verwendbar. `arch.translate(source)`
übersetzt zwischen DSL und JSON-Quellformat; die [Meta-View](META.md) zeigt die
andere Notation einschließlich Fehlerstellen und Korrekturkandidaten.

## Zuordnung zur DSL

| DSL | JSON |
| --- | --- |
| `architecture "Test" { … }` | `{ "architecture": { "name": "Test", … } }` |
| `description "Text"` | `"description": "Text"` |
| `config { profile naf41-uaf views all }` | `"config": { "profile": "naf41-uaf", "views": "all" }` |
| `config { presentation dashboard views overview, detail }` | `"config": { "presentation": "dashboard", "views": ["overview", "detail"] }` |
| `OperationalPerformer fighter "Fighter"` | `"elements": { "fighter": { "type": "OperationalPerformer", "name": "Fighter" } }` im Modell |
| `relation control c -> f "Controls" { type LogicalInteraction }` | `"relations": { "control": { "from": "c", "to": "f", "name": "Controls", "type": "LogicalInteraction" } }` |
| `view logical "Interactions" { viewpoint L3 }` | `"views": { "logical": { "name": "Interactions", "viewpoint": "L3" } }` |
| `include a, b` oder `include [a, b]` / `exclude c` oder `exclude [c]` | `"include": ["a", "b"]` / `"exclude": ["c"]` |
| `place a at (0, 20) size (280, 160)` | `"place": { "a": { "at": [0, 20], "size": [280, 160] } }` |
| `place a at (b.right + 40, c.y - 20)` | `"place": { "a": { "at": ["b.right + 40", "c.y - 20"] } }` |
| `place a right of b gap b.height / 4 align top` | `"place": { "a": { "relative": { "side": "right", "of": "b", "gap": "b.height / 4", "align": "top" } } }` |
| `style a { iconPosition right showLabel false }` | `"style": { "a": { "iconPosition": "right", "showLabel": false } }` |
| `routes { curve straight }` | `"routes": { "curve": "straight" }` |
| `route control { from right to left }` | `"route": { "control": { "from": "right", "to": "left" } }` |
| `route control { via (source.right + 40, target.y / 2) }` | `"route": { "control": { "via": [["source.right + 40", "target.y / 2"]] } }` |
| `route information -> control { to 0.5 }` | `"route": { "information -> control": { "to": 0.5 } }` |
| `diagram sequence { participants [c, f] }` | `"diagram": { "type": "sequence", "participants": ["c", "f"] }` |
| `diagram state { initial start final done, cancelled }` | `"diagram": { "type": "state", "initial": "start", "final": ["done", "cancelled"] }` |
| `view source "JSON" { @meta json }` | `"views": { "source": { "name": "JSON", "@meta": "json" } }` |

Die DSL-Listen `include`, `exclude`, Tree-`nodes` und `propertyFields` akzeptieren
Namen mit oder ohne eckige Klammern, auch einzelne Einträge. Im exportierten JSON
bleiben sie Arrays. `include []` / `"include": []` wählt keine Elemente,
`exclude []` entfernt nichts und `propertyFields []` leert die Feldauswahl.
In `"exclude": ["l2.1", "l2.2"]` können auch Beziehungs-IDs stehen. Die
Beziehungen entfallen aus Darstellung und Viewpoint-Prüfung der View.
Tree-`nodes []` bleibt ungültig. Dies gilt für `propertyFields` auf View-,
Diagramm- und Node-Style-Ebene; andere Listenoptionen behalten ihre Syntax.

`name` steht für den Titel nach der ID, nicht für die ID selbst. IDs bleiben
case-sensitive und folgen `[A-Za-z_][A-Za-z0-9_.-]*`. Numerische Objektschlüssel
sind deshalb keine gültigen Element-/View-IDs. Fehlende Views erzeugen wie in
der DSL eine Default-View. Ein Modellblock ist erforderlich, außer im Hilfemodus.
`model` erlaubt `elements` und `relations`, beide optional für ein leeres Modell.

`"@meta": "json"` oder `"@meta": "dsl"` in einer View erzeugt eine exportierbare
Quellenview. `"meta"` ist ein Alias. Auf Architektur-Ebene erzeugt `"@meta"`
die implizite View `meta-json` bzw. `meta-dsl` nach den expliziten Views.
Darstellung, Auswahl, Grenzen und Abgrenzung zur interaktiven Editoransicht:
[META.md](META.md).

### Attribute und verschachtelte Packages

Beziehungen verwenden optional `"direction": "both"` für `<->`; fehlend oder
`"forward"` entspricht `->`. Beispiel eines Eintrags in `model.relations`:

```json
"exchange": {
  "from": "a", "to": "b", "name": "Exchange",
  "type": "flow", "direction": "both"
}
```

Der Relationstyp muss diese Richtung erlauben. Inline-Profile verwenden
`config.relation.exchange.directions: ["forward", "both"]`; registrierte
Profil-JSONs verwenden `relationTypes.exchange.directions`.
`direction` ist ein eingebautes Beziehungsfeld.

`config.validation` akzeptiert `"strict"` (Standard) oder `"draft"`. Der
Entwurfsmodus rendert trotz fehlender Pflichtangaben/Mindestverbindungen und
zeigt Warnungen unter dem Diagramm; andere Fehler bleiben blockierend.
`views.VIEW_ID.style.EDGE_ID: {"display": "none"}` blendet eine Beziehung nur in
dieser View aus; `"standard"` zeigt sie. JSON/DSL-Übersetzungen erhalten beides.
Dasselbe Feld an einer Node-ID blendet die Node und angrenzende Kanten aus;
Packages verbergen ihren gesamten Inhalt. Die Modellvalidierung bleibt aktiv.

Standardattribute und eigene Profilattribute stehen direkt am Element oder an
der Beziehung. Beispielsweise entspricht `"conveyed": ["information"]` dem
DSL-Attribut `conveyed [information]`. Boolesche Werte und Zahlen bleiben typisiert;
`false`, `0` und `"false"` sind unterschiedliche Werte.

Kinder stehen in `elements` und gegebenenfalls `relations` des Containers:

```json
{
  "platform": {
    "type": "package",
    "name": "Platform",
    "elements": {
      "api": { "type": "service", "name": "API" }
    }
  }
}
```

Dies ist der Inhalt einer `elements`-Sammlung. Die Kind-ID `api` ist weiterhin
architekturweit eindeutig. Ob ein Typ Kinder enthalten darf, bestimmt das Profil.
Beziehungen können wie in der DSL innerhalb eines Containers oder am Modell
stehen; ihre Endpunkte bleiben globale IDs.

Strukturfelder wie `name` und `elements` belegen im JSON eigene Namen. Ein
gleichnamiges zulässiges Fachattribut kann deshalb im `attributes`-Objekt stehen:

```json
{ "type": "thing", "name": "Displayed title", "attributes": { "name": "Domain-specific name" } }
```

Dieses Beispiel setzt einen Profiltyp `thing` mit String-Attribut `name` voraus.
Direkte Attribute und `attributes` dürfen denselben Attributnamen nicht doppelt
setzen. Die im Modell reservierten Attributnamen bleiben auch hier reserviert.
`attributes` ist keine Möglichkeit, Profil- oder Strukturregeln zu umgehen.

### Reihenfolge und Listen mit IDs

Sammlungen für `elements`, `relations`, `views` und Inline-Regeldefinitionen
können statt eines ID-Objekts auch eine Liste mit `id` pro Eintrag verwenden:

```json
"views": [
  { "id": "overview", "name": "Overview" },
  { "id": "detail", "name": "Detail", "include": ["api"] }
]
```

Dies ist ein Ausschnitt des Architekturblocks. arch.js übernimmt die eingelesene
Reihenfolge. Da JSON-Objekte im allgemeinen Austausch keine geordnete Sammlung
garantieren, sind Arrays die eindeutige Wahl, wenn die Definitionsreihenfolge
wichtig ist. Zusätzlich kann `"config": { "views": ["detail", "overview"] }`
die Ausgabereihenfolge ausdrücklich bestimmen. ID-Objektschlüssel und ein
zusätzliches `id` im selben Eintrag dürfen nicht kombiniert werden.
`place`, `style` und `route` bleiben Objekte mit Zielschlüsseln.

### Routing, Styles und Diagrammtypen

Ein Zustandsdiagramm speichert virtuelle Punkte als `virtualInitial` und
`virtualFinal`. Auf View-Ebene stehen ihre Positionen in `virtualPlace` und
ihre Pfeilrouten in `virtualRoute`, jeweils mit der virtuellen ID als Schlüssel.
Für modellierte Übergänge gilt das reguläre `route`-Objekt.

```json
{
  "diagram": {
    "type": "state",
    "virtualInitial": {"id": "start", "target": "waiting"},
    "virtualFinal": [{"id": "end", "source": "waiting", "event": "shutdown"}]
  },
  "virtualPlace": {"start": {"at": ["waiting.x", "waiting.y - 100"]}},
  "virtualRoute": {
    "start": {
      "from": "bottom",
      "to": {"side": "top", "position": 0.25},
      "curve": "rounded",
      "via": [["start.centerX", "waiting.y - 40"], ["waiting.x + waiting.width/4", "waiting.y - 40"]]
    }
  }
}
```

Beide Punktdefinitionen erlauben optional `title` als sichtbare Beschriftung.

Bei der DSL-Übersetzung von `style [a, b] { display none }` erhält jede ID
ihren eigenen Eintrag im JSON-Objekt `style`. Der Export enthält die zuletzt
gesetzten Werte pro ID und Eigenschaft.

Gruppierte Routen wie `route r1, r2 { curve straight }` werden genauso in
einzelne Einträge im JSON-Objekt `route` übersetzt. Bei mehreren Angaben
enthält der Export pro Beziehung und Eigenschaft den zuletzt gesetzten Wert.

`backgroundImage` ist ein String und kann in einer View, einem Element oder
einem Node-Style stehen. `showBackgroundImage` ist ein boolescher Wert. In
einer View steuert er die Elementbilder, im Node-Style die einzelne Karte.

```json
"overview": {
  "name": "Übersicht",
  "backgroundImage": "/images/site-plan.png",
  "showBackgroundImage": true,
  "style": {
    "dc": { "backgroundImage": "/images/datacenter.jpg" },
    "factory": { "showBackgroundImage": false }
  }
}
```

Numerische Node-Styles `width`, `height` und `fontSize` akzeptieren in Connected-
und Tree-Views zusätzlich Ausdrücke als Strings:

```json
"style": {
  "source": {"width": 240, "height": 100, "fontSize": 15},
  "target": {"height": "2 * source.height", "width": "source.style.width + 80"}
}
```

`source.height` ist die gemessene Kartenhöhe einschließlich Inhalt,
`source.style.height` der ausdrücklich konfigurierte Mindestwert. Verfügbar
sind `width`, `height`, `fontSize`, jeweils direkt oder unter `.style`, sowie
`+`, `-`, `*`, `/` und Klammern. Referenzen bleiben bei der Übersetzung erhalten;
konstante Rechnungen werden als Zahlen normalisiert. Sichtbarkeit, fehlende
explizite Werte, Zyklen und Ergebnisbereiche werden geprüft. Finale Paket-/
Tree-Gruppenmaße sind nicht verfügbar; explizite Paket-Styles schon.
Weitere Regeln: [HELP.md](HELP.md#berechnete-node-styles).

Die vorhandenen Felder gelten unverändert. `via` ist eine Liste von Paaren,
beispielsweise `[[250, 80], [250, 300]]`. `from` und `to` akzeptieren Portnamen
oder Koordinatenpaare mit Zahlen und Ausdrücken, etwa
`"from": ["source.right", "source.y + 10"]`.
Bei Zuordnungspfeilen ist `to` ein Anteil zwischen 0 und 1. Das Ziel eines
Zuordnungspfeils steht im Schlüssel `"ELEMENT -> RELATION"`.

`"label": "none"` verbirgt das ganze Kantenlabel, `"icon": "none"` nur dessen
Icon. Weggelassene Eigenschaften verwenden die gemeinsamen Vorgaben.
Konkrete `route`-Felder überschreiben `routes` feldweise. `"showIcon": false`
und `"showLabel": false` sind unabhängig voneinander.

Alle neun Renderer und ihre Einstellungen sind verfügbar; `"diagram": "matrix"`
ist die Kurzform ohne weitere Einstellungen. Tree-Views akzeptieren beispielsweise
`"diagram": {"type": "tree", "relations": ["CapabilityGeneralization"],
"direction": "down", "parentDirection": "auto", "padding": [24, 56, 32, 16], "showLabels": true}`.
`direction` akzeptiert `down`, `up`, `left`, `right`; `orientation` ist ein Alias.
`padding` akzeptiert eine Zahl für alle Seiten oder vier Zahlen in der
Reihenfolge oben, rechts, unten, links. Die DSL erlaubt die vier Werte
mit oder ohne Klammern. JSON verwendet ein Array. Ohne Angabe gelten 48 pro Seite.
Sie unterstützen die vorhandenen Node-Styles, ordnen und routen automatisch.
Manuelle Routingfelder bleiben auf Connected-Views begrenzt. Genaue Regeln:
[DIAGRAMS.md](DIAGRAMS.md), [HELP.md](HELP.md).

Benannte Tree-Gruppen in Connected-Views verwenden das DSL-Schlüsselwort `tree`:

```json
{
  "tree": {
    "hierarchy": {
      "nodes": ["horizon", "vision", "manpower", "coverage", "response"],
      "direction": "up",
      "padding": 24
    }
  },
  "place": {
    "hierarchy": {"at": [300, 0]},
    "maritime": {"at": [0, 250]}
  }
}
```

Dies ist ein Ausschnitt einer View. `place` ist optional; mehrere Gruppen erhalten
eigene IDs und Richtungen. Mitglieder sind eindeutige Nicht-Container mit demselben
Modellparent. Einzelne Mitglieder und Gruppengrößen werden automatisch bestimmt.
`relations` filtert hier nur die Hierarchie; Querbeziehungen bleiben gerendert.

### Koordinatenreferenzen

Ein Eintrag in `place` verwendet entweder `at` oder `relative`.
`relative` benötigt `side` und die Anker-ID `of`. `gap` ist optional und
akzeptiert Zahlen oder Koordinatenausdrücke. Ohne Angabe gilt das wirksame
`spacing` der View. `align` ist optional und standardmäßig `center`.
`align to member.centerY` entspricht `"align": {"to":"member.centerY"}`.
Das Feld bezeichnet die auszurichtende Kante oder Mitte. Der Abstand bezieht
sich auf den Anker in `of`.
`size` bleibt neben der Positionsangabe zulässig, wo die Darstellung es
unterstützt. Auch Einträge in `virtualPlace` können `relative` verwenden.
Die Übersetzung erhält die relative Angabe.

In `place.at` können beide Koordinaten unabhängig Zahlen oder Ausdrucksstrings
sein. Strings unterstützen dieselben Referenzen und `+`, `-`, `*`, `/` wie die DSL;
`width`, `height`, `right`, `bottom`, `centerX`, `centerY` ergänzen `x`/`y`.
IDs verweisen auf sichtbare Nodes oder Tree-Gruppen derselben View.
Auch kompakte Subtraktionen wie `"service.y-service.height"` funktionieren.
Punkte/Bindestriche bleiben in IDs erlaubt; die längste passende deklarierte ID
hat Vorrang. Ist `root.x-offset` eine ID, referenziert `"root.x-offset.y"`
deren y-Koordinate. `"root.x - offset.y"` erzwingt die Subtraktion.
Diese Unterscheidung gilt ebenfalls für `via`.
Reine Zahlenarithmetik wird normalisiert. Symbolische Ausdrücke bleiben bei
JSON-/DSL-Übersetzung und in Meta-Views erhalten. Die Übersetzung speichert
keine bereits berechneten Layoutkoordinaten anstelle der Ausdrücke.
Beispiel: `"at": ["hierarchy.x - maritime.width - 80",
"vision.centerY - maritime.height / 2"]`. Punkt vor Strich und Klammern gelten
wie in der DSL; Division durch null ist ein Fehler.
`via` unterstützt ebenfalls Ausdrucksstrings in seinen Koordinatenpaaren:
`"via": [["source.right + 40", "target.y - 20"], ["target.x - 40", "target.centerY"]]`.
Dies funktioniert in `route`, `routes` und Zuordnungsrouten mit Schlüssel
`"information -> edge"`. Via verwendet absolute Diagrammkoordinaten nach
Auflösung der Node-/Gruppenpositionen, auch innerhalb von Packages. Lokale
Listen ersetzen die komplette Vorgabe; ein explizites `path` ersetzt `via`.
`size` und `route.from`/`to` bleiben numerisch; Labelpunkte unterstützen Ausdrücke.
Zirkelbezüge sind auch im Entwurfsmodus Fehler. Grenzen und Koordinatenräume:
[SPEC.md](SPEC.md), Hilfe: `@help routing`.

### Property-Auswahl und Class-Positionierung

View-Auswahl: `"propertyFields": ["expression", "unit", "value"]`.
Pro Node: `"style": {"criterion": {"propertyFields": ["expression"]}}`.
Diagrammvorgaben: `"diagram": {"type": "class", "propertyFields": ["expression"]}`;
auch Connected/Tree unterstützen diese Option. Rangfolge Style → View → Diagramm;
`[]` leert die Auswahl. Class unterstützt `place` mit numerischen oder berechneten
Koordinaten und optionalem `size`. Details folgen ihren Ownern; Routen bleiben
automatisch. Syntax und Grenzen: [DIAGRAMS.md](DIAGRAMS.md).

### Inline-Profile und Hilfe

Ein registriertes Profil wird über `config.profile` gewählt. Eine konkrete
geladene Revision kann beispielsweise mit
`"config": { "profile": "naf41-uaf@4.1.0-arch.16" }` gebunden werden.
Aliasnamen bleiben in den `type`-Feldern auch bei JSON-/DSL-Übersetzungen
erhalten. `aliases` und `mappings` gehören zum vollständigen externen
Registrierungsformat, nicht zur Inline-Konfiguration:
[Aliase und Mappings](profiles/naf41/ALIASES.md).

Inline-Definitionen
verwenden die originalen DSL-Schlüssel `type`, `relation`, `viewpoint`,
`styleGroup` und `attribute` beziehungsweise `attributes`:

```json
{
  "type": {
    "product": {
      "template": "application",
      "attribute": { "owner": { "type": "string", "required": true } }
    }
  }
}
```

Dies ist ein Ausschnitt von `config`. Whitelists, `extends`, `enum` und `targets`
akzeptieren Listen; `incoming`/`outgoing` sind Objekte mit `min`/`max`.
Der Umfang entspricht der Inline-DSL. Das bestehende vollständige JSON-Format
für `registerProfile` mit `nodeTypes`/`relationTypes` ist ein anderes Format;
es wird dadurch nicht ersetzt. [Profilanleitung](profiles/README.md).

`{ "@help": "json" }` entspricht `@help json`. Auch innerhalb von `architecture`
ist `"@help": "profiles"` möglich. Die Query enthält das Thema und Parameter
ohne vorangestelltes `@help`. Hilfe ersetzt wie bisher die Diagrammausgabe.

## Fehler, Grenzen und Einbettung

DSL und JSON dürfen im selben Markdown-Dokument in getrennten `arch`-Codeblöcken
stehen. Auch aufeinanderfolgende API-Aufrufe können unterschiedliche Formate
verwenden. Innerhalb einer einzelnen Architekturquelle wird ein Format gewählt;
eingebettete DSL-Fragmente wie `"model": "service api …"` werden nicht geparst.
Verschiedene Diagrammrenderer in Views derselben Architektur bleiben kombinierbar.

Es gilt striktes JSON: keine Kommentare, trailing commas oder doppelten Schlüssel.
Attributwerte sind Strings, endliche Zahlen, boolesche Werte oder flache Listen;
`null` hat keine Entsprechung in der DSL und wird nicht als „Default“ interpretiert.
Nicht unterstützte JavaScript-Werte und zyklische Objekte werden zurückgewiesen.
Es gelten dieselben Modellgrenzen; JSON und die intern normalisierte Syntax
dürfen jeweils höchstens 2.000.000 UTF-16-Codeeinheiten umfassen. Die JSON-
Verschachtelung ist zusätzlich auf 128 Ebenen begrenzt.

Fehler enthalten `path` als JSON-Pointer, etwa
`/architecture/views/logical/route/information -> control`, sowie die Zeile und
Spalte im JSON-String. Bei Objekteingaben beziehen sich Zeile/Spalte auf die
kompakte JSON-Serialisierung. Semantische Diagnosen behalten den JSON-Pfad des
zugehörigen Elements/Attributs; Fehler bei Registrierung externer Profile oder
bei erst später geprüften Ressourcen können außerhalb des Dokuments liegen.

JSON wird intern auf dieselbe DSL-Grammatik abgebildet. Quellpositionen werden
anschließend auf das JSON zurückgeführt; es gibt keine zweite Implementierung
von Fachregeln oder Rendering. Erfolgreiches `validate()` schließt daher wie
bisher spätere Icon-/SVG-Pfadfehler nicht aus.

In Markdown bleibt die Sprache `arch`, auch wenn der Inhalt JSON ist. Ebenso
verwenden JSON-Codeblöcke im DOM `language-arch` oder `data-arch`. Gewöhnliche
`json`-Fences bleiben Code und werden nicht automatisch als Architektur gerendert.
Fehlerisolation und Mehrfachview-Verhalten entsprechen dem
[API-Vertrag](SPEC.md#prüfgrenzen-und-fehlerverhalten).

`"routes": {"sharePath": "stereotypes"}` aktiviert gemeinsame Abschnitte für
exakt gleiche Relationstypen in Connected-Views; `"all"` erlaubt verschiedene
Typen mit kompatibler Darstellung, `"none"` ist der Standard. Eine konkrete
`"route": {"edgeId": {"sharePath": "none"}}` überschreibt die Vorgabe.
Manuelle Geometrie einschließlich expliziter Seitenpositionen bleibt unabhängig. Die Option wird in beide Richtungen
zwischen JSON und DSL erhalten; Details und Grenzen: [HELP.md](HELP.md).
Ganze Trees verwenden `"diagram": {"type": "tree", "sharePath": "stereotypes"}`;
benannte Gruppen `"tree": {"g": {"nodes": ["a", "b"], "sharePath": "all"}}`.
In benannten Gruppen gilt Einzelroute vor Tree-Option vor View-`routes`.

Connected-Views geben Sprungbögen als `"routes": {"crossings": "bridge",
"crossingRadius": 6}` an. Einzelregeln wie
`"route": {"edgeId": {"crossings": "none"}}` überschreiben die Werte pro Kante.

Relative Andockpositionen an Knotenseiten entsprechen `from bottom 1/2 to left 0.25`:

```json
"route": {
  "hasLocation": {
    "from": {"side": "bottom", "position": "10 / source.width"},
    "to": {"side": "left", "position": 0.25}
  },
  "data -> pickup": {
    "from": {"side": "right", "position": "1/4"},
    "to": "1/2"
  }
}
```

`side` ist `top`, `right`, `bottom` oder `left`. `position` ist eine Zahl oder
ein Ausdruck als String, dessen Ergebnis im Bereich 0–1 liegt.
Division durch null ist ungültig.
`top`/`bottom` zählen von links nach rechts, `left`/`right` von oben nach unten.
Einfache Seitenstrings bleiben gültig und wählen die Mitte. Bei Zuordnungslinien
setzt `to` die Position entlang des Relationspfads. Als Wert sind eine Zahl,
ein Bruchstring oder ein Ausdruck wie `"to": "(data.centerX-a.x)/(b.right-a.x)"`
zulässig. Das berechnete Ergebnis muss zwischen 0 und 1 liegen. Konstante
Ausdrücke werden beim Übersetzen/Meta-Export zu Zahlen normalisiert. Dieselben Endpunkt-
Objekte können in `routes` verwendet werden; konkrete Endpunkte ersetzen die
gesamte geerbte Seiten-/Positionsangabe.

Linienstile sind ebenfalls gleichwertig zur DSL:

```json
"routes": {"color": "#64748b", "width": 2, "dasharray": [8, 4]},
"route": {
  "cr.6": {"color": "red", "width": 3, "dasharray": "none"},
  "data -> pickup": {"color": "blue", "dasharray": [2, 3]}
}
```

Das Fragment gehört in eine View. Defaults gelten auch für Zuordnungslinien;
konkrete Felder haben Vorrang. `dasharray` akzeptiert Zahlenlisten,
SVG-Zahlenstrings oder `"none"`; `[]` erzwingt ebenfalls eine durchgezogene Linie.
Wertebereiche und Marker-/Sharing-Verhalten: [HELP.md](HELP.md).

### View-Erweiterungen und Einbettungen

`"extends": "s3"` übernimmt eine bestehende View. Einbettungen stehen als
Objekt unter `embed`, dessen Schlüssel die Gruppen-ID ist:

```json
"embed": {"interfaces": {"view": "s3", "frame": true}}
```

Das entspricht `embed s3 as interfaces {frame true}`. Ohne `frame` ist die
Darstellung nahtlos. Gruppen werden über `place` positioniert; ihre Maße und
die eingebetteten Node-IDs sind Koordinatenreferenzen. Übersetzungen erhalten
die Wiederverwendungsdeklarationen. Regeln und Grenzen: [HELP.md](HELP.md#views-wiederverwenden-extends-und-embed).

Bei mehrfach dargestellten Knoten geben qualifizierte IDs die konkrete Karte
an, etwa `"at": ["sub2.actor.right + 40", "sub2.actor.y"]`. Bei einer
Host-Kante wählt `"route": {"noteLink": {"target": "sub2.actor", "to": "right"}}`
die Zielkarte und den Port. `source` funktioniert analog.

Labelpositionen unterstützen Ausdruckspaare wie
`"label": ["source.centerX", "target.y - 20"]` sowie Pfadanteile:
`"label": 0.3` oder `"label": "1/3"`. Ein Anteil setzt den Mittelpunkt entlang
der vollständigen Route; 0 ist der Anfang, 1 das Ende. Diese Positionen sind
explizit und erhalten keinen automatischen Versatz. Brüche normalisieren zu
Dezimalzahlen, Koordinatenausdrücke bleiben erhalten. Siehe `@help routing`.

In einer Zuordnungsroute wie `"event -> transition": {"to": 0.2, "label": 0.2}`
bezieht sich `to` auf die Zielrelation und `label` auf den Zuordnungspfad.

`"label": {"position": 0.5, "offset": 20}` verschiebt den Labelmittelpunkt
20 SVG-Einheiten hinter die Pfadmitte. Positive Abstände gehen zum Ziel,
negative zur Quelle; außerhalb des Pfads wird auf die Endpunkte begrenzt.
DSL: `label 0.5 offset 20`. Offset ist eine endliche Zahl innerhalb ±10000000.

Auch offset kann ein Ausdrucksstring sein:
`"label": {"position": 0.5, "offset": "source.width / 2"}`.
Er wird nach dem Layout anhand sichtbarer Node-/Gruppenkoordinaten ausgewertet
und bleibt beim Übersetzen erhalten. Der Ergebnisbereich bleibt ±10000000.

`"label": {"position": 0.5, "offset": 20, "sideOffset": -24}` setzt den
Mittelpunkt erst entlang des Pfads und dann 24 SVG-Einheiten nach rechts in
Pfadrichtung. `sideOffset` akzeptiert ebenfalls einen Ausdrucksstring und
kann auch ohne `offset` gesetzt werden.

`"sideOffset": -12` direkt im Routenobjekt verschiebt die vorhandene
Labelposition seitlich. Ohne `label` ist die automatische Position der
Ausgangspunkt. DSL: `route l5.7 { sideOffset -12 }`.

`"config": {"showValidation": false}` blendet Prüfmarkierungen und den
Validierungsfooter gemeinsam aus. Die Diagnosen und Strict-Prüfungen bleiben
aktiv; alternativ API `{showValidation:false}` mit Vorrang vor config.
