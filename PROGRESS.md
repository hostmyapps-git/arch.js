# Umsetzungsfortschritt

## Abstrakte physische Ressourcen (22.11.2026)

- `naf41-uaf@4.1.0-arch.34` verwendet `PhysicalActiveResource` als abstrakten
  Alias von `ResourcePerformer`. S2 verwendet `System` und L4
  `EquipmentType` für die konkreten Ressourcen. Die Karten zeigen die
  NAF-Kategorie über `stereotype`.
- Die Browser-Profile registrieren auch die eingefrorene Revision
  `4.1.0-arch.33`. Die Tests prüfen die konkrete Altdeklaration mit
  Versionsbindung, den abstrakten Typ mit Kandidatenhilfe und die migrierte
  S2-Deklaration.

## NAFv4.1-Abgleich und Hilfe-Navigation (21.11.2026)

- Scope, Cut-outs und Darstellungsformen aller 47 Viewpoints mit
  `naf41-uaf@4.1.0-arch.33` abgeglichen. Objektifizierte logische und physische
  Interaktionen, Ressourcenflüsse, Zustandswechsel und Foundation-Beziehungen
  ergänzt. Die ausführbaren Beispielmodelle reichen bis Pr und Ar.
- Die Renderer `table`, `sankey` und `nafgrid` ergänzen die vorhandenen
  Diagramme. Matrix und dichte P-Beispiele überarbeitet. Die
  [Coverage-Übersicht](profiles/naf41/COVERAGE.md) führt Renderoptionen und
  verbleibende Notationsgrenzen auf.
- Anklickbare `@help`-Einstiegsseite, Querverweise, lexikographische
  Kataloge und Verlauf ergänzt. `@meta` färbt Quelltext und hebt Diagnoseorte
  und Korrekturkandidaten im Studio hervor.

## Architektur- und Performanceprüfung (19.11.2026)

- Verarbeitung in Lexer, Modellvalidierung, Profilregeln und Layout getrennt.
  View-Projektionen und Ausdruckspläne werden pro Aufruf wiederverwendet.
  `renderDiagram()` liefert dem Editor Geometrie und SVG aus einem Durchlauf.
- Beziehungskompatibilität, Viewpoint-Regeln, Rangbildung, Textumbruch und
  Spezialdiagramme beschleunigt. Die Platzierung bei kleinem `spacing`
  terminiert auch bei dicht gestapelten oder fest platzierten Karten.
- [ARCHITECTURE.md](ARCHITECTURE.md) dokumentiert Modulgrenzen,
  Datenverantwortung, Algorithmen und Ergebnisse. `scripts/benchmark.mjs`
  reproduziert die Laufzeitmessungen. 274 SVG-Vergleiche mit dem vorherigen
  Quellstand ergaben identische Ausgaben.

## L2-Needlines und Objektifizierung (19.11.2026)

- Profilrevision `4.1.0-arch.21`: gerichtete `Needline`-Kanten zwischen Nodes
  ergänzt, mit optionalem typisiertem `needline`-Verweis auf ein gleichnamiges
  Modellelement. Der bestehende Referenzrenderer zeichnet die separat routbare
  „is equal to“-Zuordnung. `ConveysLogicalResource` modelliert die explizite
  Beziehung vom Needline-Objekt zur logischen Payload.
- L2 verlangt eine Needline-Kante oder eine gültige Legacy-Form. Objektkarten
  sind optional; vollständige `source`-/`target`-Referenzen bleiben unterstützt,
  ohne implizite Modellkanten zu erzeugen. Bekannte Payloads und conveys-Kanten
  dürfen entsprechend may show ausgeblendet werden; Typprüfungen bleiben aktiv.
- Generische JSON-Viewpoint-Regel `objectifications` prüft eindeutige Bindung,
  Endpunktkonsistenz und Legacy-Alternativen. Verwaiste Objekte, unvollständige
  Paare, falsche Referenz-/Endpunkttypen und doppelte Bindungen werden geprüft.
  S5/S6 behalten ihre bisherigen Prüfregeln. Legacy-Endpunkte folgen den
  Typ-/Paar-/Selbstkantenregeln der Beziehung; ausgewählte Objekte benötigen
  ausgewählte Bindung oder sichtbare Legacy-Endpunkte.
- Vollständiges Beispiel S.129 mit vier Nodes/sechs Kanten und Cut-out mit
  objektifizierter, kompakter und Payload-ausgeblendeter View als Demos ergänzt.
  Hilfe, Profilanleitung, SPEC, HELP, DIAGRAMS, Coverage und GAPS aktualisiert.
- Build, alle **395 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  JSON/Bundles, Legacy-Beispiele, Referenzrouting, Draft-Hinweise, optionale
  Karten/Payloads und beide Themes geprüft; Screenshots
  `test-results/naf41-l2-{example,objectified}-{light,dark}.png` visuell geprüft.

## Kompakte Tree-Ebenen (19.11.2026)

- Tree-Layout packt belegte Querintervalle je Tiefe statt vollständiger
  rechteckiger Unterbaumbreiten. Flache Geschwister und einzelne Wurzeln nutzen
  freien Platz über/neben breiten Nachkommen. Karten und automatische Labels
  behalten ihren Mindestabstand; gemeinsam belegte Ebenen begrenzen die
  Verdichtung. Reihenfolge und Zentrierung über erstem/letztem Kind bleiben.
- Gilt automatisch für ganze Trees und benannte Gruppen, vier Richtungen,
  variable Kartenmaße und Wälder; keine neue Option nötig. Berechnung bleibt
  iterativ, verarbeitete Kindkonturen werden freigegeben. Bestehende manuelle
  Routen/Labelpositionen bleiben nachgelagerte Overrides.
- Demo `examples/compact-tree.arch`, Hilfe, SPEC und DIAGRAMS ergänzt.
  Tests prüfen konkret den freien Platz neben Waterborne Rescue, konkurrierende
  tiefe Unterbäume, variable Karten/Labels/Icons, deterministische asymmetrische
  Wälder, Gruppierung, geteilte Pfade, JSON und beide Bundles.
- Build, alle **387 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Echte SVG-Karten-/Labelgrenzen in beiden Themes auf Überschneidungen geprüft;
  Screenshots `test-results/compact-tree-*.png` visuell kontrolliert.

## Gemeinsame Pfade in Trees (19.11.2026)

- `sharePath none|stereotypes|all` in ganzen `diagram tree`-Views und benannten
  `tree`-Gruppen ergänzt. Default bleibt none. Ganze Trees verwenden dieselbe
  Bündelungslogik wie Connected; Typ-/Stilkompatibilität, freie Korridore und
  ausreichender Labelplatz bleiben Voraussetzung. Geteilte Junctions bleiben
  rechtwinklig, einzelne semantische Kanten und Labels bleiben erhalten.
- In benannten Gruppen gilt Einzelroute vor Gruppenoption vor View-`routes`.
  Die Gruppeneinstellung gilt für ihre internen Hierarchiekanten. Bündelung
  erfolgt nach Platzierung und individuellen Routen; manuelle Geometrie und
  externe Kanten behalten das bestehende Verhalten. Keine Änderung der
  Hierarchiesemantik oder Freigabe manueller Routen in ganzen Tree-Views.
- Vergleichsdemo `examples/tree-shared-paths.arch`, Hilfe, SPEC, DIAGRAMS,
  HELP, JSON und Browserbundles aktualisiert. Tests prüfen beide Tree-Formen,
  alle vier Richtungen, Pfeilmarker, Modi, Typ-/Stilgrenzen, Rangfolge, negative
  Gruppenpositionen, externe Kanten, JSON, unveränderten Input und Bundles.
- Build, alle **382 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Light-/Dark-Screenshots `test-results/tree-shared-paths-*.png` visuell geprüft.

## Einheitliche Listenschreibweisen (19.11.2026)

- `include`, `exclude`, Tree-`nodes` und `propertyFields` akzeptieren Namen
  mit oder ohne eckige Klammern. Kommas bleiben zwischen Einträgen nötig;
  einzelne Namen werden ebenfalls zu Arrays. `propertyFields` unterstützt
  beide Formen auf View-, Diagramm- und Node-Style-Ebene.
- `[]` bezeichnet ausdrücklich eine leere Liste: include wählt nichts,
  exclude entfernt nichts und propertyFields leert die Auswahl. Leere
  Tree-Mitgliedschaft bleibt ungültig. Zitierte Tree-/Property-Namen bleiben
  kompatibel, andere Listenoptionen behalten ihre bisherige Grammatik.
- Leere include/exclude-Arrays auch in der JSON-Quelle und Übersetzung
  unterstützt. Laufzeithilfe, SPEC, HELP, JSON-Dokumentation und Bundles aktualisiert.
- Build, alle **377 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Regressionstests prüfen 64 Formkombinationen, Einzel-/Leerfälle, fehlerhafte
  Listen, Quellpositionen, JSON/DSL/Meta und beide Browserbundles/Themes.

## L1-Taxonomie und logische Ressourcen (19.11.2026)

- Profilrevision `4.1.0-arch.20`: `LogicalActor` und `LogicalEquipment` als
  unterscheidbare konkrete Anwendungstypen unter `OperationalPerformer` ergänzt,
  einschließlich Quellen, Mapping-Metadaten und englischer Laufzeithilfe.
- L1 verlangt einen logischen Node, aber keine künstliche Activity oder direkte
  Performer-Zuordnung an jedem Gliederungs-/Spezialisierungsknoten. Angezeigte
  aktive Ressourcen brauchen eine Node-Gruppierung direkt oder über sichtbare
  Generalisierungs-Vorfahren; Activities und optionale passive Ressourcen eine
  direkte Zuordnung. Relevanz und vollständiger fachlicher Umfang bleiben
  Prüfaufgaben. Native UAF-Regeln und bestehende Typnamen bleiben erhalten.
- Vollständiges Beispiel von S.127 mit 12 Nodes und 11 Kanten als editierbare
  Demo ergänzt. Tests decken Pflichtgruppierungen, optionale Inhalte, alte
  Typnamen, Spezialisierungen, unsichtbare Vorfahren, Zyklen, JSON und Bundles ab.
  Build, alle **372 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Light-/Dark-Screenshots `test-results/naf41-l1-*.png` visuell geprüft.

## S8-ServicePolicy-Zuordnung (19.11.2026)

- Profilrevision `4.1.0-arch.19` erlaubt `SatisfiesServicePolicy` auch in S8,
  entsprechend Service → ServicePolicy im Cut-out und Beispiel auf S.121–122.
  Die vorhandene inverse Relation bleibt kompatibel. Service-Kontext bleibt
  optional; die Pflichtgruppierung Policy → ServiceConstraint bleibt erhalten.
- Regressionstests prüfen explizite View-Auswahl, beide Richtungsvarianten,
  falsche Endpunkte, fehlende Gruppierung sowie JSON- und Browserbundle-Parität.
  Build, alle **367 Node-Testgruppen** und vollständige Chromium-Suite bestanden.

## Sichtbare Mapping-Prüfung und may/shall (19.11.2026)

- Profilrevision `4.1.0-arch.18`: S3 darf Ressourcenabbildungen ausblenden;
  S7 verlangt Sichtbarkeit bekannter relevanter Kanten/Referenzziele. Die
  bisherige pauschale Mindestkardinalität je Ressourcenparameter entfällt.
  Fehlende Modellzuordnungen bleiben nicht blockierende Prüfaufgaben.
- Generisches `connections[].visibility` may/shall ergänzt. Bekannte, durch
  exclude oder display none versteckte Pflichtabbildungen liefern
  ARCH_MAPPING_HIDDEN (Strict-Fehler, Draft-Warnung). Keine Modellzuordnung:
  ARCH_MAPPING_REVIEW, valid true und reviewRequired true ohne allein daraus
  abgeleitetes conformant false. Eigentümer-/Typprüfungen bleiben unverändert.
- Connected/Tree zeigen ? bzw. ! neben betroffenen Karten; Tooltip, zugängliche
  Beschriftung und Footer erklären die Stelle. Andere Renderer behalten den
  Footer. Keine zusätzlichen Modellkanten oder Platzhalterressourcen erzeugt.
- `config {showValidation false}` bzw. API `{showValidation:false}` entfernt
  Marker und Footer gemeinsam. Diagnosen und Strict-Prüfung bleiben aktiv.
  Sichtbarkeit eingefrorener Kanten bleibt auch bei embed von S3 nach S7 erhalten.
- Hilfe, Dokumentation, Coverage und Demo aktualisiert. Build, alle
  **365 Node-Testgruppen** und vollständige Chromium-Suite bestanden. SVG,
  JSON, Mehrfachviews, Einbettungen, Exportoption und beide Themes geprüft;
  Screenshot `test-results/mapping-review-light.png` visuell kontrolliert.

## Berechenbare Labelabstände (19.11.2026)

- `label FRACTION offset EXPR` akzeptiert jetzt arithmetische Ausdrücke wie
  `source.width / 2` oder `-(target.height + 20)` mit den sichtbaren finalen
  Geometrieankern von via. Der Ergebniswert ist weiterhin ein Abstand entlang
  der Route; Vorzeichen, Endpunktbegrenzung und Verhalten bei Länge null bleiben.
- JSON-offset unterstützt Ausdrucksstrings; DSL/JSON/Meta erhalten diese.
  Unbekannte/unsichtbare Anker, ungültige Rechnungen und Ergebnisüberschreitungen
  werden geprüft. Explizite SVG-Pfade unterdrücken die Offsetberechnung nicht.
- Laufzeithilfe, Dokumentation, Demo und Bundles aktualisiert. Build, alle
  **358 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Browservergleich mit tatsächlicher Pfadlänge und visueller Kontrolle des
  Beispiels `test-results/label-positions-light.png` abgeschlossen.

## Berechnete Routenlabels und Pfadabstände (19.11.2026)

- `label (EXPR,EXPR)` unterstützt dieselbe begrenzte Arithmetik wie place/via,
  inklusive finaler Node-, Paket-, Tree- und Embed-Geometrie. Labelkoordinaten
  werden auch bei explizitem SVG-path ausgewertet. Sichtbare Referenzkarten,
  die als Anker dienen, bleiben kanonisch.
- `label FRACTION` setzt den Mittelpunkt entlang des vollständigen logischen
  Pfads. Dezimalwerte 0–1 und Brüche sind erlaubt; Wegpunkte, Kurven,
  Selbstschleifen und gemeinsame Pfade werden berücksichtigt. Kurven verwenden
  die vorhandene Pfadabtastung.
- `label FRACTION offset NUMBER` ergänzt einen festen Abstand in SVG-Einheiten,
  positiv zum Pfadende und negativ zum Anfang. Ergebnisse werden auf die
  Endpunkte begrenzt. Bei Länge null bleibt der Pfadpunkt unverändert.
  Diese Formen sind explizite Positionen ohne automatischen Seitenversatz.
- JSON unterstützt Ausdruckspaare, numerische Anteile/Bruchstrings und
  `{position,offset}`. DSL/JSON/Meta erhalten Ausdrücke und Abstände;
  lokale Angaben ersetzen geerbte Labelpositionen vollständig.
- Hilfe, Dokumentation, Demo und beide Bundles aktualisiert. Build, alle
  **356 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Browser-Pfadlängen, Rundläufe, Sichtbarkeit, Fehlerfälle und feste Abstände
  geprüft; Screenshot `test-results/label-positions-light.png` visuell geprüft.

## Zeichenfläche ohne unbenutzten Ursprung (19.11.2026)

- Connected-SVG-Grenzen umfassen den gezeichneten Inhalt mit Rand statt immer
  zusätzlich `(0,0)`. Dadurch bleibt nach einer geerbten Platzierungsänderung
  kein leerer Bereich bis zur früheren Position bestehen. Modellkoordinaten,
  relative Referenzen und Routing bleiben unverändert.
- Sichtbare Einbettungsrahmen zählen ausdrücklich zu den Grenzen; leere Views
  behalten endliche Standardmaße. Positive/negative Verschiebungen und die
  gemeldete S3-Erweiterung sind als Regression abgedeckt.
- Build, alle **347 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Screenshot `test-results/s3-extended-fit.png` visuell geprüft.

## S7: logische Funktionsparameter und Informationsprodukte (19.11.2026)

- Profilrevision `4.1.0-arch.17` ergänzt `InvolvesLogicalResource` von
  ServiceFunctionParameter zu OperationalExchangeItem, einschließlich
  InformationProduct/InformationElement. Physische Produkte und aktive Typen
  bleiben als Ziele dieser Beziehung ausgeschlossen.
- `HasServiceFunctionParameter` und S7-Servicekontext über EnablesService
  ergänzt. S7 verlangt für jeden Funktionsparameter sichtbare Funktions- und
  Nutzdatenzuordnungen über Links oder owner/resource-Referenzen. Die Attribute
  sind global optional; alte physische resource-Referenzen bleiben kompatibel.
- Beide S7-Zweige als Beispiel mit erweitertem/eingebettetem S3 verfügbar;
  für den in der Druckvorlage nicht zugeordneten Resource-Operationsparameter
  wird eine explizite Ressourcenreferenz ergänzt. Kein zusätzlicher nativer
  UAF-Typ oder ungesichertes Alias eingeführt; logische Ziele verwenden die
  bestehende OperationalExchangeItem-Kategorie.
- 294 semantische Knotentypen, drei Aliase, 167 Relationen, 47 Viewpoints.
  Hilfe, Dokumentation, Coverage, Demo und Profilskripte aktualisiert.
- Build, alle **345 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Richtung, Zieltypen, fehlende/unsichtbare Zuordnungen, Draft, Kompatibilität,
  S3-Wiederverwendung, JSON und beide Bundles/Themes geprüft. S7-Screenshot
  `test-results/naf41-s7-light.png` visuell geprüft.

## View-Wiederverwendung: extends und embed (19.11.2026)

- `extends VIEW` übernimmt Auswahl und Darstellung; lokale Includes/Excludes,
  feldweise Styles/Routen und vollständige Platzierungs-Overrides werden vor
  Validierung aufgelöst. Die Quellviews und das Modell bleiben unverändert.
- `embed VIEW [as GROUP] [{frame true}]` erhält das interne Layout einer
  Connected-/Tree-View in einer Connected-View. Gruppen können verschoben und
  als Koordinatenanker verwendet werden; äußere Kanten docken an internen Nodes
  an. Verschachtelung und geerbte Einbettungen sind unterstützt.
- Einmalige Darstellung, Konflikt-/Zyklendiagnosen, eingefrorene interne
  Darstellung, separate Quell-/Ziel-Viewpoint-Prüfung und erhaltene Referenzkarten
  ergänzt. Geteilte Quellpfade werden als vollständige logische Kanten gezeichnet.
- JSON/DSL/Meta, Laufzeithilfe, Dokumentation und zwei Demo-Beispiele ergänzt.
  NAF-Beispiel zeigt den Operationsparameter-Zweig von S7, keine vollständige
  Umsetzung der noch fehlenden logischen Funktionsparameter-Beziehungen.
- Build, alle **341 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Vererbung, Einbettung, verschachtelte Gruppen, Pakete, gemeinsame Referenzkarten,
  äußere Routen, JSON, beide Bundles und Themes geprüft. Screenshot
  `test-results/view-reuse-light.png` visuell geprüft.

## Abstand zwischen Relations- und Zuordnungslabels (18.11.2026)

- Automatische Relationslabels mit grafischen Referenzen prüfen nach dem
  Routing der Zuordnungspfeile beide Seiten der Verbindung. Karten, andere
  Labels und Zuordnungspfeile gehen in die lokale Konfliktbewertung ein.
- In der positionierten S6-View liegt Acknowledge jetzt über der Rückkante,
  während is equal to darunter bleibt. Request Sortie bleibt unter seiner
  Verbindung. Manuelle Labelkoordinaten werden unverändert übernommen.
- S6-Regression und Chromium-Prüfung sichern den Abstand; Hilfe ergänzt.
  Die Auswahl zwischen zwei Seiten bleibt eine lokale Heuristik.
