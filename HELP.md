# Eingebaute Hilfe

Die Hilfe ist Teil von `arch.min.js` und funktioniert offline.
Das Kernbundle `arch.core.min.js` kann über `helpBaseURL` aus Diagnosemeldungen
auf die Referenz in Studio verlinken.
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

Typnamen und Optionen heben sich von ihrer Erläuterung ab. Quelltextbeispiele
stehen in eigenen Codeblöcken. Das gilt im Studio, im Dashboard und im
eigenständigen HTML-Export. Unter `@help config` zeigt **Browser presentation**
die Werte `diagram` (Standard) und `dashboard` sowie ein mehrzeiliges Beispiel
mit der separaten Option `views`. Bei
`@help viewpoints naf41-uaf P4` stehen Pflichtinhalte, zulässige Typen,
Verbindungsregeln und Darstellungsformen vor der vollständigen JSON-Definition.
`@help relations naf41-uaf ResourceFlow` zeigt Endpunkte, Richtung und
Attribute. Beide Ausgaben lassen sich als SVG exportieren.

## Durch die Referenz navigieren

`@help` öffnet die klickbare Einstiegsseite. Von dort führt **profiles** zum
Profil und weiter zu seinen Viewpoints, Knoten- und Beziehungstypen. Auch die
Typnamen in Viewpoint-Regeln und die Endpunkte einer Beziehung sind verlinkt.
Kataloge sind nach Namen lexikographisch sortiert.

**Back** und **Forward** wechseln zwischen besuchten Hilfeseiten. **Reference**
öffnet die Einstiegsseite, **Up** den übergeordneten Katalog. Im Studio
funktionieren auch die Zurück- und Vorwärtsbefehle des Browsers. Die Eingabe
im Editor bleibt erhalten. Eine Hilfeseite lässt sich über
`studio.html?help=viewpoints+naf41-uaf+P6` direkt öffnen.

`arch.render()` und `arch.renderAll()` aktivieren die Navigation automatisch
für jeden Hilfeblock. Anwendungen, die das Ergebnis von `arch.renderDiagram()`
selbst in den DOM einsetzen, können `arch.attachHelpNavigation(svg, graph, options)`
aufrufen. Ein eigenständiger Hilfeexport kann auf die veröffentlichte
Referenz verlinken, wenn `helpBaseURL` beim Rendern auf deren Studio-URL zeigt.

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
| `@help config` | Browserdarstellung, View-Auswahl, Profilwahl und Inline-Profile |
| `@help api` | JavaScript-API und Optionen |

Aliase: `icons` → `iconpacks`, `profile` → `profiles`, `nodes` → `types`,
`edges` → `relations`, `diagram` → `diagrams`, `view` → `views`, `style` → `styles`.

Für automatische Taxonomien: `@help diagrams tree`. Die C1-View kann mit
`diagram tree { relations [CapabilityGeneralization] }` ohne manuelle Positionen
gerendert werden. `parentDirection auto` erkennt Generalisierungsziele als Eltern;
`direction down|up|left|right` (Alias `orientation`), `levelGap`, `siblingGap`, `curve rounded|orthogonal`
und `showLabels` steuern die Ausgabe. Vorhandene Node-Styles sind verfügbar.
Mit `padding 24` setzt du gleiche Außenränder. `padding [24, 56, 32, 16]`
setzt oben, rechts, unten und links einzeln. `padding 24, 56, 32, 16`
ist gleichwertig. Der Standard ist 48 pro Seite.
Die Option gilt auch in benannten `tree`-Blöcken. Dort wirkt sie auf die
Gruppenbox für `place` und Koordinatenreferenzen.
Trees nutzen freie Bereiche oberhalb/neben breiten Unterbäumen automatisch:
Geschwister werden nur anhand tatsächlich belegter Ebenen auf Abstand gehalten.
Nachkommen und automatische Labels bleiben getrennt; `siblingGap` ist weiterhin
der Mindestabstand. Das gilt auch für benannte Gruppen und alle vier Richtungen.
Beispiel: [Compact tree](examples/compact-tree.arch).
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
`include`, `exclude`, Tree-`nodes` und `propertyFields` erlauben beide
Listenschreibweisen: `include a, b` entspricht `include [a, b]`,
`nodes a, b` entspricht `nodes [a, b]` und `propertyFields expression, unit`
entspricht `propertyFields [expression, unit]`. Einzelne Einträge sind ebenfalls
Listen. Das gilt für `propertyFields` auch in Styles und Diagramm-Blöcken.
Leere Listen werden als `[]` geschrieben: `include []` zeigt keine Elemente,
`exclude []` entfernt nichts, `propertyFields []` leert die Feldauswahl.
Eine Tree-Gruppe darf weiterhin keine leere Node-Liste haben.
Mit `exclude l2.1, l2.2` kannst du einzelne Beziehungen aus einer View und
ihrer Viewpoint-Prüfung herausnehmen. Die Endpunkte bleiben ausgewählt.
`style l2.1 {display none}` wirkt nur auf die Darstellung.
Class-Karten unterstützen ebenfalls `place`, berechnete Koordinaten und
Mindestgrößen; Ports folgen ihren Ownern. `@help diagrams class` nennt Grenzen:
Details werden nicht einzeln positioniert; Class hat weiterhin kein
`route`/`routes`/`via`, keine Tree-Gruppen oder grafischen Zuordnungslinien.

`@help routing` erläutert Koordinatenreferenzen und Offsets:
`place maritime at (coverage.x + 20, vision.y - 40)` oder
`place maritime at (hierarchy.x - maritime.width - 80, vision.centerY - maritime.height / 2)`.

