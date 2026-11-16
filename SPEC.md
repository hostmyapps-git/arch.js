# arch.js — Technische Spezifikation

Version 0.1.0 · Stand 16.11.2026

## Zweck und Lieferumfang

Eine menschenlesbare Sprache beschreibt Architekturmodelle und deren Ansichten.
Die Bibliothek erzeugt eigenständig Inline-SVG im Browser und SVG-Strings in Node.
Die Sprache aller eingebauten Hilfe-, Status- und Diagnosetexte ist Englisch.
Modelltitel, Beschreibungen und andere nutzerdefinierte Texte sind sprachunabhängig.
Lieferumfang: `arch.js`, `arch.min.js`, `index.html`, `test.md`, editierbare
Beispiele und Quellcode. Browserbundles ohne externe Laufzeitscripts, ohne
erforderlichen Renderingserver, CDN oder Netzwerkanfrage zum Rendern.
Direkte Node-Quellimporte benötigen die gepinnten npm-Laufzeitabhängigkeiten;
ein eigener HTTP-Renderingdienst oder Rendering-CLI wird nicht mitgeliefert.

Das Modell trennt fachliche Typen, Beschreibungen und Beziehungen von Position,
Template und Kantenführung. Die Begriffe orientieren sich an gängigen
Architekturwerkzeugen; die Implementierung beansprucht keine vollständige
NAF-, ArchiMate-, UML- oder UAF-Konformität. Referenzmaterial liegt unter
`ReferenceDocs/`. Konzeptionelle Referenzen:
[Graphviz](https://graphviz.org/documentation/) und
[Mermaid](https://github.com/mermaid-js/mermaid/tree/develop/packages/mermaid/src/docs).

Die Kombination aus gemeinsamem Modell, mehreren Views, deklarativen
Fachprofilen und viewlokaler Gestaltung ist der Einsatzschwerpunkt. Eine
Einordnung gegenüber Mermaid.js, PlantUML, Graphviz und D2/D2.js mit
Quellen und Auswahlkriterien steht in [COMPARISON.md](COMPARISON.md).
Geplante Erweiterungen in [ROADMAP.md](ROADMAP.md) sind kein Teil dieses Vertrags.

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
- Viewpoint-`connections`: `{ nodes, relations, counterparts?, direction, min, max }` prüft
  Beziehungen mit sichtbaren Endpunkten pro sichtbarem passendem Knoten.
  `counterparts` filtert optional den Gegenstellentyp einschließlich Vererbung.
- Viewpoint-`references`: `{ nodes | relations, attributes }` verlangt sichtbare
  Zielknoten für ausgewählte skalare/mehrwertige Referenzattribute. Optionale
  fehlende Werte bleiben erlaubt; Pflichtwerte bestimmt das Attributschema.
- Dokumentationsfelder `title`, `description`, `sources`, `limitations` sind
  auf Profilen, Knoten-/Relationstypen und Viewpoints zulässig und werden von
  Registry/Hilfe erhalten. Texte/Längen werden geprüft; keine Codeausführung.
- Relations-`referenceLabels` ordnet Referenzattributen Beschriftungen zu,
  beispielsweise `{ "conveyed": "Conveys" }`. Connected-Ansichten zeigen die
  aufgelösten Titel und IDs zusätzlich zum unveränderten Beziehungstitel.
  Mehrere Referenzen, leere Titel, Vererbung und Escaping werden unterstützt;
  Zusatzzeilen fließen in die Beschriftungsgröße und SVG-Bounds ein.
- `referenceDisplay: "nodes" | "labels" | "both"` wählt die Connected-
  Darstellung am Relationstyp; View-`referenceDisplay` überschreibt sie lokal.
  Grafische Referenzkarten verwenden das ursprüngliche Template, Farben und
  Icon und zeigen mit einer visuellen Verbindung auf die tatsächliche Kante.
  `referenceOccurrences shared` (Standard) verwendet eine gemeinsame Karte mit
  Verbindungen zu allen tragenden Kanten. `perEdge` erzeugt auf Wunsch getrennte
  Vorkommen mit sichtbarer identischer Element-ID; weder Modellknoten noch
  Beziehungen werden dupliziert. Das Relationstyp-Attribut wird vom ersten
  Basistyp geerbt; die View überschreibt es lokal. Bereits sichtbare oder
  explizit platzierte Karten bleiben gemeinsam. Ausgeblendete Ziele bleiben
  erhalten; Kurven-/Bogenanker werden aus dem gerenderten SVG-Pfad berechnet.
- `pairs`, `comparisons`, `connections`, `references` sind JSON-Regeln. Der vereinfachte
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

`profiles/naf41-uaf.json`, Version `4.1.0-arch.1`, ist ein separates
strukturelles NAFv4.1-Anwendungsprofil auf Basis von `uaf`. Es enthält alle
47 Viewpoint-IDs der NATO-Ausgabe 2026.03, englische Beschreibungen mit
Quellseiten und explizite Anwendungsadapter: 72 zusätzliche Knotentypen und
92 zusätzliche Relationen ergeben mit dem Basisprofil 285 Knoten- und
135 Relationstypen. Pflichtinhalte werden durch sichtbare Verknüpfungen und
ausgewählte sichtbare Referenzen ergänzt. C7 verlangt beispielsweise die
Kette Measure → AssessmentCriterion → Capability statt isolierter Messgrößen.
Das bedeutet keine vollständige normative NAFv4.1-/UAF-Konformität.

`scripts/build-naf41.mjs` prüft die Quellenhashes und erzeugt aus
`profiles/naf41/catalog.mjs` das Runtime-Profil und Abdeckungsberichte. Die
mitgelieferte ADMBw-MDG 2026.05 wird mit Windows-1252 gelesen; ihre 318
Domänenstereotypen dienen als Vergleichsquelle. Ihre erklärte Grundlage ist
NAF 4.0 mit Bundeswehr-Erweiterungen. Es erfolgt kein vollständiger ADMBw-Import
und keine Ausführung eingebetteter Scripts. Nicht gleichbedeutende Beziehungen
wie ADMBw `Evaluates` werden nicht als NAFv4.1-Messbeziehung übernommen.
Anleitung und Grenzen: [profiles/naf41/README.md](profiles/naf41/README.md),
[profiles/naf41/COVERAGE.md](profiles/naf41/COVERAGE.md).

## Sprache

### Äquivalente JSON-Syntax

Die Architektur kann als DSL oder als JSON-String/Objekt mit der Hülle
`{ "architecture": { "name", "description"?, "config"?, "model", "views"? } }`
übergeben werden. `name` enthält jeweils den Titel. `model.elements`,
`model.relations` und `views` sind ID-Objekte oder geordnete Listen mit `id`.
Container verschachteln `elements`/`relations`. Eigenschaften, Profilattribute,
`place`, `style`, `routes`, `route` und `diagram` entsprechen der bestehenden DSL.
Koordinaten sind `[x,y]`, Wegpunkte Listen solcher Paare, Zuordnungsrouten haben
den Schlüssel `"ELEMENT -> RELATION"`. Inline-Profile verwenden die ursprünglichen
Schlüssel `type`, `relation`, `attribute`, `viewpoint` und `styleGroup`.

`src/json.js` bildet die Oberflächensyntax auf die gemeinsame DSL-Grammatik ab;
anschließend werden Quellpositionen auf JSON-Pointer und Originalzeilen abgebildet.
Parserdefaults, Profilauflösung und Validierung werden nicht separat implementiert.
Unbekannte Felder, doppelte JSON-Schlüssel und nicht darstellbare Werte werden
zurückgewiesen. JSON und normalisierte Quelle unterliegen jeweils der bestehenden
Quellgrößengrenze; höchstens 128 JSON-Ebenen. Objektquellen werden ohne Mutation
verarbeitet, Zeilen/Spalten beziehen sich dabei auf ihre kompakte Serialisierung.
`ArchError.path` und JSON-Diagnosen enthalten gegebenenfalls einen JSON-Pointer.

Alle Eingabeformen funktionieren über `parse`, `validate`, `layout`, `render`,
`renderToString`, `arch`-Markdown-Fences und die bestehenden DOM-Selektoren.
Die Rückgabe von `parse` bleibt das normalisierte API-Modell, nicht die JSON-
Quellhülle. Bestehende geparste Modelle bleiben kompatibel. `@help json` sowie
`{ "@help": "json" }` erklären das Format. Vollständiger Vertrag und Beispiele:
[JSON.md](JSON.md). Die Übersetzung zwischen Quellformaten beschreibt
[META.md](META.md).

### Quellübersetzung und Meta-Diagnosen

`translate(source, { format? })` liefert die andere Notation oder ausdrücklich
`json`/`dsl`. Es verwendet den Syntaxparser ohne vorgeschaltete fachliche
Profilvalidierung. Semantisch ungültige, syntaktisch abbildbare Quellen können
deshalb übersetzt werden. Kommentare und Formatierung werden normalisiert;
Defaults können ausdrücklich erscheinen. Die Quellgrößengrenze gilt auch für
das Ergebnis. Fehler beim Übersetzen werfen `ArchError`.

`inspectSource(source, { profile?, format? })` liefert `sourceFormat`,
`targetFormat`, `output`, `valid`, `diagnostics` und bei lesbarer Syntax
`title`, `kind`, View-Metadaten `views` sowie gegebenenfalls `configuredViews`.
Syntaxfehler ergeben `output: null`; fachliche Diagnosen können neben einer
verfügbaren Übersetzung stehen. Kandidaten sind `{ label, example, detail }`-
Objekte, keine automatisch angewandten Edits. Typkandidaten stammen aus dem
ausgewählten Profil; Tippfehler werden nach Schreibähnlichkeit eingeordnet.
Keine garantierte Reparatur und keine vollständige Ressourcen-/SVG-Prüfung.

Die Meta-View der Demo ist unabhängig von Modellviews und `config.views all`.
Sie bleibt bei Parsefehlern erreichbar, zeigt Quellausschnitte/JSON-Pointer und
einen Sprung zur Fehlerstelle. Kopie und `.json`-/`.arch`-Download sind bei
verfügbarer Übersetzung möglich; SVG-Export und Diagramm-Zoom sind dort deaktiviert.
Die Oberfläche zeigt maximal zwölf Diagnosen und weist auf weitere hin.

### Deklarierte Meta-Views

`view ID "Title" { @meta json }` bzw. `@meta dsl` deklariert eine regulär
auswählbare Quellenview. Die DSL-Kurzform `meta json`/`meta dsl` und die JSON-
Viewfelder `"@meta": "json"|"dsl"` bzw. `"meta"` sind äquivalent. Im API-Modell
steht das Format als `view.meta`. Eine Direktive direkt im Architekturblock
erzeugt die implizite View `meta-json` bzw. `meta-dsl`; bei JSON wird sie nach
den expliziten Views angefügt. Ohne Architekturquelle wird `@meta` abgewiesen.

Quellenviews unterstützen Format und Theme; Filter, Viewpoints, Diagramm- und
Layout-/Styleoptionen werden zurückgewiesen. Sie unterliegen nicht den
Viewpoint-Pflichten eines Fachprofils, prüfen aber weiterhin das gesamte Modell
und alle Diagrammviews. Syntaxfehler lassen sich in der getrennten Editor-
Meta-View untersuchen, nicht durch einen fehlerhaften Architektur-SVG-Export.

`layout()` liefert für eine Quellenview `kind: 'meta'`, `format`, `source`,
visuelle `rows`, `view`, `profile` und `bounds`; `nodes`/`edges` sind leer.
Die Ausgabe umfasst die vollständige normalisierte Architektur, einschließlich
eigener Meta-Direktiven als Text ohne rekursive Expansion. `metaSVG` zeichnet
umgebrochenen, escaped Monospace-Text mit Einrückung und Zeilennummern.
Quellenviews funktionieren einzeln, in `views all`/Listen, mit Themes, Markdown,
DOM-Adaptern und eigenständigem SVG-Download. [META.md](META.md).

### Hilfedokumente

Ein eigenständiger `@help [THEMA [PARAMETER ...]]`-Befehl ersetzt bei Bedarf das
Architekturdokument eines Codeblocks. Alternativ steht derselbe Befehl auf
oberster Ebene innerhalb von `architecture`, allein auf seiner Zeile oder
durch Semikolon abgeschlossen. Er schaltet die Ausgabe auf Hilfe um; der
`model`-Block ist dann optional. Die vollständige Befehlsreferenz steht in
[HELP.md](HELP.md). Themen: syntax, model, profiles, types, relations, viewpoints,
connections, iconpacks (Alias icons), diagrams, views, routing, styles, colors, templates,
config und api. Unbekannte Themen oder zusätzliche Parameter werden diagnostiziert.

`parse` erkennt Hilfedokumente mit `kind: 'help'`, normalisiert Thema/Aliase und
speichert `{ topic, parameters }` unter `help`. Das Dokument hat ein Profil als
Snapshot, leere `nodes`/`edges` und genau eine Ansicht `help`. Im eingebetteten
Hilfemodus wird die Architektur syntaktisch gelesen, aber nicht fachlich geprüft;
`config` und API-Profilwahl gelten für die Hilfe. Ohne Hilfebefehl bleiben die
semantischen Profilregeln unverändert. `validate` prüft Hilfe einschließlich
referenzierter Namen, `layout` liefert Textzeilen/Abschnitte und SVG-Grenzen.

Rendering über alle bestehenden Adapter erzeugt eigenständiges Inline-SVG mit
markierbarem Text, Umbruch, Light-/Dark-Theme, isolierten Titel-IDs und Escaping.
`help(query = '', options = {})` gibt dieselben Inhalte als Text zurück. Die
Registry-Abfragen laden keine externen Quellen. Große Iconlisten haben 100 Namen
pro Seite, optionale Teilstringsuche und eine Navigation per Folgebefehl. Typ-,
Relations- und Viewpoint-Details stammen aus dem kompilierten Profil einschließlich
Vererbung. Explizite Namen im Befehl werden bei Ausgabe aufgelöst, ansonsten gilt
das ausgewählte Profil. Die Hilfe wird vollständig in beide Browserbundles gebaut.

Für abstrakte Knoten-/Relationstypen ermitteln Hilfe und Diagnosen dieselben
konkreten direkten und indirekten Untertypen aus `abstract`/`extends`, einschließlich
Mehrfachvererbung. Keine profilspezifischen Namenslisten. Diagnosen ergänzen
`candidates` und `help`; die Meldung zeigt höchstens zwölf Kandidaten, die Hilfe
alle. Weitere Profilregeln gelten unverändert. `@help types . NAME` beziehungsweise
`@help relations . NAME` nutzt das ausgewählte Dokument-/API-Profil und funktioniert
auch für nicht global registrierte Inline-Profile.

`@help connections [PROFILE [TYPE]]` zeigt pro Knotentyp eingehende/ausgehende
konkrete Relationstypen und konkrete Gegenstellen. Die Ermittlung berücksichtigt
Vererbung, `from`/`to`, `pairs` und Quell-/Zielausschlüsse; der Paarvergleich wird
mit der Modellvalidierung geteilt. `allowSelf`/`acyclic` und Detailbefehle werden
angegeben. Andere Attribute/Kardinalitäten und Modell-/Viewpoint-Regeln werden
weiterhin am konkreten Modell geprüft. `.` nutzt das ausgewählte Profil.

### Semantische Darstellung

Profile unterstützen `styleGroups: { NAME: { backgroundColor: HEX } }` und
Knotentypen die Felder `styleGroup` / `backgroundColor`. Farben sind geprüfte
Hexwerte (3/6 Stellen) oder CSS3-Farbnamen. Vorrang: View-`style.backgroundColor` vor direkter
Typfarbe vor Gruppenfarbe vor Theme. Leere Gruppen sind neutral. Gruppen
werden bei Profilvererbung nach Namen ersetzt; Typfelder werden vom ersten
Elternteil geerbt. Unbekannte Gruppen sind Fehler. Inline unterstützt
`styleGroup NAME { backgroundColor "#rrggbb" }` und `type T { styleGroup NAME }`.
Snapshots enthalten die Gruppen, sodass Laufzeit- und JSON-Modelle reproduzierbar
bleiben. Alle Templates und SVG-Exports verwenden die Hintergrundfarbe.

Explizite Hintergründe verwenden standardmäßig `fill-opacity="0.2"`; Text und Rahmen bleiben
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
- `exclude ID, ID, …` entfernt Elemente samt Nachkommen aus dieser Auswahl.
  Ausschlüsse haben immer Vorrang, auch bei explizitem `include` derselben ID
  oder eines Nachkommen und unabhängig von der Reihenfolge der Direktiven.
  Erst danach werden benötigte Container-Vorfahren ergänzt. Automatisch
  benötigte Vorfahren entfallen, wenn kein ausgewähltes Kind mehr übrig bleibt;
  explizit ausgewählte Container bleiben auch ohne Kinder sichtbar.
  Beziehungen sind nur sichtbar, wenn beide Endpunkte übrig bleiben.
  Unbekannte Ausschluss-IDs sind Fehler. Fachliche Modellvalidierung bleibt global.
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
- `style ID { display logo; icon PACK.NAME }` zeigt viewlokal nur Rechteck
  und Logo mit erhaltenem Seitenverhältnis. Titel/Typ bleiben zugänglich und
  im Modell erhalten; sichtbare Beschriftung/Beschreibung entfallen. Gilt für
  Nicht-Container und Connected-Views, einschließlich Referenzkarten.
  `display standard` stellt die vollständige Karte wieder her.
- `style ID { iconPosition top|left|bottom|right }` platziert das Node-Icon
  innerhalb der Karte relativ zu den Textfeldern. Der Standard bleibt die
  bisherige Templateposition; Packages positionieren Icons ausschließlich im
  Kopfbereich und passen die Kopfhöhe an. Im Logo-Modus bleibt das Icon ohne
  Vorgabe zentriert, mit Vorgabe wird es innerhalb des gepolsterten Rechtecks
  seitlich ausgerichtet. Seitenverhältnis und Farben bleiben erhalten.
- `showIcon`, `showLabel`, `showStereotype`, `showDescription`, `showTechnology`
  im Node-Style sind boolesche Sichtbarkeitsschalter (Standard jeweils `true`).
  `showLabel` betrifft den Titel, `showStereotype` die Typ-/Stereotypzeile.
  Ausgeblendete Felder reservieren keinen Textplatz; Karte und semantische Werte
  bleiben erhalten. Packages behalten sichtbare Kinder auch bei ausgeblendetem
  Kopftext. Logo-Modus zeigt weiterhin keinen Text; `showIcon false` ergibt
  dort ein leeres Rechteck. Die Optionen gelten für Connected-Views, auch
  für gemeinsame und wiederholte Referenzkarten.
- View-Style `fontSize` (6–64, Standard 15) skaliert die Titelschrift und
  proportional die übrigen Knotentexte. `width`/`height` legen Mindestmaße
  ab 160/96 fest und haben Vorrang vor `place ... size`. Inhalt kann die Höhe
  und Containermaße weiter vergrößern. Diese Einstellungen gelten für
  Connected-Views, einschließlich Referenzkarten.
- Die Typ-/Stereotypzeile regulärer Connected-Karten bleibt einzeilig und
  erhält bei Platzmangel „…“. Der vollständige Wert bleibt im Tooltip und
  unverändert im Modell erhalten; Knotentitel/Beschreibungen können umbrechen.
- `routes { from PORT; to TARGET; via (X,Y), …; curve ART;
  label (X,Y); path "SVG-PFAD"; icon PACK.NAME; iconPosition POSITION;
  showIcon BOOLEAN; showLabel BOOLEAN }` setzt Vorgaben für alle fachlichen Kanten
  und grafischen Zuordnungspfeile einer Connected-View. Jede Eigenschaft einer
  konkreten `route` hat Vorrang vor derselben Vorgabe, unabhängig von der
  Reihenfolge im Quelltext. Nicht überschriebene Eigenschaften werden geerbt.
  `to` als Port/absoluter Punkt gilt für fachliche Kanten; ein Wert von 0 bis 1
  gilt für Zuordnungspfeile. `label`, `icon`, `iconPosition` gelten nur für
  Labels fachlicher Kanten.
  Konkrete `from`/`to`/`via`/`curve`-Angaben ersetzen einen geerbten freien
  `path`; ein expliziter konkreter `path` steuert weiterhin den gesamten Pfad.
  Ein leerer `routes {}`-Block ändert das automatische Routing nicht.
- `route RELATION { from PORT; to PORT; via (X,Y), …; curve ART;
  label (X,Y); path "SVG-PFAD" }`.
- `route ELEMENT_ID -> RELATION_ID { from PORT; to FRACTION;
  via (X,Y), …; curve ART; path "SVG-PFAD" }` routet den grafischen
  Zuordnungspfeil separat. Das Element muss über `referenceLabels` des Profils
  an der Relation referenziert sein. Funktioniert mit gemeinsamen und
  `perEdge`-Karten; die fachliche Relation bleibt unverändert.
  `from` ist ein Kartenport oder absoluter Punkt; `to` ist eine Position von
  0 (Relationsanfang) bis 1 (Relationsende), gemessen entlang des gerenderten
  Relationspfads. Ohne `to` bleibt die automatische Ankerposition erhalten.
  Wegpunkte, Kurven und freie Pfade verwenden die normale Routing-Geometrie;
  manuelle Routen ersetzen die automatische Hindernisumgehung. `path` ersetzt
  den gesamten Zuordnungspfad einschließlich Start-/Endpunkt. Keine Labels.
  Ausgeblendete Referenzen/Relationen und reine Labeldarstellung zeichnen keine
  Zuordnungspfeile; gespeicherte Routen bleiben beim View-Layout unverändert.
- `icon PACK.NAME` an einer konkreten `route` oder als `routes`-Vorgabe
  ergänzt ein Icon am Label einer fachlichen Kante. `iconPosition` wählt
  `top|left|bottom|right` relativ zum Text (Standard `left`). Icons liegen
  innerhalb des Labelrahmens; dessen Maße, Hindernisflächen und Exportgrenzen
  umfassen Icon und mehrzeiligen Text. Icons ohne Labeltext sind möglich.
  `icon none` deaktiviert eine geerbte Vorgabe. Die Optionen sind viewlokal;
  Positions-/Icon-Vorgaben werden feldweise überschrieben. Farben und
  Seitenverhältnis aus registrierten Packs bleiben erhalten; lokale SVG-IDs
  werden je Label isoliert. Knotenpositionen und Zuordnungspfeile erhalten
  dadurch keine neuen Iconoptionen.
- `showIcon` und `showLabel` in `route`/`routes` steuern Icon und Text eines
  fachlichen Relationslabels unabhängig (boolesch, Standard `true`). Icons
  werden nur bei gesetzter Iconreferenz gezeichnet. Beide Schalter auf `false`
  entfernen auch den Labelrahmen; sichtbare reine Icon-/Textlabels passen ihre
  Maße an. Konkrete Angaben überschreiben Vorgaben unabhängig. Zuordnungspfeile
  erhalten dadurch keine Labels und bleiben automatisch routbar.
- `label none` in `routes` oder einer fachlichen `route` blendet das gesamte
  Label einschließlich Text, Rahmen und Icon aus. Eine konkrete Labelposition
  `(X,Y)` überschreibt eine globale Ausblendung und zeigt das Label samt geerbtem
  Icon wieder an. Die Einstellung bleibt viewlokal; Modelltexte, Referenzen,
  Kanten-Tooltips, InformationElements und Zuordnungspfeile bleiben erhalten.
  Ausgeblendete Labels bilden keine Hindernisse und vergrößern die SVG-Grenzen
  nicht. Unterstützt auch freie und Bezier-Pfade.
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
| `parse(source, { profile })` | DSL-/JSON-String oder JSON-Quellobjekt → Architekturmodell `{ title, description, nodes, edges, views, profile, config? }` oder Hilfedokument mit `kind: 'help'` |
| `help(query, { profile })` | eingebaute Referenz als Text; Thema/Parameter ohne `@help` |
| `translate(source, { format? })` | normalisierter DSL-/JSON-Quellstring; Standard ist die andere Notation |
| `inspectSource(source, { profile?, format? })` | Quellübersetzung, Validierungsbericht und Korrekturkandidaten mit Quellstellen |
| `validate(sourceOrModel, { profile, view, views })` | Bericht `{ valid, profile: { id, version } oder null, diagnostics }` |
| `registerProfile(name, definition)` | atomare Registrierung und unabhängige Kopie des expandierten Profils |
| `getProfiles()` / `getProfile(id)` | registrierte Namen / unabhängiger Profil-Snapshot |
| `layout(sourceOrModel, { view, views, profile })` | DSL-/JSON-Quelle oder geparstes Modell → Architektur mit Boxen/Pfaden oder Hilfe mit Textzeilen; jeweils Begrenzungen |
| `renderToString(sourceOrModel, { view, views, theme, idPrefix, profile })` | eigenständiger SVG-String |
| `render(target, sourceOrModel, options)` | ersetzt Inhalt eines DOM-Elements; gibt SVG zurück |
| `renderAll({ root, selector, …options })` | rendert `pre > code.language-arch` und `[data-arch]`; gibt SVG-Liste zurück |
| `renderMarkdown(markdown, options)` | sicherer HTML-String für Absätze, Überschriften und Code-Fences, darin Inline-SVG |
| `registerIconPack(name, pack)` | prüft und registriert ein JSON-Iconpack atomar |
| `getIconPacks()` | Namen registrierter Iconpacks |
| `renderIconToString(name, { size, title })` | einzelnes Icon als zugängliches, eigenständiges SVG; Standardgröße 24, Bereich größer 0 bis 512 |
| `ArchError` | Fehler mit `message`, `line`, `column`, `code` und gegebenenfalls JSON-`path` |

`config { views all }` rendert alle Views in Definitionsreihenfolge;
`views [detail, overview]` wählt eine geordnete Teilmenge, `views detail` eine
View. Registrierte und Inline-Profile können die Option enthalten; sie ist kein
Teil des Profilschemas. Listen müssen nichtleer, eindeutig und aus bekannten
View-IDs bestehen. `views [all]` adressiert eine einzelne View mit dieser ID.

`view` ist eine Ansichts-ID, `views` ist `"all"`, eine ID oder eine ID-Liste.
Priorität: API-`view` → API-`views` → `config.views` → erste View. Mehrere Views
werden mit sichtbaren, umgebrochenen Titeln untereinander in einem eigenständigen
SVG mit getrennten inneren Viewports ausgegeben. Renderer und eigene Themes
bleiben erhalten, ein API-Theme überschreibt alle Views. IDs/Marker/Icon-Referenzen
werden je View isoliert. `render`, Markdown, `renderAll` und Download unterstützen
denselben SVG-Ausgabetyp; `@help` bleibt eine einzelne Seite.

`layout()` liefert bei mehreren Views `kind: 'views'`, `layouts` pro View,
`sections` mit Überschriften und Positionen sowie gemeinsame `bounds`. Die
`nodes`/`edges` enthalten die nach ID vereinigten sichtbaren Elemente;
viewlokale Geometrien stehen in `layouts`. Ein einzelnes Layout bleibt unverändert.
Die Beispieloberfläche bietet **Configured views** und manuelle Einzelauswahl;
mehrere Views werden auf Breite eingepasst und sind vertikal scrollbar.

Unbekannte IDs und
ungültige Attribute sind Fehler. SVG-Pfade und Iconreferenzen werden beim Rendern
der betroffenen Ansicht geprüft. `theme` überschreibt die View; dunkle Darstellung
hellt Akzentfarben für besseren Kontrast auf. `idPrefix` muss
allein aus Buchstaben, Ziffern, Unterstrichen und Bindestrichen bestehen und mit
Buchstabe/Unterstrich beginnen. Automatische Präfixe verhindern Marker-Kollisionen
zwischen mehreren Inline-SVGs. Öffentliche Datenobjekte sind JSON-kompatibel.

`renderAll` ist explizit aufzurufen, idempotent, kein automatischer DOM-Scan.
Bei `data-arch` steht der Quelltext in `textContent`. Fehler werden pro Element
als Text ausgegeben; andere Diagramme werden weiter gerendert.

### Prüfgrenzen und Fehlerverhalten

`validate()` prüft Syntax, Profilregeln und die Konfiguration aller Views,
auch wenn nur eine Teilmenge zum Rendern ausgewählt ist. Die Viewauswahl ist
kein Weg, fachlich ungültige Modellteile zu umgehen. Ein Hilfedokument ist
die dokumentierte Ausnahme: Es wird syntaktisch gelesen, ersetzt das Diagramm
und führt die normalen fachlichen Modellprüfungen nicht aus.

Iconreferenzen und freie SVG-Pfade werden beim Rendern der betroffenen Views
aufgelöst bzw. geprüft. `valid: true` garantiert deshalb keinen erfolgreichen
SVG-Export. Nicht registrierte Icons sind Fehler; ein automatisches Ersatzicon
oder Überspringen des betroffenen Elements ist nicht implementiert.

`renderToString()` und `render()` werfen Fehler an den Aufrufer. Eine Auswahl
mehrerer Views wird als eine Ausgabe behandelt: Ein Fehler in einer ausgewählten
View verhindert diese gesamte Ausgabe. `render()` ersetzt das Ziel erst nach
erfolgreicher SVG-Erzeugung. `renderMarkdown()` wirft ebenfalls beim ersten
fehlerhaften Arch-Block; nur `renderAll()` isoliert Renderfehler pro DOM-Block.
Externe Packloader und eine übergeordnete Dokumentpipeline verantwortet die
einbettende Anwendung; die Bibliothek lädt keine konfigurierten URLs selbst.

### Grenzen des Implementierungsumfangs

- DSL-Quellen: höchstens 2.000.000 UTF-16-Codeeinheiten (`source.length`;
  Fehlermeldung „2 MB“, kein Byte-Limit), 1000 Elemente, 4000 Beziehungen,
  32 Package-Ebenen; Koordinaten im Bereich ±10.000.000. Das sind
  Eingabegrenzen, keine Garantie für Rechenzeit oder lesbare Layouts.
- Automatisches Connected-Layout: Schichten und lokale Geometrie, keine globale
  Kreuzungsminimierung oder allgemeine Hindernisvermeidung für Modellkanten.
  Zuordnungspfeile verwenden eine gesonderte heuristische Hindernisumgehung.
  Manuelle Routen und SVG-Pfade garantieren keine Kollisionsfreiheit.
- Acht Renderer mit dem in [DIAGRAMS.md](DIAGRAMS.md) beschriebenen Teilumfang;
  die erweiterten Connected-Styles sind nicht universell verfügbar. Profil-JSON
  kann vorhandene Templates auswählen, keine beliebigen neuen Templates definieren.
- SVG ist das eingebaute Ausgabeformat. Keine DSL-Modulimports, ausführbaren
  Modelle, vollständige UML-/BPMN-/NAF-Semantik, XMI-Modellimporte/-exporte,
  dauerhafte Modellspeicherung oder Zusammenarbeit. Source-XMI für die
  Profilerzeugung ist kein Importadapter für Nutzermodelle.
- Fontmetriken sind geschätzt. Automatisierte Browserverifikation deckt Chromium
  ab; andere Engines und die Leistung großer Modelle sind nicht separat belegt.

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
validierte SVG-Pfaddaten; dieses Feld akzeptiert keine rohen SVG-Fragmente.
Originale Iconify-`body`-Definitionen unterstützt die separate validierende
[Iconify-Registrierung](#direkte-iconify-registrierung). String-Pfade verwenden die
bisherige Linienzeichnung (`fill: none`, `stroke: currentColor`, Stärke 1.6,
runde Linienenden/-verbindungen). Zusätzlich sind strukturierte Pfade erlaubt:

```json
{ "d": "M2 2h20v20H2Z", "fill": "currentColor", "stroke": "none", "fillRule": "evenodd" }
```

Zulässige optionale Zeichenattribute: `fill`, `stroke` (`none`,
`currentColor` oder geprüfte feste Farben), `strokeWidth` (0–64), `linecap` (`butt|round|square`), `linejoin`
(`miter|round|bevel`), `fillRule` (`nonzero|evenodd`), `opacity`, `fillOpacity`,
`strokeOpacity` (jeweils 0–1). Unbekannte Attribute sind Fehler. Registrierung
kopiert und friert die validierten Daten atomar ein. Maximal 20.000 Namen pro
Pack, 64 Pfade pro Icon, Dimensionen größer 0 bis 4096. Icon-Namen dürfen mit
Ziffern beginnen, z.B. `bootstrap.123`; Packnamen beginnen mit Buchstabe oder `_`.
Fehlende Icons führen zu einem Fehler mit Pack-/Iconname.
Alle Texte werden XML-escaped. Farben akzeptieren Hexwerte und alle 147 CSS3-Farbnamen; Namen werden ohne
DOM-Abhängigkeit in Hexwerte aufgelöst.
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
verwendet die gepinnten Pakete `@xmldom/xmldom` 0.9.12 und
`svgpath` 2.6.0. Der Laufzeitrenderer erhält validierte Pfadobjekte oder rekonstruierte
SVG-Bäume aus der direkten Iconify-Registrierung.
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
`examples/uaf.arch` ergänzt neun UAF-/NAF-Ansichten; `examples/naf41.arch`
ergänzt neun weitere NAFv4.1-Ansichten. Insgesamt stehen zwölf Modelle mit
46 Views und zusätzlich `examples/help.arch` als dreizehnter Eintrag bereit.
Profile `uaf`, `naf4-uaf` und `naf41-uaf` sind im PROFILE-Selektor verfügbar.
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
`profiles/{enterprise-demo,uaf,naf4-uaf,naf41-uaf}.js`; Basisprofile sind zuerst zu laden.
Normale Builds lesen ausschließlich lokale, festgeschriebene Quellen.
Tests decken Grammatik,
Diagnosen, Isolation der Views, Layout, Routing, Iconvalidierung, Escaping,
Markdown, beide Bundles und echte Browserinteraktion ab.

## Verifizierter Implementierungsstand

Die beschriebene Version ist implementiert. Prüfung am 16.11.2026 mit Node.js
26.13.0, npm 11.20.0, esbuild 0.28.2, Playwright 1.65.1 und dem dazugehörigen
Chromium auf macOS/ARM64. Browserbundles ohne externe Laufzeitscripts; der Node-Quellimport verwendet
@xmldom/xmldom und svgpath als gepinnte npm-Abhängigkeiten.

- 190 Unit-/Integrationstestgruppen erfolgreich, einschließlich Parserfehlern,
  deterministischer/isolierter Layouts, Routing, Iconpacks, Unicode, Escaping,
  Markdown und Vergleich beider Bundles.
- Alle zwölf Modellbeispiele mit 46 Ansichten sowie die eingebaute Hilfe im
  echten Browser geprüft.
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
- NAFv4.1: unabhängige gültige Szenarien für alle 47 Viewpoint-IDs, negative
  Kriterien-/Allokations-/Referenz-/Versionsfälle, neun Ansichten desselben
  editierbaren Modells, englische Quellen-/Regelhilfe und Offline-Start geprüft.
  Beide Themes, beide Bundles und kombinierte/einzelne Profilregistrierung
  geprüft. Die ADMBw-Vergleichsdaten sind gegen die festgeschriebene Quelle geprüft.
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
`propertyFields [NAME, NAME]` zeigt zusätzlich die tatsächlichen skalaren oder
mehrwertigen Eigenschaften/Referenz-IDs des jeweiligen Knotens. Das ist von
`attributes [ID, ID]` für eigenständige, zugeordnete Modellelemente getrennt.
Unbekannte Eigenschaftsnamen werden abgewiesen, fehlende optionale Werte nicht
angezeigt; 0/false bleiben sichtbar und alle Werte werden escaped.

View-`style` unterstützt `opacity ZAHL` im Bereich 0–1, ausschließlich für die
Füllung. Standard: 0,2 bei benannten/Hex-Hintergründen, sonst 1. Text, Icons und
Rahmen bleiben deckend. Kontrastberechnungen verwenden den konkreten Wert und
bei Containern die zusammengesetzten Untergründe. Spezialrenderer nutzen den
Wert für Karten, Heatmap-Kacheln und Timeline-Balken.

Die zentrale Farbauflösung in `src/colors.js` nutzt alle 147 festen Namen aus
CSS Color 3 einschließlich Aliasnamen; Groß-/Kleinschreibung ist unerheblich.
`src/css3-colors.js` enthält die Tabelle mit W3C-Quellverweis. Profilfarben,
Stilgruppen, View-Overrides und Heatmap-Endfarben verwenden denselben Resolver.
Hexfarben bleiben kompatibel; dynamische CSS-Farben und CSS4-only-Namen sind
kein Bestandteil dieser Erweiterung. Keine zusätzlichen Abhängigkeiten.

## Direkte Iconify-Registrierung

`registerIconPack(name, pack)` erkennt originale Iconify-JSONs anhand von
`body` in den Icondefinitionen. Die API und bestehende Loader bleiben
unverändert; es werden keine URLs automatisch geladen. Das bisherige
`paths`-Format bleibt kompatibel. Feste Farben sind nun auch in strukturierten
Pfadobjekten erlaubt, lokale Paint-Server dagegen nur innerhalb validierter
Iconify-SVG-Bäume.

`enable-background` wird als Attribut und Inline-Präsentationsstil validiert
und erhalten (`accumulate`, `inherit`, `new` oder `new` mit vier endlichen
Koordinaten/Dimensionen; Breite/Höhe nichtnegativ). Inline-Stile überschreiben
Attribute. Hintergrundpuffer und Filter werden nicht von arch.js emuliert;
die vorhandene Browserdarstellung bleibt maßgeblich. [SVG-Umfang](icons/README.md).

`src/iconify.js` prüft XML mit dem mitgelieferten @xmldom/xmldom 0.9.12,
normalisiert Pfade mit svgpath 2.6.0 und rekonstruiert eine eingefrorene sichere
Baumdarstellung. Dimensionen/Origins, Sammlungsdefaults, Alias-Ketten und
vierteldrehende/gespiegelte Varianten werden aufgelöst. Lokale IDs werden pro
Iconinstanz isoliert. `renderIconToString` unterstützt optional `idPrefix`.
Grenzwerte, unterstützte SVG-Geometrien, Gradienten, Masken und Filter sowie
abgewiesene aktive/externe Inhalte sind unter `icons/README.md` dokumentiert.

Die zwei Bibliotheken sind in den Browserbundles samt Lizenzhinweisen enthalten;
für direkte Node-Quellimporte sind sie reguläre gepinnte dependencies. Keine
zusätzlichen CDN-/Netzwerkabhängigkeiten. `THIRD_PARTY_NOTICES.md` enthält die
Lizenztexte, die der Build auch in beide Bundle-Köpfe schreibt.

Originale Testdaten für Font Awesome 6 Solid und Logos sind zusätzlich lokal
mit festen Quellrevisionen und SHA-256 unter `icons/iconify-sources.lock.json`
abgelegt. Alle fünf Originalsammlungen und sämtliche 14.977 Icon-/Aliasnamen
werden direkt registriert und gerendert. Tests prüfen Atomarität, unveränderte
Eingabedaten, lokale IDs, Transformationen, Node ohne DOM, beide Bundles und
Rastertreue komplexer Logos. Keine automatische Unterstützung beliebiger
animierter oder extern referenzierender SVG-Dateien.

Der Abgleich mit den fünf nutzerseitigen Packs unter `ReferenceDocs/iconpacks/`
umfasst weitere 12.608 Icon-/Aliasnamen. Insbesondere werden Affinity-Exporte
mit vollständigem `<svg>`, XML-Kopf, öffentlichem SVG-1.1-DOCTYPE, `viewBox`,
Editor-Namespaces und `px`-Präsentationsstilen unterstützt. Nur der bekannte
inaktive Standardheader wird vor dem XML-Parser entfernt; DTDs werden weder
geladen noch Entitäten expandiert. Fehlende Dimensionen werden aus absoluten
SVG-Größen oder der `viewBox` abgeleitet. Jedes Icon erhält einen lokalen
SVG-Viewport, damit Prozentwerte in Architekturdiagrammen korrekt bleiben.
`icons/reference-iconpacks.lock.json` dokumentiert die unveränderten Nutzerdaten.