- Build, alle **333 Node-Testgruppen** und vollständige Chromium-Suite
  bestanden; horizontale/vertikale Zuordnungen auf beiden Seiten, JSON und
  feste Labelpositionen geprüft. Aktualisierten S6-Screenshot visuell geprüft.

## Gerade Gegenkanten in positionierter S6-View (18.11.2026)

- Fehler behoben: Der Parallelkantenversatz fügte auch bei `curve straight`
  einen Knick ein. Ohne `via` verbindet straight unterschiedliche Nodes jetzt
  direkt an den gewählten Ports, auch bei parallelen/gegenläufigen Relationen.
  Explizite Wegpunkte und Selbstschleifen behalten ihr Verhalten.
- Die gemeldete S6-View mit berechneten Lifeline-Höhen und Ports 0.4/0.6 ist
  als `examples/naf41-service-sequence-placed.arch` mit dem vorhandenen
  S6-Beispielmodell reproduziert und in die Demo aufgenommen.
- Generische und S6-spezifische Regressionstests sowie Chromium-Checks für
  beide Themes und JSON-Parität ergänzt; Routinghilfe aktualisiert.
- Build, alle **332 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  S6-Screenshot `test-results/s6-placed-light.png` visuell geprüft; `s6.8`
  besitzt genau zwei Endpunkte und verläuft horizontal zwischen den 0.6-Ports.

## Berechnete Node-Styles (18.11.2026)

- `width`, `height` und `fontSize` unterstützen Zahlen oder arithmetische
  Ausdrücke mit `+`, `-`, `*`, `/`, Vorzeichen und Klammern in Connected/Tree.
  JSON verwendet Ausdrucksstrings; DSL/JSON/Meta erhalten die Referenzen.
- `ID.width/height` liefern gemessene Kartenmaße einschließlich Inhalt,
  `ID.fontSize` die effektive Titelschrift. `ID.style.FIELD` verlangt den
  expliziten View-Wert; eine konfigurierte Höhe bleibt eine Mindesthöhe.
- Generischer Abhängigkeitsgraph löst Vorwärtsreferenzen vor Textumbruch,
  Positionierung und Routing auf. Zyklen einschließlich intrinsischer
  Höhenabhängigkeiten, fehlende/unsichtbare Referenzen, Division durch null
  und ungültige Werte werden abgewiesen. Kein JavaScript-eval.
- Finale Paket-/Tree-Gruppenmaße bleiben ausgeschlossen, weil sie erst später
  entstehen; explizite Paket-Styles sind referenzierbar. Andere Renderer und
  Routenstyles behalten ihre bisherigen Grenzen. IDs mit Punkten/Bindestrichen
  bleiben erhalten, auch bei mehrdeutiger kompakter Subtraktion.
- Laufzeithilfe, README/SPEC/HELP/JSON/DIAGRAMS, Demo **Calculated node styles**,
  beide Bundles und acht zusätzliche Node-Testgruppen ergänzt.
- Build, alle **330 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Gemessene/explizite Größen, Schrift, Platzierung, Textgrenzen, JSON und
  Zirkelbezüge geprüft. Screenshot `test-results/style-expressions-dark.png`
  visuell kontrolliert; Demo-Verbindung verläuft außerhalb der Karten.

## S6: objektifizierte Nachrichten und Sequence-Kontext (18.11.2026)

- Profilrevision `4.1.0-arch.16` ergänzt ServiceInteraction als Element neben
  der bestehenden Nachricht. Das interaction-Attribut bindet genau ein
  ausgewähltes Element an eine ausgewählte Lifeline-Nachricht in S6.
  RepresentsService, TriggersServiceInteraction und InteractionRelatesOperation
  ergänzen den Cut-out; EnablesService ist ebenfalls zugelassen.
- ServiceLifeline bleibt eine Service-Zeitlinie, keine objektifizierte Nachricht.
  Die represents-Referenz wird global optional; S6 verlangt genau eine
  ausgewählte Servicezuordnung über Link oder Referenz. Alte kompakte Nachrichten
  mit order/event/operation und Lifelines mit represents bleiben gültig.
- Generisches sequenceMessage-Profilmetadatum trennt Nachrichten von Kontext.
  Der Sequence-Renderer zeichnet Objektkarten mit beschrifteter Zuordnung,
  optionalen Kontextkarten/-beziehungen (showContext) und prüfbarer Sortierung
  (orderAttribute). Ohne Sortieroption bleibt die Listen-/Deklarationsreihenfolge.
  Rückgabe-, asynchrone und Selbstnachrichten bleiben verfügbar; ausgeblendete
  Nachrichten lassen Kontextkanten nicht zu Nachrichten werden.
- Beispiel S.118 und vollständiger Cut-out jeweils als Sequence und Connected
  verfügbar. Keine Ausführung/Zeitsemantik/UML-Fragmente oder globale
  Kreuzungsoptimierung; Sequence-Layout bleibt automatisch.
- 294 semantische Knotentypen, drei Aliase, 165 Relationen und 47 Viewpoints.
  Profilhilfe, Dokumentation, Coverage, Demo und Bundles aktualisiert.
- PDF-Bestandsaufnahme weiterer L/P-Objektifizierungen und fehlender Namen in
  [profiles/naf41/GAPS.md](profiles/naf41/GAPS.md) dokumentiert. Dafür wurden
  keine weiteren L/P-Profiltypen implementiert.
- Build, alle **322 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Die Sequence-/Connected-Beispiele und beide Themes wurden geprüft; die
  Kontextzuordnung zur Operation läuft außerhalb der Kontextkarten.

## S5: objektifizierte Transitionen und vollständiger Cut-out (18.11.2026)

- Profilrevision `4.1.0-arch.15` ergänzt ServiceStateTransition als Elementtyp
  neben dem gleichnamigen Relationstyp. Ein typisiertes transition-Attribut
  bindet das Element an die State-to-State-Kante; die Endpunkte stehen an der
  Kante. Vorhandene kompakte Übergangskanten mit optionalem event bleiben gültig.
- Referenzkarten zeigen eine routbare, mit is equal to beschriftete Zuordnung.
  Generisches Profilfeld referenceConnectorLabels aktiviert die Beschriftung
  aus referenceLabels; Zeilenumbruch, Escaping und SVG-Exportgrenzen sind
  berücksichtigt. Routen behalten die vorhandene NODE_ID -> EDGE_ID-Syntax.
- HasServiceState, TriggersServiceStateTransition, StateEnablesServiceFunction,
  HasServiceMode, GroupsServiceState und AggregatesServiceStateGroup bilden
  gemeinsam mit EnablesService die Beziehungen des Cut-outs auf S.114 ab.
  Gruppen können gemeinsame Untergruppen haben, aber keine Zyklen/Selbstkanten;
  echte Zustandsübergänge dürfen weiterhin Selbstkanten sein.
- ServiceState.owner und ServiceMode.function sind global optional geworden;
  S5 prüft die Zuordnung über genau eine ausgewählte explizite Beziehung oder
  ausgewählte Legacy-Referenz. Derselbe Link plus dieselbe Referenz wird nicht
  doppelt gezählt; widersprüchliche Owner/Function-Zuordnungen fallen auf.
- Generische connections[].referencedByAttributes-Regeln zählen referenzierende
  ausgewählte Kanten, jede einmal. S5 verlangt genau eine solche Bindung je
  ausgewähltem Transitionselement. Fehlende Bindungen sind im Draft Hinweise;
  falsche Typen und Mehrfachbindungen bleiben Fehler. Keine impliziten Kanten.
- Vollständiges Beispiel S.115 (fünf Elemente/vier Modellkanten plus Zuordnung)
  und erweiterter Cut-out (neun Elemente/zehn Kanten plus Zuordnung) als Dateien
  und Demo-Einträge ergänzt. Hilfe, Profilschema, Migration, Versionsbeispiele,
  Coverage und Bundles aktualisiert: 293 semantische Knotentypen, drei Aliase,
  162 Relationen und 47 Viewpoints.
- Grenzen bleiben ausdrücklich dokumentiert: keine Ausführung/Guards,
  Erreichbarkeitsprüfung, Gleichheit der Services an beiden Zustandsendpunkten
  oder Konsistenzprüfung zwischen gleichzeitiger event-Referenz und Triggerlinks.
  Die Objektifizierung ist eine Connected-Darstellung; andere Spezialrenderer
  erhalten dadurch keine Unterstützung für Objekt-zu-Kante-Zuordnungen.
- Build, alle **317 Node-Testgruppen** und die vollständige Chromium-Suite
  bestanden. Die Beispiele wurden in beiden Themes geprüft; nach der
  Sichtprüfung sind Zuordnungslinien mittig und Beschriftungen ohne Überlagerung
  durch benachbarte Linien angeordnet.

## S4: vollständiges Beispiel und Cut-out-Beziehungen (18.11.2026)

- Profilrevision `4.1.0-arch.14` unterstützt das Beispiel auf S.112 mit exakt
  fünf Elementen und vier Relationen sowie alle neun gerichteten Muster des
  Cut-outs auf S.111. Neue Beispiele und Demo-Einträge: Service Functions und
  S4 Cut-out; die rekursive Typbeziehung wird als Whole/Member-Verbindung
  zwischen unterschiedlichen Funktionen modelliert, nicht als Selbstkante.
- ServiceFunctionAggregation bildet azyklische, auch gemeinsam genutzte
  Teilfunktionen ab. EnablesService ist in S4 zugelassen; die bestehende inverse
  UAF-Allokation IsCapableToPerform bleibt unverändert gültig.
- ServiceProvider/ServiceConsumer sind explizite konkrete Kontextrollen auf
  UAFElement-Basis mit optionaler represents-Referenz. ProvidesService,
  NotifiesServiceProvider, AccessesServiceFunction, SupportsServiceFunction,
  EnablesOperationalActivity und PerformsOperationalActivity ergänzen den
  Cut-out. ConsumesService akzeptiert zusätzlich ServiceConsumer. Native
  UAF- und ADMBw-Definitionen werden nicht ersetzt oder semantisch umgedeutet.
- Generische connections[].through-Regeln ermöglichen direkte oder transitive
  Nachweise über ausgewählte Kanten. S4 prüft Serviceabdeckung über aggregierende
  Vorfahren; Teilfunktionen benötigen keine redundanten Servicekanten. Isolierte
  Funktionen, ausgeschlossene notwendige Vorfahren, falsche Endpunkte, Zyklen
  und Selbstkanten bleiben Fehler. Draft meldet fehlende Abdeckung als Hinweis.
- Die Definitionen sind strukturelle Anwendungsprojektionen. Keine exklusive
  UML-Ownership, Ausführung, impliziten Modellkanten oder automatische Erkennung
  von nicht modellierten Funktionen. Optionale Rollen-/Aktivitätskanten werden
  nicht universell erzwungen. S2-spezifische weitere Rollenzuordnungen bleiben
  separat zu untersuchen.
- 291 semantische Knotentypen, drei Knotenaliase, 156 Relationen, 47 Viewpoints.
  Profilhilfe, Schema-Dokumentation, Mappings, Coverage und Builds aktualisiert.
  Build, alle **312 Node-Testgruppen** und vollständige Chromium-Suite bestanden;
  Beispiele in beiden Themes geprüft, SVG-Darstellung visuell kontrolliert.

## Relative Andockpositionen und Brüche (17.11.2026)

- Connected-Routen unterstützen `from bottom 1/2 to left 0.25` für alle vier
  festen Seiten. `top`/`bottom` zählen links → rechts, `left`/`right` oben → unten.
  Standard bleibt die Seitenmitte; Endpunkte folgen den endgültigen Knotenmaßen
  und Positionen, auch bei Packages und Kanten in benannten Tree-Gruppen.
- Zuordnungslinien unterstützen positionierte Ausgangsports und Brüche für
  ihre Zielposition entlang des Relationspfads (`from right 1/4 to 1/2`).
  `routes`-Vorgaben gelten entsprechend, konkrete Endpunkte ersetzen die gesamte
  Seiten-/Positionsangabe. Freie SVG-Pfade behalten Vorrang. Explizit
  positionierte Ports bleiben von automatischem sharePath-Bündeln ausgenommen.
- Dezimalzahlen und einfache Brüche mit optionalen Leerzeichen werden im Bereich
  0–1 validiert; Division durch null und ungültige Seiten werden mit englischen
  Diagnosen und Korrekturvorschlag zurückgewiesen. JSON nutzt `{side, position}`;
  Brüche sind dort Strings und werden im internen Modell/Meta-Export numerisch
  normalisiert. Bestehende Seitenports und absolute Koordinaten bleiben nutzbar.
- Hilfe, SPEC, README, JSON-Dokumentation und S3-Beispiel ergänzt. Die beiden
  has-Kanten am Geographic-Location-Knoten docken nun getrennt bei 1/4 und 3/4
  an; helle und dunkle Darstellung visuell geprüft.
- Build, alle **308 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
  Neue Prüfungen decken sämtliche Seitenkombinationen/Kurvenarten, Eckpunkte,
  Brüche, Zuordnungslinien, Vorgaben, Container/Tree-Gruppen, Fehlerfälle,
  JSON/DSL, beide Browserbundles und tatsächliche SVG-Endpunktkoordinaten ab.

## S3: Operationen, gemeinsame Parameter und Datenprodukttypen (17.11.2026)

- S.109–110 vollständig gelesen und visuell geprüft. ServiceOperation als
  Vokabularalias von UAF ServiceMethod (UML Operation) ergänzt. DataProductType
  spezialisiert DataElement und PhysicalPassiveResource. Position Report und
  Target Track Record sind benannte Modellelemente dieses Typs; die Abbildung
  zeigt keine Laufzeitinstanz eines konkreten Berichts.
- HasServiceOperationParameter bildet Operation → konzeptionellen Parameter,
  InvolvesPhysicalResource Parameter → physische passive Ressource ab. Gemeinsame
  Parameter sind erlaubt; keine exklusive UML-Parameter-Ownership wird behauptet.
  Der Parameter Resource aus dem Beispiel benötigt in S3 keinen Ressourcenbezug.
- ServiceOperationParameter.owner/resource sind weiterhin typisiert, nun
  optional als alternative Darstellung. S3 verlangt Operationszuordnung über
  has oder ausgewählte owner-Referenz; S7 verlangt Operations- und Ressourcen-
  zuordnung über Kanten oder Referenzen. ServiceFunctionParameter bleibt
  unverändert. Außerhalb dieser Viewpoints erzwingen optionale Felder keine
  Zuordnung. S3 verlangt nun außerdem die spezifizierende Interface-Verknüpfung
  für jede dargestellte Operation.
- Generische connections.referenceAttributes zählt ausgewählte Referenzziele
  als alternative Gegenstellen-Nachweise mit counterparts-Filter. Referenzen
  werden untereinander und gegen passende Kanten-Endpunkte dedupliziert;
  parallele explizite Kanten behalten ihre Einzelzählung. Referenzen erzeugen
  keine zusätzlichen Kanten und implementieren keine automatische Ownership.
- Datenmodelltrace bleibt transitiv über das Datenprodukt: SpecifiesData von
  DataModel (mit nativem Pflichtfeld kind) zum DataElement/DataProductType;
  Parameter→DataModel ist kein gültiges InvolvesPhysicalResource-Endpunktpaar.
- Neues vollständiges Beispiel `examples/naf41-service-interfaces.arch` mit
  neun Elementen und neun Relationen, Geographic Location einmal für zwei
  Operationen sowie optionalen Ressourcenbezügen; Demo **NAFv4.1 · Service Interfaces**.
- Profilrevision `4.1.0-arch.13`: 289 semantische Knoten, drei Knotenaliase,
  149 Relationen und 47 Viewpoints. Native UAF-/ADMBw-Definitionen unverändert;
  Operation-/Datenprodukt-Mappings und Grenzen dokumentiert. Generierte
  Profile/Bundles, Abdeckungsbericht, Versionsbeispiele und Hilfetexte aktualisiert.

Verifikation: Build, **302 Node-Testgruppen** und vollständige Chromium-Suite
bestanden. Vier neue Gruppen prüfen Referenz-Nachweise/Maxima/Deduplizierung,
S3-Topologie/Sharing, native Abgrenzung, falsche Richtungen und Eigentümer,
legacy owner/resource, S7-Pflichtbezüge, DataModel-Trace, JSON und beide Bundles.
Browser prüft englische Hilfe, Demo, genau einen gemeinsamen Parameter,
Knoten-/Kantenanzahlen, Label-/Kartentrennung, Textgrenzen und beide Themes.
Screenshots `test-results/naf41-s3-light.png` und `naf41-s3-dark.png` visuell geprüft.
Signaturen, Parameterreihenfolge/-richtung, vollständige UML-Ownership und
Konsistenz gleichzeitig angegebener Kanten/Referenzen bleiben offen.

## Kompakte Referenzsubtraktion und Bezeichner (17.11.2026)

- `place` und `via` lösen Ausdrücke wie `service.y-service.height` jetzt
  anhand der deklarierten Node-/Tree-Gruppen-IDs auf. Der bisherige gierige
  Ausdruck konnte beide Operanden fälschlich zu einer unbekannten ID verbinden.
- Gültige IDs mit Punkten/Bindestrichen bleiben erhalten: Die längste passende
  deklarierte ID hat Vorrang. `root.x-offset.y` referenziert daher die
  y-Koordinate einer vorhandenen ID root.x-offset; `root.x - offset.y` erzwingt
  Subtraktion. Auch verborgene deklarierte IDs werden gebunden und danach als
  nicht sichtbar abgewiesen, anstatt die Rechnung anders zu interpretieren.
- Keine globale Änderung der Bezeichnergrammatik und kein pauschales Trimmen.
  Bindung erfolgt bei Platzierungsabhängigkeiten und bei via-Prüfung/Auswertung;
  DSL-/JSON-Übersetzung erhält die symbolische Schreibweise. Rechenreihenfolge,
  Zirkelprüfung, Endlichkeits-/Nullteiler-/Ausdrucksgrenzen bleiben bestehen.
- Englische Laufzeithilfe, SPEC/HELP/JSON und beide Bundles aktualisiert.

Verifikation: Build, **298 Node-Testgruppen** und vollständige Chromium-Suite
bestanden. Drei neue Testgruppen sichern die originale lange Nutzer-ID mit
verschiedenen Leerraumvarianten, DSL/JSON/Roundtrip/beiden Bundles, Punkt-/
Bindestrich-Mehrdeutigkeiten, verborgene IDs, Tippfehler und Zyklen sowie via ab.
Browser prüft kompakte Node- und Wegpunktkoordinaten, SVG-Positionen und
JSON-Äquivalenz in beiden Themes.

## S2: ServiceAggregation (17.11.2026)

- ServiceAggregation als eigenständige Relation Gesamtservice → Mitgliedservice
  ergänzt. Bewusst kein Alias für ServiceComposition: Die vorhandene
  Kompositionsrelation samt Notation bleibt erhalten. Aggregation wird als
  durchgezogene gerichtete Gruppierung dargestellt; Mitglieder können von
  mehreren Gesamtservices referenziert werden. Selbstbezüge/Zyklen sind
  verboten; vollständige UML-Besitz-/Lebenszyklussemantik bleibt offen.
- S2-Whitelist und strukturelle Einzelknotenprüfung berücksichtigen
  ServiceAggregation zusätzlich zu ServiceComposition und ServiceDependency.
  Vorhandene Kompositionsmodelle bleiben gültig. Das vollständige S2-Beispiel
  verwendet für beide aggregates-Kanten den neuen Typ, einschließlich der
  gemeinsamen Route und der ursprünglichen Relationsnamen im JSON-Roundtrip.
- Profilrevision `4.1.0-arch.12`: 147 semantische Relationstypen, weiterhin 288
  Knotentypen und zwei Knotenaliase. Generierte Profile/Bundles, Demo, aktive
  Versionsbeispiele, Hilfe und Dokumentation aktualisiert.

Verifikation: Build, **295 Node-Testgruppen** und vollständige Chromium-Suite
bestanden. Neue Tests prüfen gemeinsam referenzierte Mitglieder, falsche
Endpunkte, Selbstbezüge/Zyklen, Kompositionskompatibilität und die getrennten
Typidentitäten. S2 wird in beiden Themes mit ServiceAggregation, vollständigem
Inhalt, gemeinsamer Route, englischer Typhilfe und JSON-Roundtrip geprüft.
Der aktualisierte Screenshot `test-results/naf41-s2-light.png` wurde visuell
kontrolliert.