Mit `place card right of anchor gap anchor.height / 4` positionierst du eine
Karte relativ zu einem Anker. Die Seiten sind `right`, `top`, `left` und
`bottom`. `gap` misst den Abstand zwischen den Kanten und übernimmt ohne
Angabe das wirksame `spacing` der View. Negative Abstände lassen Überlappung
zu. `align center` ist voreingestellt. Links und rechts richten `align top`
und `align bottom` an horizontalen Kanten aus. Oben und unten stehen
`align left` und `align right` für vertikale Kanten zur Verfügung.

Mit `place card right of hierarchy gap 32 align to member.centerY`
misst du den Abstand vom Baum `hierarchy` und richtest die Kartenmitte an
`member` aus. Links und rechts unterstützt `align to` die Felder
`y`, `centerY` und `bottom`. Oben und unten verwendet es
`x`, `centerX` und `right`. Das jeweilige Feld der platzierten Karte
wird an dasselbe Feld des Referenzkastens ausgerichtet.

`place` kann absolute und relative Angaben in derselben View kombinieren.
Relative Angaben funktionieren auch für Tree-Gruppen und Embeds, Class-Karten
und mit `place virtual` für virtuelle Zustandspunkte. Die
[A5-Beispielview](examples/naf41-foundation-viewpoints.arch)
ordnet seine Statuskarten mit `bottom of` und `right of` an.

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

### Teilvorschau beim Schreiben

Der Browser-Editor rendert gültige Einträge aus der aktuellen DSL-Eingabe, auch
wenn zum Beispiel der Titel eines Knotens, das Ziel einer Beziehung oder der
Block einer `route` noch fehlt. Auch unbekannte Knoten- und Beziehungstypen
werden vorübergehend übersprungen. Das gilt ebenso für eine Beziehung ohne
`type`, wenn das aktive Profil keinen Standardtyp definiert. Bei ähnlichen Namen im Profil
erscheint ein Vorschlag wie `EquipmentType` für `EquipmentTyp`. Bei Beziehungen
prüft die Vorschlagsliste zusätzlich die modellierten Endpunkttypen und
die Pfeilrichtung, etwa um bei `Conveyes` den passenden physischen oder
logischen Typ zu finden. Der rote
Bereich unter dem Diagramm nennt die ersten 20 Fundstellen mit Zeile und Spalte.
Auch bei einem bekannten Beziehungstyp kann die Teilvorschau eine Kante
auslassen, wenn Quelle oder Ziel dem Profil widersprechen. Unter **Type errors**
stehen dann die Fundstelle und, soweit möglich, zulässige Typen.
Sobald der Eintrag gültig ist, fließt er automatisch in die Vorschau ein.
Der SVG-Export im Browser-Editor wird freigegeben, sobald diese Fehler behoben sind.

Wenn zwei Endpunkte in einer View sichtbar sind, werden ihre Beziehungen
automatisch für die View ausgewählt. Widerspricht eine davon dem Viewpoint,
lässt die Teilvorschau sie in dieser View vorübergehend aus und meldet sie unter
**Viewpoint errors**. Ein `exclude RELATION_ID` im View-Block speichert den
Ausschluss für diese View.

Für eine externe Vorschau, etwa aus Vim, aktiviere die Teilvorschau im
DSL-Dokument mit `config { syntaxRecovery true }` oder im Aufruf mit
`arch.renderToString(source, { syntaxRecovery: true })`. Die API-Option hat
Vorrang vor der Dokumentkonfiguration. `validation draft` lässt sich damit
kombinieren und meldet fehlende Profilanforderungen weiterhin separat.
Wenn die Integration vor dem Rendern selbst parst, verwendet sie für die
Teilvorschau `arch.parsePreview(source)`.

Für die Wiederaufnahme helfen eingerückte Blöcke und je ein Eintrag pro Zeile.
Ein Syntaxfehler innerhalb einer Deklaration kann deren gesamten Block
betreffen. Abhängige Kanten und viele Darstellungsanweisungen werden in der
Teilvorschau vorübergehend weggelassen. Fehlen nach dem Auslassen von
Modelleinträgen Pflichtzuordnungen, zeigt die Teilvorschau sie als Draft-Hinweise.
Bei einem beschädigten Architekturkopf, ungültigem JSON oder weiterhin
blockierenden Prüfungen behält der Browser-Editor die letzte renderbare
Vorschau.

**Open help** führt aus Fehlermeldungen und Draft-Hinweisen zur passenden
Referenzseite. Bei Profilregeln öffnet der Link den betroffenen Typ, die
Beziehung oder den Viewpoint. Das Hilfefenster lässt die aktuelle Vorschau
und den Editor geöffnet. Die Links stehen auch in der Meta-Ansicht und in
den Elementdetails zur Verfügung.

In der interaktiven Draft-Vorschau öffnet ein Klick auf eine Karte, eine
Swimlane-Überschrift, eine Beziehung oder ihre Beschriftung die Elementdetails.
Bei Tastaturfokus öffnen `Enter` und `Leertaste` dieselbe Anzeige. Sie enthält Modell-ID, Typ,
vorhandene Attribute und die Validierungshinweise zum Element. Bei Kanten
zeigt sie auch Quelle und Ziel. `Esc` schließt die Anzeige. Bei
`showValidation false` zeigt die Vorschau die Modellinformationen ohne die
Validierungshinweise.

