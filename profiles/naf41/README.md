# NAFv4.1 structural application profile

`naf41-uaf` · version `4.1.0-arch.14` · English type/help/diagnostic text.

This is an executable architecture-modeling profile with all **47 current
NAFv4.1 viewpoint IDs**, typed relationships, required content, per-element
connection checks and designated visible-reference checks. It inherits the
existing UAF 1.0 catalog and explicitly adds the application concepts needed
for the newer viewpoints.

C7 treats EffectivenessCriterion and its subtypes as optional context: they do
not inherit mandatory CharacterizesCapability/EvaluatesCriterion connections
from the ordinary-criterion checks. A Time to find criterion may have only a
SpecifiesEffectiveness link, as on p.99. Ordinary assessment criteria still need
the complete capability-criterion-measure chain. EvaluatesCriterion uses the
Measure → AssessmentCriterion direction from the p.98 cut-out; p.99 illustrates
those arrows in reverse. See `@help viewpoints naf41-uaf C7` for the exact rules.

It is an **authored structural application mapping**, not an official NATO or
OMG profile, a Sparx MDG import, or a complete compliance checker. The NAF
Information Model is conceptual rather than directly implementable (NAFv4.1,
p.80). This mapping makes the tool representation explicit. The inherited
[UAF limitations](../uaf/COVERAGE.md) still apply. Detailed source pages,
counts, implemented checks and review obligations are in [COVERAGE.md](COVERAGE.md).

C8 supports the p.101 `Constraint` vocabulary as a concrete subtype of
`StrategicConstraint`. `ConstrainsCapability` points from either constraint type
to `Capability`. For `Constraint`, `ruleKind` is optional and, when specified,
must be `Constraint`; this meaning is implied by the type rather than inserted
as an attribute value. `StrategicConstraint` retains its inherited required
`ruleKind`. The p.100 constraint-to-rationale link is `OriginatesFromRationale`;
`JustifiesStrategy` remains the explicit inverse application relationship.
See [the C8 example](../../examples/shared-paths.arch) and
`@help connections naf41-uaf Constraint`.

Cr uses `RelatesToEnterprisePhase` from `CapabilityIncrement` to the planning
`EnterprisePhase`, following pp.102–103. `AchievedEffect` remains restricted to
Achiever → ActualState and is not a substitute for this planning relationship.
The complete p.103 [roadmap example](../../examples/naf41-capability-roadmap.arch)
adds `AggregatesEnterprisePhase` (whole → subphase) and `TriggersEnterprisePhase`
(triggering → following phase), each acyclic with no self-links. The example
needs no visible milestone nodes: these are implicit increment properties on
p.103. Explicit visible milestones still need a defining relationship.

Since `4.1.0-arch.8`, `CapabilityIncrement` extends `UAFElement` directly rather
than `ActualEnterprisePhase`. This removes accidental actual-state/achiever
compatibility. Optional date-time start/end properties remain supported; optional
`milestones` references may point outside the view. See [Cr mapping and migration](CR-MAPPING.md)
for exact semantics, validation limits and UAF/ADMBw differences.

## S1 — Service Taxonomy vocabulary

`Service` is the p.104–105 NAF vocabulary alias of native UAF 1.0
`ServiceSpecification`. Both names have the same semantic identity; original
written stereotypes remain visible. ActualService is a separate instance type.
The native `uaf` profile is unchanged. This is an application-profile mapping,
not complete UAF 1.2 compatibility or an import of the ADMBw MDG.
See [aliases, metamodel mappings and migration](ALIASES.md),
`@help aliases naf41-uaf` and `@help mappings naf41-uaf`.
The profile pins `uaf@1.0.0-arch.1`; select this revision explicitly with
`config { profile "naf41-uaf@4.1.0-arch.14" }` when needed.

| Source relationship | arch.js type | Direction |
|---|---|---|
| is a kind of | `ServiceGeneralization` | Specialized service → general service |
| satisfies | `SatisfiesServicePolicy` | Service → ServicePolicy |
| aggregates (services) | `GroupsService` | ServiceGroup → Service |
| aggregates (groups) | `AggregatesServiceGroup` | ServiceGroup → subgroup |

`ServicePolicySatisfiedBy` retains its earlier policy → service direction as an
explicit inverse application link. `AggregatesServiceGroup` forbids cycles and
self-links as an application rule, without implying single-parent ownership or
strong UML composition. The native service-generalization checks remain intact.

The [complete p.105 example](../../examples/naf41-service-taxonomy.arch) has four
services and the In Mission Operation policy. A Connected view with a named
ServiceGeneralization-only tree group keeps policy context outside the hierarchy;
shared specialization paths point toward the general service. Available in the
demo as **NAFv4.1 · Service Taxonomy**. Help: `@help types naf41-uaf Service`,
`@help connections naf41-uaf Service`, `@help viewpoints naf41-uaf S1`.