## S2: Node, PhysicalActiveResource und Service Structure (17.11.2026)

- NAFv4.1 S.106–108 vollständig geprüft, Cut-out und Beispiel von S.107–108
  visuell gelesen. Node ist ein Alias des bestehenden LogicalNode-Adapters
  unter OperationalArchitecture; die original geschriebene Typbezeichnung bleibt
  im Diagramm und in JSON-/DSL-Übersetzungen erhalten.
- PhysicalActiveResource als konkreten Anwendungs-Untertyp des abstrakten
  ResourcePerformer ergänzt. Keine Aliasgleichsetzung mit der abstrakten Basis
  oder dem engeren System-Typ; geerbtes isStandardConfiguration bleibt Pflicht.
  Der Beispielwert false ist eine explizite Modellierungsentscheidung.
- ConsumesService bildet logischer Knoten → Service ab, EnablesService
  ServiceFunction → Service und RealizesService ResourcePerformer → Service.
  Native UAF-Beziehungen Consumes/IsCapableToPerform/Implements bleiben in ihren
  bisherigen Richtungen und Endpunktregeln erhalten.
- S2 erlaubt die ergänzten Traces und bisherigen nativen Beziehungsendpunkte.
  Strukturelle ServiceComposition-/ServiceDependency-Verknüpfungen bleiben
  verpflichtend; optionale Traces ersetzen sie nicht. Die speziellen Consumer-/
  Provider-Rollen und relies-on/provides/delivers aus dem größeren S2-Cut-out
  bleiben ausdrücklich offen.
- `examples/naf41-service-structure.arch` reproduziert neun Elemente und acht
  Beziehungen von S.108 mit Node, fünf Services, Interface, Function und
  PhysicalActiveResource. Connected-Platzierung, relative Koordinaten und
  getrennte Pfade; Demo **NAFv4.1 · Service Structure** ergänzt.
- Profilrevision `4.1.0-arch.11`: 288 semantische Knotentypen, zwei Knotenaliase,
  146 Relationstypen, weiterhin 47 Viewpoints. Generierte Profile/Bundles,
  Abdeckungsbericht, Hilfe-/Versionsbeispiele und Modellierungsdokumentation
  aktualisiert. Node-/Ressourcen-Projektionen als Anwendungs-Mappings ausgewiesen.

Verifikation: Build, **294 Node-Testgruppen** und vollständige Chromium-Suite
bestanden. Drei neue Testgruppen prüfen vollständige Topologie, beide
Vokabulare, L1/L2-Kompatibilität, Pflichtwerte/Endpunkte, unverändertes natives
UAF, JSON und beide Bundles. Browser prüft neue Typ-Hilfe, Demo, Knoten-/
Kanteninhalte, Richtungen, Label-/Kartentrennung, Textgrenzen und beide Themes.
`test-results/naf41-s2-light.png` und `naf41-s2-dark.png` visuell kontrolliert.

## Aliase und versionierte Metamodell-Zuordnungen (17.11.2026)

- Generische `aliases.nodeTypes` / `aliases.relationTypes` mit Alias-Ketten,
  kanonischer Typidentität und symmetrischen Selektoren implementiert.
  Abstraktheit, Attribute, Referenzziele, Container, Paare/Ausschlüsse,
  Kardinalität, Zyklen und Viewpoint-Regeln verwenden dieselbe Semantik;
  Relationstypen werden bei Zählung/Zyklusprüfung nicht doppelt ausgewertet.
- Geschriebene `.type`, SVG-Stereotype/`data-type`, Diagnosen und JSON-/DSL-Quellen
  bleiben erhalten. Relationsaliase können mit `sharePath stereotypes` gemeinsame
  Pfade bilden. Referenz-Korrekturvorschläge berücksichtigen Aliasidentität.
- `PROFILE@VERSION` in Dokument/API/Profilbasis und Hilfe; neue API
  `getProfileVersions(ID)`. Gleichzeitige Revisionen und eingefrorene
  Modell-Snapshots; explizite Versionen dürfen nicht mit verändertem Inhalt
  überschrieben werden. Legacy-Registrierungen ohne Version bleiben ersetzbar.
- `mappings` beschreibt `rename`, `equivalent`, `specialization`, `partial` mit
  Framework-/Versionsendpunkten und Quellen; keine automatische Konvertierung.
  Neue englische Hilfe `@help aliases` / `@help mappings` und Aliasidentität in
  Typdetails. Profilübersichten zählen semantische Typen und Aliase getrennt.
- `naf41-uaf@4.1.0-arch.10` stellt Service auf einen Alias von UAF 1.0
  ServiceSpecification um und bindet `uaf@1.0.0-arch.1`. Goal und Constraint
  bleiben Untertypen. 287 semantische Knoten, ein Knotenalias, 143 Relationstypen,
  47 Viewpoints. UAF-1.2-Umbenennung wird als beschreibendes Mapping mit
  ausdrücklicher Begrenzung dokumentiert, nicht als vollständige Äquivalenz.
- Dokumentation in `profiles/naf41/ALIASES.md`, Profilanleitungen,
  README/SPEC/HELP/JSON/DIAGRAMS/ROADMAP und generiertem Abdeckungsbericht ergänzt.
  Eigene Service-Typdefinitionen in abgeleiteten Profilen müssen bei der neuen
  Basisrevision geprüft werden; ältere Revisionen werden nicht automatisch geladen.

Verifikation: Build, **291 Node-Testgruppen** und vollständige Chromium-Suite
bestanden. Acht neue Alias-Testgruppen prüfen symmetrische Identität,
Vererbung, Referenzen, View-Regeln, doppelfreie Kardinalitäts-/Zyklusprüfung,
Fehlerfälle, Profil-Snapshots/Revisionen, Metadaten/Hilfe, gemeinsame Pfade,
Quellnotation und beide Bundles. Browser prüft neue Hilfe/Bounds und gemischte
Service-/ServiceSpecification-Quellen mit Versionsbindung, JSON und beiden Themes.

## S1: Service-Vokabular und Beispiel von S.105 (17.11.2026)

- NAFv4.1 S.104–105 vollständig visuell geprüft. `Service` als konkreten
  Untertyp von UAF ServiceSpecification ergänzt. Beide Namen lassen sich
  mischen; vorhandene Attribute, Endpunkte und View-Regeln werden geerbt.
  ActualService bleibt separat; das native UAF-Profil wurde nicht verändert.
- `SatisfiesServicePolicy` bildet Service → ServicePolicy nach Cut-out/Beispiel
  ab. ServicePolicySatisfiedBy bleibt als vorhandene inverse Anwendung erhalten.
  `AggregatesServiceGroup` ergänzt Gruppe → Untergruppe mit Selbstbezug-/
  Zyklusverbot als Anwendungsregel; GroupsService bleibt Gruppe → Service.
- S1-Regeln/Hilfe beschreiben Richtungen, Gruppierung, Mehrfachvererbung und
  Tree-Grenzen. Native ServicePolicy.ruleKind bleibt Pflicht; Constraint ist
  im Beispiel eine ausdrücklich dokumentierte Wahl, kein PDF-Attributwert.
- `examples/naf41-service-taxonomy.arch` reproduziert vier Services, drei
  Spezialisierungen und eine Service-Policy samt satisfies. Connected mit
  gefilterter Tree-Gruppe, gemeinsamer Generalisierungsstrecke und externer
  Policy. Demo **NAFv4.1 · Service Taxonomy** ergänzt.
- Profilrevision `4.1.0-arch.9`, generierte Profile/Bundles und Abdeckungsbericht
  aktualisiert; README/SPEC/HELP/DIAGRAMS/ROADMAP und Profilanleitung ergänzt.

Verifikation: **283 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
S1-Beispiel strikt/draft, fünf Knoten/vier Kanten/Richtungen, gemischtes Vokabular,
Service-Nutzung in weiteren Viewpoints, ActualService-Abgrenzung, native
Generalisierungsprüfung, inverse Policy-Kompatibilität, Untergruppen/Zyklen,
JSON, Hilfetexte und beide Bundles geprüft. Browser prüft Demo, Tree/Sharing,
Richtung, Label-/Kartentrennung und Textgrenzen in beiden Themes. Screenshots
`test-results/naf41-s1-light.png` und `naf41-s1-dark.png` visuell kontrolliert.

## Liniengestaltung für Routen (17.11.2026)

- `color`, `width`, `dasharray` in viewweiten `routes`, fachlichen Einzelrouten
  und `route NODE -> EDGE` ergänzt. Einzelwerte übersteuern Vorgaben feldweise;
  reine Stilfelder ersetzen keinen geerbten freien Pfad und erhalten bei
  Referenzverbindungen die automatische Hindernisumgehung.
- CSS3-Namen und zitierte #RGB/#RRGGBB-Farben, Breiten 0.1–64 sowie geprüfte
  SVG-Strichmuster aus Zahlenlisten/-strings. `none`/`[]` erzwingen eine
  durchgezogene Linie; ungerade Muster werden wie in SVG verdoppelt.
- Linien und Pfeilspitzen erhalten die Farbe gemeinsam; Marker skalieren mit
  der Strichbreite. Farbige Marker werden je SVG-ID isoliert wiederverwendet.
  Label-/Iconfarben bleiben eigenständig; breite Marker erhalten konservative
  Exportabstände. Nicht gesetzte Stile behalten die bisherige Darstellung.
- Gemeinsame Pfade verlangen zusätzlich übereinstimmende normalisierte Farben,
  Breiten und Strichmuster. Unterschiede halten die Kanten unabhängig;
  Stamm/Querabschnitt übernehmen die gemeinsame Darstellung.
- `examples/route-styles.arch`, Demo **Route line styles**, Laufzeithilfe,
  Quell-/JSON-Schlüsselvorschläge und README/SPEC/HELP/JSON/DIAGRAMS/ROADMAP
  aktualisiert. Engine-Bundles und Demo gebaut.

Verifikation: **280 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
Defaults/Overrides, freie Pfade, unverändertes Quellmodell, viewlokale Stile,
Farb-/Breiten-/Musterprüfung, Markerarten/beide Richtungen, Referenz-Overrides,
automatische Referenzgeometrie, Sharing-Trennung, dicke Exportgrenzen,
JSON/DSL/Meta und beide Standalone-Bundles geprüft. Zwölf bestehende
Beispiel-/Theme-Ausgaben bleiben bytegleich zum vorherigen Bundle. Browser
prüft tatsächlich angewendete Muster, Markerfarben, Referenzen, Export-IDs,
Demo und beide Themes. Screenshots `test-results/route-styles-light.png` und
`route-styles-dark.png` visuell kontrolliert.

## Cr-Beispiel von S.103 vollständig nachmodelliert (17.11.2026)

- `AggregatesEnterprisePhase` und `TriggersEnterprisePhase` ergänzen die
  Phasengliederung und Triggerabhängigkeit. Beide sind explizite gerichtete
  Anwendungsadapter mit Selbstbezug-/Zyklusverbot, ohne starke Komposition,
  Single-Parent-, Ausführungs- oder phasenübergreifende Datumssemantik.
- `CapabilityIncrement` erweitert jetzt direkt UAFElement. Unbelegte
  ActualEnterprisePhase-/Achiever-/ActualState-Kompatibilität entfällt;
  das bisherige Node-Template sowie optionale ISO-Date-Time startDate/endDate
  samt Reihenfolgeprüfung bleiben erhalten. `milestones` ist eine optionale
  typisierte Referenzliste auf CapabilityMilestone.
- Cr erlaubt gemäß der Erläuterung auf S.103 implizite Milestone-Properties.
  Sichtbare Milestone-Knoten brauchen weiterhin `DefinesIncrement` und ein Datum;
  Capability/Increment und Delivery bleiben Pflichtinhalte. Vollständigkeit
  impliziter Properties wird nicht behauptet.
- `examples/naf41-capability-roadmap.arch` enthält genau sechs Elemente und
  sieben Beziehungen: Increment → Capability, Increment → IOC, Horizon 2030 →
  IOC/MOC/FOC sowie IOC → MOC → FOC. Connected-Positionen, geroutete Trigger und
  gemeinsame Aggregationspfade erhalten die gestufte Struktur im arch.js-Stil.
  Als **NAFv4.1 · Capability Roadmap** in der Demo ergänzt.
- Profilrevision `4.1.0-arch.8`, Profile, Abdeckungsbericht und Demo-Daten gebaut.
  `profiles/naf41/CR-MAPPING.md` dokumentiert Quellen, UAF-/ADMBw-Abgrenzung,
  vollständiges Beispiel, implizite Milestones, Darstellungsgrenzen und Migration.
  README, SPEC, HELP, DIAGRAMS und ROADMAP aktualisiert.

Verifikation: **272 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
Strikte/Entwurfsvalidierung, sechs/sieben Beispielinhalte und Richtungen, beide
Phasenrelationen, falsche Endpunkte, Selbstbezüge/Zyklen, optionale Phasenkontexte,
explizite/implizite Milestones, Referenztypen, Datumsregeln, JSON, Hilfetexte und
beide Standalone-Bundles geprüft. Demo-Aufruf, Textgrenzen, Kollisionsfreiheit
zwischen Labels/Karten und beide Themes im Browser geprüft. Screenshots
`test-results/naf41-cr-light.png` und `naf41-cr-dark.png` visuell kontrolliert.

## Cr: CapabilityIncrement zu EnterprisePhase (17.11.2026)

- NAFv4.1 S.102–103 visuell geprüft. Der optionale `relates to`-Link wird als
  `RelatesToEnterprisePhase` (CapabilityIncrement → EnterprisePhase) ergänzt
  und in Cr zugelassen. `AchievedEffect` bleibt Achiever → ActualState;
  eine Planungsphase wird nicht zum tatsächlichen Zustand umgedeutet.
- Profilrevision `4.1.0-arch.7`, generierte Profile/Bundles und Abdeckungsbericht
  aktualisiert. Beispiel `examples/naf41-capability-roadmap.arch` mit separatem
  Milestone; bestehende Pflichtinhalte werden beibehalten.
- Tests für gültige Endpunkte/Cr-View, falsche Richtung/ActualEnterprisePhase,
  AchievedEffect-Abgrenzung, JSON, Hilfetexte und beide Standalone-Bundles.

Verifikation: **268 Node-Testgruppen** und vollständige Chromium-Suite bestanden;
Cr-Beispiel strikt validiert und in beiden Themes gerendert.

## Gemeinsame Kantenpfade und C8-Vokabular (17.11.2026)

- `routes {sharePath stereotypes|all|none}` und Overrides pro `route` ergänzt.
  Standard `none`; `stereotypes` verlangt exakt gleiche Relationstypen, `all`
  kompatible Darstellung. Automatische Fan-in-/Fan-out-Netze mit einmal
  gezeichnetem Stamm/Querabschnitt und korrekten Markerenden in Connected-Views,
  einschließlich benannter Tree-Gruppen. Individuelle IDs, Labels/Icons und
  vollständige logische Pfade für Zuordnungen bleiben erhalten.
- Manuelle `via`/`path`, absolute Endpunkte, gerade/Bezier-Kurven, parallele
  Verbindungen und containerübergreifende Kanten bleiben unabhängig. Freier
  Korridor und Labelplatz erforderlich; gemeinsame Junctions sind rechtwinklig.
  Fan-in hat Vorrang; eine Kante gehört höchstens einem Bündel an.
- NAFv4.1 S.100–101 visuell geprüft: `Constraint` als konkreter Untertyp von
  `StrategicConstraint` ergänzt. Für diesen Vokabularadapter ist `ruleKind`
  optional und auf `Constraint` begrenzt, ohne einen Attributwert einzufügen.
  `OriginatesFromRationale` folgt der Constraint → StrategicRationale-Richtung
  auf S.100; die inverse Anwendung `JustifiesStrategy` bleibt erhalten.
- Profilrevision `4.1.0-arch.6`, generierte Profile, Bundles, Abdeckung,
  Laufzeithilfe und Dokumentation aktualisiert. Editierbares C8-Beispiel:
  `examples/shared-paths.arch`.

Verifikation: **267 Node-Testgruppen** und vollständige Chromium-Suite bestanden.
Vier Richtungen, Fan-in/Fan-out, Typ-/Stiltrennung, Overrides, manuelle Routen,
Fallback bei Hindernissen, Labels/Icons, JSON, unverändertes Modell, Referenzanker,
C8-Regeln, Quellenrichtung und beide Bundles geprüft. C7-/C8-Ausgaben visuell
kontrolliert (`test-results/shared-paths-c7.png`, `shared-paths-c8.png`).

## Optionale EffectivenessCriteria in C7 (17.11.2026)

- C7-Einzelknotenpflichten für CharacterizesCapability und eingehende
  EvaluatesCriterion schließen EffectivenessCriterion samt Untertypen aus.
  Time to find kann entsprechend S.99 nur über SpecifiesEffectiveness angebunden
  sein. Gewöhnliche AssessmentCriteria, Measures und View-Pflichtinhalte bleiben
  geprüft; die gemeinsame Vererbung und Endpunktkompatibilität bleiben erhalten.
- Generisches JSON-Viewpoint-Selektorfeld `connections[].nodesExclude` ergänzt.
  Ausschlüsse wirken mit Vererbung nur auf die betreffende Verbindungsprüfung.
  Schema/Referenzen werden bei Registrierung geprüft, ohne ältere Profile zu ändern.
- Profilrevision `4.1.0-arch.5`, generierte Profile/Bundles und Abdeckungsbericht
  aktualisiert. Pfeilrichtung EvaluatesCriterion bleibt Measure → AssessmentCriterion
  nach S.98; die abweichende Darstellung auf S.99 ist dokumentiert.
- Unabhängige C7-Fixture mit drei AssessmentCriteria/Measures und optionalem
  EffectivenessCriterion. Tests für Untertypen, weiter bestehende Pflichtketten,
  optionale Zusatzlinks, falsche Richtungen, JSON und beide Bundles ergänzt.

Verifikation: **258 Node-Testgruppen** und vollständige Chromium-Suite;
strikte/Entwurfsvalidierung ohne falsche Hinweise sowie Connected-/Class-Ausgabe
in beiden Themes geprüft.

## Frei positionierbare Properties in beiden Darstellungen (17.11.2026)

- `propertyFields` auf View-Ebene, pro Node-Style und als Diagrammvorgabe in
  Connected/Tree/Class. Rangfolge Style → View → Diagramm; `[]` leert die Auswahl.
  Vorhandene Werte einschließlich 0/false/Listen werden escaped und umgebrochen;
  fehlende Werte ausgelassen, unbekannte Felder geprüft.
- Normale Karten behalten Templates/Icons, Positionierung und manuelles Routing.
  Property-Zeilen erhöhen Karten-/Package-Headermaße vor Layout/Koordinatenauflösung;
  grafische Referenzkarten übernehmen sie. Leere Packages berücksichtigen auch
  lange Header mit Property-Zeilen in ihrer Mindesthöhe.
- Class behält gegliederte Bereiche und unterstützt `place` mit Berechnungen und
  Mindestgrößen. Flache Projektion, absolute Koordinaten; Ports folgen ihrem Owner
  und dienen als Anker. Details werden über den Owner positioniert. Kanten folgen
  Karten automatisch; Class hat weiterhin kein `route`/`routes`/`via`, keine
  Tree-Gruppen oder grafischen Referenzkarten.
- JSON-/Meta-Übersetzung, englische Laufzeithilfe und Dokumentation ergänzt.
  `examples/property-fields.arch` zeigt dasselbe C5-Modell in beiden Varianten.

Verifikation: **256 Node-Testgruppen** und vollständige Chromium-Suite.
Rangfolge, Modellidentität, negative/relative Positionen, Class-Ports,
Package-/Tree-/Referenzkarten, Templates/Iconpositionen, lange Unicode-Texte,
beide Themes, JSON/Meta, Standalone-Bundles und SVG-Export geprüft.