**Geometry** zeigt die endgültige Kartenposition und -größe in SVG-Einheiten
oder bei Kanten ihre Start-, End- und sichtbare Labelposition. **Styles** zeigt
Darstellungswerte wie Schriftgröße, Farbe und Linienstärke. Die berechnete
`style height` kann ein Mindestmaß sein. Unter **Geometry** steht die Höhe
nach Berücksichtigung des Inhalts. **Route settings** zeigt aufgelöste
Andockpunkte, Wegpunkte und Labelvorgaben. Unter dem jeweiligen Wert steht
die Formel mit ihren Referenzen. Reine Zahlenrechnungen stehen als Zahlen
im eingelesenen Modell. Bei eingebetteten Views zeigt **Geometry** die
Koordinaten der äußeren View. Die Routenvorgaben stammen aus der Quellview.

`style EDGE_ID { display none }` blendet die ganze Beziehung pro View aus,
`display standard` zeigt sie wieder. `@help routing` beschreibt den Unterschied
zu `route EDGE_ID { label none }`, das lediglich das Label ausblendet.

Auch Nodes unterstützen `style NODE_ID { display none }`. Bei Packages werden
alle Nachkommen ausgeblendet, einschließlich ihrer Beziehungen. `@help styles`
erklärt diese Sichtbarkeit unabhängig von `showLabel` und den anderen
Einzelfeldern. Die Modell-/Profilanforderungen gelten weiterhin.

Ein `style`-Block kann mehrere Ziele haben. `style [a, b] { display none }`
und `style a, b { display none }` wirken gleich. Treffen mehrere Blöcke auf
dieselbe ID, gewinnt für jede Eigenschaft ihr zuletzt angegebener Wert.
Ein anschließendes `style b { display standard }` zeigt nur `b` wieder an.

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

In Studio verbinden `render()` und `renderAll()` die Diagnose-Links mit der
eingebauten Hilfe. Wer `renderDiagram().svg` selbst einfügt, ruft danach
`arch.attachDiagnosticHelp(container, graph, options)` auf. Der Container
umschließt das SVG und die Elementdetails. Für eigene HTML-Fehleranzeigen
erzeugt `arch.createDiagnosticHelpLink(document, diagnostic, options)` den Link.
`helpBaseURL` verlinkt exportierte SVGs mit einer Studio-Instanz.

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

## Aktivitäten nach Ablauf anordnen

`diagram activity` ordnet Aktivitäten standardmäßig nach den sichtbaren
Ablaufkanten an. In `naf41-uaf` sind das `OperationalControlFlow` und
`LogicalControlFlow`. `layout model` legt die Deklarationsreihenfolge fest.

```arch
diagram activity {
  lanes [vessel, centre, controller, rescue]
  laneAttribute tags
  layout flow
}
```

Eigene Profile können ihre Ablaufkanten mit `activityFlow true` markieren.
`@help diagrams activity` zeigt die verfügbaren Optionen.

## Swimlane-Kanten routen

In `diagram activity { lanes [...] }` kannst du Andockpunkte und Wegpunkte pro
Relation festlegen. Schreibe die Route direkt in den View-Block.

```arch
route l4.7 {
  from bottom 1/4
  to top 3/4
  via (operationalActivity_reportsProblem.x + operationalActivity_reportsProblem.width / 4, operationalActivity_reportsProblem.bottom + 24)
}
```

`from` und `to` unterstützen `auto`, `top`, `right`, `bottom`, `left` und
absolute Paare `(X,Y)`. Seitenpositionen zählen von links nach rechts bzw.
von oben nach unten. Eine fehlende oder mit `auto` angegebene Seite nutzt den
automatischen Andockpunkt. Koordinatenpaare, Seitenpositionen und `via` dürfen
Ausdrücke mit sichtbaren Aktivitäten oder Lane-Knoten enthalten. Die Kante
durchläuft die Wegpunkte rechtwinklig in Listenreihenfolge.
`via (270, 100), (270, 180)` und `via [(270, 100), (270, 180)]` sind gleichwertig.
Beide Formen gelten auch für Einzelrouten, `routes`-Vorgaben und Zuordnungspfeile.

## Zuordnungspfeile routen

In einer Connected-View kannst du jeden Pfeil zwischen einem InformationElement
und seiner tragenden Relation separat steuern:

```arch
route data -> pickup {
  from left
  to 0.5
  via [(370, -125), (370, 132)]
  curve rounded
  label 0.2
}
```

`data` ist die Element-ID, `pickup` die Relations-ID. `to` wählt eine Position
entlang des tatsächlichen Relationspfads: `0` ist dessen Anfang, `1` sein Ende.
Die Position darf eine Zahl, ein Bruch oder ein Ausdruck sein, etwa
`to (data.centerX-a.x)/(b.right-a.x)` mit sichtbaren Knoten `a` und `b`.
Arch.js wertet den Ausdruck nach dem Layout aus. Das Ergebnis muss zwischen
0 und 1 liegen.
Ohne `to` bleibt die automatische Ankerposition bestehen. `from` akzeptiert
`auto`, `top`, `right`, `bottom`, `left` oder einen absoluten Punkt `(X,Y)`.
`label 0.2` platziert eine vom Profil aktivierte Beschriftung bei 20 % der
Länge des Zuordnungspfeils, gemessen von der Karte aus. Auch Brüche, `offset`
mit Ausdrücken, absolute Labelpunkte und `label none` sind möglich. Ohne
Angabe sitzt die Beschriftung in der Mitte des Zuordnungspfeils.
Alle Wegpunkte sind absolute Diagrammkoordinaten, auch innerhalb eines Clusters.
`straight` verbindet ohne `via` zwei unterschiedliche Nodes direkt zwischen
den gewählten Ports, auch bei parallelen oder gegenläufigen Beziehungen.
Es gibt dabei keinen automatischen Versatz; identische Ports können überlappen.
Explizite `via`-Punkte bleiben Zwischenpunkte; Selbstkanten behalten ihre Schleife.

