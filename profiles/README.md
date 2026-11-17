# Generische Architekturprofile

arch.js trennt **fachliche Modellierung** von **grafischer Darstellung**. Ein
Profil legt die Typen, Attribute, Beziehungen und Viewpoint-Regeln eines
Frameworks fest. Ein Typ wie `product` verwendet beispielsweise das vorhandene
SVG-Template `application`. Der Kern enthält keine Sonderbehandlung für NAF,
UAF, ArchiMate oder ein organisationsspezifisches Framework.

Diese Anleitung beschreibt das generische Profilschema. Sprach-/API-Vertrag:
[SPEC.md](../SPEC.md); Einsatzschwerpunkt, Vorteile und Grenzen:
[COMPARISON.md](../COMPARISON.md).

Architekturquellen können zusätzlich zur DSL als [JSON](../JSON.md) beschrieben
werden. Deren Inline-`config` verwendet die DSL-Schlüssel `type`, `relation`,
`viewpoint` und `attribute`. Das hier beschriebene vollständige Profilformat mit
`nodeTypes`/`relationTypes` für `registerProfile()` bleibt unverändert.

## Variante 1: Profil als Parameter

Ein Profilobjekt kann direkt pro Aufruf übergeben werden:

```js
const profile = {
  id: 'company',
  version: '1',
  nodeTypes: {
    actor: { template: 'person' },
    product: {
      template: 'application',
      attributes: { owner: { type: 'string', required: true } }
    }
  },
  relationTypes: {
    uses: { from: ['actor'], to: ['product'], style: 'flow' }
  },
  defaultRelation: 'uses'
};

const source = `architecture "Portal" {
  model {
    actor customer "Kunde"
    product portal "Portal" { owner "Team Commerce" }
    relation visit customer -> portal "Verwendet"
  }
}`;

arch.render('#diagram', source, { profile });
const report = arch.validate(source, { profile });
// { valid: true, profile: { id: 'company', version: '1' }, diagnostics: [] }
```

Alternativ einmal registrieren und anschließend per ID verwenden:

```js
arch.registerProfile('company', profile);
arch.render('#diagram', source, { profile: 'company' });
arch.parse(source, { profile: 'company' });
```

Ein geladenes JSON-Objekt wird genauso registriert. Die Engine lädt keine URLs
automatisch. Über HTTP kann `fetch()` verwendet werden; in Node `readFile()`.
Für lokale `file://`-Seiten erzeugt der Build aus allen `profiles/*.json` das
optionale Browser-Script `profiles/profiles.js`:

```html
<script src="arch.min.js"></script>
<script src="profiles/profiles.js"></script>
```

Das mitgelieferte [enterprise.json](enterprise.json) ist ein bewusst einfaches
Beispielprofil, kein standardkonformes NAF-/UAF-/ArchiMate-Profil.
Die separaten Profile `uaf` und `naf4-uaf` enthalten den UAF-1.0-Typkatalog und
ausgewählte NAF-Regeln. Umfang, Einzelscripts und Versionsbindung:
[uaf/README.md](uaf/README.md).
Das separate `naf41-uaf` ergänzt alle 47 Viewpoint-IDs der NAFv4.1-Ausgabe
2026.03 als strukturelles Anwendungsprofil auf Basis von `uaf`:
[Anleitung](naf41/README.md), [Abdeckung und offene Prüfungen](naf41/COVERAGE.md).
Diese Abdeckung ist keine vollständige normative Konformitätsprüfung.

## Variante 2: Eigenes Profil im config-Block

```arch
architecture "Portal" {
  config {
    id company
    version "1"
    defaultRelation uses
    type actor { template person }
    type product {
      template application
      attribute owner { type string required true }
      attribute criticality { enum low, medium, high }
    }
    relation uses {
      from actor
      to product
      style flow
      outgoing { max 3 }
    }
  }
  model {
    actor customer "Kunde"
    product portal "Portal" {
      owner "Team Commerce"
      criticality high
    }
    relation visit customer -> portal "Verwendet"
  }
}
```