## Berechnete via-Stützpunkte (17.11.2026)

- `via` akzeptiert Referenzen auf sichtbare Nodes/Tree-Gruppen sowie `+`, `-`,
  `*`, `/`, Klammern und Vorzeichen mit denselben Grenzen wie `place at`.
  Normale Routen, interne Tree-Kanten, Zuordnungslinien und gemeinsame `routes`-
  Vorgaben unterstützt. Endpunkt-/Labelpunkte und Größen bleiben numerisch.
- Auswertung nach Nodepositionen/Package-Größen/Tree-Gruppen im absoluten
  View-Koordinatenraum, unmittelbar vor dem jeweiligen Routing. Via weist keine
  Positionen zu; bestehende Platzierungszyklen bleiben separat geprüft.
- Effektive Vorgaben berücksichtigen lokale Ersetzung und `path`. Ausgeblendete
  oder übersteuerte Routen benötigen keine ungenutzte Ankergeometrie; gespeicherte
  Ausdrücke/IDs bleiben geprüft. Automatische grafische Referenzkarten, die als
  Anker dienen, werden kanonische Karten im normalen Layout, auch bei `perEdge`.
- JSON-/DSL-/Meta-Übersetzung erhält Ausdrücke. Hilfe, Dokumentation und die
  relative C2-View enthalten ein Beispiel mit berechnetem `via`.

Verifikation: **248 Node-Testgruppen** und vollständige Chromium-Suite.
Arithmetik, endgültige Koordinaten, Package-/Tree-Bezüge, Defaults/Übersteuerung,
Bezier, Zuordnungslinien, Sichtbarkeit, Nullteiler, JSON, Modelleingabe ohne
Mutation und beide Standalone-Bundles geprüft.

## Multiplikation/Division in Platzierungsrechnungen (16.11.2026)

- `place` unterstützt `*` und `/` mit Punkt vor Strich, Linksassoziativität,
  Klammern und unären Vorzeichen. Bestehende Referenzen, JSON und Meta-Views
  bleiben symbolisch. Beispiel für vertikale Zentrierung:
  `vision.centerY - maritime.height / 2`.
- Begrenzter arithmetischer Parser ohne Codeausführung: höchstens 32 Operanden,
  16 Klammer-Ebenen. Division durch null, nichtendliche Zwischenwerte und
  endgültige Koordinaten außerhalb des gültigen Bereichs werden abgefangen.
- Koordinatenabhängigkeiten erfassen Operanden auch in Produkten/Quotienten.
  Package-Inhaltsräume bleiben bei affinen Rechnungen korrekt; nichtlineare
  Positionsrechnungen berücksichtigen den Ursprung konservativ als Abhängigkeit.
- C2-Beispiel, englische Laufzeithilfe, Korrekturvorschläge und Dokumentation
  aktualisiert. Das Beispiel richtet Maritime SAR mittig an der Vision aus.

Verifikation: **241 Node-Testgruppen** und vollständige Chromium-Suite;
Operatorrangfolge, Gruppierung, Vorzeichen, Nullteiler, Package-/Tree-Bezüge,
Zyklen, JSON und Standalone-Bundles geprüft.

## C3-Kontextfähigkeiten ohne eigene Dependency (16.11.2026)

- NAFv4.1 S.92–93 visuell geprüft: Spezialisierungen sind optional zulässiger
  C3-Kontext; SAR besitzt im konformen Beispiel nur eine Generalisierungskante.
- Zu strenge Einzelknotenpflicht `CapabilityDependency` für jede Capability
  entfernt. Der Mindestinhalt einer Dependency pro C3-View bleibt bestehen;
  Endpunkttypen, erlaubte Relationen und übrige Modellregeln bleiben geprüft.
  Fachliche Vollständigkeit der relevanten Abhängigkeiten ist nicht automatisch
  nachweisbar. Einschränkung auch in englischer Profilhilfe dokumentiert.
- Profilrevision `4.1.0-arch.4`; Regression mit dem C3-Teil des Nutzerbeispiels
  einschließlich Tree-Gruppe und externer CapabilityGroup ergänzt.

Verifikation: **238 Node-Testgruppen** und vollständige Chromium-Suite;
C3 strikt und im Entwurfsmodus ohne falschen Hinweis, beide Themes und Bundles.

## Referenzierte Platzierung mit Addition/Subtraktion (16.11.2026)

- `place a at (coverage.x + 20, vision.y - 40)` mit bis zu 32 Termen pro Achse;
  `x`, `y`, `width`, `height`, `right`, `bottom`, `centerX`, `centerY` sichtbarer
  Nodes/Tree-Gruppen, einschließlich automatisch angeordneter Mitglieder.
- Koordinatenweise iterative Auflösung nach automatischem Layout und vor Routing.
  Vorwärtsreferenzen, Package-Inhalte und externe Tree-Karten funktionieren.
  Package-Größen wachsen rechts/unten; Positionen außerhalb ihres linken/oberen
  Inhaltsrands erzeugen einen Layoutfehler. Kein iterativer Reflow manueller Plätze.
- Zirkelbezüge berücksichtigen indirekte Abhängigkeiten über Gruppen, Package-
  Größen und automatische Kontextausrichtung. Fehlermeldung nennt die Kette;
  auch im Entwurfsmodus blockierend. Sich selbst über Maße referenzieren bleibt
  möglich, wenn daraus kein Koordinatenzyklus entsteht.
- JSON-Strings und DSL-/Meta-Übersetzung bewahren symbolische Ausdrücke.
  Fehler enthalten Quellpositionen/JSON-Pfade und Korrekturvorschläge.
  `size` und Routenpunkte bleiben numerisch; keine Codeauswertung.
- Englische Laufzeithilfe und statische Dokumentation ergänzt. C2-View `relative`
  zeigt eine Capability relativ zur Gruppenbox und Vision.

Verifikation: **237 Node-Testgruppen**, vollständige Chromium-Suite, beide
Standalone-Bundles, JSON-Gleichheit, Package-/Tree-Abhängigkeiten und eine
1.000 Elemente lange Referenzkette. Relative C2-Ansicht visuell geprüft.

## Tree-Gruppen mit eigener Richtung (16.11.2026)

- `tree ID { nodes [ID, …] direction up }` ordnet ausgewählte Mitglieder als
  Teilbaum einer Connected-View an. Mehrere Gruppen können unterschiedliche
  Richtungen (`up`, `down`, `left`, `right`) verwenden; `orientation` bleibt Alias.
  Vier Richtungen funktionieren ebenfalls mit `diagram tree`.
- Gruppen sind unsichtbare Layoutbereiche, keine Modell-Packages. Mitglieder
  sind eindeutige Nicht-Container unter demselben Modellparent. Gruppen können
  innerhalb von Packages liegen; Modellparent und Elementidentität bleiben erhalten.
- `place GRUPPE at (X,Y)` positioniert den ganzen Tree. Einzelne Mitglieder und
  Gruppengrößen werden automatisch bestimmt. Außenstehende Nodes verwenden
  Connected-Layout oder eigene Positionen; direkt verbundene Karten auf oberster
  Ebene werden automatisch neben der Gruppe ausgerichtet.
- Hierarchiefilter lassen Querbeziehungen sichtbar. Individuelle Kantenrouten,
  Label-Icons, Labelpositionen und grafische Referenzkarten bleiben nutzbar.
  Konkrete Routen überschreiben Gruppen-`curve`/`showLabels`, diese entsprechende
  View-Vorgaben. Ausgeblendete Elemente nehmen nicht am Gruppenlayout teil.
- JSON-View-`tree`, DSL-/JSON-Metaübersetzung, englische Laufzeithilfe und
  statische Dokumentation ergänzt. Das C2-Beispiel zeigt die Hierarchie nach oben,
  Maritime SAR außerhalb links sowie eine separat positionierte Variante.

Verifikation: **229 Node-Testgruppen** und vollständige Chromium-Suite erfolgreich.
C2-Gruppen in beiden Themes, JSON-Gleichheit, Text-/Labelgrenzen und SVG-Export
geprüft; exportierte Gruppenansicht visuell kontrolliert. Beide Standalone-Bundles
neu gebaut. Tests umfassen mehrere Gruppen, Package-Containment, vier Richtungen,
Routen/Referenzkarten, unverändertes Modell und verständliche Validierungsfehler.

## C2-desires-Ziele und Beispiel auf Seite 91 (16.11.2026)

- C2-Cut-out S.90 visuell nachgeprüft: EnterprisePhase kann Capability,
  EnterpriseVision und Goal über `desires` adressieren. Die vorherige Abbildung
  nur auf Capability war unvollständig; die Phase→Vision-Verbindung von S.91
  ist kein Beleg für eine fehlerhafte NAF-Abbildung.
- `DesiresVision` und `DesiresGoal` mit getrennten, typisierten Endpunkten
  ergänzt. C2 verlangt pro Planungsphase mindestens eine Verbindung aus
  `DesiresCapability`/`DesiresVision`/`DesiresGoal`, keinen zusätzlichen
  direkten Phase→Capability-Link. Bestehende C2-Pflichtinhalte bleiben geprüft.
- Profilrevision `4.1.0-arch.3`: 94 Anwendungsrelationen, insgesamt 137
  Relationstypen; 286 Knotentypen und 47 Viewpoints unverändert.
- `examples/naf41-enterprise-vision.arch` zeigt das Modell mit drei Goals als
  echten Tree (Phase → Vision → vier Blätter) und als manuell positionierte
  Connected-View in der Anordnung des PDF-Beispiels.
- Regressionen für die drei desires-Ziele, fehlende Phase-Verknüpfung,
  falsche Endpunkte/Richtungen, Generalisierungsmissbrauch und JSON ergänzt.

Verifikation: **222 Node-Testgruppen** und die vollständige Chromium-Suite
erfolgreich. Das Beispiel von S.91 besteht die strenge C2-Prüfung ohne
DesiresCapability und rendert als Tree sowie in PDF-ähnlicher manueller
Anordnung. Beide Ansichten visuell geprüft; Profil-Scripts/Bundles neu gebaut,
`git diff --check` sauber.

## NAF-C2-Bezeichnung Goal (16.11.2026)

- NAFv4.1 S.90–91 visuell und textuell geprüft: Das C2-Beispiel zeigt drei
  `Goal`-Elemente. Der vorhandene UAF-Katalog und die ADMBw-MDG definieren
  `EnterpriseGoal`; die MDG enthält keinen eigenen Stereotyp `Goal`.
- Expliziten NAF-Anwendungsadapter `Goal extends EnterpriseGoal` im
  Quellkatalog ergänzt; geerbte Attribute, `SpecifiesGoal` und alle C2-Regeln
  greifen ohne parallele Sonderregeln. Der native UAF-Katalog bleibt unverändert.
- Profilrevision `4.1.0-arch.2`: 73 Anwendungs-Knotenadapter, insgesamt
  286 Knotentypen; Beziehungen und 47 Viewpoints unverändert.
- Originales Benutzer-C1-Modell mit drei nicht eingeblendeten Goals sowie C2
  mit allen drei Goals, Pflichtbeziehungen, falscher Richtung, Attributtypen,
  Hilfe, JSON und beiden Bundle-/Profil-Ladevarianten als Regression abgesichert.
- Herkunft/Abgrenzung dokumentiert: Die Namensabbildung benötigt kein ADMBw-Profil.
  Ein eigenes Profil wäre für Bundeswehr-spezifische Erweiterungen angemessen;
  die Referenz-MDG nennt NAF 4.0 und wird nicht vollständig importiert.

Verifikation: **221 Node-Testgruppen** und die vollständige Chromium-Suite
erfolgreich. Benutzer-C1 und C2 mit drei Goals in beiden Themes geprüft,
einschließlich geerbter Beziehungen/Hilfe. Einzelne und gesammelte generierte
Profil-Scripts mit beiden Librarybundles getestet; `git diff --check` sauber.

## Automatischer Tree-/Taxonomie-Renderer (16.11.2026)

- `diagram tree` mit `relations`, `parentDirection`, `orientation`, `levelGap`,
  `siblingGap`, `curve` und `showLabels` ergänzt. Auto erkennt das Ziel von
  Generalisierungen als Elternteil; andere Beziehungen gehen von Eltern zum Kind.
  Semantische Richtung, Typen und SVG-Marker bleiben erhalten.
- Iterative Topologie-/Teilbaum-Anordnung für Bäume und Wälder: Eltern über der
  Mitte des ersten/letzten Kindes, deklarationsstabile Reihenfolge, keine
  Überschneidungen unabhängiger Unterbäume, Platz für variable Karten und Labels.
  1.000 Ebenen ohne rekursiven Layoutstack geprüft.
- Vorhandene Node-Karten/Icons/Styles und SVG-Ausgabe wiederverwendet; Packages
  sind in dieser Projektion flache Karten. Hides, JSON-/DSL-Übersetzung,
  Entwurfsmodus und gestapelte Views bleiben unterstützt.
- Strukturfehler bei Zyklen, Selbstkanten, mehreren Eltern, parallelen oder
  bidirektionalen Hierarchiekanten mit Hinweisen auf Filter/Hides/Connected.
  Manuelle Positionen/Routen bleiben Connected vorbehalten.
- `examples/taxonomy.arch` mit dem SAR-Modell und zwei C1-Views in die Demo
  aufgenommen. Laufzeithilfe `@help diagrams tree`, statische Dokumentation
  und Vergleich aktualisiert. Demo: 13 Modelle / 48 Views plus Hilfereferenz.

Verifikation: **219 Node-Testgruppen** und vollständige Chromium-Suite erfolgreich.
C1-Beispiel mit beiden Orientierungen/Themes, JSON, Schrift-/Labelgrenzen und
SVG-Export geprüft. Export und Dark-Theme-Screenshot visuell geprüft.
Beide Bundles neu gebaut; `git diff --check` ohne Beanstandungen.

## Bidirektionale Beziehungen, Entwurfsmodus und Kanten ausblenden (16.11.2026)

- `<->` und JSON `direction: "both"` ergänzt; Profilfeld `directions` erlaubt
  `forward`/`both`, einschließlich Vererbung und reiner Bidirektionalität.
  Endpunktrollen, Kardinalitäten beider Richtungen, Selbstkanten, `acyclic`,
  Viewpoint-Verbindungen und Metaview-Übersetzungen berücksichtigt.
- Connected-/Klassenrenderer mit zwei Pfeilspitzen, Matrizen mit beiden
  Richtungen. Sequenz/State/Activity/Timeline lehnen sichtbare bidirektionale
  Beziehungen ausdrücklich ab. Neue Beispiele `bidirectional.arch`, `draft.arch`.
- `config.validation`/API `validation` mit `strict` (Standard) und `draft`.
  Fehlende Pflichtangaben/Mindestanzahlen werden Warnungen, sichere Diagramme
  samt Quellpositionen darunter gerendert. Übrige Fehler bleiben blockierend.
  `validate()` kennzeichnet unvollständige Entwürfe als `conformant: false`.
- Warnungsfooter als eigenständiges `notices`-Layout mit vollständigen Bounds;
  bei mehreren Views einmal darunter. SVG-/DOM-/Markdown-Ausgabe erhalten ihn.
- `style EDGE_ID { display none|standard }` steuert die Sichtbarkeit je View.
  Verbindungen, Labels/Icons und Zuordnungspfeile ausgeblendeter Kanten entfallen;
  sämtliche Beziehungen bleiben Bestandteil der Modell-/Profilvalidierung.
- Verschachtelte Packages und ihre Hintergrund-/Schrift-/Größenstile durch das
  neue Beispiel und Browserprüfungen zusätzlich abgesichert.
- Laufzeithilfe und README/SPEC/JSON/HELP/DIAGRAMS/ROADMAP/Profilhandbuch ergänzt.
- `display none` zusätzlich für Nodes/Packages: Nachkommen und angrenzende
  Beziehungen entfallen, ohne Modell-/Profilregeln aufzuheben. Fachrenderer
  filtern konfigurierte Teilnehmer-/Detail-Listen, leere Projektionen bleiben
  gültig; Lanes/Heatmap-Eltern verbergen ihre zugeordneten Inhalte mit.

Verifikation: **212 Node-Testgruppen** und die vollständige Chromium-Suite
erfolgreich. Browser prüft beide Richtungen/Marker, verschachtelte Package-Farben,
Draft-Hinweise und Bounds, strenge Übersteuerung, verschwundene Hinweise nach
Korrektur, JSON, Node-/Kanten-Hides sowie SVG-Export. Screenshots
`bidirectional-packages.png` und `draft-validation.png` visuell geprüft.
Beide Browserbundles neu gebaut; `git diff --check` ohne Beanstandungen.

## Fehlerkorrektur: Organisationslogos einschließlich NATO (16.11.2026)

- `ReferenceDocs/organizationLogos.json` enthält 45 Icons. NATO und Rolls-Royce
  verwenden `contrast-color(currentcolor)`; Siemens Healthineers verwendet einen
  eingebetteten `<style>`-Block mit `.cls-1`/`.cls-2`. Diese drei Fälle verhinderten
  bislang die Registrierung des gesamten Packs.
- Kontrastfarbfunktion für `currentColor`, Hex- und benannte Farben ergänzt;
  native SVG-/Browserauswertung bleibt erhalten.
- Einfaches lokales Klassen-CSS wird anhand von Regelreihenfolge und
  Inline-Priorität in geprüfte Attribute aufgelöst. Keine Stylesheets oder
  Quellklassen im Host-DOM; komplexe Selektoren und aktive/externe Inhalte
  bleiben ausgeschlossen.
- Referenzpack mit Prüfsumme erfasst; Tests für alle 45 Icons, beide Bundles,
  Prioritäten, lokale Paint-Referenzen und abgewiesene CSS-Konstrukte ergänzt.

Verifikation: **195 Node-Testgruppen** und vollständige Chromium-Suite erfolgreich;
alle 45 Organisationslogos mit heller/dunkler Iconfarbe gegen die Original-SVGs
mit denselben monochromen Paint-Defaults rasterisiert verglichen. NATO-Kontrast
zusätzlich anhand der Pixel geprüft. Beide Bundles neu gebaut; `git diff --check`
ohne Beanstandungen.

## Fehlerkorrektur: data-name und data-* in SVG-Iconpacks (16.11.2026)

Verifikation: **192 Node-Testgruppen** und die vollständige Chromium-Suite
erfolgreich. Die Metadatenvariante stimmt rasterisiert mit dem Original überein.

- `data-*`-Attribute wie `data-name`, `data-export` oder `data-build` werden
  als nicht zeichnende Export-/Editor-Metadaten akzeptiert und beim SVG-Import
  verworfen. Keine Interpretation als Referenz oder Zeichenattribut und keine
  Übernahme dieser Quellmetadaten in den Host-DOM.
- Die Eingabepacks bleiben unverändert. Unbekannte Zeichenattribute, aktive
  Inhalte, externe Referenzen und `data-*` als Inline-CSS bleiben Fehler;
  fehlgeschlagene Registrierung ersetzt kein gültiges Pack.
- Regressionstests vergleichen SVG-Ausgaben mit/ohne Metadaten exakt, prüfen
  beide Bundles und negative Fälle mit Atomarität. Chromium vergleicht einen
  Originalexport mit `data-name` rasterisiert mit der rekonstruierten Ausgabe
  und prüft, dass Metadaten nicht im Ausgabe-SVG stehen.
- SVG-Umfang in `icons/README.md` und SPEC dokumentiert; beide Browserbundles
  neu gebaut.

## Fehlerkorrektur: enable-background in SVG-Iconpacks (16.11.2026)

- Die SVG-Allowlist wies `enable-background` bislang als unbekannt zurück und
  verhinderte dadurch die atomare Registrierung ansonsten nutzbarer Packs.
- Attribut und gleichnamigen Inline-Präsentationsstil ergänzt. Geprüfte Werte:
  `accumulate`, `inherit`, `new` sowie `new x y width height` mit vier endlichen
  Zahlen, nichtnegativer Breite/Höhe und den bestehenden numerischen Limits.
  Whitespace, Kommas und Exponentialzahlen werden verarbeitet. Inline-Stile
  überschreiben das Präsentationsattribut wie bei den übrigen Zeichenattributen.
