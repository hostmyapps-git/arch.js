# ADMBw and NAFv4.1 coverage

Use `config { profile naf41-admbw validation strict }` after loading
`profiles/profiles.js`. For individually loaded browser profiles, load `uaf.js`,
`naf41-uaf.js` and `naf41-admbw.js` in that order. The [example](../../examples/naf41-admbw.arch)
pairs a NAF C1 taxonomy with an ADMBw R8 evaluation. The profile applies the
mandatory contents, required connections and objectification rules from
`naf41-uaf@4.1.0-arch.43` to all 47 NAFv4.1 viewpoints. Seven additional
ADMBw toolbox viewpoints retain their own IDs.

The ADMBw 2026.05 technology identifies its base as NAF 4.0. March 2026
NAFv4.1 governs the inherited viewpoint rules. ADMBw contributes additive
optional attributes and types. The build uses the existing locked MDG and
NAF source files and reads the MDG as Windows-1252. It records a disposition
for all 318 domain stereotypes in [coverage.json](coverage.json), with omitted
tags and unresolved UML roles on the corresponding entry.
[Bundeswehr release and documentation](https://www.bundeswehr.de/de/organisation/ausruestung-baainbw/vergabe/methode-architektur)

## Mapping decisions

- Same-name node types keep the existing NAF/UAF type and attribute rules.
  Compatible optional scalar tags can be added. The audit identifies retained
  fields such as EnterpriseGoal `benefits`, where the inherited UAF field is
  a list and the MDG field is scalar.
- Distinct MDG connector rules with an inherited name use `ADMBw` as a
  prefix. For example, `ADMBwServiceDependency` retains the MDG target
  choices independently of the NAF service-to-service type. Four explicit
  aliases reuse a NAF connector where the mapped direction agrees.
- `Evaluates` relates `FulfilmentCriterion` to `FitCriterion`.
  `EvaluatesCriterion` remains the NAF measurement relationship.
  `ImplementsProtocol` relates `ProtocolImplementation` to `Protocol`.
  The native link can be shown in P3. The qualified resource-to-protocol
  evidence still requires the inherited `ResourceImplementsProtocol` rule.
  A protocol implementation record alone does not establish which physical
  resource implements it. Future work should verify a native MDG resource
  binding before using it as alternative P3 evidence.
- Activity control points and selected BPMN elements can be represented as
  explicitly named endpoint types. The audit records their qualified names.
  The UML message projections use typed NAF lifelines. Checks in EA such as
  `receiveEvent.event.operation` and the message connector remain audit
  entries pending a complete UML interaction representation.
- `StoredIn` derives its source/target pairs from MDG subtypes
  `DataElementStoredIn` and `FormStoredIn`. It does not infer broader
  endpoints from the prose description alone.

## Further compliance work

| Area | Outstanding check | Where to start |
|---|---|---|
| Normative alignment | The pinned NAF application profile uses a UAF 1.0 base. The specific NISP baseline, UAF version and NAF methodology obligations still require review for a formal claim. | [NAF application limits](../naf41/GAPS.md), NAFv4.1 Chapter 4 §1.1 |
| ADMBw metamodel | Element ownership, classifier multiplicity, UML properties and the additional BPMN rules require validation beyond typed binary relationships. | The `unresolvedConstraints`, `unresolvedBases`, and `externalTargets` entries in [the audit](coverage.json) |
| Tagged values | Custom date, boolean and typed GUID declarations are mapped when their target names are known. Untyped GUIDs, controlled country codes and conflicts with inherited fields still need explicit value mappings. | Search the audit for `STANAG 1059` or `forecastedUsage`; inspect the MDG's `TaggedValueTypes` section |
| ADMBw extensions | Toolbox contents set the available vocabulary for the seven ADMBw-specific viewpoints. Methodology-dependent cardinalities require independent review against ADMBw product guidance. | The R8 example and the toolbox names preserved in `@help viewpoints naf41-admbw` |
| EA interoperability | Native EA diagrams, shape scripts and XMI round trips need a separate importer/exporter and fidelity tests. | Sparx MDG toolboxes, UML role constraints and a representative EA exchange file |

Use `npm run build` to regenerate the runtime definitions and the audit.
The regression suite checks that all 47 existing NAFv4.1 fixtures keep their
required rules, element membership, and relation membership under the extension.