Bei grafischen Referenzkarten bleibt die automatische Relationsbeschriftung
auf der Kante, solange kein Zuordnungspfeil den Labelkasten kreuzt. Bei einer
Kreuzung vergleicht Arch.js die Ausgangsposition mit beiden Seiten. Es wählt
die Position mit den wenigsten Überlagerungen. Bei Gleichstand gewinnt die
Position, die weniger Zuordnungspfeile verdeckt. Bei identischen Werten hat
die Ausgangsposition Vorrang. Eine explizite `label`-Position bleibt fest.

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
zwischen 0 und 1, als Zahl oder Ausdruck (`1/2`, `10 / source.height`).
Auf `top`/`bottom` läuft sie von links nach rechts, auf `left`/`right` von oben
nach unten. Ohne Wert gilt die Mitte (0.5); 0 und 1 liegen an den Ecken.
Die Position folgt dem Knoten auch beim Verschieben oder Ändern seiner Größe.
`auto` akzeptiert keine Position; Division durch null ist ungültig.

```arch
route hasLocation {
  from right (target.centerY - source.y) / source.height
  to left 1/2
}
```

Hier sind `source` und `target` Knoten-IDs. Der Ausdruck richtet den Startpunkt
auf die Höhe der linken Seitenmitte des Ziels aus. `from right 10 / source.height`
setzt den Start zehn SVG-Einheiten unter die obere rechte Ecke. Für `top` und
`bottom` teilst du einen horizontalen Abstand durch `source.width`.

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

Absolute Endpunkttupel können mit endgültigen Kartenpositionen und -größen
rechnen. `from (a.right, a.y + 10)` dockt zehn SVG-Einheiten unter der oberen
rechten Ecke an. `from (a.right, b.centerY) to left` richtet den Startpunkt
an der linken Seitenmitte von `b` aus. Die Tupel unterstützen dieselbe
Arithmetik wie `via` und sind auch in `routes` verwendbar.

### Vorgaben und Überschreibungen

In einer Connected-View gilt standardmäßig `curve rounded` für Kanten und
Zuordnungspfeile. Mit `curve orthogonal` erhältst du rechtwinklige Ecken.
`routes` setzt Vorgaben für alle Kanten und Zuordnungspfeile in der View.

```arch
routes { curve straight }

route pickup { curve rounded }
route data -> pickup { from left }
```

Hier verwendet `pickup` abgerundete Ecken. Der Zuordnungspfeil übernimmt
`straight` und startet links an der Karte. Konkrete Angaben haben pro Eigenschaft
Vorrang, unabhängig von der Position des `routes`-Blocks.

Mehrere Beziehungen können sich einen Block teilen. Innerhalb der `route`-Blöcke
gewinnt pro Beziehung und Eigenschaft die letzte Angabe.

```arch
route r1, r2 { curve rounded from bottom to top }
route r2 { curve straight }
```

`route [r1, r2] { … }` ist gleichwertig. Im Beispiel übernimmt `r2` die
Andockseiten aus dem gemeinsamen Block und verwendet `straight`.

Erlaubt sind `from`, `to`, `via`, `curve`, `label`, `path`, `icon`, `iconPosition`, `showIcon`, `showLabel`, `showStereotype`, `sharePath`, `color`, `width`, `dasharray`, `crossings` und `crossingRadius`. Eine einzelne Host-Kante kann zusätzlich mit `source` und `target` konkrete Karten aus Einbettungen auswählen. Ein `to`-Port oder
absoluter Zielpunkt gilt für fachliche Kanten; ein `to`-Wert von 0 bis 1 für
Zuordnungspfeile. Ein `label` im gemeinsamen `routes`-Block gilt für fachliche
Kanten. Zuordnungspfeile erhalten ihre `label`-Vorgabe direkt in der Einzelroute.
Konkrete Angaben zu
`from`, `to`, `via` oder `curve` ersetzen einen geerbten freien `path`.
Ein konkret gesetzter `path` steuert den gesamten Pfad. `routes {}` lässt das
bisherige automatische Routing bestehen. Siehe auch `@help routing`.

## Sprungbögen an Kantenkreuzungen

```arch
routes { crossings bridge crossingRadius 6 }
route r1 { crossings none }
route r2 { crossingRadius 9 }
```

Connected-Views verwenden standardmäßig `crossings bridge` und einen Radius
von 6 SVG-Einheiten. `crossingRadius` akzeptiert Werte von 2 bis 24.
`routes { crossings none }` schaltet Sprungbögen für die View aus. Mit
`route r2 { crossings bridge }` kannst du sie für eine einzelne Kante zulassen.
`route r1 { crossings none }` hält `r1` am Kreuzungspunkt gerade. Die andere
Kante kann dort weiterhin einen Sprungbogen bekommen.

Der Renderer bevorzugt die später gezeichnete Kante und prüft, ob um die
Kreuzung genug Platz für den Bogen bleibt. Er berücksichtigt gerade
Pfadabschnitte, auch zwischen abgerundeten Kurven. Gemeinsame Pfade, deren
Abzweigungen und Endpunkte bleiben als solche erkennbar. Karten, Labels,
Pfeilenden und Ansatzpunkte von Zuordnungspfeilen brauchen Abstand.
Deckungsgleiche Strecken erhalten denselben Sprungbogen, auch bei manuell
gesetzten `via`-Punkten. Verhindert eine der Routen den gemeinsamen Bogen,
prüft der Renderer den kreuzenden Abschnitt. Passende gestrichelte Routen
zeichnen den gemeinsamen Bogen einmal.
Explizite SVG-Pfade, eingebettete Routen und gemeinsame Pfadabschnitte
können gekreuzt werden. Ihre eigene Darstellung bleibt dabei erhalten.
Die Bögen sind Teil des SVG-Exports. Labelpositionen, Referenzanschlüsse und
die logische Pfadgeometrie beziehen sich weiterhin auf die ursprüngliche Route.