- Das Attribut bleibt im rekonstruierten SVG erhalten; arch.js implementiert
  keine eigene Hintergrundpuffer-/Filtersemantik. Andere unbekannte Attribute,
  aktive Inhalte und externe Referenzen werden dadurch nicht zugelassen.
- Positive/negative Regressionstests einschließlich unveränderter Eingaben,
  Atomarität und beider Browserbundles ergänzt. Chromium vergleicht Original-
  SVGs mit Attribut-/Stylevarianten rasterisiert mit der rekonstruierten Ausgabe.
- `icons/README.md` und SPEC um Werteumfang und SVG-1.1-Quellenverweis ergänzt;
  beide Browserbundles neu gebaut.

Verifikation: **190 Node-Testgruppen** und die vollständige Chromium-Suite
erfolgreich. Attribut-/Stylevarianten stimmen im Pixelvergleich mit den
Original-SVGs überein. `git diff --check` ohne Beanstandungen.

## Abgeschlossener Folgeauftrag: @meta als Architektur-View (16.11.2026)

- `view ID "Title" { @meta json }` und `@meta dsl` ergänzt; Alias `meta json`
  bzw. `meta dsl`. Direkt in `architecture` erzeugt die Direktive eine View mit
  ID `meta-json` bzw. `meta-dsl`. Ohne Architekturquelle erfolgt ein Kontexthinweis.
- JSON-Viewfelder `"@meta": "json"|"dsl"` und Alias `"meta"` ergänzt; die
  Architektur-Kurzform erzeugt in JSON die Quellenview nach expliziten Views.
  Übersetzungen erhalten die deklarierte Quellenansicht in beiden Richtungen.
- Quellenviews sind Teil der regulären Viewauswahl, von `views all`/Listen,
  Markdown-/DOM-Adaptern und eigenständigen SVG-Exports. Die bestehende
  interaktive Editor-Meta-View bleibt separat für Syntaxdiagnosen verfügbar.
- Eigenständiges `kind: meta`-Layout mit `source`, Format, visuellen Zeilen und
  Bounds. SVG-Ausgabe mit Zeilennummern, erhaltener Einrückung, Umbruch langer
  Zeilen, sicherem Text-Escaping und hellen/dunklen Themes. Kein `foreignObject`.
- Die vollständige normalisierte Architektur enthält ihre Meta-Direktiven als
  Text genau einmal; keine rekursive Auswertung oder Kopie des Layoutobjekts.
  Quellenviews haben keine fachlichen Knoten/Kanten und benötigen keinen
  Viewpoint. Modell- und andere Viewregeln bleiben uneingeschränkt wirksam.
- Filter, Viewpoints, Diagramm-/Node-/Routingeinstellungen werden in Quellenviews
  abgewiesen. Format und Theme sind die unterstützten Einstellungen.
- Editierbares Beispiel [meta.arch](examples/meta.arch) / **Architecture source
  views** ergänzt. Demo enthält zwölf Modellbeispiele mit 46 Views plus Hilfe.
  META, README, JSON, SPEC, HELP, DIAGRAMS und ROADMAP aktualisiert;
  englische Laufzeithilfe `@help meta` um deklarierte Quellenviews erweitert.

Verifikation: **188 Node-Testgruppen** erfolgreich. Zusätzliche positive und
negative Fälle für Direktiven, Aliase, JSON, Architektur-Kurzform, IDs,
Viewauswahl, Themes, sichere Textausgabe, lange Unicode-Zeilen, Profilpflichten,
Markdown, beide Bundles und Rundlaufübersetzungen. Browser prüft kombinierte/
einzelne Quellenviews, Textgrenzen, JSON-/DSL-Eingabe und SVG-Download. Der
native Chromium-SVG-Viewer wurde direkt mit dem Export geöffnet; seine
Ganzseitenaufnahme kann hängen, daher wird derselbe Export für die Raster-
Sichtkontrolle zusätzlich in einer einfachen HTML-Seite dargestellt.

Abschluss: vollständige Chromium-Suite erfolgreich, einschließlich Mobilansicht,
`file://`, Einzel-/Mehrfachausgabe und direkt geöffnetem eigenständigem SVG.
`architecture-meta-export.png` und `architecture-meta-dark.png` visuell geprüft:
lesbare Einrückung, vollständige Quellen, getrennte Abschnitte und keine
abgeschnittenen Textzeilen. 25 vollständige Arch-Beispiele aus den aktualisierten
Hauptdokumenten ohne Fehler gerendert. Dokumentationslinks/Anker und
`git diff --check` geprüft; `USERSPEC.md` bleibt unverändert.

## Abgeschlossener Folgeauftrag: Meta-View und Korrekturkandidaten (16.11.2026)

- Eigene Editor-Meta-View ergänzt: DSL → Architektur-JSON und JSON → DSL,
  unabhängig von Modellviews und `config.views all`. Umschalten im View-Menü,
  Live-Aktualisierung, Kopie und Download der jeweils anderen Quelle.
- Öffentliche APIs `translate` und `inspectSource` ergänzt. Übersetzung benutzt
  die gemeinsame Syntax, erhält Modell-/Viewbedeutung und normalisiert Formatierung
  und Defaults. Kommentare/ursprüngliches Whitespace werden nicht rekonstruiert.
- Fehleransicht zeigt markierte Quellausschnitte, Zeile/Spalte, JSON-Pointer und
  einen Sprung in den Editor. Syntaxfehler sperren unzuverlässige Übersetzungen;
  semantisch ungültige, syntaktisch lesbare Modelle bleiben übersetzbar.
- Korrekturkandidaten für Block-/Feldtippfehler, JSON-Syntax, fehlende Blöcke/
  Titel, unbekannte Typen/IDs, Pflichtattribute und gültige Optionswerte. Konkrete
  Untertypen abstrakter Typen stammen aus dem ausgewählten Profil. Keine
  automatische Änderung oder Garantie, dass ein Vorschlag alle Regeln erfüllt.
- Meta-Ausgabe und Diagnosen werden als Text in DOM-Elemente geschrieben.
  SVG-Export und Diagramm-Zoom sind im Meta-Modus deaktiviert; Rückkehr in eine
  Diagrammview stellt sie wieder her. Die aktuelle Profilanzeige wird aktualisiert.
- [META.md](META.md), JSON-/API-Spezifikation, README, HELP und ROADMAP ergänzt;
  englische Laufzeithilfe `@help meta` und `@help json` aktualisiert.

Verifikation: **180 Node-Testgruppen** erfolgreich. Alle mitgelieferten DSL- und
JSON-Beispiele in beide Richtungen übersetzt; SVG-Gleichheit für jede View in
beiden Themes geprüft. Negative Syntax-/Profilfälle, Typkandidaten, JSON-Pfade,
Determinismus, unveränderte Eingaben und beide Browserbundles geprüft.
Chromium prüft Meta-Wechsel, Downloads, Fehlerzeilen/Sprung, Tippfehler- und
abstrakte Typkandidaten sowie Wiederherstellung des Diagramms. Desktopaufnahmen
`meta-json.png`, `meta-dsl-error.png` und `meta-json-error.png` visuell geprüft.
Mobile Meta-Diagnosen ohne horizontale Seitenüberbreite und Meta-Start über
`file://` erfolgreich geprüft; `meta-mobile.png` visuell kontrolliert.
28 vollständige Dokumentationsbeispiele gerendert und 137 lokale Links/Anker
ohne Fehler geprüft. Beide Browserbundles sind neu gebaut; abschließende
Node- und Chromium-Suiten erfolgreich. `USERSPEC.md` bleibt unverändert.
Die Vorschläge sind bewusst begrenzte, prüfbare Beispiele, keine automatische
Reparatur oder vollständige Ressourcen-/SVG-Validierung.

## Abgeschlossener Folgeauftrag: äquivalente JSON-Quellsyntax (16.11.2026)

- `architecture`-Hülle mit `name`, `description`, `config`, `model` und `views`.
  Element-/Relations-/View-IDs als Objektschlüssel oder geordnete Listen mit `id`.
  Verschachtelte Packages, direkte Profilattribute und ein `attributes`-Block
  für Kollisionen mit JSON-Strukturfeldern. Originale View-/Routing-Schlüssel
  einschließlich `"ELEMENT -> RELATION"` für Zuordnungspfeile.
- JSON-Strings und Objekte über Parser, Validierung, Layout und Rendering;
  `arch`-Fences und `data-arch` verwenden dieselben Regeln. DSL und JSON sind in
  getrennten Codeblöcken kombinierbar, nicht als Sprachfragmente innerhalb
  eines Architekturblocks.
- JSON-Oberflächensyntax wird auf die vorhandene Grammatik abgebildet. Keine
  zweite Implementierung der Profil-/Modellvalidierung. Quellzeilen/Spalten und
  JSON-Pointer bleiben für Diagnosen erhalten; doppelte JSON-Schlüssel und
  nicht darstellbare Werte werden abgewiesen. Die bisherigen Modelllimits gelten.
- Editierbares Demo-Beispiel **JSON architecture** und zwei JSON-Quelldateien
  für Standardprofil/NAFv4.1 ergänzt. Elf Modellbeispiele mit 43 Views plus Hilfe.
  Editorformatanzeige und Quelldownload unterscheiden `.json` und `.arch`.
- [JSON.md](JSON.md), README, SPEC, HELP, DIAGRAMS, Profilanleitung und ROADMAP
  ergänzt. Laufzeithilfe `@help json` ist Englisch.

Verifikation des JSON-Folgeauftrags: **171 Node-Testgruppen** und vollständige
Chromium-Suite erfolgreich. Identische DSL-/JSON-SVG-Ausgabe, alle acht Renderer,
Inline-/registrierte Profile, Bool-/Zahl-/Enum-/Referenzattribute, Grenzen und
beide Bundles geprüft. Browser: Editor, Viewwechsel, Themes, Downloads, negative
JSON-Syntax mit Recovery, DOM-/Markdown-Adapter, NAF-Karten und Zuordnungspfeile.
JSON- und NAF-Desktopaufnahmen visuell geprüft. Der folgende Meta-Auftrag
erweitert diesen Stand um Quellübersetzung und zusätzliche Prüfungen.

## Dokumentationsanalyse und Einordnung (16.11.2026)

Der aktuelle Stand wurde gegen Parser, Profilvalidierung, API, Connected- und
Spezialrenderer sowie die vorhandene Mehrfachview-Ausgabe geprüft. Änderungen
dieses Auftrags betreffen die Dokumentation; das Renderingverhalten wurde nicht
geändert. Frühere Abschnitte bleiben als chronologischer Prüfnachweis erhalten;
ihre Testzahlen beschreiben den jeweiligen damaligen Stand.

- [COMPARISON.md](COMPARISON.md) ergänzt: Einsatzschwerpunkt, konkrete Vorteile,
  Grenzen und vergleichende Einordnung zu Mermaid.js, PlantUML, Graphviz und
  D2/D2.js. Aussagen zu diesen Werkzeugen sind mit offiziellen Quellen belegt
  (Abruf 16.11.2026); Auswahlhinweise sind als Einschätzung gekennzeichnet.
  Keine vergleichenden Leistungs- oder Qualitätsbenchmarks behauptet.
- README um Navigation, Einsatzkriterien und aktuelle Connected-Präsentation
  ergänzt. Fehlendes `naf41-uaf` im Verzeichnis der Build-Ausgaben nachgetragen.
- SPEC präzisiert: lokale Node-SVG-Erzeugung ist möglich, ein Renderingserver
  ist nicht erforderlich; keine pauschale Abwesenheit von Laufzeitabhängigkeiten
  bei direkten Node-Quellimporten. `paths` und validiertes Iconify-`body` getrennt
  beschrieben. Parsergrenzen von Leistungszusagen unterschieden.
- Fehlervertrag erläutert: alle Modell-/Viewregeln gelten trotz Renderauswahl;
  Icons und freie SVG-Pfade können erst beim Rendern scheitern. Mehrfachviews
  bilden eine Ausgabe, `renderAll` isoliert dagegen Fehler pro DOM-Block.
  `renderMarkdown` bietet diese Isolation nicht.
- DIAGRAMS berichtigt: Die früher pauschal behauptete Übertragbarkeit sonstiger
  Styles auf Spezialrenderer stimmt nicht. Eine Unterstützungstabelle nennt
  Connected-exklusive Optionen, abgewiesene Einstellungen und rendererabhängige
  Farben. Mehrfachview-Layoutvertrag und Grenzen ergänzt.
- HELP um Stolperstellen und Querverweise erweitert, vorhandene Hilfe/Rezepte
  erhalten. ROADMAP trennt implementierten Ausgangspunkt und geplante Arbeit;
  vorhandenes Zoom/Fit und Referenzrouting von ihren geplanten Erweiterungen
  unterschieden.
- `profiles/README.md` enthielt eine Kopie der SPEC statt der Profilanleitung.
  Profilanleitung aus dem vorhandenen Repository-Stand wiederhergestellt,
  die Viewauswahl erhalten und neuere Regeln, Referenzkarten, Kandidatenhilfe,
  CSS3-Farben, `propertyFields` und NAFv4.1-Verweise ergänzt. UAF-Anleitung mit
  dem separaten NAFv4.1-Anwendungsprofil verknüpft. Abdeckungsberichte bleiben
  maßgeblich; 47 Viewpoint-IDs sind keine normative Vollständigkeitszusage.

Verifikation: `npm test` erneut erfolgreich mit **158 Tests**, ohne Fehler oder
übersprungene Fälle. **28** vollständige Arch-Dokumentationsbeispiele bzw. das neue
README-Stylefragment im passenden Modellkontext mit registrierten Profilen und
Iconpacks gerendert; **110** lokale Dokumentationslinks und Überschriftenanker
ohne Fehler geprüft.
Unvollständige Syntaxausschnitte sind bewusst kontextabhängig. Die vorhandene
Mehrfachview-Exportaufnahme mit Übersicht, Detail und Matrix wurde visuell auf
Titel, Trennung und Darstellung geprüft. Die vorherige vollständige Chromium-
Verifikation ist im folgenden Abschnitt festgehalten; sie wurde für diese reinen
Dokumentationsänderungen nicht wiederholt. Keine zusätzliche Browser- oder
Leistungsabdeckung behauptet. `USERSPEC.md` bleibt unverändert.

## Abgeschlossener Folgeauftrag: Renderauswahl für mehrere Views (16.11.2026)

- `config { views all }`, eine einzelne View-ID und geordnete ID-Listen ergänzt.
  Die Option lässt sich mit registrierten oder Inline-Profilen kombinieren;
  ohne Auswahl bleibt die erste View der Standard. Leere/duplizierte Listen
  und unbekannte IDs werden mit englischen Diagnosen abgewiesen.
- API-Option `views` ergänzt; Priorität `view` → `views` → `config.views` → erste
  View. Einzelausgabe bleibt unverändert. Mehrere Views werden mit Überschriften,
  separaten Viewports, eigenen Themes/Renderern und isolierten SVG-IDs in einem
  eigenständigen SVG ausgegeben. Layout enthält `kind: views`, `layouts`,
  `sections`, gemeinsame Bounds und nach ID vereinigte Elemente.
- Vorschau-Dropdown um **Configured views** ergänzt; manuelle Einzelauswahl,
  Theme, Zoom, SVG-Download, Markdown, renderAll und Fehler-Recovery geprüft.
  Zusammengesetzte Ansichten werden auf Breite eingepasst und vertikal gescrollt.
- Englische Hilfe, vollständige HELP-Dokumentation, README, Spezifikation und
  Beispiel `examples/multiple-views.arch` aktualisiert. `npm run check`
  erfolgreich: Bundles gebaut, 158 Node-Testgruppen und komplette Chromium-
  Suite bestanden. Zusätzliche Browserprüfung für gültige SVG-Bilddecodierung,
  nicht überlappende innere Viewports, eindeutige IDs und Dropdown/API-Overrides.
  Export-Screenshot `multiple-views-export.png` und Vorschau visuell geprüft.


## Abgeschlossener Folgeauftrag: Node-Iconposition und sichtbare Felder

- `iconPosition top|left|bottom|right` für Connected-Node-Styles ergänzt.
  Geometrie berechnet Icon-/Textposition, Kopf-/Kartenhöhe und Textbreiten
  gemeinsam. Package-Icons bleiben im Kopfbereich; Logo-Modus richtet Icons
  innerhalb des gepolsterten Rechtecks aus und behält ohne Vorgabe seine
  Zentrierung. Farben und Seitenverhältnis bleiben erhalten.
- Unabhängige Node-Schalter `showIcon`, `showLabel`, `showStereotype`,
  `showDescription`, `showTechnology` ergänzt; boolesch, Standard jeweils true.
  Verdeckte Felder bilden keinen Textinhalt. Modellwerte, zugängliche Tooltips,
  Package-Kinder und Referenzidentitäten bleiben erhalten.
- `showIcon`/`showLabel` auch für fachliche `route`/`routes`-Labels ergänzt.
  Reine Icon-/Textlabels und komplette Ausblendung werden unterstützt;
  konkrete Angaben überschreiben Vorgaben pro Eigenschaft. `label none`
  bleibt die komplette Ausblendung; Zuordnungspfeile bleiben davon unabhängig.
- Englische Hilfe, Dokumentation und `examples/node-presentation.arch` mit
  Positions-/Sichtbarkeitsansichten aktualisiert. `npm run check` erfolgreich:
  beide Bundles gebaut, 151 Node-Testgruppen und vollständige Chromium-Suite
  bestanden. Alle zwölf Nicht-Container-Templates, alle vier Positionen,
  Schriftgrößen 8/32/64 bei Mindestbreite, beide Themes, Package-Köpfe,
  Logo-Seitenverhältnis und Sichtbarkeitskombinationen geprüft. Screenshots
  `node-icon-positions.png` und `node-visible-fields.png` visuell geprüft.


## Abgeschlossener Folgeauftrag: label none

- `label none` in `routes` und fachlichen `route`-Blöcken ergänzt. Die Option
  blendet den vollständigen Labelrahmen einschließlich Text und Icon aus.
  Konkrete Labelkoordinaten überschreiben eine globale Ausblendung und
  zeigen das Label samt geerbtem Icon wieder an, unabhängig von der Reihenfolge.
- Ausgeblendete Labels werden weder als Hindernisse noch für SVG-Grenzen
  berücksichtigt. Modelltexte, Kanten-Tooltips, referenzierte InformationElements
  und ihre Zuordnungspfeile bleiben erhalten. Verdeckte Icons werden nicht
  aufgelöst; freie und Bezier-Pfade behalten gültige Geometrie.
- Englische Hilfe, Dokumentation und Beispiel
  `examples/edge-label-visibility.arch` ergänzt. `npm run check` erfolgreich:
  Bundles neu gebaut, 144 Node-Testgruppen und vollständige Chromium-Suite
  bestanden. Globale Ausblendung, konkretes Wiedereinblenden, Icon-Unterdrückung
  und beide Themes geprüft; Screenshot `edge-label-none.png` visuell geprüft.


## Abgeschlossener Folgeauftrag: positionierbare Icons an Edge-Labels

- `icon PACK.NAME` und `iconPosition top|left|bottom|right` für fachliche
  Connected-Relationslabels ergänzt, als `routes`-Vorgabe und konkrete
  `route`-Eigenschaft. Standardposition links; `icon none` deaktiviert ein
  geerbtes Icon. Beide Eigenschaften werden unabhängig überschrieben.
- Icons innerhalb des Labelrahmens relativ zum Text angeordnet. Platzbedarf,
  mehrzeilige und reine Icon-Labels, Hindernisflächen und SVG-Grenzen werden
  gemeinsam berechnet; Farben und Seitenverhältnis bleiben erhalten.
  Wiederholte Iconify-Logos besitzen getrennte lokale SVG-IDs.
- Labeloptionen verändern weder Zuordnungspfeile noch Knoten-Iconpositionen.
  Knoten verwenden weiterhin die im Template festgelegte Position.
