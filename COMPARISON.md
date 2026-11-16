# Einordnung: Vorteile, Grenzen und Alternativen

Stand: 16.11.2026. Aussagen zu arch.js beziehen sich auf den implementierten
Stand 0.1.0 in diesem Repository. Die anderen Werkzeuge sind anhand ihrer
verlinkten offiziellen Dokumentation eingeordnet. Dies ist eine Entscheidungshilfe,
kein Leistungsvergleich: Es wurden keine vergleichenden Benchmarks durchgeführt.

## Wofür arch.js gedacht ist

arch.js verbindet eine textuelle Architekturmodellierung mit SVG-Darstellung.
Die [äquivalente JSON-Syntax](JSON.md) erlaubt dieselben Modelle über strukturierte
Eingaben; beide Formen verwenden dieselbe Grammatik, Profilprüfung und Renderer.
Elemente, Beziehungen und typisierte Referenzen haben stabile IDs im `model`;
Views wählen daraus Ausschnitte und bestimmen die Darstellung. Das ist besonders
nützlich, wenn dieselben Elemente in einer Übersicht, einer Detailansicht und
einer Matrix wiederkehren und fachliche Regeln gemeinsam geprüft werden sollen.

Die Vorteile ergeben sich aus der Kombination folgender Funktionen:

- **Ein Modell, mehrere Views:** Namen, Typen und Beziehungen werden einmal
  gepflegt. `include`/`exclude` und verschiedene Renderer liefern unterschiedliche
  Sichten. `config { views all }` oder eine geordnete ID-Liste exportiert mehrere
  Views untereinander in einem SVG. Das Modell wird beim Layout nicht verändert.
  Mit `@meta json`/`@meta dsl` kann eine Quellenview die Architekturdefinition
  in dieselbe SVG-Ausgabe aufnehmen. [Meta-Views](META.md).
- **Prüfbare Fachprofile:** JSON-Profile definieren eigene Typen, Vererbung,
  abstrakte Typen, Attribute, zulässige Endpunkte, Kardinalitäten und
  Viewpoint-Pflichten. Eingebaute Hilfe und Kandidatenlisten verwenden dieselbe
  Profilregistry. Regeln müssen nicht als ausführbarer Profilcode eingebunden werden.
- **Gezielte Darstellung:** Connected-Views kombinieren automatisches Layout mit
  `place`, Mindestgrößen, Ports, Wegpunkten und freien SVG-Pfaden. Node-Felder und
  Labeltext/Icon lassen sich getrennt anzeigen; Icons können auf vier Seiten stehen.
- **Sichtbare Austauschobjekte:** Referenzierte InformationElements können als
  gemeinsame Karte an mehreren Beziehungen erscheinen. Zuordnungspfeile lassen
  sich separat routen; `perEdge` erlaubt bewusst mehrere Karten derselben Identität.
- **Lokale Einbettung:** Die gebauten Browserbundles rendern ohne zusätzliche
  Laufzeitscripts, CDN oder Renderingdienst, auch über `file://`. Profile und
  Iconpacks lassen sich lokal registrieren. Node kann dieselbe SVG-Ausgabe erzeugen.
- **Text und SVG als Artefakte:** DSL und JSON-Profile lassen sich versionieren
  und prüfen; der SVG-Export enthält die Darstellung einschließlich Icons.

Beispiele: [mehrere Views](examples/multiple-views.arch),
[Node-Darstellung](examples/node-presentation.arch),
[gerouteter Datentransfer](examples/naf41-walker-routing.arch).
Die genaue Syntax steht in [HELP.md](HELP.md) und [SPEC.md](SPEC.md).

## Was arch.js derzeit begrenzt