## Farbe, Breite und Strichmuster von Routen

Wenn gestrichelte Beziehungen bei gleicher Farbe, Strichbreite und gleichem
Strichmuster auf einem geraden Abschnitt deckungsgleich verlaufen, zeichnet
der SVG-Renderer den gemeinsamen Strich einmal. Das gilt auch für manuelle
`via`-Routen und Überlagerungen mit einem durch `sharePath` entstandenen
Abschnitt. Jede Beziehung behält ihre Pfeilspitzen und Beschriftung.

```arch
routes { color "#64748b" width 2 dasharray 8, 4 }
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
`dasharray 8, 4` und `dasharray [8, 4]` bedeuten jeweils 8 Einheiten Strich und
4 Einheiten Lücke. Zulässig sind 1–32 nichtnegative Zahlen bis 10000, davon
mindestens eine positiv. Ungerade
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

# Ganze Tree-View
diagram tree { sharePath stereotypes }

# Alternativ: benannte Gruppe innerhalb einer Connected-View
tree hierarchy { nodes [a,b,c] sharePath stereotypes }
```

`none` ist der Standard. `stereotypes` bündelt nur exakt gleiche Relationstypen,
`all` auch unterschiedliche Typen mit kompatiblem Linienstil und Pfeilrichtung.
Gemeinsamer Start- oder Zielknoten und passende Ports sind erforderlich.
Einzelne `route`-Eigenschaften haben Vorrang. Labels/Icons bleiben je Beziehung
sichtbar; der gemeinsame Abschnitt und seine Pfeilspitze werden einmal gezeichnet.

Die Option gilt in Connected-Views, benannten Tree-Gruppen und ganzen Tree-Views.
In benannten Gruppen gilt: Einzelroute vor Tree-`sharePath` vor View-`routes`.
Die Gruppenoption wirkt auf die ausgewählten internen Hierarchiekanten;
externe Kanten behalten die View-/Einzelroutenvorgaben. Ganze Tree-Views setzen
den Modus im Diagramm-Block und unterstützen weiterhin keine manuellen Routen.
`curve rounded` rundet die äußeren Knicke ab und führt die seitlichen Linien
mit Bögen in den gemeinsamen Stamm. Ein mittig ausgerichteter Ast verläuft
gerade. Die automatische Bündelung braucht ausreichend freien Platz. Hindernisse,
zu wenig Labelplatz, manuelle `via`/`path`, absolute Endpunkte, explizit
positionierte Seitenports, `straight`/`bezier`,
parallele Beziehungen und Kanten zwischen Containern bleiben unabhängig.
Fan-in hat Vorrang vor Fan-out. Grafische Zuordnungslinien werden nicht gebündelt;
sie folgen weiterhin dem vollständigen Pfad ihrer jeweiligen Beziehung.

JSON: `"routes": {"sharePath": "stereotypes"}`. Beispiel:
[Shared paths / C8](examples/shared-paths.arch). Laufzeithilfe: `@help routing`.
Die [Tree-Demo](examples/tree-shared-paths.arch) vergleicht `none`, `stereotypes`
und `all` in ganzen Tree-Views und einer benannten Gruppe.

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

Labelgröße und SVG-Grenzen berücksichtigen das Icon. Die Icon-Optionen gelten
für Labels fachlicher Kanten. Node-Icons
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

Die oben gezeigten Schalter sind standardmäßig `true`. `showLabel` steuert den
Node-Titel, `showStereotype` die Typ-/Stereotypzeile. `iconPosition` akzeptiert
`top`, `left`, `bottom`, `right`; Kartenmaße und Texte passen sich an. Ohne
Angabe bleibt die bisherige Templateposition bestehen. Bei Packages bleiben
Icons im Kopfbereich; ausgeblendete Kopftexte verbergen keine Kinder.

Im Modus `display logo` wird das Icon ohne Positionsangabe zentriert, sonst
innerhalb des gepolsterten Rechtecks an der gewählten Seite ausgerichtet.
Dieser Modus blendet weiterhin alle Texte aus. `showIcon false` blendet das
Icon aus. Ein aktiviertes Hintergrundbild bleibt sichtbar. Für frei
kombinierbare Textfelder verwende `display standard`.
Die Optionen gelten für Connected-Views und deren Referenzkarten; Modellwerte
und Tooltips bleiben erhalten.

## Hintergrundbilder für Views und Elemente

```arch
architecture "Standort" {
  model {
    system dc "Datacenter" {
      icon core.database
      backgroundImage "/images/datacenter.jpg"
    }
    system factory "Factory" {
      backgroundImage "/images/factory.jpg"
    }
  }
  view overview "Übersicht" {
    backgroundImage "/images/site-plan.png"
    showBackgroundImage true
    style factory { showBackgroundImage false }
  }
  view plain "Ohne Bilder" {}
}
```

`backgroundImage` in der View setzt das Bild für die Zeichenfläche sofort.
Elementbilder sind standardmäßig ausgeblendet. `showBackgroundImage true` in
der View blendet die Elementbilder ein. Ein `style` kann für ein Element die
Sichtbarkeit überschreiben oder mit `backgroundImage` eine andere Bildquelle
setzen. `icon` und `showIcon` bleiben unabhängig davon.