- Englische Hilfe, Dokumentation und Beispiel `examples/edge-label-icons.arch`
  mit allen vier Positionen ergänzt. `npm run check` erfolgreich: Bundles
  gebaut, 140 Node-Testgruppen und vollständige Chromium-Suite bestanden.
  Native Text-/Icon-Grenzen, farbige Logos, leere Labels und beide Themes
  geprüft; Screenshots `edge-label-icons.png` und `edge-label-icons-dark.png`
  visuell geprüft.


## Abgeschlossener Folgeauftrag: gemeinsame Routing-Vorgaben

- `routes { ... }` als viewweite Vorgabe für alle fachlichen Kanten und
  Zuordnungspfeile ergänzt, auch ohne einzelne Route-Blöcke. Unterstützt
  `from`, `to`, `via`, `curve`, `label`, `path`. Konkrete Angaben überschreiben
  Vorgaben feldweise, unabhängig von der Reihenfolge im Quelltext.
- Zielports/-punkte gelten für fachliche Kanten, numerische Zielpositionen von
  0 bis 1 für Zuordnungspfeile; Labels gelten für fachliche Kanten. Konkrete
  Geometrieangaben ersetzen einen geerbten freien Pfad. Leere Vorgaben bewahren
  die bisherige automatische Hindernisumgehung.
- Gemeinsame Auflösung der Vorgaben für Validierung und Rendering; effektive
  Bezier-Kontrollpunkte werden nach dem Zusammenführen geprüft. Globale
  Labelpositionen bleiben bei grafischen Referenzkarten unverändert.
- Englische Hilfe, Dokumentation und Walker-Routing-Beispiel aktualisiert.
  `npm run check` erfolgreich: Bundles gebaut, 135 Node-Testgruppen und komplette
  Chromium-Suite bestanden. Globale gerade Kanten mit einzeln abgerundetem
  Zuordnungspfeil im Browser und Screenshot geprüft.


## Abgeschlossener Folgeauftrag: kürzere Zuordnungsrouten

- Routing-Syntax auf `route ELEMENT_ID -> RELATION_ID { ... }` verkürzt.
  Der Parser unterscheidet Zuordnungspfeile anhand von `->` vom normalen
  `route RELATION_ID { ... }`; `reference` ist kein zusätzliches Schlüsselwort.
- Hilfe, Dokumentation, Walker-Beispiel und bestehende Tests auf die neue Form
  umgestellt. Das bisherige zusätzliche Schlüsselwort wird nicht mehr akzeptiert;
  normale Element-/Relations-IDs namens `reference` bleiben verwendbar.
- Beide Bundles neu gebaut; `npm run check` mit 130 Node-Testgruppen und
  vollständiger Chromium-Suite erfolgreich.


## Abgeschlossener Folgeauftrag: Zuordnungspfeile routen

- `route ELEMENT_ID -> RELATION_ID { ... }` ergänzt. Jede grafische
  Referenzverbindung ist unabhängig über Kartenport/absoluten Start, Wegpunkte,
  Kurven oder einen freien SVG-Pfad steuerbar. `to` wählt eine Position von 0
  bis 1 entlang des gerenderten Relationspfads, ohne Angabe bleibt der
  automatische Anker bestehen. Gemeinsame und perEdge-Karten werden unterstützt.
- Vorhandene Routing-Geometrie wiederverwendet; manuelle Pfade und Kontrollpunkte
  fließen in die Exportgrenzen ein. Ungültige Ziele, nicht vorhandene Referenzen,
  doppelte Routen, Ports, Kurven und Ankerpositionen erzeugen englische Diagnosen.
  Die Option ist auf Connected-Views beschränkt und verändert das Modell nicht.
- Hilfe unter `@help routing`, Profilreferenz und Spezifikation ergänzt;
  vollständiges Beispiel `examples/naf41-walker-routing.arch` hinzugefügt.
  Browserbundles neu gebaut. 130 Node-Testgruppen und vollständige Chromium-Suite
  erfolgreich; vier Positionswerte auf geraden, kubischen, quadratischen und
  Bogenpfaden in beiden Themes gegen native SVG-Geometrie geprüft.
  Screenshot `naf41-walker-routing.png` visuell geprüft.


## Abgeschlossener Folgeauftrag: gemeinsame InformationElements

- Grafische Referenzkarten erscheinen standardmäßig einmal je Element. Eine
  gemeinsame Karte erhält einen Zuordnungspfeil zu jeder tragenden Kante;
  ihre automatische Position berücksichtigt alle beteiligten Kanten.
- `referenceOccurrences shared | perEdge` als View-Option und vererbte
  JSON-Relationstyp-Vorgabe ergänzt. `perEdge` erlaubt getrennte Karten und
  kennzeichnet mehrfach dargestellte Elemente mit derselben sichtbaren ID.
  Bereits sichtbare oder explizit platzierte Karten bleiben gemeinsam.
- IDs besitzen einen separaten, geometrisch berücksichtigten Fußbereich;
  Modellidentität, Modellbeziehungen und eindeutige lokale SVG-IDs bleiben erhalten.
- Englische Hilfe, Profilreferenz, Spezifikation und Walker-Beispiel aktualisiert;
  Browserbundles neu gebaut. 124 Node-Testgruppen und vollständige Chromium-
  Suite erfolgreich. Shared-/perEdge-Screenshots am Walker-Beispiel geprüft.


## Abgeschlossener Folgeauftrag: einzeilige Stereotypen, Schrift/Größe und Cluster

- Lange Typ-/Stereotypzeilen in Connected-Karten werden nicht mehr umgebrochen,
  sondern einzeilig mit „…“ gekürzt; der vollständige Wert bleibt im Tooltip
  und unverändert im Modell erhalten.
- View-Styles `fontSize` (6–64), `width` (ab 160), `height` (ab 96) ergänzt.
  Titelschrift und proportionale Sekundärtexte besitzen gemeinsame Layout-/
  SVG-Metriken. Style-Mindestgrößen haben Vorrang vor place-size; Inhalte
  dürfen die Höhe und Containermaße weiterhin vergrößern.
- Bestehende Package-Container als Cluster dokumentiert: `Package` im
  NAF-/UAF-Profil, `package` im Standardprofil. Vollständiges Beispiel
  `examples/naf41-clusters.arch` mit Gruppen, Größen und Schrift ergänzt.
- Referenzkarten berücksichtigen Clusterrahmen/-köpfe bei ihrer Platzierung;
  bei unterschiedlich hohen Endknoten bleibt die Hauptausrichtung der Kante
  maßgeblich statt eines kurzen vertikalen Routingsegments.
- 122 Node-Testgruppen und vollständige Chromium-Suite erfolgreich;
  Mindestbreiten, Schriftgrößen 8/14/15/32/64, alle zwölf Nicht-Container-
  Templates, Tooltip-Vollständigkeit sowie Cluster-/Style-Beispiel geprüft.
  Screenshot `naf41-node-styles.png` erstellt.

## Abgeschlossenes Folgebeispiel: Datacenter–Walker–Factory

- L3-Modell `examples/naf41-walker-transfer.arch` erstellt: Datacenter und
  Factory als Cluster, der Walker als eigenständiger OperationalPerformer,
  zwei gerichtete LogicalInteractions mit demselben InformationElement.
- Modellvalidierung erfolgreich. Browserprüfung bestätigt zwei fachliche
  Kanten, einen Walker und zwei visuelle Vorkommen desselben Datenpakets.
  Vollständige Chromium-Suite erneut erfolgreich; Screenshot
  `naf41-walker-transfer.png` und aktuelles Cluster-/Style-Beispiel visuell geprüft.

## Abgeschlossener Folgeauftrag: grafische Kantenreferenzen und Logo-Karten

- NAFv4.1 S.132 vollständig visuell geprüft: Informationsprodukte sind als
  eigene Kästen mit Pfeilen zur tragenden Austauschlinie dargestellt.
- Connected-Renderer um profilgenerische Referenzkarten ergänzt, mit
  `referenceDisplay nodes|labels|both` als Relationsvorgabe und View-Override.
  `LogicalInteraction` verwendet im NAFv4.1-Profil standardmäßig Karten.
  Vorhandene Templates, Farben und Icons bleiben erhalten. Wiederverwendete
  Elemente erhalten visuelle Vorkommen, keine zusätzlichen Modellbeziehungen.
- Automatische Platzierung hält Karten von Knoten/Labels fern; explizites
  `place` bleibt wirksam. Anker auf Linien, Cubics, Quadratics und Bögen
  anhand des echten SVG-Pfades bestimmt und im Browser gegen SVG-Geometrie
  geprüft. Karten, Zuordnungspfeile und Beschriftungen erweitern die SVG-Bounds.
- `style ID {display logo icon PACK.NAME}` ergänzt: viewlokales Rechteck mit
  zentriertem Logo ohne sichtbare Texte. Seitenverhältnis/feste Farben sowie
  zugängliche Titel bleiben erhalten; auch an Referenzkarten nutzbar.
  `display standard` stellt die gewohnte Darstellung wieder her.
- Vollständiges Beispiel `examples/naf41-logos.arch` hinzugefügt; Hilfetexte,
  Profilanleitungen und SPEC aktualisiert. Nur Connected-Views unterstützen
  die neuen grafischen Präsentationsmodi; andere Renderer melden bei einer
  expliziten unpassenden View-Einstellung einen verständlichen Fehler.
- 119 Node-Testgruppen erfolgreich. Chromium-Suite mit Originalbeispiel,
  Mehrfachreferenzen, Kurvenankern, SVG-Bounds, Logoformaten, beiden Themes
  und Offline-Einbindung erfolgreich. Der lokale Browser-Testserver benötigte
  wegen einer EPERM-Portbeschränkung die erlaubte Ausführung außerhalb der
  Sandbox. Screenshots `naf41-user-l3.png` und `naf41-user-logos.png` visuell geprüft.

## Abgeschlossener Folgeauftrag: sichtbare Austauschinformationen an Kanten

- Das konkrete Fighter-/Controller-Beispiel übernommen und eine sichtbare
  Beschriftung `controlls` / `Conveys: Controll [i]` am Austausch ergänzt.
- Profilgenerische Relationsmetadaten `referenceLabels` eingeführt. Der
  Connected-Renderer löst skalare/mehrwertige Referenzen zu Titeln plus IDs auf;
  doppelte Titel bleiben eindeutig. Das Modell und der Beziehungstitel werden
  nicht verändert; es entstehen keine zusätzlichen fachlichen Beziehungen.
- UAF-`conveyed`-Beziehungen und die NAFv4.1-Interaktions-/Flussadapter
  entsprechend konfiguriert. Leere Titel, ausgeblendete referenzierte Karten,
  Vererbung, explizite Deaktivierung und Escaping geprüft. Labelgrößen und
  SVG-Bounds berücksichtigen alle Zusatzzeilen.
- `npm run check`: 114 Testgruppen und vollständige Chromium-Suite erfolgreich.
  Das Originalbeispiel in beiden Themes getestet und `naf41-user-l3.png`
  visuell kontrolliert. Bundles/Profile neu gebaut; Hilfe und Spezifikation
  um die explizite Connected-Darstellung ergänzt.

## Abgeschlossener Folgeauftrag: nutzbares NAFv4.1-Anwendungsprofil

- Separates `naf41-uaf`, Version `4.1.0-arch.1`, mit allen 47 Viewpoint-IDs
  der NATO-Ausgabe 2026.03 erstellt. UAF-1.0-Basis bleibt reproduzierbar;
  72 ausdrückliche Anwendungsadapter und 92 zusätzliche Relationsabbildungen
  ergeben insgesamt 285 Knoten-/135 Relationstypen. Kein offizielles NATO-/
  OMG-Profil und keine Behauptung vollständiger normativer Konformität.
- `profiles/naf41/catalog.mjs` als editierbare Quelle, deterministischer Build,
  JSON, Einzel-/Sammelregistrierung und Abdeckungsnachweise ergänzt. Quellseiten
  und verbleibende Prüfgrenzen stehen auch in der englischen Profilhilfe.
- Die zusätzliche ADMBw-MDG 2026.05 mit Windows-1252 gelesen: 318
  Domänenstereotypen; erklärte Grundlage NAF 4.0 plus Bundeswehr-Erweiterungen.
  Vergleichsdaten/Hash festgeschrieben; keine Scripts/Toolboxes importiert.
  Anders bedeutende Beziehungen (insbesondere Evaluates/ImplementsProtocol)
  bleiben ausdrücklich von den NAFv4.1-Anwendungsabbildungen getrennt.
- Profilgenerische Dokumentationsfelder, Gegenstellentypfilter für
  Viewpoint-`connections` und sichtbare Zielprüfungen für ausgewählte
  Referenzattribute auf Knoten/Kanten ergänzt. Keine NAF-Sonderlogik im Kern.
- `examples/naf41.arch` mit neun Views integriert. Neue englische Hilfen
  zeigen Kriterienketten, Needlines, Kandidaten und gerichtete Beziehungen.
  Die Klassensicht kann mit `propertyFields` echte Eigenschaftswerte und
  Referenz-IDs darstellen; P4-Beispiel manuell übersichtlich angeordnet.
- 110 Node-Testgruppen erfolgreich, darunter alle 47 unabhängigen
  Viewpoint-Szenarien und gezielt fehlerhafte Kriterienketten, Allokationen,
  Referenzen und Versionszyklen. Browserprüfung deckt beide Themes, neun
  Beispielviews, englische Hilfe, Live-Fehlerkorrektur und file:// ab.
- Eine neue Browserassertion verwendete zunächst HTMLElement-innerText für
  eine SVG-Gruppe; auf textContent korrigiert. Die Anzeige selbst war gültig.
- Anschließende komplette Chromium-Suite erfolgreich; aktuelle Needline-
  Eigenschaftsanzeige und P4-Anordnung visuell kontrolliert. Beide Bundles
  mit Einzel- und Sammelprofilregistrierung im isolierten VM-Kontext geprüft.
  24 generierte Dateien nach erneutem Build byteidentisch (SHA-256).
- SPEC, ROADMAP, HELP, README und Profilanleitungen aktualisiert. Die
  geerbten offenen UAF-Regeln und zusätzliche fachliche Prüfgrenzen bleiben
  im Abdeckungsbericht ausdrücklich ausgewiesen.

## Abgeschlossener Folgeauftrag: erlaubte Beziehungen je Knotentyp

- `@help connections [PROFILE [TYPE]]` ergänzt; eingehende und ausgehende
  Relationen mit konkreten Gegenstellen, allowSelf/acyclic und Detailbefehlen.
- Profilgenerische Ermittlung berücksichtigt `from`/`to`, Vererbung, `pairs`
  und deren Quell-/Zielausschlüsse. Der Paarvergleich wird mit der bestehenden
  Modellvalidierung geteilt; abstrakte Relationen/Gegenstellen werden ausgelassen.
- Typ- und Relationshilfe verlinken die neue Abfrage. `.` funktioniert für
  aktuelle Dokument-/API-/Inline-Profile. Weitere Attribut-, Kardinalitäts- und
  Viewpoint-Regeln bleiben Modellprüfungen.
- Vier neue Testgruppen prüfen Richtungen, geerbte Endpunkte, Paar-Ausschlüsse,
  abstrakte Typen, Selbstbeziehungen, Inline-Profile und alle Kombinationen eines
  unabhängigen Beispielprofils gegen die Modellvalidierung. UAF-Abfrage mit
  sechs ausgehenden und fünf eingehenden Relationen erfolgreich geprüft.
- Abschluss: `npm run check` mit **98 Testgruppen** und vollständiger Chromium-
  Suite erfolgreich. Beide Themes, Textgrenzen, bestehende Render-Adapter und
  die UI-Abfrage im UAF-Profil geprüft. `help-connections.png` visuell kontrolliert.
- Kompakte Relationsübersicht steht vor den Gegenstellendetails. Beide Bundles
  neu gebaut; alle 15 generierten Dateien nach erneutem Build byteidentisch.
  Für diesen Folgeauftrag sind keine Arbeiten offen.

## Abgeschlossener Folgeauftrag: englische Bibliothekstexte

- Eingebaute Hilfe einschließlich Beispiele, Überschriften, Such-/Seitenhinweise
  und SVG-Zugänglichkeit auf Englisch umgestellt.
- Parser-, Profil-, Diagramm-, Layout-, Icon- und API-Diagnosen übersetzt;
  Quellpositionen heißen jetzt line/column. Fehlercodes und strukturierte
  Diagnosen bleiben erhalten, ebenso Syntax und Validierungsregeln.
- Bestehende Prüfungen auf die englischen Texte angepasst. Beide Browserbundles
  neu gebaut. Alle 94 Testgruppen und die vollständige Chromium-Suite sind
  erfolgreich; englische Übersicht und Kandidatenhilfe visuell kontrolliert.

## Abgeschlossener Folgeauftrag: Kandidaten für abstrakte Typen

- Konkrete Untertypen generisch aus `abstract` und `extends` ermitteln,
  einschließlich indirekter und mehrfacher Vererbung. Funktioniert für Knoten
  und Beziehungen in UAF und eigenen Profilen.
- Fehlermeldungen nennen bis zu zwölf Kandidaten und einen Hilfebefehl;
  strukturierte Diagnosen enthalten zusätzlich die vollständige `candidates`-
  Liste und `help`. Ohne konkrete Untertypen wird dies ausdrücklich angegeben.
- Detailhilfe für abstrakte Typen zeigt die konkreten Alternativen vor den
  Regeldefinitionen. `.` wählt das aktuelle Dokument-/API-Profil, auch inline.
- Fünf neue Testgruppen prüfen generische Profile, Beziehungen, leere/lange
  Kandidatenlisten, Inline-Profile und das konkrete OperationalAgent-Beispiel.
- Browser bestätigt Kandidatenmeldung für `OperationalAgent r "fighter"`,
  Hilfe über das aktuelle UAF-Profil und erfolgreiches Rendering nach Wechsel
  auf `OperationalPerformer`. Fehlerisolation, Mobil- und file://-Start bleiben
  erfolgreich. Alle 15 Buildausgaben nach erneutem Build byteidentisch.
  Für beide Folgeaufträge sind keine Arbeiten offen.

## Abgeschlossener Folgeauftrag: eingebaute @help-Referenz

- Eigenständige Hilfeblöcke mit Themenübersicht, Sprachsyntax, View-/Stil-/Routing-
  Einstellungen, Farben, Diagrammoptionen und JavaScript-API implementiert.
- Registry-basierte Pack-/Profilübersicht sowie Detailabfragen für Typen,
  Beziehungen und Viewpoints einschließlich geerbter Regeln ergänzt. Iconlisten
  mit Teilstringsuche, Aliasnamen und 100 Namen pro Seite; keine Datei-/URL-Lader.
- Bestehende Parse-/Validierungs-/Layout-/Render-APIs unterstützen Hilfedokumente;
  zusätzlich liefert `arch.help(query, options)` Text. Inline-SVG bleibt offline
  verwendbar, markierbar und exportierbar, mit Theme/Umbruch/isolierten IDs.
- Editierbares Hilfebeispiel und README/SPEC/HELP.md ergänzt. Unit-, Bundle- und
  Browserprüfungen sowie visuelle Kontrolle erfolgreich: zunächst 88 Testgruppen,
  mobile/offline Hilfe und Export. JSON-Einrückung im SVG explizit erhalten.
- Nach Nutzerbeispiel auch `architecture "Test" { @help profiles; model {} }`
  integriert: Direktive auf Architekturebene, per Zeile/Semikolon abgeschlossen,
  genau eine Anfrage; Config-Profilwahl bleibt wirksam. Die Hilfe ersetzt die
  Diagrammausgabe und überspringt fachliche Regeln des noch bearbeiteten Modells.
  Regressionstest mit dem exakten mehrzeiligen Nutzerbeispiel ergänzt.
- Abschlussprüfung erfolgreich: `npm run check` mit **89 Testgruppen** und
  vollständiger Chromium-Suite. Eigenständige und eingebettete Hilfeblöcke,
  Fehlerisolation, Profilwahl, Registry-Abfragen, Suche/Seiten, Unicodegrenzen,
  Einrückung, Themes und SVG-Export geprüft. Mobile Darstellung und direkter
  Start über file:// funktionieren; keine externen Anfragen oder JS-Fehler.
