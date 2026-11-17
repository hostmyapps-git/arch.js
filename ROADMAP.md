# Roadmap

Stand: 17.11.2026. Der erste Abschnitt hält den implementierten Ausgangspunkt
fest; die folgenden Abschnitte sind ein priorisierter Ausblick ohne Terminzusage.
Einsatzschwerpunkt und Grenzen gegenüber anderen Werkzeugen:
[COMPARISON.md](COMPARISON.md). arch.js konzentriert sich auf gemeinsame
Architekturmodelle, prüfbare Profile und mehrere gestaltbare Views.

## Tatsächlich implementiert

- Opt-in-Bündelung von Fan-in-/Fan-out-Kanten über `sharePath stereotypes|all|none`
  in Connected-Views samt Tree-Gruppen. Gleiche tatsächliche Typen oder explizit
  kompatible verschiedene Typen; separate Labels/Icons und logische Pfade für
  Zuordnungen. Freie Korridore erforderlich, kein allgemeines Edge-Bundling.
- C8-Vokabularadapter `Constraint` und `OriginatesFromRationale`, quellgebunden
  an NAFv4.1 S.100–101; bestehendes `StrategicConstraint` weiter unterstützt.

- Property-Zeilen auf Connected-/Tree-/Package-Karten, globale und pro-Node-Auswahl
  und Größenanpassung vor Positionierung/Routing. Class-Karten behalten ihre
  Bereiche und erlauben `place` samt relativen Koordinaten/Mindestgrößen.
  Ports folgen ihren Ownern; Class-Routen bleiben automatisch.

- Referenzierte `place`- und `via`-Koordinaten mit `+`, `-`, `*`, `/`, Klammern, sichtbaren Node-/Tree-Ankern,
  Abmessungen und Mittelpunkten. Koordinatenweise topologische Auflösung,
  indirekte Zyklusdiagnosen einschließlich Containment/Tree-Mitgliedschaft,
  JSON-/Meta-Erhalt und Routing nach Positionierung. Größen, Endpunkt- und
  Labelpunkte bleiben numerisch; kein allgemeiner Ausdrucksinterpreter oder iterativer Reflow.

- Tree-Renderer für automatische Taxonomien/Wälder: zentrierte Eltern,
  vier Wachstumsrichtungen, richtungsabhängige Interpretation von Generalisierungen,
  Relationstypfilter, variable Node-/Labelmaße und vorhandene Node-Styles.
  Eindeutige Strukturprüfung, JSON/Meta, Hilfe und C1-Beispiel in der Demo.
- Benannte Tree-Layoutgruppen in Connected-Views mit expliziten Mitgliedern,
  eigener Richtung und optionaler Gruppenposition. Externe Karten bleiben
  automatisch/manuell positionierbar; Querbeziehungen, Routen und Referenzkarten
  bleiben erhalten. Keine verschachtelten Layoutgruppen oder Package-übergreifende
  Mitgliedschaft. C2-Beispiel mit externer Capability verfügbar.

- Bidirektionale Beziehungen mit `<->`, profilabhängigen `directions`,
  gemeinsamer ID/Attributen, JSON-/Meta-Übersetzung, beidseitigen Pfeilspitzen
  und richtungsabhängigen Kardinalitäts-/Matrixprüfungen.
- Entwurfsmodus `validation draft` mit Warnungen für fehlende Anforderungen
  unter dem Diagramm, strenger API-Übersteuerung und SVG-Export der Hinweise.
- Einzelne Beziehungen je View per `style EDGE_ID { display none }` ausblenden;
  das vollständige Modell bleibt Gegenstand der Profilprüfung.
- Nodes/Packages per `style NODE_ID {display none}` einschließlich angrenzender
  Kanten und Package-Inhalten ausblenden; alle Renderer und JSON unterstützt.

- Deklarierte Quellenviews mit `@meta json`/`@meta dsl`, einzeln oder zusammen
  mit Diagrammen als SVG exportierbar; Architektur-Kurzform und JSON-Syntax.
  Zeilennummern, Einrückung, visueller Umbruch, Themes und keine rekursive
  Expansion. [META.md](META.md).

- Meta-View für DSL-/JSON-Quellübersetzung mit Kopie/Download, markierten
  Fehlerstellen und Korrekturkandidaten. Typkandidaten aus dem geladenen Profil,
  Tippfehlerhilfe und API `translate`/`inspectSource`. [META.md](META.md).

- Äquivalente Architektur-JSON-Eingabe mit `architecture`-Hülle, originalen
  View-/Routing-Schlüsseln, verschachtelten Elementen, Inline-Profilen und
  ID-Listen. Gemeinsame Grammatik/Validierung und JSON-Pfad-Diagnosen; in API,
  Editor, Markdown und DOM-Rendering verfügbar. [JSON.md](JSON.md).

- Renderauswahl über `config { views all }`, eine View-ID oder geordnete
  ID-Liste; passende API-Optionen und Dropdown-Auswahl. Mehrere Views erscheinen
  mit Überschriften in einem gemeinsamen SVG, einschließlich Spezialrenderern,
  Themes, eigenständigem Download und eindeutigen Marker-/Icon-IDs.

