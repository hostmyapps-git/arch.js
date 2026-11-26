# Interne Architektur von Arch.js

Arch.js verarbeitet DSL und JSON zu einem Architekturmodell, prüft es gegen
sein Profil, berechnet die Geometrie der gewählten Views und erzeugt SVG.
`src/arch.js` liefert den Kern für Node und `arch.core.min.js`. Der Einstiegspunkt
`src/arch.studio.js` ergänzt ihn für Node und `arch.min.js` um Hilfe,
Dashboard und Inspektion. Beide verwenden dieselben Render- und
Validierungsfunktionen in `src/runtime.js`. Studio übergibt dort die Funktionen
für Hilfeseiten, Dashboard-Präsentation und DOM-Interaktion. Profil- und
Icon-Registrierung stammen in beiden Varianten aus denselben Modulen.
Der Build erzeugt die Browserdateien mit `npm run build`.

## Verarbeitung eines Dokuments

| Schritt | Zuständigkeit | Vertrag |
| --- | --- | --- |
| Einlesen | `lexer.js`, `parser.js`, `json.js` | DSL und JSON verwenden dieselbe Grammatik. JSON wird in DSL überführt und mit JSON-Pointern auf die Eingabe zurückgeführt. Der Lexer zählt Spalten in UTF-16-Codeeinheiten. |
| Profil binden | `profiles.js`, `parser.js` | `parse()` hält das kompilierte Profil und den Default-Beziehungstyp im Modell fest. Die öffentliche Funktion `getProfile()` liefert eine unabhängige Kopie. |
| Views auflösen | `view-reuse.js`, `graph-index.js` | `extends` und `embed` erzeugen wirksame View-Definitionen. Die ursprünglich geschriebenen Views bleiben im öffentlichen Modell erhalten. |
| Modell prüfen | `model-validation.js`, `profile-validation.js`, `route-validation.js` | Identitäten, Endpunkte und Präsentationsangaben werden vor fachlichen Profilregeln geprüft. Anschließend folgen die diagrammspezifischen Anforderungen und die Pläne für Style, Platzierung und Routenreferenzen. |
| Views berechnen | `geometry.js`, `tree.js`, `diagrams.js`, `placement.js`, `sequence.js` | Layout übernimmt die geprüfte Projektion und ihre Pläne. Jede View besitzt ihre eigene Geometrie. Verschiebungen eingebetteter Karten und Pfade finden im Host statt. |
| Ausgabe | `svg.js`, `multi-view.js`, `meta.js`, `validation-mode.js` | SVG-Koordinaten, IDs, Themes und Validierungshinweise werden bei der Ausgabe angewendet. `renderDiagram()` liefert den Layoutgraphen und sein SVG aus demselben Durchlauf. |

Die öffentliche `validate()`-Funktion meldet Profilfehler und Draft-Hinweise,
ohne ein Layout zu rendern. `layout()` und die Renderfunktionen validieren auch
bereits geparste Modelle erneut. Aufrufer dürfen diese Modelle bearbeiten oder
als JSON speichern und wieder einlesen. Ein späterer Aufruf übernimmt deshalb
keine Validierung oder View-Auswahl aus einem früheren Aufruf. Dagegen verwendet
ein einzelner Aufruf zur Auswertung gestapelter oder eingebetteter Views
immer denselben validierten Kontext.

`view.include` und `view.exclude` bestimmen die fachliche Projektion. `display
none` wird erst für die sichtbare Projektion angewendet. Ein ausgeblendeter
Knoten oder eine ausgeblendete Beziehung kann weiterhin für Profilregeln
relevant sein. Sichtbarkeitspflichten wie `shall` prüfen ausdrücklich beide
Projektionen. Die Indizes in `graph-index.js` enthalten jeweils Knoten und
Kanten in Quellreihenfolge, damit Diagnosen und Layouts reproduzierbar bleiben.

AST und Layoutgraph gehören zu verschiedenen Phasen. Renderer dürfen die
Positionen der eigenen Karten setzen. Änderungen am AST, an kompilierter
Profilsemantik oder an einer gemeinsam genutzten View-Projektion würden andere
Views beeinflussen. Gemeinsame Glyphenmessung, SVG-Pfade, XML-Escaping und
Fehlertypen liegen deshalb in eigenständigen Modulen ohne Abhängigkeit vom
Layout oder Parser. Der interne Modulgraph unter `src/` ist azyklisch.