Der vereinfachte Block wird in dieselbe Profildefinition wie die JSON-Variante
übersetzt und durch denselben Validator geprüft. `config` darf vor oder nach
`model` stehen. Attribute sind Strings/Wörter, Zahlen, `true`/`false` oder flache
Listen dieser Werte, beispielsweise `contacts [owner1, owner2]`.
Eigene Zahlenattribute dürfen beliebige endliche JS-Zahlen enthalten; nur die
Zeichenkoordinaten sind auf ±10.000.000 begrenzt.

Ein vorhandenes registriertes Profil kann auch im Dokument gewählt werden:

```arch
config { profile enterprise-demo }
```

Diese Auswahl und eine Inline-Profildefinition sind innerhalb desselben
`config`-Blocks Alternativen.

## Auswahlreihenfolge und Isolation

1. Expliziter API-Parameter `options.profile` (Objekt oder registrierte ID).
2. Im Dokument ausgewähltes `config { profile ID }`.
3. Im Dokument definiertes Inline-Profil.
4. Eingebautes Profil `default` für die bisherige Sprache.

Ein expliziter Parameter ersetzt die Dokumentauswahl/Inline-Regeln vollständig;
Regeln werden dabei nicht unbemerkt zusammengeführt. Ein Dokument kann ein vom
Aufrufer erzwungenes Profil nicht durch lockere Inline-Regeln abschwächen.

`parse()` speichert das aufgelöste Profil als eingefrorenen, JSON-kompatiblen
Snapshot in `model.profile`. Layout und Rendering prüfen auch bereits geparste
Modelle erneut. Ein späteres Überschreiben einer Registry-ID verändert frühere
Modelle nicht. Ein erneuter expliziter Profilparameter wählt dagegen bewusst
das neue Profil. Bei bereits geparsten Modellen sind implizite Relationstypen
schon konkret aufgelöst und werden durch einen Profilwechsel nicht umbenannt.

Inline-Profile werden nicht global registriert. `getProfiles()` liefert die
registrierten IDs, `getProfile(id)` eine unabhängige Kopie des expandierten
Profils. Registrierung ist atomar: ungültige Schemata ersetzen kein gültiges
Profil. Es gibt keinen globalen „aktiven“ Profilzustand.

## Profilformat

### NAF-Bezeichnung Goal und ADMBw-Abgrenzung

In `naf41-uaf` ist `Goal` ein dokumentierter Anwendungsadapter mit
`extends: ["EnterpriseGoal"]`. Damit funktionieren die Bezeichnung aus dem
NAFv4.1-C2-Beispiel und der native UAF-Name gleichermaßen. Pflichtinhalte und
Verbindungen in C2, `SpecifiesGoal` und geerbte Attribute werden gemeinsam geprüft.
Der native Katalog `uaf` bleibt bei `EnterpriseGoal`.

Die Referenz `NAFv4-ADMBw-MDG-2026.05.xml` definiert `EnterpriseGoal`, keinen
separaten `Goal`-Stereotyp. Für diese Namensabbildung wird kein eigenes Profil
benötigt. Bundeswehr-spezifische Typen, Endpunktregeln und Abweichungen gehören
hingegen in ein separates ADMBw-Anwendungsprofil mit ausdrücklich festgelegter
Basis. Die MDG nennt NAF 4.0; sie ist keine unveränderte NAFv4.1-Definition.
Sparx-Toolboxen, Shape Scripts und andere MDG-Werkzeugfunktionen werden nicht
durch die Deklaration eines arch.js-Profils importiert.