- Screenshots der Übersicht, UAF-Regeln und Iconsuche visuell kontrolliert.
  Beide Browserbundles neu gebaut. Für den Help-Auftrag sind keine Arbeiten offen.

## Abgeschlossener Folgeauftrag: Iconify direkt registrieren

- Originales Iconify-JSON soll über die bestehende `registerIconPack`-API
  funktionieren; der Preview-Loader bleibt unverändert.
- DOM-unabhängige SVG-Prüfung, Alias-/Dimensions-/Transformationsauflösung und
  feste Farben ergänzen. Lokale Gradienten, Masken und Clip-Pfade für Logos
  berücksichtigen; IDs pro Ausgabe isolieren.
- Originale Font-Awesome-/Logo-Packs einer festen Iconify-Revision zur Prüfung
  heruntergeladen. Bestehende konvertierte Packs bleiben kompatibel.
- Registrierung/SVG-Ausgabe für alle fünf festgeschriebenen Originalsammlungen
  implementiert; 14.977 Icon-/Aliasnamen werden ohne Vorabkonvertierung geprüft.
- Nutzer hat fünf zusätzliche Referenzdateien unter `ReferenceDocs/iconpacks/`
  bereitgestellt. Ihre 12.608 Icon-/Aliasnamen werden ebenfalls direkt geprüft.
  Dabei die vollständigen Affinity-SVG-Exporte mit XML-/SVG-1.1-Header,
  Namespace-Metadaten, ViewBox und px-Stilen als weitere Eingabeform ergänzt.
- Interne SVG-IDs pro Instanz isoliert; Referenzen bleiben lokal, aktive/
  externe Inhalte werden abgewiesen. Prozentgeometrien erhalten pro Icon einen
  eigenen Viewport. Die Registry wird bei Fehlern nicht teilweise überschrieben.
- XML-Parser und Pfadnormalisierung sind in den Browserbundles enthalten. Für
  direkte Node-Imports sind die bereits gepinnten Pakete jetzt reguläre
  dependencies. Lizenztexte als THIRD_PARTY_NOTICES.md und in beiden Bundles.
- README, SPEC, Iconpack-Anleitung und Roadmap aktualisiert. Originaldaten und
  Nutzerreferenzen mit Revision/Hashes bzw. Herkunft nachgewiesen.
- Zwischenprüfung: alle 80 Testgruppen und komplette Chromium-Suite erfolgreich,
  inklusive Original-SVG-Rastervergleichen mit Affinity, Logos und Font Awesome.
  Abschlussprüfung nach Größen-/Viewport-Nachkorrektur ebenfalls erfolgreich:
  `npm run check` mit **80 Testgruppen** und kompletter Chromium-Suite.
- `test-results/iconify-originals.png` visuell kontrolliert. Browser prüft
  Originaltreue von Farben, Gradienten, Masken/Filtern, Alias-Rotation/Spiegelung,
  wiederholte lokale IDs und Inline-Registrierung direkt über file://.
- Originaldaten unter ReferenceDocs unverändert; alle fünf Hashes geprüft.
  Standardsichere Exporte ohne Iconify-Dimensionen werden aus absoluten Größen
  oder ViewBox normalisiert. Fehlende Nutzerdateien in anderen Checkouts werden
  vom zusätzlichen Referenztest diagnostiziert; Basistests sind unabhängig davon.
- Alle **15 generierten Dateien** nach erneutem Build SHA-256-byteidentisch.
  Beide Bundles enthalten die Lizenztexte der eingebetteten Hilfsbibliotheken.
  Lokale Dokumentationslinks geprüft. Für diesen Auftrag sind keine Arbeiten offen.

## Folgeauftrag: CSS3-Farbnamen und style opacity

- Alle 147 festen CSS3-Farbnamen aus der versionierten W3C-Farbtabelle
  übernommen, inklusive Aliasnamen und unabhängig von Groß-/Kleinschreibung.
- Gemeinsamer DOM-unabhängiger Resolver für Profil-/Gruppenfarben, View-Farben,
  Akzente und Heatmap-Endfarben. Namen werden intern zu Hexwerten aufgelöst.
- UAF-Präsentationskonfiguration auf lesbare Namen umgestellt; keine fachlichen
  Regeln geändert. Minimalbeispiel zeigt benannte Farben und `opacity 0.55`.
- View-`style.opacity` als numerische Fülltransparenz 0–1 implementiert. Standard
  bleibt 0,2 für farbige Hintergründe. Text/Icons/Rahmen bleiben deckend;
  Kontrast berücksichtigt Opacity und verschachtelte Container.
- Dokumentation fortgeschrieben. Tests umfassen alle Farbnamen, beide Themes,
  Parser/Profil/JSON-Integration, Heatmap-Gleichheit, Grenzwerte und Kontrast.
  Abschluss: `npm run check` erfolgreich mit **71 Testgruppen** und kompletter
  Chromium-Suite. Alle 147 Farbwerte stimmen mit Chromiums Auflösung überein.
  Browser prüft zusätzlich benannte Farbe und `fill-opacity=0.55` im Minimalbeispiel.
- Beide Bundles und Profile neu erzeugt. Ein anfänglicher Heatmap-Test ersetzte
  versehentlich den Attributbereich statt der View-Konfiguration; der Test wurde
  korrigiert. Der Browservergleich wurde an die kleingeschriebenen äquivalenten
  Hexwerte der benannten Farben angepasst. Abschließende Prüfung vollständig grün.

## Folgeauftrag: exclude für Ansichten

- `exclude ID, ID, …` implementiert; Ausschlüsse gewinnen unabhängig von der
  Reihenfolge gegenüber Include-Auswahl und automatischen Container-Erweiterungen.
- Ausgeschlossene Container entfernen ihre gesamten Teilbäume. Vorfahren werden
  erst für überlebende Include-Auswahlen ergänzt, damit keine leeren automatisch
  eingeblendeten Container zurückbleiben. Explizite Container-Auswahl bleibt wirksam.
- Beziehungen zu ausgeblendeten Knoten verschwinden. Alle Renderer und die
  Viewpoint-Prüfung verwenden dieselbe Auswahl; Modellregeln gelten weiterhin global.
- Syntaxfarben, Dokumentation und Minimalbeispiel mit zweiter View ergänzt.
  Drei Testgruppen für Konflikte, Hierarchien, Referenzen, Snapshot-Isolation,
  Spezialrenderer und Profilregeln erfolgreich.
- Abschluss: `npm run check` erfolgreich, alle **68 Testgruppen** und komplette
  Chromium-Suite bestanden. Browser prüft explizit den Include-/Exclude-Konflikt
  im Minimalbeispiel, das Verschwinden der betroffenen Kante und die
  unveränderte vollständige Ansicht. Beide Bundles neu erzeugt.
- README, SPEC und Diagrammanleitung aktualisiert; insgesamt neun Modelle /
  32 Ansichten.

## Folgeauftrag: Klassenansicht gestalten

- Klassenkarten mit abgerundeten Ecken, dezentem Schatten und abgesetztem
  Kopfbereich überarbeitet. Titel und Stereotyp haben eine klare Hierarchie.
- Detailbereiche mit feinen eingerückten Trennlinien, Anzahl-Badges und
  Monospace-Signaturen gestaltet; Einträge erhalten kleine Funktionssymbole.
- Mehr Abstand und breitere Karten, Ports mit abgerundeter Fassung und Punkt.
  Hintergrundfarben mit 0,2 Fülltransparenz bleiben erhalten.
- `npm run check` erfolgreich: alle 65 Testgruppen und vollständige Chromium-
  Suite. Klassendiagramm in beiden Themes visuell kontrolliert; keine
  abgeschnittenen Beschriftungen. Beide Bundles neu erzeugt.
- `SPEC.md` und `DIAGRAMS.md` um die neue Gestaltung fortgeschrieben.

## Abgeschlossener Folgeauftrag: zusätzliche Diagrammrenderer

1. Eigene View-Konfiguration und Validierung für sieben Darstellungen ergänzen.
2. Sequenz, Zustand, Swimlanes, Matrix, hierarchische Heatmap, Timeline und
   Klassenansicht mit sicheren SVG-Ausgaben implementieren.
3. Editierbare Beispiele und Oberfläche integrieren; Grenzen dokumentieren.
4. Positive/negative Tests, Browser- und Sichtprüfung sowie Reproduktion prüfen.

Die vorhandene Profilvalidierung bleibt wirksam. Neue Renderer erhalten
explizite View-Angaben für Reihenfolge, Zuordnungen, Zeit-/Wertattribute und
Detailbereiche. Keine Behauptung vollständiger UML-/BPMN-/NAF-Konformität.

### Umsetzung und Abschlussprüfung

- Alle vier Arbeitsschritte abgeschlossen. View-Syntax `diagram TYPE { … }`
  ergänzt; Standard bleibt `connected`. Die sieben zusätzlichen Renderer liegen
  generisch in `src/diagrams.js`, ohne Framework-Sonderfälle oder neue Abhängigkeiten.
- Sequenz: geordnete Teilnehmer/Nachrichten, Lebenslinien, synchrone/asynchrone
  Nachrichten, Rückgaben, Selbstnachrichten und kurze Aktivierungsmarkierungen.
- Zustand/Aktivität: Initial-/Endnotation, Übergänge, Entscheidungen, Fork-/Join-
  Balken, Lanes und Eigentümerzuordnung mit lokalen Strukturprüfungen.
- Matrix: gerichtete Beziehungen mit Typfilter, Mehrfachzählung und Tooltip.
  Heatmap: echte eingebettete Hierarchie, Wertebereich, Farbskala und fehlende Werte.
- Timeline: ISO-Zeiträume, UTC-Achse, Meilensteine und Abhängigkeiten.
  Klassenansicht: Attribute, Methoden/Funktionen, zugeordnete Parameter,
  Interfaces und sichtbare Ports. Signaturen sind Text, keine Programmausdrücke.
- Eigenständige Layouts/SVG-Primitive integriert; alle bisherigen Einbettungs-
  APIs und die Profilvalidierung bleiben nutzbar. Speziallayouts verbieten
  Connected-`place`/`route`, damit Einstellungen nicht stillschweigend ignoriert werden.
- `examples/diagrams.arch` mit sieben editierbaren Views und neuer Galerieauswahl
  integriert. Insgesamt neun Modelle / 31 Views. Labels wortweise umgebrochen;
  lange allgemeine Labels maximal zweizeilig mit vollständigem Tooltip.
- Anleitung `DIAGRAMS.md`, README, SPEC, Profilanleitungen und Roadmap aktualisiert.
  Der UAF-Abdeckungsnachweis verweist auf die explizite Rendererwahl; seine
  bestehenden fachlichen Lücken gelten weiterhin. Weitere Interaktionsfragmente,
  hierarchische Zustände und vollständige UML-/BPMN-Verhaltensregeln bleiben offen.
- `npm run check` erfolgreich: **65 Testgruppen** sowie gesamte Chromium-Suite.
  Neue Tests prüfen alle sieben Layouts in beiden Themes, Reihenfolge, lokale
  Semantik, unzulässige Referenzen/Optionen, Escaping, leere Modelle,
  Snapshot-Isolation, Markdown und Gleichheit beider Bundles mit den Quellen.
- Browser: alle neuen Views in beiden Themes ohne abgeschnittene SVG-Inhalte,
  Live-Fehlerkorrektur, echter SVG-Download mit Spezialdiagramm und alle sieben
  Ansichten direkt über `file://` erfolgreich. Bestehende Tests unverändert grün.
- Screenshots `test-results/diagram-*-light.png` / `*-dark.png` erzeugt;
  Sequenz, Zustand, Swimlanes, Matrix, Heatmap, Timeline und Klasse visuell geprüft.
- Alle 15 generierten Dateien nach erneutem Build per SHA-256 byteidentisch.
  Lokale Dateilinks der neuen und aktualisierten Anleitungen geprüft.

## Folgeauftrag: transparente Hintergrundfüllungen

- Farbige Knoten-/Containerfüllungen auf `fill-opacity="0.2"` gesetzt.
- Text, Icons und Rahmen bleiben deckend; Kontrast wird gegen die sichtbare
  Mischfarbe einschließlich verschachtelter Container berechnet.
- Tests für beide Themes, alle Templates und verschachtelte Hintergründe
  angepasst. `npm run check` erfolgreich: alle 56 Testgruppen und die komplette
  Chromium-Suite. Farbansicht in beiden Themes visuell kontrolliert.
- `SPEC.md` und Profilanleitungen auf die transparente Füllung und die
  Kontrastberechnung gegen den tatsächlichen Untergrund abgestimmt.

## Folgeauftrag: semantische Hintergrundfarben

- [x] Bestätigte Paketzuordnung und neutrale Zusatzbereiche festgelegt.
- [x] Generische Stilgruppen, Hintergrundfarben und View-Overrides ergänzt.
- [x] UAF-Präsentationskonfiguration mit Paket-/Typzuordnung integriert.
- [x] Alle Templates mit unveränderten Hintergründen in beiden Themes und
  kontrastreichen Text-/Akzentfarben erweitert.
- [x] Neunte UAF-Ansicht mit fünf Farben und neutralem Element ergänzt;
  insgesamt acht Modelle / 24 Views. Dokumentation und Roadmap fortgeschrieben.
- [x] Abschließende Tests, Browser-Sichtprüfung und Reproduktionsprüfung.

Die Farbkonfiguration liegt in `profiles/uaf/presentation.json`; erzeugte Profile
bleiben separate Laufzeitdaten. Quellenzuordnungen werden im Abdeckungs-JSON
pro Stereotyp dokumentiert. Es gibt keinen neuen Diagrammrenderer.

Abschluss: `npm run check` erfolgreich mit **56 Testgruppen** und kompletter
Chromium-Suite. Alle 211 nativen Typzuordnungen gegen ihre XMI-Pakete geprüft;
Mehrfachvererbung und neutrale Adapter explizit berücksichtigt. Tests prüfen
Gruppen-/Profilvererbung, Snapshots, Inline-Syntax, direkte und View-Farben,
ungültige Gruppen/Farben und alle 13 Templates in beiden Themes. Zwei neue
Testfehler waren fehlerhafte Testaufrufe (Layout ohne Parse, abweichende Profil-ID)
und wurden korrigiert; der abschließende Lauf ist vollständig erfolgreich.

Screenshots `test-results/uaf-colors-light.png` und `uaf-colors-dark.png` visuell
kontrolliert. Browser prüft die exakten fünf Füllfarben und den neutralen
Theme-Hintergrund; bestehende SVG-Downloads und Offline-Starts bleiben geprüft.
Nach erneutem Build sind alle 15 generierten Dateien per SHA-256 byteidentisch.

## Abgeschlossener Folgeauftrag: UAF-/NAF-Profil

- [x] Bestehende Profil-Engine und vorhandene NATO-Referenzen geprüft.
- [x] Version und nachvollziehbaren Profilumfang aus den NATO-/OMG-Quellen festlegen.
- [x] UAF-Typen, Beziehungen und NAF-Viewpoints als separates Datenprofil erstellen.
- [x] Benötigte zusätzliche Prüfregeln generisch in der Engine ergänzen.
- [x] Editierbares UAF-Beispiel und Offline-Registrierung integrieren.
- [x] Quellen-/Abdeckungsnachweis, SPEC, Anleitung und Roadmap fortschreiben.
- [x] Positive/negative Profiltests, Regressionen und Browserdarstellung prüfen.

### UAF-/NAF-Profil: Umsetzung

- Quellenbindung: normative OMG-UAFP-XMI für **UAF 1.0** heruntergeladen und
  unter `ReferenceDocs/uaf/UAFP-1.0.xmi` abgelegt. Die mitgelieferte NATO-
  UAF-Leitlinie von März 2019 verwendet diesen Stand. Quellen, Versionen und
  SHA-256-Werte in `profiles/uaf/sources.lock.json` festgeschrieben. NAFv4.1
  dient nur zur Abgrenzung; kein Vermischen mit UAF 1.3 oder neuerer NAF-Semantik.
- `scripts/build-uaf.mjs` extrahiert alle **211 nativen Stereotypen**, davon
  **33 abstrakt**, mit Vererbung und schreibbaren Attributen aus dem XMI.
  `Package` und `Requirement` sind 2 ausdrücklich markierte Adapter; insgesamt
  213 Knotentypen. Native Multiplizitäten gelten einschließlich Pflichtfeldern;
  Metamodell-Defaults werden nicht automatisch eingesetzt.
- 100 native schreibbare Attributdefinitionen und 23 explizite UML-Adapterfelder
  übernehmen Datentypen, Enums, Multiplizitäten und Referenzziele. Sieben native
  abgeleitete Felder sind nicht schreibbar und werden nicht berechnet.
- 43 binäre Beziehungsabbildungen mit Quellenbezug; bedingte Typkombinationen
  für `IsCapableToPerform`, `PerformsInContext` und `Implements` als Paare.
  `ProtectsInContext` / `SameAs` wegen unaufgelöster Quelltypen bewusst ohne
  binäre Abbildung. Native Beziehungsknoten bleiben eigenständig modellierbar.
- Basisprofil `profiles/uaf.json` und abgeleitetes `profiles/naf4-uaf.json`
  erzeugt. Letzteres fordert einen von 20 ausgewählten strukturellen Viewpoints
  pro Ansicht. Die Viewpoint-Regeln sind eine deklarierte Teilabdeckung,
  keine vollständige NAF-Konformitätsprüfung.
- Generische Engine erweitert: Mehrfachvererbung, Konflikterkennung bei
  geerbten Attributen, flache Listen, typisierte Modellreferenzen, URI-/Datums-
  formate, Feldvergleiche, bedingte Relationspaare mit Ausschlüssen,
  Zyklusprüfung und Allokationsprüfung pro sichtbarem Element. Kein UAF-
  Sonderfall in `src/`. Generalisierung als siebter Kantenstil ergänzt.
- DSL um Listen und zusätzliche Inline-Regelfelder erweitert. Komplexere
  `pairs` / `comparisons` / `connections` bleiben reine JSON-Profilfelder.
- Build ordnet Profile nach Abhängigkeiten und erzeugt kombinierte sowie
  einzelne lokale Registrierungsscripts. UAF bleibt außerhalb von `arch.js`;
  Start über `file://` ohne Fetch möglich. Keine neuen npm-Abhängigkeiten.
- Editierbares Search-&-Rescue-Beispiel `examples/uaf.arch` mit acht Ansichten
  integriert. Oberfläche jetzt acht Modelle / 23 Ansichten. Übersicht und
  Realisierung mit manueller Kantenführung lesbar angeordnet. Weiterhin nur
  Knoten-Kanten-Diagramme, keine neuen Spezialrenderer.
- `profiles/uaf/README.md` erklärt Version, Einbindung, Adapter und Grenzen.
  Generierte `coverage.json` / `COVERAGE.md` weisen geprüfte Regeln und 125
  nicht als vollständig umgesetzt ausgewiesene native Regeln mit Quell-IDs
  aus. `README.md`, `SPEC.md`, `profiles/README.md` und `ROADMAP.md` aktualisiert.
- Zwischenprüfung: alle **53 Testgruppen** erfolgreich. Neue generische Tests
  unabhängig von UAF; Fachtests mit Gegenbeispielen und eigenständigen gültigen
  Architekturen für sämtliche 20 unterstützten Viewpoints. Gesamte Chromium-
  Suite bereits erfolgreich; finale Prüfung nach Dokumentation/Layoutkorrektur folgt.

### UAF-/NAF-Profil: abschließende Verifikation

- `npm run check` erfolgreich: Build, **53 Testgruppen**, komplette Chromium-
  Suite mit allen acht Modellen / 23 Ansichten, bestehenden Iconpacks,
  Profilparametern und sämtlichen Einbettungs-APIs.
- UAF-Browserprüfung: Profilwahl, Capability-Taxonomie mit korrektem
  Generalisierungsmarker, Realisierungsansicht, absichtlich falsches
  `Implements`-Endpunktpaar, lesbare Diagnose und Wiederherstellung geprüft.