Bei Einbettungen bildet `view-occurrences.js` die Adressen sichtbarer Karten
und Kanten auf ihre Modell-IDs ab. Die Validierung bindet Host-Endpunkte und
Koordinaten an konkrete Karten vor dem Layout. `geometry.js` verschiebt die
Quellgeometrie je Einbettung und ordnet interne Pfade und Referenzpfeile
derselben Gruppe zu. Fachliche Profilregeln erhalten weiterhin eine
Projektion mit jeweils einer Identität pro Modellelement und Beziehung.

## Fachliche Profile und Referenzausgaben

Das NAF-Profil entsteht aus `profiles/naf41/catalog.mjs` und
`representations.mjs`. Der Build prüft die Prüfsummen der mitgelieferten
Normgrundlagen und erzeugt das Laufzeitprofil sowie die Abdeckungsübersicht
aus derselben Definition. Die ausführbaren Regeln und die Hinweise zur
geeigneten Darstellung verwenden unterschiedliche Felder eines Viewpoints.

`table.js`, `sankey.js` und `naf-grid.js` übernehmen sichtbare
View-Projektionen aus `diagrams.js`. Messung und Ausgabe verwenden denselben
Layoutplan. Sankey bestimmt die Spalten über topologische Ränge. Zusätzliche
Positionen für lange Flüsse halten Zwischenknoten frei. Das A2-Raster
verwendet die festen NAFv4.1-Zellen und projiziert die zugeordneten
modellierten Views aus den Attributen oder Governance-Beziehungen.

`help.js` baut Abschnitte und Querverweise aus der Sprach- und Profilregistry
auf. `help-navigation.js` verbindet sie im DOM mit einem Verlauf pro SVG-Block.
Das Studio synchronisiert den aktiven Verlauf mit der Browser-History und
hält Navigationszustand und Editorquelle getrennt. `source-highlight.js`
liefert tolerant erkannte Syntaxfarben für Hilfe, Quellen-SVG und Studio.

## Laufzeit und Wartung

- **Profilkompatibilität.** Die kanonische Abstammung wird für eingefrorene,
  kompilierte Typdefinitionen in einer `WeakMap` gespeichert. Ein Alias teilt
  seine Abstammung mit seinem Zieltyp. Rohe, editierbare Typdefinitionen werden
  bei jedem Zugriff neu ausgewertet. Globale Beziehungsschranken werden anhand
  der Abstammung pro Kante gemeinsam klassifiziert. Bei bidirektionalen Kanten
  zählt jede Richtung einmal und eine Selbstkante je Endpunktrolle insgesamt
  einmal. Die Zyklusprüfung behält die Quellreihenfolge der Kanten bei.
- **Viewpoint-Verbindungen.** Von `connection-rules.js` gebaute Indizes ordnen
  zulässige Kanten und Referenzen ihrem Ursprung zu. Sie werden beim ersten
  passenden Knoten pro Regel und View aufgebaut. `through` folgt den
  geschriebenen Endpunktrollen und kann mehrere Ebenen erreichen. Eine Kante
  zählt für einen Ursprung auch dann nur einmal, wenn mehrere Wege dorthin
  führen. Typisierte Referenzen ergänzen die gezählten Beziehungen, wobei
  bereits durch eine Kante belegte Zielknoten abgezogen werden. Bei einer
  Sichtbarkeitspflicht durchsucht `mapping-visibility.js` die Kanten in der
  unmittelbaren Nachbarschaft des Knotens im Gesamtmodell.
- **Knotenplatzierung.** Eine Warteschlange nach Kahn bestimmt die Ränge der
  freien Knoten anhand ihrer Vorgänger. Ist sie bei einem Zyklus leer, wird der
  erste verbleibende Knoten in Quellreihenfolge verwendet. Bei automatischen
  Karten trennen Rangbänder und Stapel die Karten bereits geometrisch. Die
  Kollisionsprüfung betrachtet daher nur fest platzierte Karten. Der Abstand
  beträgt hier mindestens 24 Einheiten, damit jeder Kollisionsschritt auch bei
  kleinen `spacing`-Werten vorwärtskommt. Verschachtelte Container gruppieren
  ihre Kinder einmal für beide Platzierungsdurchgänge.
- **Text und Pfade.** Die Breite eines Zeichens wird einmal für jeden Schritt
  des Umbruchs addiert. Die Addition erfolgt in derselben Folge wie zuvor,
  damit auch Schwellwerte in den SVG-Layouts gleich bleiben. SVG-Pfade und
  Referenzlinien behalten ihre geometrischen Prüfungen und Genauigkeitsgrenzen.
