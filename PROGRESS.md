# Umsetzungsfortschritt

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