Der NAFv4.1-C2-Cut-out (S.90) erlaubt drei `desires`-Endpunkttypen:
EnterprisePhase → Capability (`DesiresCapability`), → EnterpriseVision
(`DesiresVision`) und → EnterpriseGoal/Goal (`DesiresGoal`). Die C2-Regeln
fordern pro Planungsphase mindestens eine Verbindung aus dieser Gruppe.
So ist das Phase→Vision-Beispiel auf S.91 ohne zusätzlichen direkten
Phase→Capability-Link zulässig. `CapabilityGeneralization` bleibt auf
Capability→Capability begrenzt.

| Bereich | Unterstützte Einstellungen |
| --- | --- |
| Profil | `styleGroups`, `id`, `title`, `version`, `extends`, `defaultRelation`, `requireViewpoint` |
| `nodeTypes.NAME` | `extends`, `template`, `abstract`, `container`, `contains`, `attributes`, `icon`, `accent`, `styleGroup`, `backgroundColor`, `comparisons` |
| `relationTypes.NAME` | `extends`, `from`, `to`, `directions`, `style`, `abstract`, `allowSelf`, `attributes`, `outgoing`, `incoming`, `pairs`, `acyclic`, `referenceLabels`, `referenceDisplay`, `referenceOccurrences` |
| `viewpoints.NAME` | `nodes`, `relations`, `requiredNodes`, `requiredRelations`, `connections`, `references` |

Profile, Typen und Viewpoints können außerdem `title`, `description`, `sources`
und `limitations` für Registry und englische Laufzeithilfe enthalten.

### Richtung und unvollständige Modelle

```arch
config {
  extends default
  relation exchange {
    from service
    to service
    style flow
    directions [forward, both]
  }
}
```

Im Profil-JSON heißt die Einstellung `"directions": ["forward", "both"]`.
Ohne Angabe gilt `["forward"]`; bei Typvererbung wird die Einstellung vom
ersten Elternteil geerbt. `["both"]` verlangt `<->`, `["forward"]` verlangt
`->`. Eigene lokale Angaben ersetzen die Liste. Das Standardprofil erlaubt
beide Richtungsarten für `flow`, `dependency`, `access` und `association`.
Die Zeichenstile `composition`, `generalization` und `realization` sind nur
vorwärts gerichtet; eine Profilfreigabe von `both` wäre ein Fehler.

`from`/`to` und `pairs` prüfen die geschriebenen Endpunktrollen. Eine
bidirektionale Beziehung hat gemeinsame Attribute/Referenzen, zählt an beiden
Endpunkten einmal eingehend und einmal ausgehend und bildet einen gerichteten
Zyklus. `acyclic` lehnt sie deshalb ab. Kardinalitätsgrenzen gelten außerdem
für tatsächlich beteiligte Rückrichtungs-Endpunkte; Viewpoint-`connections`
zählt bei `either` dieselbe Beziehung nur einmal. Unterschiedliche Informationen
je Übertragungsrichtung benötigen zwei getrennte Beziehungen.

`config { validation draft }` ändert keine Profilregeln: Fehlende Pflichtattribute,
Viewpoints, erforderliche Viewpoint-Typen/Beziehungen und unterschrittene
Mindestanzahlen werden als Warnungen dargestellt. Überschreitungen von Maxima,
ungültige Typen/Werte/Referenzen, Zyklen und Renderer-/Strukturfehler bleiben
Fehler. Mit `validation strict` oder API `{validation: "strict"}` lässt sich
die vollständige Konformität prüfen. `style EDGE_ID {display none}` ist reine
Darstellung und nimmt Beziehungen nicht aus der Modellprüfung heraus.

- Profil-/Typ-/Viewpoint-Namen verwenden die DSL-Bezeichnergrammatik.
- Ohne ID erhält ein als Parameter übergebenes Objekt die ID `parameter`, ein
  Inline-Profil `inline`. Ohne Versionsangabe gilt der String `"1"`.
- Ein Profil benötigt 1–512 Knotentypen. Erlaubt sind maximal 512 Relationstypen,
  128 Viewpoints und 128 Attributdefinitionen je Typ.