- **Spezialdiagramme.** Matrizen indexieren Kanten nach Quell- und Ziel-ID in
  einem Durchlauf. Damit braucht jede der `Zeilen × Spalten` Zellen nur einen
  Zugriff auf passende Kanten. Heatmaps ermitteln Kinder und Teilbaummaße über
  Indizes. Zeitachsen, Sequenzteilnehmer und Klassen-Kompartimente greifen
  ebenfalls per ID oder Besitzer zu. Die Messphase lässt SVG-Text und dessen
  Umbruch aus. Sie berechnet weiterhin Geometrie, wenn der Renderer Karten oder
  Referenzobjekte positioniert.
- **Diagnostik.** JSON-Pointer, Warnungsreihenfolge, Pflichtbedingungen und
  geometrische Prüfungen sind Teil des Verhaltens. Neue Optimierungen sollten
  neben Laufzeit und SVG-Ausgabe auch die Diagnose an der ursprünglichen
  Quellposition prüfen. `tests/core.test.mjs` vergleicht die exportierte API
  der beiden generierten Bundles mit dem ES-Modul.

Die Laufzeit bleibt synchron. Eine große SVG-Matrix enthält weiterhin bis zu
10.000 Zellen, und auch der Browser muss sie zeichnen. In stark vernetzten
Viewpoints kann `through` für viele Ursprünge große Teile des Graphen erreichen.
Sehr viele manuelle Platzierungen erhöhen die Zahl der Kollisionsprüfungen.
Die Benchmarks unten messen Node-Laufzeit und treffen keine Aussage über
Browser-Rasterisierung, Speicherbedarf oder Exportgröße.

### Grid, Dashboard und schmale Views

- **Sparsame Projektionen.** Ab 128 Elementen und acht Views kann der
  Graphindex kleinen Projektionen mit höchstens einem Achtel der Elemente
  direkt folgen. Er ermittelt die ausgehenden Kanten der enthaltenen Elemente
  und prüft beide Endpunkte sowie die Ausschluss- und Sichtbarkeitsregeln.
  Die numerischen Positionen der Treffer stellen vor der Rückgabe die
  Deklarationsreihenfolge wieder her. Für dichte Projektionen bleibt ein
  linearer Durchlauf günstiger. Die Indizes werden pro Operation und erst
  bei Bedarf aufgebaut. Eine leere Projektion benötigt keinen Modelldurchlauf.
- **View-Vererbung und Objektbindungen.** Eine View ohne eigene Ein- oder
  Ausschlüsse kopiert die geordnete Projektion ihrer Basis direkt.
  Einbettungsprüfungen laufen nur bei tatsächlichen Einbettungen.
  Objektifizierungen indexieren globale Bindungen pro Profilregel. Payloads,
  sichtbare Endpunkte und fehlende Bindungen werden weiterhin pro View
  geprüft. Die Reihenfolge der modellierten Objekte und Kanten bleibt erhalten.
- **Dashboard und Recovery.** Nach erfolgreicher Validierung verwendet der
  Bericht einen gemeinsamen Dokumentkontext. Recovery-Views teilen sich
  den Katalog und die modellweiten Profildiagnosen, weil sie dieselben Knoten
  und Kanten unter demselben Profil prüfen. Für jede Recovery-View werden
  ihre Abhängigkeiten in Deklarationsreihenfolge geordnet und ihre lokalen
  Regeln neu geprüft. Diese Wiederverwendung gilt nur innerhalb eines
  Berichts. Ein neuer Aufruf prüft das aktuelle, editierbare Modell erneut.
- **Hilfe und Rasterfarben.** Die Hilfe speichert sortierte Typdefinitionen
  und Aliaslisten nach Identität der eingefrorenen Profiltabelle. Dadurch
  muss der HTML-Export dieselben Tabellen nur einmal sortieren. Ein Grid
  gruppiert seine Kacheln nach Zeilen und berechnet die Farbwerte einmal
  je Zeile und Theme pro SVG-Ausgabe.
- **Dashboard-Interaktion.** Tabellenzeilen bleiben bei der Navigation im
  DOM. Tab- oder Suchwechsel bauen die Ergebnisliste neu auf. Die
  Suchdaten entstehen bei Bedarf, und die Auswahl aktualisiert nur die
  betroffenen Zeilen und Diagrammglyphen. Mehrere Glyphen derselben
  Modell-ID, etwa Kante und Beschriftung, bleiben gemeinsam markiert.
