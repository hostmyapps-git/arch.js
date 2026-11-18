# Aliase, Untertypen und Metamodell-Mappings

Stand: 17.11.2026. Implementiert seit `naf41-uaf@4.1.0-arch.10`.
Die Beschreibungssprache bleibt unverändert; Aliasdefinitionen stehen im
externen JSON-Profil und werden über `arch.registerProfile()` geladen.

## Drei getrennte Konzepte

| Konzept | Bedeutung | Wirkung in arch.js |
|---|---|---|
| Untertyp | Eigener Typ mit Vererbung und gegebenenfalls zusätzlichen Regeln | `nodeTypes.Child.extends: "Parent"`; gerichtete Kompatibilität |
| Alias | Anderer Name für denselben semantischen Typ | `aliases.nodeTypes.Name: "Target"`; symmetrische Typgleichheit |
| Mapping | Dokumentierte Zuordnung zwischen Frameworks/Versionen | `mappings`; beschreibende Metadaten, keine automatische Modellkonvertierung |

Aliase übernehmen die vollständige Definition ihres Ziels: Abstraktheit,
Attribute, Pflichtfelder, Vergleiche, Containerregeln, Templates, Icons,
Beziehungsendpunkte und Validierungsregeln. Ein Alias erzeugt keine zusätzliche
Vererbungsstufe und darf keine eigenen semantischen oder grafischen Regeln
festlegen. Die geschriebene Typbezeichnung bleibt für Modell, SVG-Stereotyp,
`data-type`, Fehlerdiagnosen und JSON-/DSL-Übersetzung erhalten. Ein explizites
`stereotype` bleibt eine unabhängige Darstellungsentscheidung.

## NAF-Service

`Service` verweist im Anwendungsprofil auf **UAF 1.0 `ServiceSpecification`**.
Beide Namen dürfen gemischt werden. `ActualService` bleibt ein anderer Typ.
Das native `uaf`-Profil erhält keinen zusätzlichen Typ `Service`.