- Direkter Start über `file://` einschließlich UAF-Beispiel erfolgreich;
  keine externen HTTP-Anfragen und keine JavaScript-Fehler. Desktop/Mobil,
  SVG-/Quelltextexport und Text-/Pfadgrenzen bleiben erfolgreich geprüft.
- `test-results/uaf.png` und `test-results/uaf-traceability.png` nach finalem
  Layout visuell kontrolliert; Realisierungslabels liegen frei zwischen den
  Knoten. Keine zusätzlichen Diagrammrenderer implementiert.
- Separate Einbindung mit `arch.min.js`, `profiles/uaf.js` und
  `profiles/naf4-uaf.js` unabhängig vom kombinierten Script ausgeführt;
  Minimalbeispiel aus `profiles/uaf/README.md` validiert und gerendert.
  Alle 38 lokalen Dokumentationslinks der geprüften Anleitungen existieren.
- Erneuter Build ohne Netz: alle **15 generierten Dateien** per SHA-256
  byteidentisch. Dies umfasst Bundles, Beispielscript, Iconpack-Dateien,
  kombinierte und einzelne Profilscripts, beide UAF-/NAF-JSONs sowie
  `coverage.json` und `COVERAGE.md`.
- Verwendbares Ergebnis vollständig ausgeliefert. Verbleibende fachliche
  Lücken und Grenzen stehen im Abdeckungsnachweis und in `ROADMAP.md`;
  es wird keine vollständige UAF-/NAF-Zertifizierung behauptet.

## Abgeschlossener Folgeauftrag: generische Architekturprofile

- [x] Umfang festgelegt: Framework-neutrale Engine; Profilwahl per API-Parameter
  oder vereinfachtem DSL-`config`-Block. Keine eingebauten NAF-Sonderfälle.
- [x] Entwurf: getrennte semantische Typen und grafische Templates, Profilregistry,
  Datentypen/Pflichtattribute/Enums, Vererbung, Endpunktregeln, Containerregeln,
  Kardinalitäten und deklarative Viewpoints. Bestehende Sprache als Standardprofil.
- [x] Profilregistry und Schema-/Modellvalidierung implementieren.
- [x] Parser, Layout, Renderer und sämtliche Einbettungs-APIs integrieren.
- [x] JSON- und Inline-Beispiele in die Oberfläche aufnehmen.
- [x] Spezifikation, Anleitung und Roadmap fortschreiben.
- [x] Profiltests, Regressionstests und Browserprüfung abschließen.

### Generische Profile: Umsetzung und abschließende Prüfung

- Neue framework-neutrale Profil-Engine in `src/profiles.js`; grafische Templates
  und Kantenstile sind unabhängig von fachlichen Typen. Die bisherigen Typen
  bilden das eingebaute Profil `default` und erhalten die bestehende Syntax.
- Öffentliche API: `registerProfile`, `getProfiles`, `getProfile`, `validate` und
  `options.profile` bei Parse/Layout/Rendering/Markdown/DOM-Integration. Auswahl
  als registrierte ID oder direktes JSON-kompatibles Profilobjekt.
- Auswahlreihenfolge: API-Parameter vor Dokumentauswahl/Inline-Profil vor
  Standardprofil. Ein API-Profil wird nicht durch lokale Regeln abgeschwächt.
  Im Dokument kann `config { profile ID }` ein registriertes Profil wählen oder
  `config { type … relation … viewpoint … }` ein eigenes Profil definieren.
- Beide Konfigurationswege verwenden denselben Validator: einfache Vererbung,
  abstrakte Typen, skalare Attribute, Pflichtwerte, Enums und Grenzwerte,
  Relationsendpunkte, Selbstbeziehungen, Container-Kindtypen, ein-/ausgehende
  Kardinalitäten sowie erlaubte und verpflichtende Typen je Viewpoint.
- `parse` speichert ein unveränderliches expandiertes Profil im Modell. Frühere
  Modelle bleiben bei Registry-Änderungen reproduzierbar. Bereits geparste
  Modelle werden vor Layout/Rendering erneut geprüft; JSON-Roundtrips getestet.
- Semantische Diagnosen werden gesammelt und tragen Quellposition, Element-ID,
  Attribut bzw. View-ID. `validate()` liefert einen Bericht, Rendering wirft
  bei Fehlern `ArchError`. Bestehende Fehlercodes im Standardprofil erhalten.
- Keine ausführbaren Profilregeln, kein `eval`, unbekannte Schemafelder werden
  zurückgewiesen. Typen und Attribute mit Prototyp-ähnlichen Namen als Daten
  geprüft. Zyklen und ungültige Referenzen werden bei Registrierung erkannt.
- Eigene Zahlenattribute sind nur durch endliche JS-Zahlen begrenzt; die bisherige
  Koordinatengrenze ±10.000.000 gilt weiter für Zeichenkoordinaten/Größen.
- Generisches Beispielprofil `profiles/enterprise.json`, ausführliche Anleitung
  `profiles/README.md`, Inline-Beispiel `examples/profiles.arch` und registriertes
  Beispiel `examples/external-profile.arch` ergänzt. Keine spezifischen
  Frameworkprofile und keine neuen Diagrammrenderer implementiert.
- Build validiert alle lokalen `profiles/*.json` und erzeugt das optionale
  Offline-Registrierungsscript `profiles/profiles.js`. Keine neuen Abhängigkeiten
  für diese Erweiterung. Die Library enthält nur das Standardprofil.
- Beispieloberfläche: sieben Modelle/fünfzehn Views, PROFILE-Selektor für den
  API-Parameter, aktive Profil-ID/-Version, mehrere lesbare Diagnosen und
  Wiederherstellung der letzten gültigen Vorschau. Syntaxfarben erweitert.
- `SPEC.md`, `README.md`, `profiles/README.md` und `ROADMAP.md` auf den finalen
  Funktionsumfang abgestimmt. Grenzen des deklarativen Regelsatzes dokumentiert;
  keine Behauptung vollständiger Framework-Konformität.
- Abschließendes `npm run check` erfolgreich: **36 Testgruppen** und komplette
  Chromium-Suite, einschließlich aller bestehenden Modelle und Iconpacks,
  Inline-/JSON-Profile, Parameterpriorität, Endpunktregeln, Pflichtattribute,
  Profilwechsel, Fehlerkorrektur und aller Rendering-Adapter.
- Desktop- und Mobil-Screenshots sowie `test-results/profiles.png` visuell
  kontrolliert. Keine SVG-Textüberläufe in den Beispielen, keine externen
  HTTP-Anfragen und keine JavaScript-Fehler. Start über `file://` bleibt möglich.
- Alle **acht** generierten Dateien nach erneutem Build per SHA-256 byteidentisch:
  `arch.js`, `arch.min.js`, `demo/examples.js`, die drei Iconpack-JSONs,
  `icons/iconpacks.js` und `profiles/profiles.js`.
- Aktuelle Bundlegrößen unkomprimiert: `arch.js` 78.378 Bytes,
  `arch.min.js` 45.243 Bytes. Für diesen Folgeauftrag sind keine Arbeiten offen.

## Auftrag und Stand

Quelle: `USERSPEC.md`, gelesen am 14.11.2026. Ausgangslage: leeres Projekt mit
Anforderungen und Referenz-PDFs; `SPEC.md` war eine Kopie der Anforderungen.

## Umsetzungsplan

1. **Spezifikation:** Grammatik, Modell/Ansichten, API, Layout, Sicherheit und
   reproduzierbare Entwicklungsbefehle festlegen.
2. **Sprachkern:** Lexer/Parser mit Positionsfehlern, semantische Validierung,
   wiederverwendbares Modell und mehrere Ansichten implementieren.
3. **Darstellung:** deterministisches automatisches Layout, verschachtelte
   Packages, manuelle Koordinaten/Größen, Ports, Wegpunkte und SVG-Pfade.
4. **SVG/Icons:** hochwertige Templates, helle/dunkle Darstellung, sichere
   JSON-Iconpacks und Browser-/Node-API einschließlich Markdown-Fences.
5. **Verwendbares Beispiel:** lokale interaktive Oberfläche mit Editor,
   Beispielen, Ansichtsauswahl, SVG-Export und verständlichen Fehlermeldungen.
6. **Auslieferung:** `arch.js`, `arch.min.js`, `test.md`, `index.html`, Anleitung,
   Unit-/Integrationstests sowie echte Browser- und Sichtprüfung.

## Protokoll

- [x] Anforderungen und Projektstruktur gelesen; keine bestehende Implementierung
  und keine zusätzlichen AGENTS.md-Anweisungen gefunden.
- [x] Architekturentscheidung: Runtime ohne Fremdabhängigkeiten; Build- und
  Testwerkzeuge als festgeschriebene npm-Entwicklungsabhängigkeiten.
- [x] Spezifikation und reproduzierbare Befehle ausgearbeitet.
- [x] Sprachkern, Validierung und Layout implementiert.
- [x] SVG-Renderer, Templates, Icons und Markdown implementiert.
- [x] Beispieloberfläche und Auslieferungsdateien fertiggestellt.
- [x] Automatisierte Tests und Browser-Sichtprüfung bestanden.

### Implementierung und erste Prüfungen

- DSL mit 13 Elementtypen und 6 Beziehungstypen, mehrfach verwendbarem Modell,
  Ansichtsfiltern, verschachtelten Packages und lokaler/absoluter Positionierung.
- Deterministisches Layout einschließlich Zyklen, festen Größen und Kombination
  automatischer und manueller Positionen. Kanten mit Ports, Wegpunkten, vier
  Kurvenarten, eigenen SVG-Pfaden und Labelpositionen.
- Zugängliches SVG mit eindeutigen Markern, 13 Templates, 16 eingebauten Icons,
  hellen/dunklen Paletten, JSON-Iconpacks und sicherem Markdown-Adapter.
- Vier Beispielmodelle mit sieben Ansichten, interaktive Oberfläche mit Editor,
  Syntaxfarben, lokalen Entwürfen, Fehlerwiederherstellung und Downloads.
- `npm run build` erfolgreich; beide Bundles aus denselben Quellen gebaut.
- Erster Testlauf: 14 Testgruppen bestanden. Anschließend Browserprüfungen und
  visuelle Nachkontrolle ergänzt (abschließender Stand siehe unten).
- esbuild und Playwright exakt gepinnt installiert; Chromium installiert.
  Die Sandbox verhinderte zunächst Registry-/Cache-Zugriff; Installation wurde
  anschließend mit der erteilten Freigabe erfolgreich ausgeführt.

### Browserprüfung und Verbesserungen

- Alle vier Modelle und sieben Ansichten erfolgreich in Chromium gerendert;
  SVG-Textgrenzen und Kantenpfade automatisch gegen ihre Begrenzungen geprüft.
- Desktop-, Mobil-, Template-, Routing- und Dunkelmodus-Screenshots unter
  `test-results/` erzeugt und visuell kontrolliert.
- Dunkle Akzentfarben für lesbareren Kontrast aufgehellt. Beispielauswahl für
  kleine Displays ergänzt; Cursor beginnt beim Beispielwechsel in Zeile 1.
- Parallele kollineare Kanten erhalten getrennte Pfade. Orthogonale Wegpunkte
  werden durch zusätzliche rechtwinklige Segmente verbunden.
- Begrenzung freier elliptischer SVG-Bögen einschließlich Rotation und
  Radiuskorrektur verbessert; konservative Grenzen verhindern Abschneiden.
- `renderAll` gegen überlappende Selektoren (`pre[data-arch]` mit Arch-Codeblock)
  abgesichert und Idempotenz/Fehlerisolation im Browser geprüft.
- Lange eigene Stereotypen werden vollständig mehrzeilig dargestellt. Breiten-
  und Höhenberechnung für lange Texte/Unicode in allen Templates verbessert.
- Leere ungültige Attribute/Pfade sowie XML-ungültige Unicodezeichen werden
  diagnostiziert. Regressionstests für diese Fälle ergänzt.
- Vorschau bleibt bei Syntaxfehlern auf dem letzten gültigen Stand, SVG-Export
  ist bis zur erfolgreichen Korrektur deaktiviert. Wiederherstellung getestet.

### Abschließende Verifikation — erfolgreich

- `npm ci`: exakte Neuinstallation aus `package-lock.json` erfolgreich.
- `npm run check`: Build, **15 Testgruppen** und vollständige Chromium-Suite
  erfolgreich; keine offenen Testfehler.
- Byteidentische Reproduktion aller drei generierten Dateien (`arch.js`,
  `arch.min.js`, `demo/examples.js`) nach erneutem Build per SHA-256 geprüft.
- Beide Browserbundles liefern für identische Optionen identisches SVG.
- Downloads enthalten gültiges SVG bzw. exakt den aktuellen Quelltext.
- Browserinteraktion: Live-Rendering, Beispielwechsel/Entwürfe, Ansichten,
  Fehlerdiagnose/-korrektur, Zoom/Fit, Thema und Hilfedialog erfolgreich.
- Markdown-Fixture rendert zwei Inline-SVGs; unabhängige DOM-Blöcke einschließlich
  eines fehlerhaften Blocks und doppelter Selektoren erfolgreich geprüft.
- Desktop (1536 × 1050), Mobilansicht (390 × 844), lange Beschriftungen, Unicode
  und benutzerdefinierte Stereotypen bei Mindestbreite ohne Textüberläufe geprüft.
- Start direkt per `file://` erfolgreich; keine externen HTTP-Anfragen und keine
  JavaScript-Fehler in der Beispieloberfläche.
- `arch.js`: 47.465 Bytes; `arch.min.js`: 27.665 Bytes (unkomprimiert).
- `SPEC.md` und `README.md` auf die tatsächliche Implementierung abgestimmt;
  `USERSPEC.md` unverändert erhalten.

## Ergebnis und verbleibende Grenzen

Alle geforderten Lieferdateien liegen im Projektwurzelverzeichnis vor.
`index.html` lässt sich direkt öffnen oder mit `npm start` ausliefern.
Es sind keine weiteren Arbeiten für den beschriebenen Lieferumfang offen.

Bewusste Grenzen sind dokumentiert: kompakter Layoutalgorithmus ohne globale
Kantenkreuzungsoptimierung, kleiner Markdown-Adapter, keine vollständige
Standardkonformität zu NAF/UAF/ArchiMate/UML. Der Editor hält Entwürfe für die
laufende Sitzung; zum dauerhaften Aufbewahren steht der Quelltextdownload bereit.
Automatisiert geprüft ist Chromium; andere Browser-Engines wurden nicht geprüft.

## Qualitätskriterien

Ein verwendbares Ergebnis bedeutet: Die Beispielseite funktioniert lokal ohne
CDN, beide Bundles rendern dieselben Modelle, fehlerhafte Eingaben sind lesbar
diagnostiziert, manuelle Layouts und Kantenpfade sind nachweislich wirksam und
Neuinstallation/Build/Tests sind dokumentiert und wiederholbar.

## Folgeauftrag: externe Iconpacks und Roadmap

- [x] Umfang geklärt: Bootstrap-, Lucide- und Tabler-Iconpacks als JSON herunterladen
  und integrieren; zusätzliche Diagrammtypen ausschließlich dokumentieren.
- [x] Vorhandene Darstellung geprüft: derzeit nur Knoten-Kanten-Diagramme mit
  Templates/Packages; kein Sequenz-, Matrix-, Swimlane- oder anderer Spezialrenderer.
- [x] `ROADMAP.md` mit aktuellem Stand, priorisierten Layoutverbesserungen,
  eigenständigen Diagrammtypen und Abnahmekriterien angelegt.
- [x] Original-JSONs mit fester Quellrevision, Prüfsummen und Lizenzen ablegen.
- [x] Packformat/Renderer für die tatsächlichen SVG-Geometrien und Zeichenstile integrieren.
- [x] Sichtbares Beispiel und lokale Offline-Einbindung ergänzen.
- [x] Gesamte Packs, Browserdarstellung und Dokumentation prüfen.

### Externe Iconpacks: Umsetzung und Prüfergebnisse

- Vollständige Original-JSONs unter `icons/upstream/` heruntergeladen. Iconify-
  Revision `d0290276f8f74436ebcfa5f8ff38a8dcc91a0ef5`; Originaldateien und
  vollständige Lizenztexte mit SHA-256 unter `icons/sources.lock.json` erfasst.
- Bootstrap: 2.084 Originale + 6 Aliase = 2.090 Namen; Lucide: 2.132 + 245 =
  2.377; Tabler: 6.594 + 194 = 6.788. Gesamt: 11.255 nutzbare Referenzen.
- Alle Originale einschließlich versteckter historischer Icons und alle Aliase
  übernommen. Metadaten/Versionsstände und die vollständigen MIT-/ISC-/Feather-
  Lizenzhinweise sind unter `icons/README.md` bzw. `icons/licenses/` abgelegt.
- Der im Iconify-Metadatensatz genannte Bootstrap-Lizenzpfad war veraltet und
  lieferte HTTP 404. Korrektes `LICENSE` über GitHub ermittelt und auf eine feste
  Revision gepinnt. Auch Lucide-Lizenzrevision und Tabler-Release festgeschrieben.
- Build-Konverter (`scripts/iconpacks.mjs`) mit exakt gepinnten
  Entwicklungsabhängigkeiten `@xmldom/xmldom` 0.9.12 und `svgpath` 2.6.0 ergänzt.
  SVG-Primitive, Matrix-Transformationen, Vererbung, lokale Referenzen und
  Aliasnamen werden in das kontrollierte Pfadformat aufgelöst. Unbekannte
  Inhalte sind Fehler, keine Icons werden stillschweigend übersprungen.
- Laufzeitformat um geprüfte strukturierte Pfade für Füllungen, Strichstärken,
  Linienenden/-verbindungen, Füllregeln und Deckkraft erweitert. Bestehende
  String-Pfade bleiben kompatibel. Namen mit führenden Ziffern werden unterstützt.
- Generierte Dateien: `icons/bootstrap.json`, `icons/lucide.json`,
  `icons/tabler.json` und das optionale Offline-Script `icons/iconpacks.js`.
  Die drei Sammlungen bleiben außerhalb der schlanken Bibliotheksbundles.
- `renderIconToString()` ergänzt, Galerie mit 18 vergrößerten Beispielicons und
  JSON-Downloads in `index.html` integriert. Neues editierbares Beispiel
  `examples/iconpacks.arch` mit vier Views. Insgesamt fünf Modelle/elf Ansichten.
- `npm test`: 20 Testgruppen erfolgreich. Jedes der 11.255 Icons registriert und
  als SVG gerendert; Original-/Lizenzhashes und vollständige Namensmengen geprüft.
- Chromium-Suite erfolgreich: alle fünf Modelle/elf Ansichten, Galerie,
  JSON-Download, Offline-Einbindung über `file://`, Mobilansicht und bestehende
  Editorfunktionen. 17 kritische Icons rasterisiert gegen Original-SVGs
  verglichen; keine Abweichung über der definierten Toleranz (mittlere absolute
  Kanalabweichung maximal 1 von 255). Screenshots `icon-gallery.png` und
  `iconpacks.png` unter `test-results/` visuell kontrolliert.
- Initialer neuer Vergleichstest unterschied nur die Objektprototypen der
  internen Map und des eingelesenen JSON. Auf JSON-Datenvergleich korrigiert;
  sämtliche Tests bestanden anschließend.
- `SPEC.md`, `README.md` und `icons/README.md` um Format, API, Herkunft,
  Integration und reproduzierbaren Download/Build fortgeschrieben.
- Keine neuen Diagrammtypen implementiert. `ROADMAP.md` trennt den aktuellen
  Knoten-Kanten-Renderer ausdrücklich von geplanten Matrizen, Capability Maps,
  Sequenz-, Swimlane-, Deployment- und Zeit-/Migrationsansichten.
- Abschließendes `npm run check` mit Build, allen 20 Testgruppen und kompletter
  Chromium-Suite erfolgreich. Erneuter Netzwerkdownload der festgeschriebenen
  Quellen/Lizenzen erfolgreich gegen alle Hashes geprüft. Alle sieben generierten
  Dateien sind nach erneutem Build byteidentisch (SHA-256-Vergleich).