- `defaultRelation` bezeichnet einen konkreten Relationstyp. Ohne Angabe wird
  ein vorhandenes `flow` gewählt, sonst muss jede Beziehung explizit `type`
  angeben. Im JSON verhindert `defaultRelation: null` jede implizite Typwahl.
- `extends` auf Profilebene übernimmt ein **registriertes** Basisprofil; neue
  Definitionen mit demselben Namen ersetzen die ganze jeweilige Typ-/Viewpoint-
  Definition. `config { extends default … }` ergänzt beispielsweise eigene Typen.
- `extends` bei Knoten/Relationen ist ein Typname oder eine Liste von Typnamen
  für Mehrfachvererbung (inline: `extends first, second`). Attribute aller Eltern
  werden zusammengeführt. Unterschiedliche Regeln für denselben Attributnamen
  erfordern eine explizite lokale Regel; diese ersetzt die geerbte Definition.
  Andere Einstellungen wie Darstellung, Endpunkte und Kardinalitäten werden
  vom **ersten** Elternteil geerbt, sofern nicht lokal überschrieben.
  `comparisons` werden aus allen Eltern zusammengeführt. `abstract` gilt nur
  für die aktuelle Definition. Zyklen/unbekannte Basistypen sind Fehler.
- `from`/`to`/`contains` und Viewpoint-Listen akzeptieren Typnamen einschließlich
  ihrer Untertypen. `['*']` erlaubt beliebige Typen; im DSL muss `"*"` quotiert
  sein. Fehlende Whitelists erlauben alle Typen. Im JSON erlaubt `[]` bei
  `contains`, `nodes` oder `relations` keinen Typ, bei Pflichtlisten keine
  Mindestanforderung. `from`/`to` müssen nichtleere Listen sein.
- `outgoing`/`incoming`: `{ min, max }`, ganzzahlig 0–4000; Standard `min: 0`,
  `max: null` (unbegrenzt). Zählung pro anwendbarem Knoten über das gesamte Modell,
  einschließlich Beziehungen abgeleiteter Relationstypen, unabhängig von Views.
- `allowSelf` ist standardmäßig `true`. `abstract: true` verhindert das direkte
  Instanziieren des jeweiligen Knoten-/Relationstyps.
- `acyclic: true` verwirft gerichtete Zyklen dieser Relation einschließlich ihrer
  Untertypen über das gesamte Modell, unabhängig von sichtbaren Views.

### Bedingte Endpunktpaare

```json
{
  "pairs": [
    { "from": ["actor"], "to": ["activity"] },
    { "from": ["product"], "to": ["function"], "toExclude": ["specialFunction"] }
  ]
}
```

Mindestens ein Paar muss passen. Dadurch wird beispielsweise nicht automatisch
`actor -> function` erlaubt. `fromExclude` und `toExclude` schließen Typen mit
ihren Untertypen innerhalb eines Paares aus. Zusätzliche globale `from`-/`to`-
Listen müssen ebenfalls passen. `pairs` ist nur im JSON-Profil verfügbar.

### Attribute

```json
{
  "owner": { "type": "string", "required": true, "minLength": 1 },
  "criticality": { "type": "string", "enum": ["low", "medium", "high"] },
  "replicas": { "type": "integer", "min": 1, "max": 20 },
  "encrypted": { "type": "boolean", "required": true },
  "contacts": { "type": "reference", "targets": ["actor"], "many": true, "minItems": 1, "uniqueItems": true },
  "retired": { "type": "string", "format": "date-time" }
}
```

Unterstützte Typen: `string` (Standard), `number`, `integer`, `boolean`, `reference`.
`required` prüft Vorhandensein; bei Strings verhindert zusätzlich `minLength: 1`
einen leeren Wert. `minLength`/`maxLength` zählen Unicode-Codepoints.
`min`/`max` gelten für Zahlen, `enum` enthält Werte des festgelegten Datentyps.
Keine automatische Typkonvertierung: `true` ist boolean, `"true"` ein String.
`reference` ist eine Modellknoten-ID; das Ziel muss existieren und zu einem der
`targets` oder dessen Untertypen gehören. Vorwärtsreferenzen sind erlaubt,
Kanten-IDs sind keine Referenzziele. Ohne `targets` sind alle Knotentypen erlaubt.