Die NAF-Seiten 104–105 verwenden Service. Die offizielle
[OMG-Änderung UAF12-33](https://issues.omg.org/issues/UAF12-33) dokumentiert die
Umbenennung ServiceSpecification → Service für UAF 1.2, zugleich aber weitere
Änderungen im Service-Metamodell. Deshalb bedeutet der Alias **keine vollständige
UAF-1.2-Unterstützung oder Gleichwertigkeit aller UAF-1.0-/1.2-Regeln**.
Die NAF-/UAF-Gleichsetzung ist eine ausdrücklich dokumentierte Entscheidung
dieses strukturellen Anwendungsprofils.

`Goal extends EnterpriseGoal` bleibt bis zur fachlichen Prüfung ein Untertyp.
`Constraint extends StrategicConstraint` bleibt ebenfalls erhalten: Constraint
macht `ruleKind` optional und schränkt einen angegebenen Wert auf Constraint
ein. StrategicConstraint verlangt das geerbte Pflichtfeld. Eine Aliasumstellung
würde dieses unterschiedliche Validierungsverhalten beseitigen.

## Profilformat

Kleines eigenständig registrierbares Beispiel:

```js
arch.registerProfile('alias-example', {
  id: 'alias-example',
  version: '1.0',
  nodeTypes: { ServiceSpecification: { template: 'service' } },
  relationTypes: {
    ServiceDependency: {
      from: ['Service'], to: ['ServiceSpecification'], style: 'dependency'
    }
  },
  aliases: {
    nodeTypes: {
      Service: {
        target: 'ServiceSpecification',
        description: 'Alternative vocabulary within this profile.'
      },
      Offering: 'Service'
    },
    relationTypes: { DependsOn: 'ServiceDependency' }
  }
});
```

Beide Tabellen sind optional. Ein Eintrag ist entweder ein Zielname oder ein
Objekt mit `target` und optional `title`, `description`, `sources`, `limitations`.
Alias-Ketten werden auf den endgültigen Zieltyp aufgelöst. Knoten- und
Beziehungsnamen besitzen getrennte Namensräume. Pro Tabelle sind höchstens
512 Aliase erlaubt.

Fehler bei der Registrierung sind unter anderem unbekannte Ziele, Aliaszyklen,
Kollisionen zwischen Alias und eigenständiger Typdefinition sowie zusätzliche
Regelfelder im Alias. Eine abgeleitete Profildefinition erbt Aliase und darf
ihren Zielnamen nicht stillschweigend ändern oder durch einen Typ verdecken.
Eine neue Bedeutung benötigt ein eigenständig definiertes Profil bzw. eine
entsprechend überarbeitete Basisrevision. Registrierungen sind atomar.

`getProfile()` enthält aufgelöste Lookup-Einträge unter `nodeTypes` bzw.
`relationTypes`; Alias-Einträge tragen `aliasOf` mit dem kanonischen Zielnamen.
Die Aliasdeklarationen stehen zusätzlich unter `aliases`. Diese Einträge sind
keine zusätzlichen semantischen Typen. Abgetrennte Profilkopien und serialisierte
Parsed-Model-Snapshots können wieder kompiliert werden; manipulierte
Alias-Lookup-Einträge mit abweichenden Regeln werden zurückgewiesen.

Die Gleichheit gilt auf beiden Seiten aller Typprüfungen: `extends`,
Endpunkte, Paarregeln und Ausschlüsse, Referenzziele, Containerinhalte,
Viewpoint-Listen, Pflichtkategorien, Verbindungs- und Referenzregeln sowie
Diagrammfilter. Kardinalitäten und Zyklen werden je kanonischem Relationstyp
geprüft und zählen Aliasnamen nicht doppelt. `sharePath stereotypes` darf
Alias und Zielrelation gemeinsam routen; echte Untertypen bleiben getrennt.

Inline-DSL-Profile erhalten dafür keine neuen Deklarationsschlüssel. Auch das
äquivalente Architektur-JSON verwendet die registrierte Profilauswahl; dessen
Inline-Konfiguration ist weiterhin auf die vorhandenen DSL-Felder begrenzt.

## Versionen auswählen

```arch
architecture "Services" {
  config { profile "naf41-uaf@4.1.0-arch.14" }
  model {
    Service rescue "Rescue"
    ServiceSpecification parent "Rescue services"
    relation specializes rescue -> parent "is a kind of" {
      type ServiceGeneralization
    }
  }
  view s1 "Service taxonomy" { viewpoint S1 diagram tree }
}
```

JSON: `"config": { "profile": "naf41-uaf@4.1.0-arch.14" }`.
API: `{ profile: 'naf41-uaf@4.1.0-arch.14' }`.
Ein externes Profil kann ebenso `"extends": "uaf@1.0.0-arch.1"` verwenden;
das NAF-Profil bindet diese konkrete Basisrevision.

Ein unqualifizierter Profilname wählt wie bisher die zuletzt registrierte
Definition dieses IDs. `getProfiles()` listet IDs;
`getProfileVersions('naf41-uaf')` liefert geladene Revisionsstrings.
`getProfile('naf41-uaf@4.1.0-arch.14')` liefert die konkrete Profilkopie.
Parsed Models behalten ihren eingefrorenen Profil-Snapshot.

**Explizit versionierte Revisionen sind unveränderlich:** denselben ID und
dieselbe Version mit anderen kompilierten Inhalten zu registrieren ist ein
Fehler. Für Änderungen `version` erhöhen. Identische Wiederregistrierung ist
möglich. Legacy-Registrierungen ohne explizites `version` behalten ihr bisheriges
Ersetzen per ID; ihre implizite Version ist keine dauerhafte Versionsbindung.
Versionen bestehen aus Buchstaben/Ziffern/Unterstrich/Punkt/Bindestrich, beginnen
mit Buchstabe/Ziffer/Unterstrich und enthalten kein `@` oder Leerzeichen.

Es werden keine früheren Revisionen heruntergeladen oder automatisch
mitgeliefert. Für eine historische Bindung muss die betreffende Profildefinition
zuvor registriert worden sein. Der Build liefert aktuell eine Revision pro
Profil-ID aus und ordnet auch versionierte Basisabhängigkeiten korrekt.

## Mapping-Metadaten

```json
{
  "mappings": [{
    "kind": "node",
    "relationship": "rename",
    "source": {"framework": "UAF", "version": "1.0", "type": "ServiceSpecification"},
    "target": {"framework": "UAF", "version": "1.2", "type": "Service"},
    "description": "Documented rename; other service rules also changed.",
    "sources": ["https://issues.omg.org/issues/UAF12-33"],
    "limitations": ["No complete semantic equivalence or automatic migration."]
  }]
}
```

`kind`: `node` oder `relation`. `relationship`: `rename`, `equivalent`,
`specialization`, `partial`. Die beiden Endpunkte enthalten Framework, Version
und Typ als nichtleere Strings. Optional sind die üblichen Dokumentationsfelder.
Bis zu 512 Mappings sind möglich. Die Zielframeworks müssen nicht geladen sein;
Mappings sind Quellen-/Entscheidungsdokumentation und definieren keine Typen,
führen keinen Code aus und ändern keine Validierungsregel. Automatische
Typgleichheit verlangt weiterhin eine gesonderte `aliases`-Deklaration im
konkreten Profil. Die Mappingliste wird geerbt; eine lokale Liste ersetzt sie.

## Hilfe und Migration

Jeweils einen Befehl als eigenes Hilfedokument verwenden:

```arch
@help aliases naf41-uaf
```

```arch
@help mappings naf41-uaf
```

```arch
@help types naf41-uaf Service
```

```arch
@help connections naf41-uaf Service
```

Alle Abfragen erlauben auch `PROFILE@VERSION` bzw. `.` für das gewählte Profil.
Die Typ-Hilfe zeigt kanonischen Namen, Aliase und geerbte Regeln;
Profilzusammenfassungen zählen Aliase separat.

Bestehende NAF-Modelle mit Service oder ServiceSpecification benötigen keine
Syntaxänderung. Die S1-Semantik sowie Darstellung bleiben erhalten. Allgemein
ist ein Alias jedoch stärker als ein Untertyp: ein Selektor, der nur Service
nennt, akzeptiert nun auch ServiceSpecification und dessen Untertypen. Eigene
abgeleitete Profile mit einer bisherigen eigenständigen Service-Definition
kollidieren mit dem neuen Alias. Diese Definition entfernen, wenn Gleichheit
gewollt ist, oder die bisherige Basisrevision weiter laden und explizit wählen.
Es gibt keine automatische Umstellung eigener Typdefinitionen.

## S2 vocabulary since revision 11

`Node → LogicalNode` is a second vocabulary alias. LogicalNode remains the
application subtype of OperationalArchitecture, so the alias does not assert
that every UAF architecture is semantically equivalent to a NAF Node.
`PhysicalActiveResource extends ResourcePerformer` is deliberately a concrete
subtype rather than an alias: the UAF target is abstract, while the NAF example
uses the physical-resource category as an instantiable modeling vocabulary.
Inherited attributes and endpoint compatibility still apply, including required
`isStandardConfiguration`. See [S2 modeling and limits](README.md#s2--service-structure-pp106108).

## Aggregation and composition since revision 12

ServiceAggregation and ServiceComposition are intentionally separate relationship
types. The former is a directed grouping projection with reusable members;
it does not assert exclusive composition ownership. Both retain their own
presentation and individually reject self-links/cycles. No alias equates the
terms and full UML ownership/lifecycle semantics remain outside this profile.

## S3 vocabulary since revision 13

ServiceOperation aliases UAF ServiceMethod, whose base metaclass is UML
Operation. DataProductType specializes both DataElement and the application
PhysicalPassiveResource category; it is not an alias for all passive resources.
The shared conceptual ServiceOperationParameter has a context-dependent
operation association (has link or owner reference); S3 makes its resource
association optional while S7 requires one. This does not implement exclusive
UML Parameter ownership or instantiate a runtime report object.