- Node-Styles mit `iconPosition top|left|bottom|right` sowie unabhängigen
  Sichtbarkeitsschaltern für Icon, Titel, Stereotyp, Beschreibung und Technologie.
  Package-Köpfe, Logo-Modus und Referenzkarten berücksichtigt. Fachliche
  Relationslabels besitzen getrennte Schalter `showIcon` und `showLabel`.

- `label none` für fachliche Kanten, lokal oder als Routing-Vorgabe. Blendet
  Text, Rahmen und Icon aus; konkrete Labelpositionen überschreiben die Vorgabe.
  Modelltexte, Tooltips und grafische Referenzen bleiben erhalten.

- Icons an Connected-Relationslabels über `route`/`routes` mit `icon` und
  `iconPosition top|left|bottom|right`; lokale Overrides, `icon none`,
  Seitenverhältnis, Farben, mehrzeilige Labels und Exportgrenzen berücksichtigt.

- Viewweite Routing-Vorgaben über `routes { ... }` für Kanten und
  Zuordnungspfeile. Konkrete `route`-Eigenschaften haben feldweise Vorrang;
  die Validierung prüft die zusammengeführten Kurven/Kontrollpunkte.

- Eigene Routen für Zuordnungspfeile: `route ELEMENT -> RELATION`
  mit Kartenport, Ankerposition entlang des Relationspfads, Wegpunkten,
  Kurven und freiem SVG-Pfad. Für gemeinsame und getrennte Referenzkarten.

- Viewlokale Schrift- und Mindestgrößen mit `fontSize`, `width`, `height` in
  Connected-Styles; skalierte Textgeometrie und einzeilige Typ-/Stereotypzeilen
  mit Auslassungspunkten und vollständigem Tooltip. Beispiele für NAF-Cluster
  sowie Datenübergabe durch einen Walker ergänzt.

- Grafische Referenzkarten an Connected-Kanten: gemeinsame Karte je Element
  als Standard, optional `referenceOccurrences perEdge` mit sichtbaren IDs.
  Unterstützung von Pfeilankern auf Kurven und View-`referenceDisplay nodes|labels|both`.
  Viewlokale Logo-Rechtecke über `style ID {display logo icon PACK.NAME}`;
  ursprüngliche Templates und zugängliche Modellinformationen bleiben erhalten.

- Separates `naf41-uaf` mit allen 47 aktuellen NAFv4.1-Viewpoint-IDs,
  strukturellen Pflicht-/Verknüpfungs-/Referenzprüfungen und englischer Hilfe.
  Versions-/Quellenbindung auf NATO 2026.03; ADMBw 2026.05 als Vergleichsquelle.
  Explizite Anwendungsadapter und verbleibende Prüfgrenzen sind unter
  [profiles/naf41/COVERAGE.md](profiles/naf41/COVERAGE.md) dokumentiert.

- Eingebaute `@help`-Referenz als eigenständiger Block oder Direktive innerhalb
  von `architecture`, mit registrierten Profilen/Iconpacks, Regeln, Suche/Seiten
  und SVG-/Textausgabe. Befehle: [HELP.md](HELP.md).
- Englischsprachige Bibliothekstexte und Diagnosen. Abstrakte Knoten-/Relationstypen
  erhalten generisch ermittelte konkrete Untertypen in Fehlermeldungen und Hilfe.
- `@help connections PROFILE TYPE` zeigt gerichtete Relationsmöglichkeiten je
  Knotentyp mit konkreten Gegenstellen, geerbten Endpunktregeln und Ausschlüssen.

- Direkte Iconify-Registrierung über die bestehende API, inklusive fester Farben,
  Gradienten/Masken/Filtern, Alias-Transformationen und isolierten lokalen IDs.

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
| Hoch | Hindernisvermeidende Führung allgemeiner Modellkanten | Automatische Modellkanten umgehen sichtbare Knoten und Package-Titel; bisher besteht nur eine gesonderte Heuristik für Referenzpfeile. |
| Hoch | Weniger Kantenkreuzungen, Ports und Labelkollisionen | Größere Architekturansichten bleiben ohne manuelle Wegpunkte lesbar. |
| Hoch | Layout-Strategien pro Package und Ansicht | Raster-, Baum- und Layer-Layouts gezielt kombinieren. |
| Mittel | Pan, Elementfokus und Suche zusätzlich zum vorhandenen Zoom/Fit | Größere Modelle bequem erkunden, navigieren und durchsuchen. |
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
- Die strukturelle NAFv4.1-Abdeckung um vollständige spezialisierte Semantik
  ergänzen: Zustands-/Sequenzkonsistenz, genaue Protokollabgleiche, Produkt-/
  Versionskonsistenz und kontrollierte Textkriterien. Quellenkriterien einzeln
  prüfen; ein vorhandener Viewpointname bescheinigt keine normative Vollständigkeit.
- UAF 1.3 als separates, versioniertes Profil prüfen und Migration anbieten;
  bestehende UAF-1.0-Modelle und das darauf basierende NAFv4.1-Anwendungsprofil
  reproduzierbar erhalten.
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