`many: true` verlangt eine flache Liste, auch bei nur einem Eintrag: `[owner1]`.
`required` prüft das Vorhandensein; `minItems`/`maxItems` prüfen die Anzahl
(0–4000), `uniqueItems: true` verbietet doppelte Werte. Die übrigen Typ-, Enum-
und Wertebereichsregeln gelten für jeden Eintrag. Listen ohne `required` dürfen
fehlen, selbst bei `minItems: 1`; eine vorhandene leere Liste scheitert dann.
Verschachtelte Listen oder Objektwerte werden nicht unterstützt.

Für Strings prüft `format` entweder `date` (`YYYY-MM-DD` mit realem Kalender),
`date-time` (Datum plus `T`, Sekunden und Zeitzone `Z` oder `±HH:MM`) oder `uri`
(URI-Schema erforderlich, keine Leerzeichen). Der gespeicherte Wert bleibt ein
String. Inline beispielsweise: `attribute owners { type reference targets actor
many true minItems 1 }`.

`nodeTypes.NAME.comparisons` kann zusätzlich skalare Felder vergleichen:
`[{ "left": "start", "op": "<=", "right": "end" }]`. Zulässig sind `<`, `<=`,
`=`, `!=`, `>=`, `>` für passende Zahlen-/Stringtypen und gleiche Formate.
Datum/Zeit wird zeitlich verglichen, sonst gilt der normale Zahlen-/Stringvergleich.
Der Vergleich findet statt, wenn beide Felder vorhanden sind; Pflichtfelder
werden unabhängig davon geprüft. Geerbte Vergleiche bleiben wirksam. Dieses
Feld ist nur im JSON-Profil verfügbar.

Unbekannte Attribute sind Fehler. Strukturelle Bezeichner wie `id`, `type`,
`title`, `parent`, `attributes` oder `relation` sind als eigene Attribute reserviert.