| Bereich | Implementierter Umfang und Konsequenz |
| --- | --- |
| Automatisches Layout | Deterministisches Schichtenlayout, kein globaler Kantenkreuzungsoptimierer. Allgemeine Modellkanten umgehen Hindernisse nicht zuverlässig automatisch. Für dichte Ansichten sind kleinere Views oder manuelle Routen nötig. Referenzpfeile haben eine eigene heuristische Hindernisumgehung; manuelle Routen ersetzen sie. |
| Umfang | Der DSL-Parser begrenzt auf 1000 Elemente, 4000 Beziehungen und 32 Package-Ebenen. Diese Obergrenzen sind keine Zusage für Lesbarkeit oder Geschwindigkeit großer Modelle. Ein dokumentierter Leistungstest fehlt. |
| Notation | Acht Renderer sind vorhanden, aber Sequenz, Zustand, Aktivität, Matrix, Heatmap, Timeline und Klasse haben einen begrenzten Teilumfang. Beispielsweise fehlen Sequenzfragmente, verschachtelte Zustände und Ressourcen-/Terminplanung. [Renderergrenzen](DIAGRAMS.md). |
| Styles | Freie Positionen/Routen, Logo-Karten, Iconpositionen, Feldsichtbarkeit und Schrift-/Größen-Overrides gehören zu Connected-Views. Spezialrenderer bestimmen Form und Geometrie selbst. Neue beliebige SVG-Templates erfordern derzeit Änderungen am Renderer. |
| Fachliche Konformität | UAF-/NAF-Profile prüfen die dokumentierten Typ- und Strukturregeln. Alle 47 NAFv4.1-Viewpoint-IDs bedeuten keine vollständige normative Abdeckung oder Zertifizierung. Methodik, qualitative Vollständigkeit und offene Semantik erfordern Review. [NAF-Abdeckung](profiles/naf41/COVERAGE.md), [UAF-Abdeckung](profiles/uaf/COVERAGE.md). |
| Wiederverwendung und Austausch | Mehrere Views innerhalb eines Dokuments und registrierbare Profile sind vorhanden. DSL-Modulimports, View-Abfragen, XMI-Modellimport/-export und verlustfreie Konvertierung anderer Diagrammsprachen sind nicht implementiert. |
| Integration und Export | SVG-API und Browserdemo sind vorhanden; kein mitgelieferter Rendering-/Validierungs-CLI, HTTP-Renderingdienst oder direkter PNG-/PDF-Export. `npm start` startet nur den statischen Demoserver. |
| Editor | Live-Vorschau, Zoom/Fit, Viewauswahl und Downloads; keine dauerhafte Speicherung, Zusammenarbeit oder grafisches Rückschreiben per Drag-and-drop. Entwürfe leben nur in der laufenden Sitzung. |
| Markdown | Der eigene Adapter unterstützt Absätze, Überschriften und Code-Fences, kein vollständiges CommonMark. Bestehende Markdown-Renderer können über `renderAll` integriert werden. GitHub rendert `arch`-Fences nicht durch diese Bibliothek automatisch. |
| Prüfung und Darstellung | Automatisierte Browsertests verwenden Chromium. Andere Browser-Engines sind nicht separat abgesichert. Textmaße sind geschätzt; Schriften können Umbruch und Erscheinungsbild beeinflussen. Ein erfolgreiches `validate()` prüft weder sämtliche Iconauflösungen noch alle freien SVG-Pfade. |

Browserbundles sind eigenständig; direkte Node-Quellimporte benötigen die in
`package.json` gepinnten XML-/SVG-Abhängigkeiten. Iconify-SVGs werden nur im
[unterstützten Teilumfang](icons/README.md) rekonstruiert. Escaping, verbotene
aktive Inhalte und Größenlimits ersetzen keine allgemeine Sicherheits- oder
Ressourcengarantie für jede Einbettungsumgebung.

## Vergleich nach Einsatzschwerpunkt

Die folgende Tabelle beschreibt Schwerpunkte. Sie behauptet nicht, dass ein
Werkzeug außerhalb seines Schwerpunkts unbrauchbar ist oder dass die anderen
keine Wiederverwendung, Validierung, Icons oder lokale Ausführung anbieten.