- **Kontextplatzierung und SVG-Pfade.** Ohne Baumgruppen gibt es keine
  Kontextanker. Mit Baumgruppen indexiert das Layout die erste passende
  Beziehung in Quellreihenfolge. Die Kreuzungsanalyse liest die einfachen
  absoluten `M`-, `L`- und `Q`-Pfade direkt, wenn sie dem Ausgabeformat von
  `polyPath` entsprechen. Andere Pfadsyntax verwendet den vollständigen
  SVG-Pfadparser. Beide Pfade liefern dieselben geordneten Segmente.

## Reproduzierbare Messung

Im Projektverzeichnis mit installierten Abhängigkeiten ausführen.

```sh
node scripts/benchmark.mjs
node scripts/benchmark.mjs /pfad/zum/vergleichsstand/src/arch.js
node scripts/benchmark.mjs src/arch.studio.js 'dashboard/'
```

Der Benchmark lädt für beide Stände dieselben Beispiel- und Profildateien aus
dem aktuellen Verzeichnis. Er wärmt jede Arbeitslast auf, misst fünf Blöcke
mit mehreren Aufrufen und gibt den Median der Blockmittel pro Aufruf aus. Vergleichswerte stammen vom Stand direkt
vor der Überarbeitung und dem überarbeiteten Quellcode auf demselben Mac
(arm64, Node v26.13.0). Zeiten in Millisekunden.

| Arbeitslast | Vorher | Nachher |
| --- | ---: | ---: |
| Kleines Diagramm | 0,174 | 0,068 |
| NAF-Beispiel, alle Views | 10,010 | 1,322 |
| NAF-Beispiel mit View-Wiederverwendung | 4,343 | 1,225 |
| Layout eines bereits geparsten Modells mit View-Wiederverwendung | 3,175 | 0,695 |
| Styles mit berechneten Maßen | 0,516 | 0,204 |
| Beispiel mit Spezialdiagrammen | 3,975 | 0,984 |
| Validierung von 650 Elementen, 1.600 Beziehungen und 12 Views | 16,935 | 3,818 |
| Rendering desselben Modells | 188,544 | 21,812 |
| Matrix mit 100 × 100 Zellen und 1.600 Beziehungen | 197,572 | 18,378 |
| `@help connections naf41-uaf OperationalPerformer` | 65,979 | 1,610 |

Für die Überarbeitung wurden außerdem die SVGs der Beispiel- und NAF-Dateien
in beiden Themes, vier NAF-Hilfeabfragen sowie 160 deterministisch erzeugte
Graphen mit Zyklen, Parallelkanten und manuellen Positionen mit dem vorherigen
Stand verglichen. Die 274 Ergebnisse waren byte-identisch. Ein eigener
Regressionstest deckt kleine Abstände ab, bei denen die alte Platzierung
hängen konnte.

Ein späterer Vergleich vor und nach der Grid- und Dashboard-Überarbeitung
verwendete denselben Mac und dieselbe Node-Version. Die folgenden Zeiten
sind Mediane in Millisekunden.

| Arbeitslast | Vorher | Nachher |
| --- | ---: | ---: |
| Vollständiges NAF-Raster | 0,778 | 0,549 |
| Raster mit 480 zusätzlichen Diagrammen | 5,816 | 4,615 |
| Dashboard-Bericht mit 480 zusätzlichen Diagrammen | 5,148 | 3,786 |
| Dashboard-Bericht mit 96 zusätzlichen Diagrammen und einer fehlerhaften View | 10,230 | 2,654 |
| NAF-Dashboard als eigenständiges HTML | 16,324 | 7,459 |
| 160 schmale Views bei 1.000 Elementen und 4.000 Beziehungen validieren | 20,418 | 7,396 |
| 650 Elemente und 1.600 Beziehungen in 12 Views rendern | 30,473 | 25,653 |

Ein Vergleich mit dem vorherigen Stand ergab 210 identische Validierungsresultate,
SVGs und Dashboard-Nutzdaten aus Beispielen, Hilfe und Recovery. Die
eigenständige HTML-Oberfläche enthält den optimierten Navigationscode.

In Chromium sank die synchrone Zeit pro Auswahl im Katalog mit 960 Elementen
von rund 1,57 ms auf 0,006 ms. Gemessen wurden fünf Blöcke mit je 80
programmgesteuerten Klicks nach einem Aufwärmblock. Die Diagrammansicht blieb
dabei geöffnet. Das misst Ereignisbehandlung und DOM-Änderungen ohne
Bildaufbau. Eine zusätzliche Vergleichsmessung der Pfadanalyse mit 1.600
geraden und gerundeten Pfaden ergab 3,74 ms vorher und 1,43 ms nachher.