Die Standardattribute `description`, `technology`, `tags` sowie bei Knoten
`icon`/`stereotype` sind profilübergreifend erlaubt und bleiben Strings. Ein
Profil darf dafür zusätzliche String-Regeln festlegen. Eigene Werte werden in
`element.attributes` gespeichert, Standardattribute bleiben aus Kompatibilität
direkt am Element. `attributeLocs` enthält Quellpositionen für Diagnosen.
Die vorhandenen Templates zeichnen weiterhin Titel/Beschreibung/Technologie;
beliebige zusätzliche Felder werden gespeichert/validiert. Der Connected-Renderer
zeichnet sie nicht automatisch als weitere Kartenzeilen. Die explizite
[Klassenansicht](../DIAGRAMS.md#klassen-detailansicht-class) unterstützt zugeordnete
Detailbereiche. `propertyFields [NAME, NAME]` zeigt dort zusätzlich die Werte
deklarierter Attribute oder öffentlicher Node-Eigenschaften; es erzeugt keine
zusätzlichen Modellelemente.

### Container und Darstellung

Jeder fachliche Knotentyp kann eines der 13 vorhandenen `template`s verwenden.
Standard ist `node`. `template: 'package'` impliziert einen Container; andere
Templates sind keine Container. `container` muss dazu passen. Ein Profil kann
über `contains` die direkten Kindtypen einschränken. Container können frei
benannt sein; das Schlüsselwort `package` hat im Engine-Kern keine privilegierte
Containersemantik mehr.

Bei Knoten gilt: View-Style > explizite Modell-Iconreferenz > Profildarstellung >
Template-Standard. `accent` im Profil akzeptiert Hexwerte und CSS3-Farbnamen. Die strukturelle
Container-Eigenschaft kann eine View nicht durch einen Templatewechsel ändern.
Eigene Relationstypen wählen über `style` einen der sieben Kantenstile:
`flow`, `dependency`, `association`, `access`, `composition`, `realization`,
`generalization`. Letzterer zeichnet ein durchgezogenes, hohles Dreieck,
`realization` bleibt gestrichelt.
Fachlicher `type` und grafisches `template`/`style` bleiben getrennt im Layout/SVG.

### Viewpoints

```arch
config {
  type actor { template person }
  type product { template application }
  relation uses { from actor to product }
  viewpoint context {
    nodes actor, product
    relations uses
    requiredNodes actor, product
    requiredRelations uses
  }
}
```

Eine View bindet die Regeln mit `viewpoint context`. Der Validator prüft alle
Views: erlaubte sichtbare Typen und mindestens ein sichtbares Element jeder
Pflichtklasse. Beziehungen gelten als sichtbar, wenn beide Endpunkte sichtbar
sind. Implizit eingeblendete Container-Vorfahren zählen ebenfalls und müssen
in die Whitelist passen. Ohne `viewpoint` gelten keine Viewpoint-Regeln, außer
das Profil setzt `requireViewpoint: true`. Das gilt auch für die automatisch
erzeugte Default-View.

Mit JSON-`connections` werden Beziehungen **pro sichtbarem Knoten** gezählt:

```json
{
  "connections": [
    { "nodes": ["activity"], "relations": ["performs"], "direction": "incoming", "min": 1 }
  ]
}
```

Jede sichtbare `activity` benötigt hier eine sichtbare eingehende
`performs`-Beziehung, jeweils einschließlich Untertypen. Zulässige Richtungen:
`incoming`, `outgoing`, `either` (Standard); `min` ist standardmäßig 1, `max`
unbegrenzt. Unsichtbare Endpunkte zählen nicht. `connections` ist nur im
JSON-Profil verfügbar; der vereinfachte Inline-Block unterstützt weiterhin
Whitelists und Pflichttypen. Die zusätzlichen JSON-Felder `pairs`,
`comparisons`, `connections` lassen sich über ein registriertes Profil auch
mit `config { profile ID }` auswählen.

`connections` unterstützt außerdem `counterparts` zur Filterung des
Gegenstellentyps einschließlich Untertypen. Optionales `nodesExclude: ["Typ"]`
nimmt den genannten Typ und seine Untertypen aus genau dieser Einzelknotenregel
aus. Die Typen bleiben erlaubte Elemente/Endpunkte; globale Pflichtinhalte und
andere Regeln bleiben aktiv. Eine leere Liste verändert die Auswahl nicht;
unbekannte Typnamen werden bei Registrierung abgewiesen.
`references` verlangt für ausgewählte
Referenzattribute sichtbare Zielknoten:

```json
{
  "references": [
    { "relations": ["interaction"], "attributes": ["conveyed"] }
  ]
}
```

Alternativ wählt `nodes` statt `relations` die zu prüfenden Knotentypen.
Fehlende optionale Referenzen sind erlaubt; die Attributdefinition bestimmt
Pflichtwerte. Sichtbarkeit bedeutet hier Mitgliedschaft in der Viewauswahl;
eine automatisch gezeichnete Referenzkarte ersetzt diese Anforderung nicht.
Diese Regeln werden wie `connections` im JSON-Profil definiert.

### Referenzen an Beziehungen darstellen

Ein Relationstyp kann seine typisierten Referenzen zusätzlich sichtbar machen:

```json
{
  "attributes": {
    "conveyed": { "type": "reference", "targets": ["information"], "many": true }
  },
  "referenceLabels": { "conveyed": "Conveys" },
  "referenceDisplay": "nodes",
  "referenceOccurrences": "shared"
}
```

Dies ist ein Ausschnitt einer Relationstypdefinition; `information` muss ein
deklarierter Knotentyp sein. `referenceLabels` ordnet Referenzattributen die
Beschriftung zu. `referenceDisplay` wählt `labels`, `nodes` oder `both`;
`referenceOccurrences` wählt `shared` (Standard) oder `perEdge`. Darstellungsvorgaben
werden vom ersten Elternrelationstyp geerbt und können in einer View überschrieben
werden. Karten und Zuordnungspfeile sind Präsentation, keine neuen Modellobjekte
oder Modellbeziehungen. Grafische Referenzkarten gibt es nur im Connected-Renderer.
Routing und Beispiele: [HELP.md](../HELP.md#zuordnungspfeile-routen).

## Stilgruppen und Hintergrundfarben

Profile können `styleGroups` deklarieren. Jeder Knotentyp kann eine Gruppe über
`styleGroup` auswählen oder eine direkte `backgroundColor` setzen:

```json
{
  "styleGroups": { "logical": { "backgroundColor": "#6A5ACD" }, "neutral": {} },
  "nodeTypes": { "activity": { "styleGroup": "logical" } }
}
```

Die Farben können Hexwerte mit drei oder sechs Stellen oder CSS3-Farbnamen sein. Eine leere Gruppe
verwendet den Theme-Hintergrund. Unbekannte Gruppen und ungültige Farben sind
Profilfehler. Profilvererbung übernimmt Gruppen; gleichnamige Gruppen werden
vollständig ersetzt. Typvererbung übernimmt `styleGroup` und direkte
`backgroundColor` vom ersten Elternteil, sofern lokal nicht angegeben.
Eine direkte Typfarbe hat Vorrang vor der Gruppenfarbe. Eine View kann beides
mit `style ELEMENT { backgroundColor "#FFD700" }` überschreiben.

Inline funktioniert dieselbe Konfiguration:

```arch
config {
  styleGroup logical { backgroundColor "#6A5ACD" }
  type activity { template process styleGroup logical }
}
```

Explizite Hintergrundfarben verwenden standardmäßig `fill-opacity="0.2"` in
beiden Themes und im SVG-Export. `style ID { opacity 0.5 }` überschreibt die
Fülltransparenz viewlokal (0–1). Text und Rahmen bleiben vollständig deckend.
Text/Rahmen werden schwarz oder weiß nach größtem Kontrast zur sichtbaren
Mischfarbe aus Füllung und Untergrund gewählt, auch bei verschachtelten
Containern. Akzentfarben
bleiben erhalten, wenn ihr Kontrast zum Hintergrund mindestens 4,5:1 beträgt;
sonst verwendet der Renderer die kontrastreiche Textfarbe. Ohne eigene
Hintergrundfarbe bleibt die bisherige Darstellung erhalten. Gruppen werden im
Profil-Snapshot gespeichert; sie verändern keine fachlichen Validierungsregeln.

Zur Laufzeit lässt sich beispielsweise eine unabhängige Kopie konfigurieren:

```js
const profile = arch.getProfile('naf4-uaf');
profile.styleGroups.logical.backgroundColor = '#446688';
profile.nodeTypes.Software.styleGroup = 'logical';
arch.render('#diagram', source, { profile });
```

## Laufzeitdiagnosen

`parse`, `layout`, `render`, `renderToString`, `renderAll` und `renderMarkdown`
validieren mit dem ausgewählten Profil. Ungültige Modelle werden nicht als
gültige Diagramme ausgegeben. `parse`/Rendering werfen einen `ArchError` mit
der ersten Diagnose und einer `diagnostics`-Liste für alle semantischen Fehler.

`validate(sourceOrModel, options)` wirft bei normalen Eingabefehlern nicht,
sondern liefert:

```json
{
  "valid": false,
  "profile": { "id": "company", "version": "1" },
  "diagnostics": [{
    "severity": "error",
    "code": "ARCH_SEMANTIC",
    "message": "portal: Missing required attribute owner",
    "line": 4,
    "column": 5,
    "elementId": "portal",
    "attribute": "owner"
  }]
}
```

Syntax-/Schema-/Strukturfehler liefern eine erste Diagnose; bei Profilfehlern
vor erfolgreicher Profilauflösung ist `profile` null. Semantische Fehler werden
gesammelt; optional enthalten sie `elementId`, `attribute` und `viewId`.
Fehlercodes: `ARCH_SYNTAX`, `ARCH_PROFILE`, `ARCH_SEMANTIC`; das Standardprofil
erhält aus Kompatibilität `ARCH_VALIDATION`. Keine Regeln werden als JavaScript
oder `eval` ausgeführt, unbekannte Schemaeinstellungen werden abgewiesen.

Die Laufzeittexte sind Englisch. `@help types PROFILE TYPE` nennt konkrete
Kandidaten abstrakter Typen; `@help connections PROFILE TYPE` listet eingehende
und ausgehende Relationen mit passenden Gegenstellen. Dies ersetzt nicht die
Prüfung von Pflichtattributen, Kardinalitäten und Viewpoint-Regeln am konkreten
Modell. Vollständige Befehle: [HELP.md](../HELP.md).

Ein erfolgreiches `validate()` garantiert keine vollständige SVG-Erzeugung:
Iconreferenzen und freie SVG-Pfade werden erst beim Rendern geprüft. Modell-
und Viewregeln prüfen auch nicht zum Rendern ausgewählte Views. Details und
Fehlerisolation: [SPEC.md](../SPEC.md#prüfgrenzen-und-fehlerverhalten).

## Beispiele, Tests und Grenzen

- [profiles.arch](../examples/profiles.arch): Inline-Profil mit zwei Views.
- [external-profile.arch](../examples/external-profile.arch): registriertes
  JSON-Profil mit zwei Views.
- [uaf.arch](../examples/uaf.arch): UAF-/NAF-Profil mit neun Views;
  [Dokumentation und Abdeckung](uaf/README.md).
- `index.html`: Auswahl **Your own framework** / **Reusable JSON profile**;
  Profilparameter oben über den PROFILE-Selektor überschreibbar.
- `npm run build`, `npm test`, `npm run test:browser`: Schemata, Snapshots,
  Vererbung, Datentypen, Kardinalitäten, Viewpoints und alle Einbettungs-APIs geprüft.

Die Engine prüft die deklarierten Regeln. Es gibt noch keine vollständigen
Standardprofile und keine automatische Konformitätszertifizierung. Das UAF-Profil
hat eine dokumentierte Teilabdeckung. Der aktuelle Regelsatz umfasst skalare und
mehrwertige Attribute, typisierte Referenzen und die beschriebenen Strukturregeln;
komplexe Pfad-/Ausdrucksregeln, Einheiten, Objektattribute und frei definierbare
Diagrammrenderer sind nicht Bestandteil des Profilschemas. Die eingebauten
Spezialrenderer sind unter [DIAGRAMS.md](../DIAGRAMS.md) beschrieben. Zusätzliche Frameworks können als
Daten beschrieben werden, soweit ihre Regeln durch diesen Regelsatz ausdrückbar
sind; weitergehende Anforderungen benötigen eine generische Erweiterung des
Regelschemas. Künftige Arbeiten stehen in [ROADMAP.md](../ROADMAP.md).

## Renderauswahl im Architektur-Config

Die View-Auswahl gehört zur Architektur und ist unabhängig vom Profilschema:

```arch
config { profile naf41-uaf views all }
```

Alternativ wählt `views [detail, overview]` mehrere Views in dieser Reihenfolge
oder `views detail` genau eine. Dies funktioniert ebenfalls mit Inline-Profilen
oder ohne Profilangabe. Mehrere Views werden mit Überschriften untereinander
in einem eigenständigen SVG gerendert; ohne Auswahl bleibt die erste View der
Standard. API-Priorität: `view` → `views` → `config.views` → erste View.
Siehe [HELP.md](../HELP.md#eine-mehrere-oder-alle-views-rendern).