Native `ServicePolicy` requires `ruleKind`. The sample explicitly chooses
`Constraint`; this value is an example modeling choice, not information supplied
by the PDF. Optional group/policy context is supported but its completeness is
not automatically inferred. A whole-view tree may filter to ServiceGeneralization
and will omit non-hierarchy edges; multiple inheritance needs Connected layout.

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
`Node`, its canonical application type `LogicalNode`, or `OperationalArchitecture` for a
logical node. Relationship help checks type compatibility; the selected
viewpoint can impose further restrictions.

## S2 — Service Structure (pp.106–108)

`Node` is a vocabulary alias of the existing `LogicalNode` application subtype
of UAF OperationalArchitecture. It is not a physical resource or a drawing
primitive. The alias also works in existing L1/L2 projections through the
same inherited logical-node rules. It does not equate all OperationalArchitecture
subtypes with Node.

`PhysicalActiveResource` is a **concrete application subtype** of the abstract
UAF ResourcePerformer. It deliberately is not an alias: an alias would retain
ResourcePerformer's abstract flag. Native UAF and ADMBw do not gain either new
name. The required native `isStandardConfiguration` boolean remains explicit:

```arch
PhysicalActiveResource airTraffic "Air Traffic Control System" {
  isStandardConfiguration false
}
```

The example chooses false; change it if the resource represents a standard
configuration. Native concrete types such as System remain usable.

| Source link | Relationship type | Direction |
|---|---|---|
| depends on | `ServiceDependency` | Dependent service → required service |
| aggregates | `ServiceAggregation` | Whole service → component service |
| specifies | `SpecifiesServiceInterface` | Service → interface |
| consumes | `ConsumesService` | Logical node → service |
| enables | `EnablesService` | Service function → service |
| realizes | `RealizesService` | Physical active resource → service |

The last three are source-directed application projections. Native UAF
Consumes still starts at OperationalActivity; IsCapableToPerform runs from
service to function; Implements keeps its native endpoint pairs. They are not
aliases of the new relationships and their validation rules are unchanged.
ServiceAggregation is a separate whole-to-member grouping relation, rendered
as a solid directed link. It rejects self-links/cycles and permits multiple
aggregating services to reference the same member. It is not an alias of
ServiceComposition, which remains supported with composition notation. Neither
relationship implements full UML ownership/lifecycle semantics.

[The complete S2 example](../../examples/naf41-service-structure.arch) reproduces
p.108's nine elements and eight relationships, including all five services.
It validates in strict mode and uses ordinary Connected placement/routing.
It is also available as **NAFv4.1 · Service Structure** in the demo.

Service dependencies and structural connections (ServiceAggregation,
ServiceComposition or ServiceDependency) remain mandatory; optional
consumption/enabling/realization traces cannot satisfy those requirements.
ServiceProvider and ServiceConsumer now exist for S4 (see below). Their admission
and the complete relies-on/provides/delivers context of the wider p.107 S2
cut-out remain outside the S2 mapping.
This change covers the complete p.108 example, not every optional S2 construct.

Help: `@help types naf41-uaf Node`,
`@help types naf41-uaf PhysicalActiveResource`,
`@help connections naf41-uaf Node`, `@help viewpoints naf41-uaf S2`.
Use one help query per document.

## S3 — Service Interfaces (pp.109–110)

`ServiceOperation` is an application-profile vocabulary alias of UAF
`ServiceMethod`. The native stereotype extends UML Operation; this alias does
not assert that every UML owner/method/ownedParameter constraint is implemented.
`DataProductType` is a concrete application specialization of both DataElement
and PhysicalPassiveResource. Position Report and Target Track Record are named
model elements of that type, not runtime report instances. The italic Physical
Passive Resource category in the cut-out is concretized by the data-product type
in the example; other passive resource types remain distinct.

| Source link | Relationship type | Direction |
|---|---|---|
| specifies | `SpecifiesServiceInterface` | Service → interface |
| specifies | `SpecifiesServiceOperation` | Interface → operation |
| has | `HasServiceOperationParameter` | Operation → conceptual parameter |
| involves | `InvolvesPhysicalResource` | Parameter → physical passive resource / data product |

The [complete p.110 example](../../examples/naf41-service-interfaces.arch)
contains nine elements and nine relationships. One Geographic Location
parameter is associated with two operations. The Resource parameter has no
resource trace, as in the source. This is a conceptual reusable parameter,
not a single UML owned Parameter shared between two exclusive owners.
The demo entry is **NAFv4.1 · Service Interfaces**.