| Werkzeug | Dokumentierter Schwerpunkt | Abwägung gegenüber arch.js |
| --- | --- | --- |
| **arch.js** | Ein fachlich typisiertes Modell mit mehreren Views, JSON-Profilen und SVG-Renderern. | Passend, wenn gemeinsame Identitäten, projektspezifische Regeln und gezielte Connected-Komposition wichtig sind. Dafür begrenzte Layoutautomatik, Notation und Integrationen. |
| **Mermaid.js** | JavaScript-Diagramme aus Text mit vielen Diagrammarten; Mermaid-Fences werden unter anderem von GitHub unterstützt. [Einführung](https://mermaid.js.org/intro/), [GitHub-Integration](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams). | Naheliegend für Diagramme direkt in vorhandener Markdown-Dokumentation. arch.js fügt das hier beschriebene gemeinsame Modell und sein JSON-Profilschema hinzu, benötigt aber eine eigene Einbettung für `arch`-Fences. |
| **PlantUML** | Viele UML- und weitere Notationen, Präprozessor und Standardbibliothek. Sequenzen unterstützen unter anderem verschachtelte `alt`, `loop` und `par`. [Sequenzen](https://plantuml.com/sequence-diagram), [Präprozessor](https://plantuml.com/preprocessing), [Standardbibliothek](https://plantuml.com/stdlib). | Naheliegend, wenn umfangreiche UML-Notation und wiederverwendbare Diagrammdefinitionen wichtig sind. arch.js konzentriert sich auf gemeinsame Modellobjekte mit generischen Profilprüfungen; seine Spezialnotationen sind kleiner. |
| **Graphviz** | Graphdarstellung mit mehreren Layoutengines. `dot` versucht gerichtete Kantenkreuzungen und Kantenlängen zu reduzieren; Ausgabeformate umfassen SVG, PNG und PDF, abhängig vom Build. [Engines](https://graphviz.org/docs/layouts/), [dot](https://graphviz.org/docs/layouts/dot/), [Export](https://graphviz.org/docs/outputs/). | Naheliegend für automatisch erzeugte Graphen und die Wahl passender Layoutverfahren. arch.js bietet stattdessen sein Architekturmodell, Fachprofilregeln und View-Darstellungen direkt an; ein automatischer Layoutvorteil wird nicht beansprucht. |
| **D2 / D2.js** | Textdiagramme mit Dagre, ELK oder TALA sowie Komposition mehrerer Boards. D2.js ist die JavaScript-Anbindung des D2-Compilers über WebAssembly für Browser und Node. [Layouts](https://d2lang.com/tour/layouts/), [Komposition](https://d2lang.com/tour/composition/), [D2.js](https://github.com/d2lang/d2/tree/master/d2js/js). | Naheliegend für Architekturzeichnungen mit Layoutauswahl, Imports und Varianten. arch.js bietet sein eigenes typisiertes Modell-/Profilschema und die Referenzkarten an Beziehungen; seine Mehrfachviews sind keine D2-Boards. |

### Wichtige Unterschiede im Detail

**Mermaid:** Auch Mermaid besitzt eine Architecture-Notation mit Gruppen,
Services und Icons; sie ist in der aktuellen Dokumentation als Beta markiert.
Layoutoptionen hängen von Version und Diagrammtyp ab; die Dokumentation nennt
ELK als Standard ab v12. Deshalb sind weder „Mermaid kann keine Architektur“
noch „Mermaid verwendet immer Dagre“ passende Abgrenzungen.
[Architecture](https://mermaid.js.org/syntax/architecture.html),
[Layouts](https://mermaid.js.org/config/layouts.html).

**PlantUML:** Lokales Rendering ist möglich; eine Serverpflicht besteht nicht.
Die klassische lokale Installation verwendet Java, Graphviz nur für bestimmte
Diagramme. Weitere Layoutwege sind unter anderem Smetana, VizJs und ELK.
arch.js bietet demgegenüber ein direkt ladbares Browserbundle; daraus folgt
keine allgemeine Aussage über Aufwand oder Leistung aller PlantUML-Integrationen.
[Lokaler Start](https://plantuml.com/starting),
[Layoutengines](https://plantuml.com/layout-engines).

**Graphviz:** Auch Graphviz erlaubt vorgegebene Positionen und Kontrollpunkte,
etwa über `pos` und `neato -n`; die Wirkung ist engineabhängig. Freie Positionierung
ist daher kein Alleinstellungsmerkmal von arch.js. Der praktische Unterschied
liegt in der hier integrierten Kombination aus Modell, View, Profilschema und
Präsentationsoptionen. [Positionen](https://graphviz.org/docs/attrs/pos/).

**D2:** Wiederverwendung und mehrere Darstellungen sind bereits vorgesehen:
Imports binden Definitionen ein, `layers`, `scenarios` und `steps` haben
unterschiedliche Vererbungsregeln. Welche Positions-/Layoutoptionen verfügbar
sind, hängt von der Engine ab. D2.js benötigt keinen entfernten Renderingdienst;
die dokumentierte Anbindung verwendet WASM und Worker.
[Imports](https://d2lang.com/tour/imports-use-cases/),
[Boards](https://d2lang.com/tour/composition/),
[Layoutumfang](https://d2lang.com/tour/layouts/),
[JavaScript-Anbindung](https://github.com/d2lang/d2/tree/master/d2js/js).

## Auswahl in der Praxis

Unsere Einschätzung aus diesen Funktionen: arch.js passt gut zu einem
versionierten Architekturmodell, dessen Elemente in mehreren gezielt gestalteten
Views wiederkehren und gegen eigene Regeln geprüft werden sollen. Ein kleiner
repräsentativer Ausschnitt mit dem eigenen Profil ist dafür die sinnvollste Probe.

Für bestehende Mermaid-Dokumentationen spricht die vorhandene Hostintegration;
für ausführliche UML-Szenarien der dokumentierte Notationsumfang von PlantUML;
für automatisch erzeugte Graphen die Layoutauswahl von Graphviz; für
komponierte Architekturzeichnungen mit Imports und Layoutengines D2. Diese
Werkzeuge können neben arch.js eingesetzt werden. Ihre Syntax und Semantik
werden durch arch.js nicht automatisch importiert oder übersetzt.

Offene Verbesserungen stehen getrennt vom implementierten Umfang in
[ROADMAP.md](ROADMAP.md). API-Verträge und Fehlerverhalten stehen in
[SPEC.md](SPEC.md), Prüfnachweise in [PROGRESS.md](PROGRESS.md).
