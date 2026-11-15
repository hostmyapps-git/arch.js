# Roadmap

Stand: 14.11.2026. Dies ist ein priorisierter Ausblick, keine Liste bereits
implementierter Funktionen und keine Terminzusage.

## Tatsächlich implementiert

- Konfigurierbare semantische Stilgruppen und Hintergrundfarben in Profilen,
  Inline-Konfiguration und View-Overrides. Fünf UAF-Bereichsfarben mit neutraler
  Zusatzgruppe, automatischem Textkontrast und identischer SVG-Ausgabe.

- Textsprache für Architekturmodelle und getrennte Ansichten.
- Generische Profile per API-Parameter oder Inline-`config`: eigene fachliche
  Typen, Vererbung, Attribute und Laufzeitvalidierung ohne Framework-Sonderfälle.
- Regeln für Relationsendpunkte, Container-Kindtypen, Kardinalitäten und
  Viewpoints; Profilregistry und reproduzierbare Profil-Snapshots.
- Mehrfachvererbung, flache typisierte Listen, Modellreferenzen, URI-/Datums-
  formate, Feldvergleiche, bedingte Endpunktpaare, Zyklusprüfung und
  Allokationsprüfungen pro sichtbarem Element.
- Externe Profile `uaf` und `naf4-uaf`: UAF-1.0-Typkatalog und ausgewählte
  strukturelle NAF-Regeln auf Basis der Leitlinie von 2019; genaue Teilabdeckung
  unter [profiles/uaf/COVERAGE.md](profiles/uaf/COVERAGE.md).
- Knoten-Kanten-Diagramme mit 13 grafischen Templates und 7 Kantenstilen;
  fachliche Typen werden unabhängig davon in Profilen definiert.
- Verschachtelte Packages, automatische Schichtenlayouts, freie Koordinaten,
  Größen, Ports, Wegpunkte, Bezierkurven und eigene SVG-Pfade.
- Inline-SVG, helle/dunkle Darstellung, JSON-Iconpacks, Markdown-Integration.
- Vollständige Bootstrap-, Lucide- und Tabler-Iconpacks mit lokaler Galerie,
  Beispiel, JSON-Downloads sowie festgeschriebenen Quellen und Lizenzen.
- Interaktiver Quelleneditor mit Live-Vorschau, Beispielen und SVG-Export.

Sieben zusätzliche Renderer sind jetzt verfügbar: Sequenz, Zustand,
Aktivität/Swimlanes, Matrix, hierarchische Heatmap, Timeline/Gantt und
Klassenansicht mit Details/Ports. Konfiguration und Teilumfang stehen in
[DIAGRAMS.md](DIAGRAMS.md). Die Darstellung ist keine vollständige UML-/BPMN-
oder NAF-Konformitätsimplementierung.

## Nächster Schwerpunkt: Darstellung und Layout

| Priorität | Feature | Nutzen / prüfbares Ergebnis |
| --- | --- | --- |
| Hoch | Hindernisvermeidende Kantenführung | Automatische Kanten umgehen sichtbare Knoten und Package-Titel. |
| Hoch | Weniger Kantenkreuzungen, Ports und Labelkollisionen | Größere Architekturansichten bleiben ohne manuelle Wegpunkte lesbar. |
| Hoch | Layout-Strategien pro Package und Ansicht | Raster-, Baum- und Layer-Layouts gezielt kombinieren. |
| Mittel | Zoom/Pan und Fokus auf einzelne Elemente | Größere Modelle bequem erkunden, navigieren und durchsuchen. |
| Mittel | Drag-and-drop mit Rückschreiben in die View | Verschieben erzeugt reproduzierbare `place`-/`route`-Anweisungen. |
| Mittel | Konfigurierbare Templates und Design-Tokens | Eigene Organisationstemplates definieren, ohne Renderer-Code zu ändern. |

## Eigenständige Visualisierungen und Diagrammtypen

Die ersten Versionen sind implementiert. Weitere Ausbauschritte:

| Darstellung | Geplante Erweiterung |
| --- | --- |
| Matrix | Interaktive Zellnavigation, Hierarchieaggregation und transitive Pfade |
| Capability Map / Heatmap | Gewichtete Kachelgrößen und mehrere Bewertungsdimensionen |
| Sequenz | Interaktionsfragmente (`alt`, `loop`, `par`) und vollständige Aktivierungsintervalle |
| Aktivität / Swimlane | Ausführbare Guard-/Token-Semantik, optimiertes Branch-/Merge-Layout |
| Zustand | Hierarchische/orthogonale Zustände, History, Entry-/Exit-Aktionen |
| Klasse / Interface | Provided-/Required-Interfaces, vollständige UML-Eigentums-/Kompatibilitätsregeln |
| Zeit-/Migrationsroadmap | Kritischer Pfad, Termin-/Ressourcenplanung, Ist-/Soll-Baselines |
| Deployment | Spezialisierte Umgebung-/Instanznotation zusätzlich zur vorhandenen Containerdarstellung |

## Sprach- und Modellierungsfunktionen

- Erweiterte Attributtypen: Einheiten und strukturierte Objektwerte.
  Flache Listen, Datums-/Zeitformate und typisierte Referenzen sind implementiert.
- Wiederverwendbare Modellmodule und Imports mit klarer ID-Auflösung.
- Modellabfragen für Views statt ausschließlich expliziter `include`-Listen.
- Diagnosewarnungen mit vollständigen Quellbereichen (Fehler mit Zeile/Spalte,
  eigenen Typschemata und mehreren semantischen Diagnosen sind implementiert).
- Erweiterbares deklaratives Regelschema für komplexe Pfad-/Zeit-/Konsistenz-
  regeln, weiterhin ohne ausführbaren Profilcode. Mehrfachvererbung und einfache
  zeitliche Feldvergleiche sind implementiert.
- Formalisierte Sprachversionierung und Migration bestehender DSL-Dokumente.
- UAF-/NAF-Abdeckung anhand der offenen Quellregeln ausbauen: Eigentum,
  UML-/SysML-Kompatibilität, abgeleitete Werte, Aggregationen und komplexe
  Konsistenzregeln. Offene Regeln einzeln mit Gegenbeispielen abnehmen.
- Weitere NAF-Viewpoints und ihre Spezialdarstellungen nachziehen; Kriterien
  aus der jeweiligen Quellversion festlegen. Ein Typname allein genügt nicht.
- UAF 1.3 / NAFv4.1 als getrennte, versionierte Profile prüfen und migrierbar
  machen; bestehende UAF-1.0-Modelle reproduzierbar erhalten.
- ArchiMate und weitere Frameworkprofile mit eigenen Quellen-/Abdeckungsnachweisen.
- UML-/SysML-XMI-Import/-Export mit explizitem Nachweis möglicher Informationsverluste.

## Editor, Integration und Qualität

- Automatisches lokales Speichern, Datei öffnen/importieren und Undo/Redo.
- Iconsuche mit größerer Vorschau, Favoriten und Einfügen einer Iconreferenz.
- Modelldetails/Relationen beim Anklicken eines SVG-Elements anzeigen.
- PNG-/PDF-Export mit denselben Layouts wie die SVG-Ausgabe.
- CLI für Validierung/Rendering und Integration in Dokumentations-Builds.
- Ergänzende Firefox-/WebKit-Tests, Barrierefreiheitsprüfung und Leistungstests.
- Optional vollständiger CommonMark-Adapter als getrennte Integration.

## Abnahmeregel für zukünftige Features

Ein Feature gilt erst als implementiert, wenn Textsyntax und Semantik dokumentiert,
ein editierbares Beispiel enthalten, Fehlerfälle getestet und Ausgabe/Interaktion
im Browser geprüft sind. Änderungen an der Trennung von Modell und Darstellung
müssen vorhandene Ansichten weiterhin reproduzierbar halten.
