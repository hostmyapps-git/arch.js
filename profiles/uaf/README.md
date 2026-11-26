# UAF- und NAF-Profil

Zwei externe Datenprofile ergänzen die generische Engine:

| ID | Datei | Umfang |
| --- | --- | --- |
| `uaf` | [uaf.json](../uaf.json) | UAF-1.0-Typkatalog, Attribute und ausgewählte binäre Beziehungen; freie Views |
| `naf4-uaf` | [naf4-uaf.json](../naf4-uaf.json) | Erweitert `uaf` um 20 ausgewählte strukturelle NAF-Viewpoint-Regelsätze; jede View benötigt `viewpoint` |

Profilversion: `1.0.0-arch.1`. Grundlage sind das normative
[OMG-UAFP-XMI für UAF 1.0](https://www.omg.org/spec/UAF/20170501/UAFP_Profile.xmi)
und die [NATO-UAF-Modellierungsleitlinie, März 2019, Version 1.0.0](https://www.nato.int/content/dam/nato/webready/documents/publications-and-reports/20190404_AC_322-N-201-0046_ENG-UAF-Guidelines1.pdf).
Die neuere NAFv4.1-Datei im Repository dient zur Abgrenzung. Diese Profile
beanspruchen keine vollständige NAFv4.1-/UAF-1.3-Konformität. Der genaue Stand
ist im generierten [Abdeckungsnachweis](COVERAGE.md) dokumentiert.
Für die 47 NAFv4.1-Viewpoints gibt es zusätzlich das separate strukturelle
Anwendungsprofil [naf41-uaf](../naf41/README.md), das auf `uaf` aufbaut.
Es ersetzt keine vollständige normative Konformitätsprüfung.

## Direkt ausprobieren

`index.html` öffnen und **NAF · UAF architecture** auswählen. Das Beispiel
[uaf.arch](../../examples/uaf.arch) enthält neun Ansichten: Überblick,
Capability-Taxonomie, Capability-Service-Zuordnung, Servicefunktionen,
logische Aktivitäten, operative Informationsflüsse, Ressourcenfunktionen und
Realisierungsnachweis sowie semantische Farbzuordnung. Im PROFILE-Selektor bleibt
**From document** eingestellt.

Das folgende vollständige Dokument validiert mit `naf4-uaf`:

```arch
architecture "Rescue capabilities" {
  config { profile naf4-uaf }
  model {
    Capability rescue "Search & Rescue"
    Capability maritime "Maritime rescue"
    relation specializes maritime -> rescue "Specializes" {
      type CapabilityGeneralization
    }
  }
  view taxonomy "Capability taxonomy" {
    viewpoint C1
  }
}
```

Groß-/Kleinschreibung ist relevant: `Capability` ist der UAF-Typ,
`capability` der Typ im bisherigen Standardprofil. Ein grafisches Template
verändert den fachlichen Typ nicht.

## Einbindung im Browser, auch über file://

Die Library enthält nur das Standardprofil. Die einzelnen erzeugten Scripts
registrieren die Daten zur Laufzeit; UAF ist nicht in `arch.js` festkodiert:

```html
<div id="diagram"></div>
<script src="arch.core.min.js"></script>
<script src="profiles/uaf.js"></script>
<script src="profiles/naf4-uaf.js"></script>
<script>
  // source enthält z.B. das vollständige Dokument von oben.
  arch.render('#diagram', source);
  console.log(arch.validate(source));
</script>
```

Das abgeleitete Profil benötigt das Basisprofil zuerst. Alternativ registriert
ein einziges `<script src="profiles/profiles.js"></script>` alle mitgelieferten
Profile in Abhängigkeitsreihenfolge; die beiden Einzelscripts entfallen dann.
Klassische lokale Scripts funktionieren auch über `file://`.

Unter HTTP lassen sich stattdessen die JSON-Dateien laden:

```js
for (const id of ['uaf', 'naf4-uaf']) {
  const response = await fetch(`./profiles/${id}.json`);
  if (!response.ok) throw new Error(`Profil ${id}: HTTP ${response.status}`);
  arch.registerProfile(id, await response.json());
}
arch.render('#diagram', source, { profile: 'naf4-uaf' });
```

Die API-Auswahl hat Vorrang vor `config`. `uaf` erlaubt Views ohne
Viewpoint-Bindung; `naf4-uaf` verlangt in jeder View einen unterstützten
Viewpoint. Ein unbekannter Viewpoint wird diagnostiziert. Die Engine lädt
weder Profile noch XMI-Dateien selbstständig aus dem Netz.

## Node.js

```js
import { readFile } from 'node:fs/promises';
import { registerProfile, parse, validate, renderToString } from './src/arch.js';

for (const id of ['uaf', 'naf4-uaf']) {
  registerProfile(id, JSON.parse(await readFile(`profiles/${id}.json`, 'utf8')));
}
const source = await readFile('examples/uaf.arch', 'utf8');
const report = validate(source);
if (!report.valid) throw new Error(JSON.stringify(report.diagnostics));
const model = parse(source);
const svg = renderToString(model, { view: 'traceability' });
```

## Semantische Hintergrundfarben

[presentation.json](presentation.json) ist die editierbare Farbkonfiguration.
`styleGroups` legt die Farben fest, `packages` die Zuordnung der UAF-Quellpakete,
`types` optionale Überschreibungen pro Stereotyp. Nach einer Änderung erzeugt
`npm run build` die JSON-Profile und Offline-Scripts neu.

| Quellpaket | Gruppe | Hintergrund |
| --- | --- | --- |
| Strategic | capability | Lime `#00FF00` |
| Services | service | Violet `#EE82EE` |
| Operational | logical | Slateblue `#6A5ACD` |
| Resources | physical | Darkorange `#FF8C00` |
| Metadata, Standards, Summary and Overview, Dictionary, Parameters | foundation | Gold `#FFD700` |
| Personnel, Security, Project, Actual Resources | neutral | Theme-Hintergrund |

Die farbigen Füllungen verwenden standardmäßig `fill-opacity="0.2"`;
`style ID { opacity 0.5 }` überschreibt dies je View. Die Gruppenfarben können
auch als CSS3-Namen wie `lime`, `violet` oder `gold` konfiguriert werden. Text und Icons bleiben
deckend und werden gegen den sichtbaren Hintergrund auf Kontrast geprüft.
Auch `Package` und `Requirement` sind zunächst neutral. Die Quellpakete
entscheiden unabhängig von Vererbung und Viewpoint; jeder native Typ erhält
eine ausdrückliche Zuordnung. `coverage.json.presentationAssignments` enthält
den Nachweis. Dies ist eine konfigurierbare Projektfarbkonvention.
Die Beispielansicht **Semantic background colors** zeigt alle fünf Gruppen
und ein neutrales Element. Details zur Laufzeitkonfiguration und View-
Überschreibung stehen unter [Stilgruppen](../README.md#stilgruppen-und-hintergrundfarben).

## Was geprüft wird

Der Katalog übernimmt alle **211 nativen Stereotypen** der festgeschriebenen
XMI-Datei, einschließlich **33 abstrakter Typen**, nativer Mehrfachvererbung und
schreibbarer Domänenattribute. Zwei ausdrücklich zusätzliche Adaptertypen
`Package` und `Requirement` ergeben insgesamt **213 Knotentypen**.

- Native Attribute: Datentyp, Pflichtfeld, Enum und Multiplizität. Keine
  automatische Typkonvertierung oder Übernahme von Metamodell-Defaultwerten.
  Beispielsweise verlangt `Software` über `ResourcePerformer` das boolesche
  Attribut `isStandardConfiguration`; im Beispiel steht ausdrücklich `false`.
- Referenzen: ID muss auf einen existierenden Modellknoten mit passendem
  fachlichem Typ oder Untertyp zeigen. Vorwärtsreferenzen sind erlaubt.
- Mehrwertige Attribute: flache Listen wie `conveyed [report, order]`, erlaubte
  Zieltypen, Mindest-/Höchstanzahl und Eindeutigkeit. Die Ziele müssen im Modell
  existieren, aber nicht in jeder View sichtbar sein. Referenzen zeichnen keine
  automatische Kante; dafür werden explizite Beziehungen verwendet.
- URI- und Datumsformate; `ActualState.startDate <= endDate` und
  `Standard.mandatedDate <= retiredDate`, sofern beide Werte vorliegen.
- **43 binäre Beziehungsabbildungen** mit Richtung und zulässigen Typkombinationen.
  Bedingte Kombinationen werden als Paare geprüft. Beispielsweise darf
  `ServiceSpecification -> ServiceFunction` mit `IsCapableToPerform` verbunden
  sein, `ServiceSpecification -> OperationalActivity` dagegen nicht.
- Generalisierungen: spezialisierter Typ zeigt zum allgemeinen Typ; keine
  Selbstbeziehung oder Zyklen. Darstellung mit durchgezogenem Dreieck.
- Deklarierte NAF-Viewpoint-Regeln: sichtbare Typen, Pflichttypen und bei
  ausgewählten Views Allokationen pro sichtbarem Element. In `L4` benötigt jede
  sichtbare `OperationalActivity` eine sichtbare eingehende
  `IsCapableToPerform`-Beziehung; analog `S4` und `P4` für ihre Funktionstypen.

Die 20 ausgewählten Viewpoints sind `C1`, `C2`, `C3`, `C4`, `C7`, `C8`,
`S1`, `S3`, `S4`, `C1-S1`, `L1`, `L2-L3`, `L3`, `L4`, `P1`, `P2`, `P3`,
`P4`, `L4-P4` und `A8`. Regeln und Quellen mit Seitenverweisen stehen in
[naf-viewpoints.json](naf-viewpoints.json) und [COVERAGE.md](COVERAGE.md).

Diagnosen haben Element-/Attribut-/View-ID und Quellposition. Ungültige Modelle
werden vor Layout und Rendering abgewiesen. Profile und Regeln bleiben reine
Daten; im Kern gibt es keine UAF-spezifischen Fallunterscheidungen.

## Bewusste Abbildungen und Grenzen

UAF ist ein UML-/SysML-Profil. arch.js ist kein UML-/SysML-Werkzeug. Der
Typkatalog enthält auch native Beziehungsspezialisierungen als mögliche
Modellknoten. Die 43 `relationTypes` sind eine zusätzliche bequeme binäre
Abbildung ausgewählter Beziehungen; sie ersetzen nicht sämtliche Tupel,
UML-Eigentumsverhältnisse oder Eigenschaften reifizierter Beziehungen.
Insbesondere gibt es keine automatische Gleichsetzung einer Kante und eines
gleichnamigen Beziehungsknotens. Referenzattribute adressieren Knoten-IDs.

[uml-adapters.json](uml-adapters.json) beschreibt die ausdrücklich unterstützten
UML-Felder: Actions referenzieren ihre Definition über `behavior` und optional
`activity`, Ports ihren Eigentümer über `owner` (UML `class`) und ihren
Schnittstellentyp über `interfaceType` (UML `type`), Rollen ihren Typ über
`classifier`, Connectoren ihre Enden über `ends`. Exchanges benötigen mindestens
ein typisiertes `conveyed`-Element. Weitergehende Eigentums-/Kompatibilitätsregeln
werden dadurch nicht automatisch geprüft. Pflichtfelder der Adapter sind
bewusste Regeln dieser Abbildung.

`Package` ist ein Container des Werkzeugs, `Requirement` ein vereinfachter
SysML-Adapter. Die zusätzlichen Relationstypen `CapabilityGeneralization`,
`CapabilityDependency`, `ServiceGeneralization`, `OperationalGeneralization`,
`ResourceGeneralization` und `Refine` sind keine nativen UAFP-Stereotypen;
[relations.json](relations.json) dokumentiert ihre Herkunft.

Sieben abgeleitete Quellattribute werden weder berechnet noch als Eingabefelder
akzeptiert. `ProtectsInContext` und `SameAs` bleiben ohne binäre Abbildung, weil
ihre Quellregeln auf nicht vorhandene Typen (`SecurityControlAction` bzw.
`UPDMElement`) verweisen. Ihre nativen Typen bleiben im Katalog erhalten.
Weitere offene Quellregeln sind mit stabilen IDs in [coverage.json](coverage.json)
aufgelistet. Diese werden nicht stillschweigend als implementiert behandelt.

Die grafischen Templates sind eine lesbare arch.js-Darstellung und keine
vollständige offizielle UML-/UAF-Notation. Die zusätzlichen
[Diagrammrenderer](../../DIAGRAMS.md) können explizit je View konfiguriert werden.
Ihre Auswahl ergänzt keine fehlenden UML-/SysML-Eigentumsregeln und keine
vollständige Verhaltensprüfung. Die mitgelieferten UAF-Views verwenden weiterhin
die strukturelle Standarddarstellung.
Weitere Arbeiten stehen in [ROADMAP.md](../../ROADMAP.md).

## Reproduzieren und weiterentwickeln

```sh
npm ci
npx playwright install chromium
npm run check
```

`scripts/build-uaf.mjs` liest ausschließlich lokale Dateien. Der Build prüft die
SHA-256-Werte aller drei Referenzdateien in [sources.lock.json](sources.lock.json),
extrahiert Typen/Attribute/Vererbung aus der XMI, ergänzt die ausdrücklich
gepflegten Regeldateien und erzeugt `profiles/uaf.json`, `profiles/naf4-uaf.json`,
`coverage.json` und `COVERAGE.md`. Danach erzeugt `scripts/build.mjs` die
Registrierungsscripts in Abhängigkeitsreihenfolge. Normale Builds benötigen kein
Netz. Es wurden keine neuen npm-Abhängigkeiten ergänzt.

Falls die normative XMI erneut heruntergeladen werden soll:

```sh
curl --fail --location https://www.omg.org/spec/UAF/20170501/UAFP_Profile.xmi --output ReferenceDocs/uaf/UAFP-1.0.xmi
npm run build
```

Ein anderer Hash beendet den Build mit Fehler. Änderungen an Quellversion oder
Abdeckung benötigen eine bewusste Anpassung der Quellenbindung und Tests.
Generierte Dateien nicht manuell bearbeiten; Änderungen an Adaptern und
Viewpoints gehören in `uml-adapters.json`, `relations.json` oder
`naf-viewpoints.json`; die Farben und Gruppenzuordnungen stehen in
`presentation.json`. Allgemeine Sprach-/Regelerweiterungen gehören weiterhin
in die generische Engine, dokumentiert unter [profiles/README.md](../README.md).

`tests/uaf.test.mjs` prüft Katalog, Quellen, positive und negative Fachregeln,
jeden unterstützten Viewpoint und alle neun Beispielansichten.
`tests/profile-rules.test.mjs` prüft die neuen Engine-Regeln unabhängig von UAF.
Die Chromium-Suite prüft Profile, Editieren, Fehlerkorrektur, SVG-Ausgabe und
direkten Start über `file://`.
