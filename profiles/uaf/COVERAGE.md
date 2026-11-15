# UAF-/NAF-Abdeckungsnachweis

Automatisch durch `npm run build` erzeugt. Quellen und Regeln stehen in
[README.md](README.md); sämtliche Quell-IDs in [coverage.json](coverage.json).

## Versionsbindung und Umfang

- UAF 1.0; NATO-UAF-Leitlinie Version 1.0.0, März 2019.
- 211 native Stereotypen, davon 33 abstrakt; 213 Knotentypen einschließlich der Adapter Package/Requirement.
- 100 native, schreibbare Attributdefinitionen mit Typ-/Multiplizitätsprüfung; 23 explizite Adapterfelder.
- 7 abgeleitete Quellfelder werden weder geschrieben noch berechnet.
- 43 binäre Beziehungsabbildungen; 20 ausgewählte strukturelle Viewpoint-Regelsätze.

Der Typkatalog ist vollständig für die nativen Stereotypen dieser XMI-Datei.
Die Validierung des gesamten UAF-/NAF-Metamodells ist es nicht. UML-/SysML-
Basiseigenschaften werden nur durch die ausdrücklich deklarierten Adapter
abgebildet. Quell-IDs an Beziehungen belegen ausschließlich die angegebenen
binären Endpunktprüfungen; sie gelten nicht als vollständige Prüfung des
jeweiligen reifizierten Beziehungsknotens oder sämtlicher UML-Eigenschaften.

## Festgeschriebene Quellen

| Lokale Quelle | Version | SHA-256 |
| --- | --- | --- |
| [ReferenceDocs/uaf/UAFP-1.0.xmi](../../ReferenceDocs/uaf/UAFP-1.0.xmi) | UAF 1.0, dtc/17-05-15 | `91808de61074fc5774b2c5eb0234fc0d111365090d8218dde1f0668601b46135` |
| [ReferenceDocs/nafv4/20190404_AC_322-N-201-0046_ENG-UAF-Guidelines1.pdf](../../ReferenceDocs/nafv4/20190404_AC_322-N-201-0046_ENG-UAF-Guidelines1.pdf) | NAFv4 UAF modeling guideline 1.0.0, March 2019 | `d0a072dc5a2cbb7ed68f657d98ab81716d6e717fca410b91924924be89f02fbc` |
| [ReferenceDocs/nafv4/NATO-Architecture-Framework-v4-1-en.pdf](../../ReferenceDocs/nafv4/NATO-Architecture-Framework-v4-1-en.pdf) | NAFv4.1, 2026.03 (context and differences only) | `ec8e5628c7b609f43adcf667accc6f7a75fa2a098ac34f10afb270e11b1f9c50` |

Die NAFv4.1-Datei dient nur zum Abgrenzen des neueren Stands. Sie ist keine
Grundlage für die Behauptung einer vollständigen NAFv4.1-Validierung.

## Binäre Beziehungsabbildungen

| Relation | Herkunft | Prüfungsart |
| --- | --- | --- |
| ArbitraryConnector | UAF stereotype | literal-endpoint-constraints |
| OperationalExchange | UAF stereotype | literal-endpoint-constraints |
| OperationalControlFlow | UAF stereotype | literal-endpoint-constraints |
| IsCapableToPerform | UAF stereotype | authored-endpoint-pairs |
| PerformsInContext | UAF stereotype | authored-endpoint-pairs |
| Implements | UAF stereotype | authored-endpoint-pairs |
| ArchitecturalReference | UAF stereotype | literal-endpoint-constraints |
| Consumes | UAF stereotype | literal-endpoint-constraints |
| ResourceExchange | UAF stereotype | literal-endpoint-constraints |
| FunctionControlFlow | UAF stereotype | literal-endpoint-constraints |
| Forecast | UAF stereotype | literal-endpoint-constraints |
| VersionSuccession | UAF stereotype | literal-endpoint-constraints |
| CapabilityForTask | UAF stereotype | literal-endpoint-constraints |
| AchievedEffect | UAF stereotype | literal-endpoint-constraints |
| DesiredEffect | UAF stereotype | literal-endpoint-constraints |
| Exhibits | UAF stereotype | literal-endpoint-constraints |
| MapsToCapability | UAF stereotype | literal-endpoint-constraints |
| OrganizationInEnterprise | UAF stereotype | literal-endpoint-constraints |
| ActualResourceRelationship | UAF stereotype | literal-endpoint-constraints |
| FillsPost | UAF stereotype | literal-endpoint-constraints |
| ProvidesCompetence | UAF stereotype | literal-endpoint-constraints |
| OwnsProcess | UAF stereotype | literal-endpoint-constraints |
| CompetenceForRole | UAF stereotype | literal-endpoint-constraints |
| RequiresCompetence | UAF stereotype | literal-endpoint-constraints |
| CompetenceToConduct | UAF stereotype | literal-endpoint-constraints |
| Control | UAF stereotype | literal-endpoint-constraints |
| Command | UAF stereotype | literal-endpoint-constraints |
| ResponsibleFor | UAF stereotype | literal-endpoint-constraints |
| Enhances | UAF stereotype | literal-endpoint-constraints |
| Protects | UAF stereotype | literal-endpoint-constraints |
| Affects | UAF stereotype | literal-endpoint-constraints |
| Mitigates | UAF stereotype | literal-endpoint-constraints |
| OwnsRisk | UAF stereotype | literal-endpoint-constraints |
| OwnsRiskInContext | UAF stereotype | literal-endpoint-constraints |
| AffectsInContext | UAF stereotype | literal-endpoint-constraints |
| ProjectSequence | UAF stereotype | literal-endpoint-constraints |
| MilestoneDependency | UAF stereotype | literal-endpoint-constraints |
| CapabilityGeneralization | UML Generalization adapter named in NATO guideline C1 | explicit-adapter |
| CapabilityDependency | NATO guideline C3 CapabilityDependency DMM tuple adapter | explicit-adapter |
| ServiceGeneralization | UML Generalization adapter for NATO guideline S1 | explicit-adapter |
| OperationalGeneralization | UML Generalization adapter for NATO guideline L1 | explicit-adapter |
| ResourceGeneralization | UML Generalization adapter for NATO guideline P1 | explicit-adapter |
| Refine | SysML Refine adapter used in NATO guideline C8 | explicit-adapter |

