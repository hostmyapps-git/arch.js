# NAFv4.1 structural application profile

`naf41-uaf` · version `4.1.0-arch.1` · English type/help/diagnostic text.

This is an executable architecture-modeling profile with all **47 current
NAFv4.1 viewpoint IDs**, typed relationships, required content, per-element
connection checks and designated visible-reference checks. It inherits the
existing UAF 1.0 catalog and explicitly adds the application concepts needed
for the newer viewpoints.

It is an **authored structural application mapping**, not an official NATO or
OMG profile, a Sparx MDG import, or a complete compliance checker. The NAF
Information Model is conceptual rather than directly implementable (NAFv4.1,
p.80). This mapping makes the tool representation explicit. The inherited
[UAF limitations](../uaf/COVERAGE.md) still apply. Detailed source pages,
counts, implemented checks and review obligations are in [COVERAGE.md](COVERAGE.md).

## Load and use

For the browser, load the engine and profiles before calling a renderer:

```html
<script src="arch.min.js"></script>
<script src="profiles/uaf.js"></script>
<script src="profiles/naf41-uaf.js"></script>
```

Alternatively, `profiles/profiles.js` loads all supplied profiles in dependency
order. Both variants also work with `file://`; registration does not fetch
additional resources. When replacing a bundle in a live-preview integration,
reload the preview so its scripts actually execute again.

For JSON registration, register `profiles/uaf.json` first and then
`profiles/naf41-uaf.json` with `arch.registerProfile(profile.id, profile)`.
The runtime JSON has no executable application code.

```arch
architecture "Measurable rescue capability" {
  config { profile naf41-uaf }
  model {
    Capability rescue "Maritime rescue"
    AssessmentCriterion response "Time to dispatch" {
      expression "Dispatch within ten minutes of a validated alert"
    }
    Measure time "Elapsed dispatch time" { unit "minutes" value 8 }
    relation characterizes response -> rescue "Characterizes" {
      type CharacterizesCapability
    }
    relation evaluates time -> response "Evaluates" {
      type EvaluatesCriterion
    }
  }
  view performance "C7 · Performance criteria" { viewpoint C7 }
}
```

Open the **NAFv4.1 · Search & Rescue** example in `index.html`, or edit
[examples/naf41.arch](../../examples/naf41.arch). It has nine views of one
model: C1, C7, L2, L3, L4, S4, P4, L4-P4 and Cr. The independently authored
[test scenarios](../../tests/fixtures/naf41/cases.mjs) provide a minimal model
for every one of the 47 viewpoints; `document(ID)` wraps a model in a complete
DSL document.

## Ask the profile

```text
@help profiles naf41-uaf
@help viewpoints naf41-uaf
@help viewpoints naf41-uaf C7
@help types naf41-uaf OperationalAgent
@help types naf41-uaf Needline
@help connections naf41-uaf OperationalPerformer
@help relations naf41-uaf LogicalInteraction
```

Within a document that selects this profile, `.` means the selected profile:

```arch
architecture "Profile help" {
  config { profile naf41-uaf }
  @help viewpoints . L2
}
```

Help displays the title, English explanation, source page, rule definitions
and limitations. An abstract type such as `OperationalAgent` also lists
concrete candidates. Use `OperationalPerformer` for an actor and
`OperationalArchitecture` or its convenience subtype `LogicalNode` for a
logical node. Relationship help checks type compatibility; the selected
viewpoint can impose further restrictions.

## Modeling choices

| Concept | Representation in this profile |
|---|---|
| Logical node | `OperationalArchitecture` or `LogicalNode` |
| Logical active resource | `OperationalPerformer` and applicable UAF subtypes |
| Activity / service / physical function | `OperationalActivity` / `ServiceFunction` / `Function` |
| Physical active resource | Concrete `ResourcePerformer` subtype, e.g. `Software`, `System`; native `isStandardConfiguration` is required |
| Passive physical resource | `DataEntity` (also a UAF `DataElement`) or `PhysicalMaterial` |
| Capability performance | `AssessmentCriterion` with `expression`, `Measure` with `unit`; criterion → capability and measure → criterion |
| Logical needline | `Needline` node with required `source` and `target` references to logical nodes |
| Logical interaction | `LogicalInteraction` edge between active resources, required `conveyed` list; optional `needline` reference |
| Physical interaction | `ResourceInteraction` node with typed endpoints, linked to standards/protocols |
| State | `ServiceState`, `LogicalState`, `ResourceState`, each with required `owner`; distinct from a UAF state-machine description |
| Sequence | Domain lifelines with `represents`; interactions have a positive `order` |
| Parameters | `ServiceOperationParameter` / `ServiceFunctionParameter`, with `owner` and `resource` |
| Roadmaps | Domain milestones with a valid ISO date, readiness/increment nodes, explicit defining and fulfilment/delivery links |
| Foundation | Explicit glossary, correspondence, methodology, work-product, status, version and library adapters |