Die Bilder füllen ihre Fläche proportional, bei Bedarf mit Zuschnitt.
View-Bilder werden mit 30 Prozent Deckkraft, Elementbilder mit 25 Prozent
Deckkraft hinter dem Karteninhalt gezeichnet. Pfade werden im Browser relativ
zur Seite aufgelöst. Für eine eigenständige SVG-Datei mit eingebetteten Bildern
verwende Rasterbilder als `data:image/png;base64,…` oder in einem anderen
unterstützten Format (JPEG, GIF, WebP, AVIF). Bei einem fehlenden Bild zeigt die
View weiterhin Diagramm und Hintergrundfarbe.

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

## Route-Icon, Text und Stereotyp getrennt auswählen

```arch
routes { icon core.cloud showStereotype true }
route pickup { showIcon false showLabel false }
```

In Connected-Views steuert `showLabel` den Titel und die Referenztexte.
`showIcon` steuert das konfigurierte Icon. Beide sind standardmäßig `true`.
`showStereotype true` zeigt den Relationstyp als `«TYPE»` oberhalb des
Labeltexts. Im Beispiel zeigt `pickup` nur den
Stereotyp. Einzelne `route`-Angaben überschreiben die Vorgaben pro
Eigenschaft. `label none` blendet alle drei Inhalte samt Rahmen aus.

