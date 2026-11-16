# Meta-Views: Architekturquelle anzeigen und übersetzen

## Als Teil der Architektur und des SVG-Exports

Eine View kann die vollständige Architektur als JSON oder DSL zeigen:

```arch
architecture "Architecture with source" {
  config { views all }
  model { service api "API" }
  view overview "Diagram" {}
  view source "Architecture as JSON" {
    @meta json
  }
  view text "Architecture as DSL" {
    @meta dsl
  }
}
```

Diese Views sind regulär über ihre IDs auswählbar, in `config.views` sortierbar
und mit `views all` gemeinsam mit Diagrammen als ein eigenständiges SVG
exportierbar. Helle/dunkle Themes und die vorhandenen Einbettungs-APIs gelten
ebenfalls. Das Demo-Beispiel **Architecture source views** zeigt dies:
[meta.arch](examples/meta.arch).

Die Kurzform direkt im Architekturblock erzeugt eine eigene View mit der ID
`meta-json` beziehungsweise `meta-dsl`:

```arch
architecture "Source only" {
  model { service api "API" }
  @meta json
}
```

Ohne weitere View zeigt dieses Dokument ausschließlich die Meta-Ausgabe. Bei
mehreren Views gelten die normale erste View als Standard und die bestehende
Renderauswahl. Mehrfach dieselbe automatisch erzeugte ID ist ein Fehler; für
mehrere gleichformatige Quellenviews explizite View-IDs verwenden.

JSON entspricht dem View-Ausschnitt
`{ "name": "Architecture as JSON", "@meta": "json" }`. Auch `"meta": "json"`
und in der DSL `meta json` sind zulässig. Auf Architektur-Ebene kann JSON
`"@meta": "json"` setzen; die implizite View wird dort nach den expliziten
Views angefügt. Ein alleinstehendes `@meta json` ohne Architekturquelle hat
keinen Inhalt zum Übersetzen und wird mit einem Kontexthinweis zurückgewiesen.

Quellenviews zeigen stets die gesamte normalisierte Architektur mit Modell,
Konfiguration und allen Viewdefinitionen. Die eigenen `@meta`-Direktiven
erscheinen als Quelltext genau einmal; sie lösen keine rekursive Darstellung
aus. Lange Zeilen werden visuell umgebrochen, Einrückung und Zeilennummern
bleiben lesbar. Das SVG besteht aus Text und SVG-Primitiven, ohne `foreignObject`.

Eine Quellenview unterstützt Format und Theme. Modellfilter, Viewpoints,
`diagram`, Positionierungen sowie Node-/Routing-Styles gehören zu Diagrammviews
und werden hier abgewiesen. Quellenviews benötigen auch bei einem Profil mit
`requireViewpoint` keinen fachlichen Viewpoint. Das Modell und sämtliche
Diagrammviews werden trotzdem normal geprüft; fehlerhafte Modelle werden durch
eine Quellenview nicht gültig. Für die Untersuchung von Syntaxfehlern dient die
folgende interaktive Editoransicht, die keinen erfolgreichen Diagrammexport
voraussetzt.

## Interaktive Editor-Meta-View

Die Beispieloberfläche bietet im **View**-Menü zusätzlich zu den Diagrammviews:

- **Meta view · JSON** bei DSL-Quellen: zeigt das entsprechende Architektur-JSON.
- **Meta view · DSL** bei JSON-Quellen: zeigt die entsprechende Textsyntax.

Die Ausgabe aktualisiert sich beim Bearbeiten. **Copy** kopiert sie;
**Download JSON/DSL** speichert `.json` beziehungsweise `.arch`. Im Meta-Modus
ist der SVG-Export deaktiviert. Zum Diagramm zurückkehren, indem im View-Menü
eine Architekturview oder **Configured views** gewählt wird.

Diese interaktive Meta-View gehört zur Editoroberfläche, nicht zum fachlichen Modell. Sie
benötigt keine eigene `view`-Definition und erscheint nicht in `config.views all`.
Die eingebaute englische Referenz ist `@help meta`.

## Fehler verstehen und korrigieren

Auch eine fehlerhafte Quelle lässt sich in der Meta-View untersuchen. Jeder
angezeigte Fehler enthält die Meldung, einen Quellausschnitt mit hervorgehobener
Zeile und verfügbare Korrekturkandidaten. Bei JSON stehen zusätzlich die
JSON-Pointer dabei. Der Button **Line …, column …** springt im Editor an die
betroffene Stelle.

Beispiele für Kandidaten:

| Fehler | Vorschläge |
| --- | --- |
| DSL `modle` statt `model` | Nach Schreibähnlichkeit geordnete gültige Blockschlüssel |
| JSON `dierection` statt `direction` | Passende Schlüssel des betreffenden JSON-/Viewblocks |
| Fehlende Klammer oder Anführungszeichen | Geschlossener Block oder korrekt quotierter String als Beispiel |
| Ungültige JSON-Kommas/Schlüssel | Hinweise zu Kommas, doppelten Anführungszeichen und schließenden Klammern |
| Unbekannter Elementtyp `servic` | Kandidaten aus dem geladenen Profil, beispielsweise `service` |
| Abstrakter `OperationalAgent` | Tatsächliche konkrete Untertypen des ausgewählten Profils, beispielsweise `OperationalPerformer` |
| Unbekannte Endpunkt-ID | Im Modell vorhandene IDs, nach Schreibähnlichkeit geordnet |
| Fehlendes Pflichtattribut | Attributbeispiel mit passendem Datentyp bzw. Enum-/Minimalwert |

Kandidaten werden **nicht automatisch übernommen**. Ähnliche Schreibweise
beweist keine fachliche Richtigkeit; Typen, Endpunkte, Pflichtattribute und
Viewpoint-Regeln müssen nach einer Korrektur weiterhin zusammenpassen. Wenn
keine gezielte Korrektur ermittelt werden kann, zeigt die Hilfe ein gültiges
Grundbeispiel statt einer vermeintlich sicheren Reparatur.

Bei nicht lesbarer Syntax gibt es keine verlässliche vollständige Übersetzung.
Dann bleibt die Ausgabe gesperrt, bis die Syntax korrigiert ist. Ist die Syntax
lesbar, aber das Modell fachlich ungültig, bleiben Übersetzung und Download
verfügbar; die Fehler werden zusätzlich gezeigt. Die Oberfläche zeigt höchstens
zwölf Diagnosen gleichzeitig und weist auf weitere hin.

## JavaScript-API

```js
const json = arch.translate(dslSource);       // DSL → JSON
const dsl = arch.translate(jsonSource);       // JSON → DSL
const normalized = arch.translate(dslSource, { format: 'dsl' });

const inspection = arch.inspectSource(source, { profile: 'naf41-uaf' });
// {
//   sourceFormat: 'dsl', targetFormat: 'json',
//   output: '...', valid: false,
//   diagnostics: [{ message, line, column, path?, candidates: [
//     { label, example, detail }
//   ] }], ...
// }
```

`translate(source, { format? })` akzeptiert DSL-Strings, JSON-Strings oder JSON-
Quellobjekte und liefert einen Quellstring. Ohne `format` wird die andere
Notation gewählt. Die Funktion prüft Syntax und abbildbare Struktur, keine
fachliche Vollständigkeit; sie wirft bei Übersetzungsfehlern einen `ArchError`.
Ein ausschließlich per API erzwungenes Profil bleibt Aufrufkontext und wird
nicht automatisch als Dokument-`config` in die Übersetzung eingebettet.

`inspectSource(source, { profile?, format? })` liefert einen Diagnosebericht.
`output` ist bei nicht übersetzbarer Syntax `null`. `valid` beschreibt die
gemeinsame Modell-/Profilvalidierung, nicht den Erfolg eines SVG-Renderings.
Das Ergebnis enthält bei lesbarer Syntax außerdem `title`, `kind`, die
View-Metadaten `views` und gegebenenfalls `configuredViews` für die Oberfläche.
Fehlende Icons oder ungültige freie SVG-Pfade können wie bisher erst beim
Rendern auffallen.

## Was beim Übersetzen erhalten bleibt

Modellobjekte, IDs, Typen, Attribute, Referenzen, Containerhierarchie, Viewauswahl,
Layoutvorgaben, Styles und Diagrammeinstellungen bleiben fachlich gleich.
Ein- und Rückübersetzung werden anhand der mitgelieferten Beispiele durch
identische SVG-Ausgaben für alle Views und beide Themes geprüft.

Formatierung und Kommentare werden nicht erhalten. Defaults können ausdrücklich
ausgegeben werden; Beziehungen können im JSON am Modell statt innerhalb eines
Packages stehen, da ihre Endpunkte globale IDs sind. Leere Blöcke können zu
`{}` zusammengezogen werden. Die Übersetzung ist daher kein textidentischer
Roundtrip und keine Quelltextversionsverwaltung. Die bisherigen Größenlimits
gelten auch für die übersetzte Ausgabe.

Formatvertrag: [JSON.md](JSON.md). Sprach-/API-Regeln: [SPEC.md](SPEC.md).
Profilregeln und Kandidatenhilfe: [HELP.md](HELP.md).