`Needline` and `ResourceInteraction` have identities because they can themselves
be referenced. References do not automatically draw edges.
Connected views show the `conveyed` elements of `LogicalInteraction` as cards
attached to the carrying edge, following the example on NAFv4.1 p.132 with the
original arch.js templates/colors. By default, a shared information element
appears once, with an attachment to each carrying edge. A view can request
`referenceOccurrences perEdge` to repeat cards; every repeated card displays
the same element ID. Already visible or explicitly placed cards stay shared. These
attachment arrows are presentation annotations, not extra model relationships.
`referenceDisplay labels` restores `Conveys: Title [ID]` text;
`referenceDisplay both` shows cards and text. Other flow types keep their
configured defaults, which a connected view can override.
`route data -> pickup { from left to 0.5 via (370, -125), (370, 132) curve rounded }`
controls an attachment independently. `to` measures a fraction along the
carrying relationship; see [the routed walker example](../../examples/naf41-walker-routing.arch)
and `@help routing`.
`diagram class { propertyFields [source, target, conveyed] }` shows their actual
values; use a connected view for explicit relationships. Drawing
containment is not a substitute for `GroupsLogicalResource` or
`GroupsPhysicalResource` links.

Application flow edges connect activity/function definitions. The inherited
UAF `OperationalControlFlow` and `FunctionControlFlow` still connect UML-style
action representations. These are different projections with different
endpoint requirements, explained in relationship help.

Every formal view needs `viewpoint ID`. Its `include`/`exclude` selection is
validated; all relationships with visible endpoints are part of that view.
Choose compatible context or split it into another view. Minimum connection
checks count visible links, so an allocation hidden in another view does not
satisfy a mandatory visible allocation. The L2-L3 concept view intentionally
has no mandatory formal content.

NAF permits tailoring the set of viewpoints to the architecture's purpose.
A model does not need to instantiate all 47 views. Taxonomies may have a
single root. Some application choices are stricter than minimal documentary
content: for example C2 uses a planning `EnterprisePhase`, and A4 records an
explicit tailoring/no-extension decision with rationale.

State/sequence execution, ownership across transitions, exact protocol matching,
version-label/date consistency, the semantics of textual criteria, completeness
of optional information, methodology adherence and stakeholder approval require
review. A successful structural validation does not establish those properties.

## ADMBw reference

The supplied `NAFv4-ADMBw-MDG-2026.05.xml` was read in its declared
Windows-1252 encoding. Its technology description says **NAF 4.0 plus Bundeswehr
extensions**. It supplied supporting comparisons, especially for strategic
constraints and foundation relationship directions. It does not redefine the
NAFv4.1 viewpoint requirements here. Bundeswehr-only requirements, toolboxes,
shape scripts and embedded scripts were not imported.

Two important distinctions are preserved: MDG `Evaluates` connects different
requirement concepts than the NAFv4.1 measure/criterion relationship, and its
`ImplementsProtocol` uses an intermediate `ProtocolImplementation`. The
application projections are named/documented separately. Extracted comparison
endpoints are included in [coverage.json](coverage.json).

## Maintain and verify

- Edit [catalog.mjs](catalog.mjs) for application nodes, relationships and view rules.
- Update [sources.lock.json](sources.lock.json) only after reviewing a new source version.
- Run `npm run check` to build, validate source hashes, run Node tests and run Chromium tests.
- Generated outputs: `profiles/naf41-uaf.json`, `.js`, combined profile script,
  coverage report and the normal engine bundles.

The pre-existing `uaf` and `naf4-uaf` profiles retain their earlier meanings.
Migration is explicit: change the selected profile and then satisfy the newer
view rules and adapter fields. This release does not silently migrate native
UAF 1.0 models to UAF 1.3.