```arch
ServiceOperation submit "Submit location"
ServiceOperationParameter location "Geographic Location"
DataProductType report "Position Report"
relation argument submit -> location "has" { type HasServiceOperationParameter }
relation payload location -> report "involves" { type InvolvesPhysicalResource }
```

This is a model fragment. A strict S3 view also needs its service/interface and
specifying relationships; use the complete example for a standalone document.
Every operation selected in S3 must have its specifying interface link; an
operation shown only as disconnected context now produces an incomplete-view
notice. This tightens the earlier S3 rule, which did not check operation
association. Use draft validation while constructing that link.

Legacy scalar `owner` and `resource` attributes remain accepted on
ServiceOperationParameter, with their previous reference target types. Their
requiredness is now contextual: S3 requires an operation association, supplied
by a visible has link or a selected owner reference. S3 resource tracing is
optional; S7 requires both the operation and resource associations. Explicit
reference values must still be correctly typed and selected in the view.
A reference and a matching edge do not count the same counterpart twice.
Outside S3/S7, the optional attributes alone do not impose an ownership check.
ServiceFunctionParameter keeps its previous required owner/resource attributes.

A Data Model is reached **through** the passive data product, following the
p.110 note: optionally add `DataModel model "Reports" {kind Physical}` and
`relation schema model -> report "specifies" {type SpecifiesData}`.
Do not point InvolvesPhysicalResource directly at DataModel. Native DataModel
still requires `kind` (Conceptual, Logical or Physical).

Connected is suitable for the shared-parameter drawing and exposes place/route.
Class parameter compartments still use a scalar owner attribute; the renderer
does not infer multiple compartment owners from has links. Full operation
signatures, parameter directions/order and consistency between simultaneous
reference and edge declarations remain outside these structural checks.

Help: `@help types naf41-uaf ServiceOperation`,
`@help types naf41-uaf DataProductType`, `@help viewpoints naf41-uaf S3`.
Use one help query per document.

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
| Parameters | Operation parameters: explicit has/involves links or legacy `owner`/`resource`; S3 payload optional, S7 required. Function parameters retain required references. |
| Roadmaps | Domain milestones with a valid ISO date, readiness/increment nodes and defining/fulfilment/delivery links; Cr additionally permits implicit milestone properties as in p.103 |
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

## S4: functions, aggregation and service context (pp.111–112)

Revision 4.1.0-arch.14 supports the complete p.112 example and each directed
association of the p.111 cut-out. ServiceFunction remains native UAF Activity;
Service remains an alias of ServiceSpecification. The additional relationships
are explicit application projections, not imported UAF/ADMBw stereotypes.

| Source | Relationship | Target |
|---|---|---|
| ServiceFunction | EnablesService | Service / ServiceSpecification |
| ServiceFunction | ServiceFunctionAggregation | ServiceFunction |
| ServiceProvider | ProvidesService | Service |
| ServiceConsumer | ConsumesService | Service |
| ServiceFunction | NotifiesServiceProvider | ServiceProvider |
| ServiceConsumer | AccessesServiceFunction | ServiceFunction |
| OperationalActivity | SupportsServiceFunction | ServiceFunction |
| ServiceFunction | EnablesOperationalActivity | OperationalActivity |
| ServiceProvider / ServiceConsumer | PerformsOperationalActivity | OperationalActivity |

ServiceProvider and ServiceConsumer are concrete contextual roles extending
UAFElement, not aliases or specializations of OperationalPerformer. Optional
represents references can identify an OperationalAgent, ResourcePerformer or
ServiceSpecification; links remain attached to the role. ADMBw Provides uses
OperationalPerformer/OperationalRole to ServiceSpecification/Role, so it is not
silently substituted for this role projection.

ConsumesService additionally accepts ServiceConsumer without removing the S2
OperationalArchitecture source. Native Consumes and IsCapableToPerform remain
unchanged. S4 accepts legacy service-to-function IsCapableToPerform alongside
function-to-service EnablesService. Each selected service needs a direct
function allocation. Each selected function needs one directly or through
selected aggregating ancestors, at any depth. Orphans still fail; draft mode
reports missing coverage. Shared subfunctions are permitted. Aggregation is
acyclic and rejects self-links; the recursive cut-out arrow describes a type
relationship, not a concrete self-loop.

Provider/consumer/activity context is optional; none of the optional cut-out
links is required universally. Grouping does not establish UML exclusive
ownership, call behavior, workflow order or executable notification semantics.
No completeness check can discover functions omitted from the model. Existing
S2 provider-specific relies-on/delivers projections remain outside this S4 work.

Examples: [p.112](../../examples/naf41-service-functions.arch) and
[full cut-out](../../examples/naf41-service-functions-cutout.arch).
Use @help viewpoints naf41-uaf S4 and @help connections naf41-uaf ServiceFunction.