Mit `config { showRouteStereotypes true }` aktivierst du Stereotype für alle
Connected- und Tree-Views. Der Standardwert ist `false`. Für eine einzelne
Tree-View verwende `diagram tree { showStereotype true }`. Eine benannte Gruppe
akzeptiert `tree hierarchy { nodes [a, b, c] showStereotype true }`. In Bäumen
blendet `showLabels false` den gewöhnlichen Text aus und lässt den Stereotyp
sichtbar, wenn er aktiviert ist.

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
config { views detail, overview }
```

```arch
config { views detail }
```

Die Liste bestimmt die Reihenfolge. `views [detail, overview]` ist gleichwertig.
IDs müssen existieren und eindeutig sein;
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

`Node` ist ein Alias von `LogicalNode`. Seit `naf41-uaf@4.1.0-arch.34`
ist `PhysicalActiveResource` ein abstrakter Alias von `ResourcePerformer`.
Instanziiere für S. 108 ein `System` mit `isStandardConfiguration false` und
`stereotype "Physical Active Resource"`. Modelle mit der ehemaligen konkreten
Deklaration können die mitgelieferte Revision `naf41-uaf@4.1.0-arch.33` wählen.

`@help types naf41-uaf Node`, `@help types naf41-uaf PhysicalActiveResource`
und `@help viewpoints naf41-uaf S2` erklären Typen und Grenzen. Jeweils einen
Befehl pro Hilfedokument verwenden. Die Richtungen des Beispiels sind:
`ConsumesService` Node → Service, `EnablesService` ServiceFunction → Service,
`RealizesService` ResourcePerformer (z. B. System) → Service. Die nativen UAF-Beziehungen
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
nutzbar. S7 verlangt die Eigentümerzuordnung und zeigt Prüfhinweise für nicht modellierte Ressourcenzuordnungen; bekannte Zuordnungen müssen sichtbar sein.

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

## Views wiederverwenden: extends und embed

Die Connected-Zeichenfläche wird am tatsächlich gezeichneten Inhalt mit Rand
ausgerichtet. Der Koordinatenursprung wird nicht zusätzlich freigehalten;
positive und negative Modellkoordinaten bleiben unverändert. Sichtbare
Einbettungsrahmen werden vollständig berücksichtigt.

`extends s3` übernimmt die Auswahl und Darstellung einer View. Lokales
`include` ergänzt die effektive Auswahl, `exclude` entfernt daraus Elemente
oder Beziehungen. Beziehungsausschlüsse werden vererbt.
Styles, Routen und gemeinsame Routenoptionen werden feldweise überschrieben;
eine lokale Platzierung ersetzt die geerbte vollständig. Viewpoint, Diagramm,
Theme, Richtung und Abstand können lokal geändert werden. Die Ausgangsview
bleibt unverändert. Genau eine Basis je View; Vorwärtsreferenzen und Ketten
sind möglich.

```arch
view s7 "S7" {
  extends s3
  viewpoint S7
  include receiving
  place receiving at (service.x, service.bottom + 80)
}
view overview "Overview" {
  embed s3 as interfaces {frame true}
  place interfaces at (0,0)
  include receiving
  place receiving at (interfaces.x, interfaces.bottom + 80)
}
```

Die Kurzform `embed s3` verwendet `s3` zugleich als Gruppen-ID. Ohne Block
bleibt die Einbettung nahtlos. `frame true` zeigt Rahmen und Quellview-Titel.
Gruppenmaße umfassen das Quelllayout einschließlich seines Exportabstands.
Karten bleiben über ihre Modell-ID erreichbar, solange diese im Host eindeutig
ist. `gruppe.node` ist auch bei einer einzelnen Karte gültig. Bei mehreren
Karten desselben Knotens verlangt Arch.js den qualifizierten Namen und nennt
die möglichen Adressen. Bei verschachtelten Einbettungen gilt der volle Pfad,
etwa `gruppe.innen.node`.

Einbettungen benötigen eine Connected-View und Connected-/Tree-Quellen.
Überlappende Einbettungen behalten jeweils ihre Karten und internen Kanten.
Interne Styles, Platzierungen und Routen werden über eine erweiterte Quellview
geändert. Die fachliche Prüfung zählt Elemente und Beziehungen anhand ihrer
Modell-IDs. Doppelte Adressen durch kollidierende Namen, Zyklen, ausgeschlossene
eingebettete Nodes und Help-/Meta-Quellen führen zu einer Diagnose.

```arch
view overview "L3 Overview" {
  embed l3.1 as sub1
  embed l3.2 as sub2
  include [note]
  place sub1 at (0, 0)
  place sub2 at (0, sub1.bottom + 40)
  place note at (sub2.actor.right + 40, sub2.actor.y)
  route noteLink {
    target sub2.actor
    from left to right
  }
}
```

`noteLink` ist hier eine Modellbeziehung von `note` zu `actor`, während
`target sub2.actor` die sichtbare Zielkarte auswählt. `source` funktioniert
entsprechend. `from` und `to` setzen die Ports. Koordinatenausdrücke in
Endpunkttupeln, `via`, Labels und Styles können qualifizierte Namen verwenden.
Für mehrdeutige grafische Referenzen einer Host-Kante wählt beispielsweise
`route sub2.payload -> noteLink { to 1/2 }` die Referenzkarte.

Beispiele: [view-reuse.arch](examples/view-reuse.arch),
[naf41-view-reuse.arch](examples/naf41-view-reuse.arch). Das NAF-Beispiel zeigt den
Operationsparameter-Zweig von S7; für den zuvor nicht zugeordneten Resource-
Parameter ergänzt es ausdrücklich eine Ressourcenreferenz. Es bildet nicht das
vollständige S7-Beispiel mit logischen Funktionsparametern ab.

## S7: Funktionsparameter und Informationsprodukte

Ab `naf41-uaf@4.1.0-arch.17`:

```arch
relation parameter receiving -> incoming "has" {type HasServiceFunctionParameter}
relation product incoming -> report "involves" {type InvolvesLogicalResource}
```

Dabei ist `receiving` eine ServiceFunction, `incoming` ein
ServiceFunctionParameter und `report` beispielsweise ein InformationProduct.
Die logische Zielkategorie ist OperationalExchangeItem, einschließlich
InformationElement. Physische Datenprodukte bleiben an Operationsparameter
über InvolvesPhysicalResource gebunden. S7 verlangt die Funktionszuordnung und die Sichtbarkeit vorhandener
Ressourcenzuordnungen. Nicht modellierte Ressourcenzuordnungen erzeugen einen
Prüfhinweis. Alternativ sind owner/resource-Referenzen möglich. Alte physische resource-Referenzen bleiben kompatibel, erweitern aber
nicht die Ziele der neuen logischen Beziehung.

Hilfe: `@help connections naf41-uaf ServiceFunctionParameter` und
`@help relations naf41-uaf InvolvesLogicalResource`.
[Beispiel mit beiden Zweigen](examples/naf41-service-parameters.arch).

## Berechnete und relative Routenlabels

```arch
route request { label (source.centerX, source.y - 20) }
route response { label 0.3 }
routes { label 1/2 }
```

Punktkoordinaten akzeptieren dieselben Felder, Rechenoperatoren und Grenzen
wie `place`/`via`: `+`, `-`, `*`, `/`, Klammern sowie sichtbare Node-, Paket-,
Tree- und Embed-Gruppenreferenzen. Sie werden nach dem Layout aufgelöst und
sind absolute View-Koordinaten. Ein expliziter SVG-Pfad unterdrückt diese
Labelberechnung nicht.

Ein einzelner Wert zwischen 0 und 1 positioniert den Labelmittelpunkt entlang
der gesamten logischen Route: 0 am Anfang, 1 am Ende. Brüche wie `1/3` sind
möglich. Wegpunkte, Rundungen, Bézier-Kurven und Selbstschleifen zählen zur
Pfadlänge; Kurven werden über die vorhandene Pfadabtastung angenähert.
Bei gemeinsamen Pfaden zählt die vollständige Beziehung, nicht nur ihr Ast.
Die Route wird durch diese Einstellung nicht verändert.

Beide Formen sind explizite Positionen: Es gibt keinen automatischen Versatz
oder Seitenwechsel zur Kollisionsvermeidung. Lokales `label` überschreibt die
Vorgabe aus `routes`. `label none` bleibt verfügbar. Einzelrouten für
Zuordnungspfeile akzeptieren dieselben Labelpositionen.

JSON: `"label": ["source.centerX", "source.y - 20"]`, `"label": 0.3` oder
`"label": "1/3"`. Ausdrücke bleiben im DSL-/JSON-/Meta-Rundlauf erhalten;
Brüche werden zu Dezimalzahlen normalisiert.
[Beispiel](examples/label-positions.arch), Laufzeithilfe: `@help routing`.

Ein fester Abstand entlang der Route lässt sich mit `offset` ergänzen:

```arch
route response { label 0.5 offset 20 }
route request { label 0 offset 80 }
route reply { label 1 offset -40 }
```

Der Abstand wird nach der relativen Position in SVG-Einheiten entlang des
Pfads gemessen: positiv zum Ziel, negativ zur Quelle. Er ist keine Verschiebung
senkrecht zur Kante. Ergebnisse außerhalb der Route werden auf Start/Ende
begrenzt; bei Länge null bleibt das Label am einzigen Pfadpunkt. Erlaubt sind
endliche Zahlen innerhalb ±10000000. Für Ausdruckspaare ist kein zusätzlicher
offset vorgesehen; deren Rechenoperatoren steuern die Koordinaten direkt.
JSON: `"label": {"position": 0.5, "offset": 20}`; position akzeptiert auch
Bruchstrings. Die lokale Labelangabe ersetzt die gesamte geerbte Labelposition.

Auch der Abstand selbst kann berechnet werden:

```arch
route response { label 0.5 offset source.width / 2 }
route reply { label 1 offset -(target.height + 20) }
```

`offset` verwendet dieselben sichtbaren Geometrieanker und Rechenoperatoren wie
`via`. Der Wert wird nach der endgültigen Platzierung aufgelöst, auch bei einem
expliziten SVG-path. Er bleibt ein Abstand entlang des Pfads, kein Prozentwert.
Das Ergebnis muss endlich innerhalb ±10000000 liegen; die endgültige
Pfadposition wird wie bei numerischen Abständen auf die Endpunkte begrenzt.
JSON: `"label": {"position": 0.5, "offset": "source.width / 2"}`.
Ausdrücke bleiben beim DSL-/JSON-/Meta-Rundlauf erhalten.

`sideOffset` setzt den Labelmittelpunkt senkrecht zur lokalen Pfadrichtung.
Positive Werte gehen nach links, negative nach rechts, jeweils in Blickrichtung
vom Pfadanfang zum Pfadende. Bei `a <-> b` verläuft der Pfad von `a` nach `b`.
Bei einem expliziten SVG-Pfad zählt seine Zeichenrichtung. An einem Knick
gilt die Richtung des ankommenden Segments.

```arch
route response { label 0.5 offset 20 sideOffset 24 }
route event -> transition { label 0.3 sideOffset -event.width / 10 }
```

`sideOffset` akzeptiert dieselben Ausdrücke und SVG-Einheiten wie `offset`.
Der seitliche Abstand wird an der durch `label` und `offset` bestimmten
Pfadposition angewendet.

Als eigener Routeneintrag verschiebt `sideOffset` die vorhandene Labelposition.
Ohne `label` ist das die vom Layout gewählte Position, einschließlich des
automatischen Abstands für Zuordnungspfeile. `label 0.5` setzt den Mittelpunkt
ausdrücklich auf den Pfad.

```arch
route l5.7 { sideOffset -12 }
```

## Prüfmarkierungen für Ressourcenzuordnungen

Ab `naf41-uaf@4.1.0-arch.21` unterscheidet S7:

- **?**: Keine Ressourcenzuordnung modelliert. Vollständigkeit fachlich prüfen;
  dies ist kein belegter Kardinalitätsverstoß und blockiert auch Strict nicht.
- **!**: Eine bekannte Pflichtzuordnung oder ihre Ressource ist ausgeblendet.
  Strict meldet einen Fehler, Draft rendert mit Warnung.

S3 darf bekannte Ressourcenzuordnungen ausblenden (may show), S7 muss sie im
Umfang der dargestellten Parameter zeigen (shall show). Eine gezeichnete Kante
wird auch dann geprüft, wenn eine zusätzliche Referenz auf dieselbe Ressource
existiert. Referenzbasierte Zuordnungen verlangen einen sichtbaren Zielknoten;
sie erzeugen keine automatischen Modellbeziehungen.

Die Markierungen erscheinen neben Connected-/Tree-Karten und erläutern die
Stelle per Tooltip und zugänglicher Beschriftung. Unter dem Diagramm stehen
Legende und Details. Andere Renderer zeigen die Hinweise im Footer. Es werden
keine fehlenden Nodes oder Kanten erzeugt. Hinweise beziehen sich nur auf die
angezeigten Views; die Modellvalidierung prüft weiterhin alle deklarierten Views.

```arch
config {profile naf41-uaf validation draft showValidation false}
```

`showValidation false` versteckt Markierungen und Footer gemeinsam, beispielsweise
für Exporte. Alternativ API `{showValidation:false}`; die API hat Vorrang vor
config. Validierung und Strict-Fehler bleiben aktiv. `validate()` liefert
weiterhin Diagnosen. `reviewRequired:true` kennzeichnet fehlendes Modellwissen;
ein solcher Hinweis allein setzt nicht `conformant:false`.

[Beispiel](examples/mapping-review.arch), `@help config`.

## L2 Needlines

```arch
Node search "Search"
Node assetControl "Asset Control"
relation control search -> assetControl "control" {type Needline}
```

Needline-Karten sind optional. Die objektifizierte Form bindet eine Karte an
die Kante; das Profil zeichnet ihre „is equal to“-Zuordnung automatisch:

```arch
Needline taskingNeed "Tasking"
InformationProduct order "Tasking Order"
relation tasking assetControl -> search "tasking" {
    type Needline
    needline taskingNeed
}
relation payload taskingNeed -> order "conveys" {type ConveysLogicalResource}
```

`route taskingNeed -> tasking {from top 1/2 to 1/2}` positioniert die
Zuordnungslinie. Normale `route payload`-Angaben steuern die conveys-Beziehung.
Eine View kann die Objektkarte oder bekannte Payloads ausblenden. L2 verlangt
mindestens eine Needline-Kante oder ein gültiges Legacy-Needline-Objekt mit
`source` und `target`; eine LogicalDependency allein genügt nicht.
Ein ausgewähltes Objekt braucht eine ausgewählte Bindung oder das vollständige
Legacy-Endpunktpaar. Doppelte Bindungen und widersprechende Endpunkte liefern
Fehler, im Draft-Modus Hinweise. Referenzen allein erzeugen keine Modellkanten.

Wenn L1 und L2 dieselben Nodes verwenden, entferne die Needline-IDs mit
`exclude l2.1, l2.2` aus der L1-View. L2 kann die Beziehungen weiterhin verwenden.
L3 erlaubt dieselben Needlines mitsamt ihren Nodes als optionalen Kontext.
Die `LogicalInteraction` und ihre `conveyed`-Ressourcen bleiben für L3 Pflicht.

[Beispiel S.129](examples/naf41-needlines.arch),
[Cut-out mit drei Darstellungsvarianten](examples/naf41-needlines-cutout.arch).
Hilfe: `@help relations naf41-uaf Needline`, `@help viewpoints naf41-uaf L2`.