`literal-endpoint-constraints` übernimmt einfache native Endpunktlisten.
`authored-endpoint-pairs` bildet bedingte Typkombinationen explizit ab.
`explicit-adapter` bezeichnet eine zusätzliche UML-/SysML-/DMM-Abbildung,
keinen nativen UAFP-Stereotyp. Endpunktrichtung und Regeln stehen im JSON.

## Unterstützte strukturelle Viewpoints

Die Seitenzahlen beziehen sich auf die gedruckten Seiten der NATO-Leitlinie
von 2019. Die Whitelists, Pflichttypen und Allokationsprüfungen sind eine
deklarierte Teilabdeckung, keine vollständige Konformitätsprüfung pro View.

| ID | Titel | Seiten | Darstellung / Grenze |
| --- | --- | --- | --- |
| C1 | Capability Taxonomy | 11, 12 | hierarchical connected shapes |
| C2 | Enterprise Vision | 13, 14 | connected shapes and typed references |
| C3 | Capability Dependencies | 15 | connected shapes |
| C4 | Standard Processes | 16, 17 | activity definitions and allocation |
| C7 | Performance Parameters | 20 | typed measurement definitions |
| C8 | Capability Assumptions | 21 | requirements traceability |
| S1 | Service Taxonomy | 26, 27 | hierarchical connected shapes |
| S3 | Service Interfaces | 28, 29 | interface and port references |
| S4 | Service Functions | 30 | function allocation |
| C1-S1 | Capability to Service Mapping | 40 | connected-shapes mapping |
| L1 | Node Types | 44, 45 | hierarchical connected shapes |
| L2-L3 | High-level Operational Concept | 48 | connected-shapes overview, not a rich-picture editor |
| L3 | Node Interactions | 49, 50, 51 | typed flows and conveyed references |
| L4 | Logical Activities | 52, 53 | allocation and action flows, not a BPMN/swimlane renderer |
| P1 | Resource Types | 69, 70 | hierarchical connected shapes |
| P2 | Resource Structure | 71, 72 | resource, role and connector references |
| P3 | Resource Connectivity | 73, 74 | typed resource exchanges |
| P4 | Resource Functions | 75, 76 | function allocation and action flows |
| L4-P4 | Activity to Function Mapping | 87, 88 | cross-domain traceability |
| A8 | Standards | 104, 105 | typed standard references and metadata |

## Offene Quellregeln und Ausnahmen

- **ProtectsInContext:** keine binäre Abbildung; Quellregel verweist auf nicht vorhandene Typen (SecurityControlAction, OperationalRole, ResourceRole, OperationalConnector, ResourceConnector, SecurityProperty).
- **SameAs:** keine binäre Abbildung; Quellregel verweist auf nicht vorhandene Typen (UPDMElement, UPDMElement).
- **125 native ownedRule-Einträge** werden nicht als vollständig umgesetzt ausgewiesen. Ihre Namen und stabilen Quell-IDs stehen unter `unimplementedNativeConstraints` in coverage.json. Einzelaspekte können durch generische Attribut-/Datumsregeln geprüft sein; weitergehende Pfad-, Aggregations-, Eigentums- und Konsistenzregeln bleiben offen.
- Pflichtfelder folgen den nativen Multiplizitäten. Metamodell-Defaultwerte werden nicht automatisch eingesetzt.
- Quellnormalisierung: Das Attribut `UAFElement.URI ` mit abschließendem Leerzeichen heißt im DSL `URI`.
- Nicht enthaltene Viewpoint-Regelsätze: `C5`, `Cr`, `S5`, `S6`, `S7`, `S8`, `Sr`, `L2`, `L5`, `L6`, `L7`, `L8`, `Lr`, `P5`, `P6`, `P7`, `P8`, `Pr`, `A1`, `A2`, `A3`, `A4`, `A5`, `A6`, `A7`, `Ar`.

Die nativen Typen dieser offenen Bereiche können im Basisprofil `uaf`
modelliert werden. Das allein belegt weder die Semantik noch die vollständige
Validierung eines entsprechenden NAF-Viewpoints.

## Weitere Grenzen

- No UML/SysML editor or lossless XMI import/export.
- No execution of English/OCL constraints.
- Derived fields are not writable or calculated.
- Only declared binary endpoint constraints are enforced.
- Specialist renderers need explicit view configuration; no complete UML/BPMN behavior semantics.
- NAFv4 guideline March 2019; no claim of complete NAFv4.1, UAF 1.3 or tool certification.

## Verifikation

Die Tests vergleichen den nativen Typkatalog direkt mit der XMI, prüfen
Quellhashes, Vererbung, gültige/ungültige Endpunktpaare, Referenzen,
Attributformate und jeden der 20 unterstützten Viewpoints mit einer eigenen
positiven Architektur. Negative Tests prüfen insbesondere fehlende
Allokationen und unzulässige Sichttypen. Das editierbare Beispiel enthält
neun Ansichten und wird zusätzlich im Browser geprüft. Diese Tests sind
keine externe Konformitätszertifizierung.
