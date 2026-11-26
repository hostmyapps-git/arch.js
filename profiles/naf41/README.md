# NAFv4.1 structural application profile

`naf41-uaf` · version `4.1.0-arch.43` · English type/help/diagnostic text.

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

## Chapter 3 review

[Coverage](COVERAGE.md) lists the checked contents and representation options
for every viewpoint. [Remaining gaps](GAPS.md) records differences in semantics
and notation. The local reference is the March 2026 NAFv4.1 specification,
printed pp. 79–82 and 88–190. Use the viewpoint help to see the requirements,
typed links and applicable renderers together.

- [Physical resources](../../examples/naf41-resource-viewpoints.arch) exercises P2 through Pr and L4–P4. It includes a protocol-conforming radio link, objectified resource flows and transitions, a data model and dated milestones.
- [Architecture foundation](../../examples/naf41-foundation-viewpoints.arch) exercises A1–Ar with an A2 viewpoint grid, explicit correspondence, work-product versioning and a review roadmap.
- [Objectified logical interactions](../../examples/naf41-interactions-cutout.arch) illustrates L3 with a modeled payload, an optional weighted Sankey and the L6 event and behavior context in a sequence diagram.

In A2 (NAF pp. 174–175), `Stakeholder` is the category shown in the cut-out.
UAF 1.0 declares it abstract. The example interprets Operational Planner and
SAR SIC Project Lead as job titles, modelled as `Post` with `stereotype "Stakeholder"`
for the card caption. Use `ActualPost` for a specific appointment or `ActualPerson`
for an individual. These types all work as the source of `StakeholderHasConcern`.

In A3 (NAF pp. 176–177), use `ArchitectureDescriptionElement` when the
concrete type of a correspondence endpoint is unspecified. The type is a
concrete arch.js application adapter for `UAFElement`. A more specific
type such as `View` or `ArchitectureDescription` can serve as the endpoint
directly. The two targets in the printed example appear swapped relative to
their correspondence captions. The model links **includes Combat SAR** to
**Combat SAR** and **implements SAR Reference Architecture** to **SAR Reference
Architecture**. Both correspondences also link to the common description.

In A4 (NAF pp. 178–179), `Methodology` is an alias for
`ArchitectureMethodology`. Use `ExtendsMethodology` from Mission Threads to
NAFv4 and `MethodologyExtendsStandard` from NAFv4 to the TOGAF standard.
`MethodologyAppliesStandard` models the link to the NAFv4 Information Model.

In A5 (NAF pp. 180–181), `ArchitectureStatusDescribesProduct` links an
`ArchitectureStatus` to an `ArchitectureWorkProduct`, `ArchitectureDescription`
or `View`. The p.181 example reports development status, completeness and
maturity against the two P2 views. A selected work product can satisfy its
status requirement through a selected `WorkProductContainsView` link, or
through a selected `ArchitectureDescriptionGeneralization` and `ContainsView`.

In A6 (NAF pp. 182–183), either an `ArchitectureWorkProduct` or an
`ArchitectureDescription` can own a version. `ProductHasVersion` points
from the description or product to a version or baseline. The inverse
`VersionOfProduct` is also accepted. A version can satisfy its work-product
requirement through a selected baseline that specializes it via
`ArchitectureVersionGeneralization`. `ArchitectureVersionSupersedes`
points from the newer version to the earlier version.

In A8 (NAF pp. 186–188), `Profile` is an alias for `StandardProfile`.
The FMN guidebook uses `ReferencesStandard` to point to Spiral 6 and
`IncludesArchitecturalConstraint` to point to each included constraint.
The example declares `ruleKind Constraint` for the two
`ArchitecturalConstraint` nodes, as required by the inherited UAF rule type.

For weighted L3 views, set `volume` on each selected `LogicalInteraction` and
choose `diagram sankey { relations [LogicalInteraction] weightAttribute volume }`.
All values should use the same unit. Without a weight attribute each selected
link contributes one unit. Use `diagram connected` for feedback cycles.

### P2 — Voice Data (pp. 151–152)

The cut-out prints *Physical Passive Resource* in italics, identifying an
abstract category. The example labels **Voice Data** with that category.
Declare it as `DataProductType`, a concrete subtype in this profile. Use
`stereotype "Physical Passive Resource"` to reproduce the label in the diagram.
The dependency from **DSC Radio** to **Voice Data** uses `PhysicalDependency`.

## S1 — Service Taxonomy vocabulary

`Service` is the p.104–105 NAF vocabulary alias of native UAF 1.0
`ServiceSpecification`. Both names have the same semantic identity; original
written stereotypes remain visible. ActualService is a separate instance type.
The native `uaf` profile is unchanged. This is an application-profile mapping,
not complete UAF 1.2 compatibility or an import of the ADMBw MDG.
See [aliases, metamodel mappings and migration](ALIASES.md),
`@help aliases naf41-uaf` and `@help mappings naf41-uaf`.
The profile pins `uaf@1.0.0-arch.1`; select this revision explicitly with
`config { profile "naf41-uaf@4.1.0-arch.43" }` when needed.

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
<script src="arch.core.min.js"></script>
<script src="profiles/uaf.js"></script>
<script src="profiles/naf41-uaf.js"></script>
```

Alternatively, `profiles/profiles.js` loads all supplied profiles in dependency
order. Both variants also work with `file://`; registration does not fetch
additional resources. When replacing a bundle in a live-preview integration,
reload the preview so its scripts actually execute again.

For JSON registration, register `profiles/uaf.json` first and then
`profiles/naf41-uaf.json` with `arch.registerProfile(profile.id, profile)`.
Both browser loading variants register the frozen revisions
[`4.1.0-arch.33`](revisions/4.1.0-arch.33.json),
[`4.1.0-arch.34`](revisions/4.1.0-arch.34.json),
[`4.1.0-arch.35`](revisions/4.1.0-arch.35.json),
[`4.1.0-arch.36`](revisions/4.1.0-arch.36.json),
[`4.1.0-arch.37`](revisions/4.1.0-arch.37.json),
[`4.1.0-arch.38`](revisions/4.1.0-arch.38.json),
[`4.1.0-arch.39`](revisions/4.1.0-arch.39.json),
[`4.1.0-arch.40`](revisions/4.1.0-arch.40.json),
[`4.1.0-arch.41`](revisions/4.1.0-arch.41.json) and
[`4.1.0-arch.42`](revisions/4.1.0-arch.42.json) before the current
`4.1.0-arch.43`. The unqualified ID selects the current revision. Use the
same registration order when manually loading multiple JSON revisions.

The profile defines the A2 grid through `viewpointGrid`. Revision
`4.1.0-arch.43` shares the style-group colors with node cards and presents
`L2-L3` as a narrow tile with a vertical label.
[Grid syntax and navigation](../../DIAGRAMS.md#naf-viewpoints-mit-nafgrid).

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

`PhysicalActiveResource` is an **abstract alias** of UAF `ResourcePerformer`
as of revision `4.1.0-arch.34`. Pages 107–108 show the abstract category in
the cut-out and use its name as a card label in the example. The executable
type in the S2 model is `System`. The inherited `isStandardConfiguration`
boolean remains explicit.

```arch
System airTraffic "Air Traffic Control System" {
  isStandardConfiguration false
  stereotype "Physical Active Resource"
}
```

The stereotype controls the card caption. The ID and `RealizesService` link
stay the same. Existing declarations of the formerly concrete type can use
`config { profile "naf41-uaf@4.1.0-arch.33" }`. In custom rules the new alias
matches the entire `ResourcePerformer` hierarchy.

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
S2 also accepts the explicit provider and consumer roles. They provide or
consume a service and may rely on a logical Node through
`ServiceRoleReliesOnNode`. `DeliversService` links the Node to the service it
delivers. These links express the optional context in the p.107 cut-out.

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
optional; S7 requires operation ownership and visibility of known resource associations, while unmodeled resources produce review notices. Explicit
reference values must still be correctly typed. Owners must be selected; resource visibility follows the may/shall policy.
A reference and a matching edge do not count the same counterpart twice.
Outside S3/S7, the optional attributes alone do not impose an ownership check.
ServiceFunctionParameter owner/resource attributes are globally optional; S7 checks ownership, visibility of known mappings and review of unmodeled payloads.

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

## L4 logical activities and roles

The [p.135 example](../../examples/naf41-logical-activities.arch) follows the
allocation and control-flow directions from the cut-out on p.134.
`Role` is an alias of UAF 1.0 `OperationalRole` and keeps its written stereotype
in the diagram. `HoldsRole` links a `Node` to the role it holds. Both can be the
source of `PerformsOperationalActivity`. Use `OperationalControlFlow` or
`LogicalControlFlow` between `OperationalActivity` definitions.

Both control-flow types carry `activityFlow: true` for activity diagrams.
Swimlanes therefore follow their directed control flows by default. Use
`diagram activity { ... layout model }` to use declaration order.

L4 requires a visible allocation and a control flow for each selected activity.
A role-focused view may omit the holding node. Existing `IsCapableToPerform` links from
`OperationalAgent` still fulfill the allocation rule, with their native endpoint
constraints. The example uses `diagram connected` to place and route the nodes
explicitly.

Help is available through `@help connections naf41-uaf Role` and
`@help viewpoints naf41-uaf L4`.

### Operational flows and the L4 cut-out

The [p.134 cut-out example](../../examples/naf41-logical-activities-cutout.arch)
models an `OperationalFlow` edge between two `OperationalActivity` elements.
An optional `OperationalFlow` object identifies that edge and can carry separate
`ConveysLogicalResource` links to logical passive resources such as an
`InformationProduct`. The connected renderer draws the `is equal to` attachment
from the object to the flow. The binding can be routed with the regular
reference-route syntax.

```arch
OperationalFlow handover "Incident Handover"
InformationProduct report "Incident Report"
relation transfer handle -> record "Operational Flow" {type OperationalFlow flow handover}
relation conveysReport handover -> report "conveys" {type ConveysLogicalResource}
```

The flow object and payload can be omitted from the view. If selected, the object
binds to one selected flow edge. `LogicalObjectFlow` still accepts a typed
`conveyed` list on the edge. `OperationalControlFlow` and `LogicalControlFlow`
fulfill the separate required control-flow rule.

| Source | Relationship | Target |
|---|---|---|
| `OperationalActivity` | `OperationalActivityAggregation` | `OperationalActivity` |
| `OperationalActivity` | `MapsToCapability` | `Capability` |
| `OperationalActivity` | `ActsUponLogicalResource` | `OperationalExchangeItem` subtype |
| `OperationalActivity` | `TriggersLogicalEvent` | `LogicalEvent` |
| `LogicalEvent` | `TriggersOperationalActivity` | `OperationalActivity` |
| `Service` | `RelatesServiceToOperationalActivity` | `OperationalActivity` |
| `ResourcePerformer` (for example `EquipmentType`) | `EnablesOperationalActivity` | `OperationalActivity` |

## L5 logical states (pp.136–138)

The [p.138 example](../../examples/naf41-logical-states.arch) uses
`HasLogicalState` from a `Node` or `LogicalActor` to a `LogicalState`. A state
can also use its compact `owner` reference. L5 checks for exactly one visible
owner and counts matching references and edges once.

An `event` on a `LogicalStateTransition` draws a `triggers` arrow from the event
card to the transition edge in `diagram connected`. An event can trigger several
edges. The [p.137 cut-out](../../examples/naf41-logical-states-cutout.arch)
uses the objectified form. Set `transition` on the state-to-state edge to bind a
`LogicalTransition` node, then relate the event to that node with
`TriggersLogicalTransition`. Each selected transition object binds one edge.

| Source | Relationship | Target |
|---|---|---|
| `LogicalState` | `StateEnablesOperationalActivity` | `OperationalActivity` |
| `LogicalState` | `StateEnablesLogicalFunction` | `LogicalFunction` |
| `OperationalActivity` or `LogicalFunction` | `HasLogicalMode` | `LogicalMode` |
| `LogicalStateGroup` | `GroupsLogicalState` | `LogicalState` |
| `LogicalStateGroup` | `AggregatesLogicalStateGroup` | `LogicalStateGroup` |

The compact `LogicalMode.activity` remains a valid assignment. A state can
belong to several groups. Nested state groups must be acyclic. `diagram connected`
supports the graphical attachments used in both examples.

## L6 — Logical Sequence

Use `RepresentsLogicalResource` from a `LogicalLifeline` to the
`OperationalAgent` it represents. The p.140 example uses two `Node` elements
and one `LogicalEquipment`. Each selected lifeline requires one selected
resource. The compact `represents` attribute also satisfies that requirement.
An explicit edge and an attribute to the same resource count once.

In a sequence view, `showContext true` draws the resource cards and explicit
timeline links. The relationship's `sequenceContext: "above"` profile setting
aligns an individually represented resource above its lifeline. A shared
resource appears once in the side context. `LogicalSequenceInteraction` edges
are the ordered messages.
Use `orderAttribute order` to sort the messages and require unique positive
order values. See the [p.140 example](../../examples/naf41-logical-sequence.arch).

The p.139 cut-out also shows a `Logical Interaction` object bound to a
message. The current L6 model supports compact `event` and `activity`
references on the message. Object binding and direct association edges to
the interaction object, including the logical-function association, are
tracked in [GAPS.md](GAPS.md).

## L7 — Information Model

`InformationEntity` is the L7 vocabulary for an entity specified by an
information model. It specializes UAF `InformationElement`. Existing
`InformationElement` declarations also satisfy the L7 entity requirement.

| Source | Relationship | Target |
|---|---|---|
| `InformationModel` | `SpecifiesInformation` | `InformationEntity` |
| `InformationModel` | `RepresentsInformationProduct` | `InformationProduct` |
| `InformationEntity` | `AggregatesInformationAttribute` | `InformationAttribute` |
| `InformationAttribute` | `HasInformationAttributeType` | `InformationAttributeType` |

The L7 scope and cut-out on p.141 agree on the direction from the information
model to the information product. The `represents` arrow printed on p.142
points the other way. The profile treats that reversal as a likely editorial
error. The [arch.js example](../../examples/naf41-information-model.arch)
uses the elements from p.142 and the relationship direction from p.141.

For models using the former `RepresentsInformationModel` adapter from
`4.1.0-arch.28`, reverse the endpoints and use `RepresentsInformationProduct`.

An attribute selected in L7 requires one selected owner. Its type may be
omitted from the view. The compact `owner` and `attributeType` references
remain valid alongside the explicit link syntax.

## L8 — Logical Constraints

`LogicalConstraint` specializes `OperationalConstraint` for the L8
vocabulary. Its declared type implies `ruleKind Constraint`. An explicit
`ruleKind` on `LogicalConstraint` accepts the same value.

| Source | Relationship | Target |
|---|---|---|
| `LogicalConstraint` or `LogicalRequirement` | `ConstrainsLogical` (*applies to*) | active resource, behavior or passive resource |
| `LogicalRequirement` | `LogicalRequirementConstraint` (*relates to*) | `LogicalConstraint` |
| `LogicalSpecification` | `GroupsLogicalConstraint` (*aggregates*) | `LogicalRequirement` or `LogicalConstraint` |
| `LogicalConstraint` | `OriginatesFromLogicalRationale` | `LogicalRationale` |
| `LogicalRationale` | `OriginatesFromStrategicConstraint` | `StrategicConstraint` |

Active resources use `OperationalAgent` subtypes such as `Node`. Behavior
can be an `OperationalActivity` or `LogicalFunction`. Passive resources
use `OperationalExchangeItem` subtypes such as `InformationProduct`.

The p.143 cut-out shows the requirement-to-constraint link. The p.144
[example](../../examples/naf41-logical-constraints.arch) applies its
requirement directly to `Search`. The profile accepts either form as the
required connection for a requirement. A link between a requirement and a
constraint is explicit. A common subject alone provides no evidence of it.

## Lr — Logical Roadmap

| Source | Relationship | Target |
|---|---|---|
| `LogicalMilestone` | `DefinesLogicalReadiness` (*defines*) | `LogicalReadinessLevel` |
| `LogicalReadinessLevel` | `LogicalReadinessFulfilsResource` (*fulfils*) | `OperationalAgent`, such as a `Node` |
| `LogicalReadinessLevel` | `TracesCapabilityIncrement` (*relates to*) | `CapabilityIncrement` |
| `LogicalProject` | `SchedulesLogical` (*schedules*) | `LogicalMilestone` |
| `LogicalProject` | `DefinesLogicalEvolution` (*defines evolution of*) | `OperationalAgent` |

Both the cut-out on p.145 and the example on p.146 point from the readiness
level to the resource. Existing models can express the inverse direction
with `FulfilsLogicalReadiness`. Either form satisfies the Lr association
check. Each selected readiness level needs a defining milestone and an
associated resource. Deciding which milestones mark actual readiness is a
modeling decision. The profile does not derive readiness from their dates.
`LogicalProject` inherits the required boolean `isStandardConfiguration` from
`Project`.

The [p.146 example](../../examples/naf41-logical-roadmap.arch) assigns the
maintenance and personnel milestones to both levels, and the software
milestone to WBR High. It uses illustrative ISO dates for the required
`LogicalMilestone.date` values. The printed example leaves those dates open.

## P1 — Resource Taxonomy

The [p.149 example](../../examples/naf41-resource-taxonomy.arch) uses
`EquipmentType` for DSC Radio and its three specializations. This is a concrete
subtype of UAF `ResourceArtifact`. It inherits the required boolean
`isStandardConfiguration`. The example supplies values because the PDF omits
them. `ResourceFunction` is a vocabulary alias of UAF `Function`.

| Label in the cut-out | Source → target | Arch.js relationship |
|---|---|---|
| is a kind of | Specialized active resource → general active resource | `ResourceGeneralization` |
| aggregates | Configuration → active resource | `GroupsPhysicalResource` |
| aggregates | Active resource → active resource | `ResourceAggregation` |
| aggregates | Resource function → resource function | `ResourceFunctionAggregation` |
| performs | Active resource → resource function | `IsCapableToPerform` |
| uses | Active resource → resource function | `UsesResourceFunction` |
| depends on | Active resource → passive resource | `PhysicalDependency` |
| realizes | Configuration → capability | `Exhibits` |
| realizes | Active resource → logical active resource | `Implements` |
| realizes | Resource function → service function or operational activity | `Implements` |
| realizes | Resource function → logical function | `RealizesLogicalFunction` |

P1 checks that the view includes active resources and resource functions. The
links are optional under the p.149 notes. Completeness against the intended scope
and validity of classification decisions need modeling review.

The example uses a named `tree` with `relations [ResourceGeneralization]` and
`sharePath stereotypes`. Its children are below the root and their arrows point
to the parent. The surrounding connected view places the configuration, logical
equipment and function independently. `diagram matrix` can also show the typed
mappings. Class views produce compartments with automatic routing.

## Modeling choices

| Concept | Representation in this profile |
|---|---|
| Logical node | `Node` (alias of `LogicalNode`) or `OperationalArchitecture` |
| Logical active resource | `LogicalActor`, `LogicalEquipment`, or existing `OperationalPerformer` types |
| Activity / service / physical function | `OperationalActivity` / `ServiceFunction` / `ResourceFunction` (alias of `Function`) |
| Physical active resource | Concrete `ResourcePerformer` subtype, e.g. `EquipmentType`, `Software` or `System`. Native `isStandardConfiguration` is required. |
| Passive physical resource | `DataEntity` (also a UAF `DataElement`) or `PhysicalMaterial` |
| Capability performance | `AssessmentCriterion` with `expression`, `Measure` with `unit`; criterion → capability and measure → criterion |
| Logical needline | `Needline` edge between Nodes; optional bound `Needline` object, or a legacy object with paired `source`/`target` references |
| Logical interaction | `LogicalInteraction` edge between active resources, required `conveyed` list; optional `needline` reference |
| Physical interaction | `ResourceInteraction` node with typed endpoints, linked to standards/protocols |
| State | `ServiceState` with HasServiceState or owner in S5; LogicalState/ResourceState retain required owner; distinct from a UAF state-machine description |
| Sequence | Domain lifelines with `represents`; S6 also accepts `RepresentsService` and L6 accepts `RepresentsLogicalResource`. Interactions have a positive order. |
| Parameters | Operation parameters: explicit has/involves links or legacy `owner`/`resource`; S3 payload optional, S7 required. Function parameters retain required references. |
| Roadmaps | Domain milestones with a valid ISO date, readiness/increment nodes and defining/fulfilment/delivery links; Cr additionally permits implicit milestone properties as in p.103 |
| Foundation | Explicit glossary, correspondence, methodology, work-product, status, version and library adapters |

`Needline` and `ResourceInteraction` have identities because they can themselves
be referenced. References do not automatically draw semantic edges. L2 now
supports a typed edge-to-object binding and an is equal to presentation connector;
ResourceInteraction retains its earlier endpoint-reference projection.
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

Application flow edges connect activity/function definitions. In the UAF base
profile, `OperationalControlFlow` connects UML-style `OperationalActivityAction`
endpoints. The NAF profile adds the `OperationalActivity` pair and retains the
action pair. Each edge uses a single representation at both endpoints.

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
S2 also accepts provider and consumer roles, with `ServiceRoleReliesOnNode` for the role-to-node trace and `DeliversService` for the node-to-service link.

Examples: [p.112](../../examples/naf41-service-functions.arch) and
[full cut-out](../../examples/naf41-service-functions-cutout.arch).
Use @help viewpoints naf41-uaf S4 and @help connections naf41-uaf ServiceFunction.

## S5: objectified transitions and state context (pp.113–115)

Revision 4.1.0-arch.15 supports the complete p.115 example and p.114 cut-out.
ServiceStateTransition exists in both node and relation namespaces. Use a
separate object ID and bind it on the state edge: `relation change ready ->
unavailable "" {type ServiceStateTransition transition loss}`. This edge
defines the endpoints; no duplicate source/target attributes are needed.

The typed transition reference draws the object-to-edge connector captioned
is equal to. It is not a model edge accepting another edge ID as endpoint.
Use `route loss -> change {from top to 1/2}` to route it. Labels-only
presentation lists the reference in the ordinary edge label instead. Connected
views display the attached object; the Sequence renderer also supports message
objectification from revision 4.1.0-arch.16. Other specialist renderers do not.

| Source | Relationship | Target |
|---|---|---|
| Service | HasServiceState | ServiceState |
| ServiceState | ServiceStateTransition | ServiceState |
| ServiceEvent | TriggersServiceStateTransition | ServiceStateTransition object |
| ServiceState | StateEnablesServiceFunction | ServiceFunction |
| ServiceFunction | EnablesService | Service |
| ServiceFunction | HasServiceMode | ServiceMode |
| ServiceStateGroup | GroupsServiceState | ServiceState |
| ServiceStateGroup | AggregatesServiceStateGroup | ServiceStateGroup |

Each selected transition object must be referenced by exactly one selected
state-transition edge in S5. A transition edge may remain compact without an
object. Its optional event reference is retained; new models can instead use
explicit triggers links. Events are optional and multiple triggers are allowed.

ServiceState.owner and ServiceMode.function become optional global attributes:
S5 requires exactly one selected owner/function association through the explicit
link or the legacy reference, deduplicating the same owner reference and link.
Outside S5 those attributes alone no longer enforce ownership. State ownership
and function ownership references must still be selected when provided. Every
selected state retains the existing transition-connection check. Group nesting
is acyclic, rejects self-links, and permits shared subgroups. State transitions
may self-loop. The recursive cut-out arrows describe type-level possibilities.

Legacy EnablesServiceMode (state to mode) remains valid but is not the cut-out
function-to-mode has relation. Cross-state same-service consistency, event
reference/link consistency, guards, execution, reachability and implicit
state-machine semantics are not implemented. These are structural application
projections, not full UML/UAF state-machine semantics.

Examples: [p.115](../../examples/naf41-service-states.arch),
[cut-out](../../examples/naf41-service-states-cutout.arch).
Help: @help types naf41-uaf ServiceStateTransition,
@help relations naf41-uaf ServiceStateTransition, @help viewpoints naf41-uaf S5.

## S6: objectified interactions and service timelines (pp.116–118)

Revision 4.1.0-arch.16 reproduces both messages on p.118 as ServiceInteraction
edges plus ServiceInteraction nodes. Bind each node on its message using the
interaction reference. Lifelines represent services, not objectified messages.

| Source | Relationship | Target |
|---|---|---|
| ServiceLifeline | RepresentsService | Service |
| ServiceLifeline | ServiceInteraction | ServiceLifeline |
| ServiceEvent | TriggersServiceInteraction | ServiceInteraction object |
| ServiceInteraction object | InteractionRelatesOperation | ServiceOperation / ServiceMethod |
| ServiceFunction | EnablesService | Service |
| Service | SpecifiesServiceInterface | ServiceInterface |
| ServiceInterface | SpecifiesServiceOperation | ServiceOperation / ServiceMethod |

Each selected lifeline represents exactly one selected service, via RepresentsService
or its legacy represents reference. The reference becomes globally optional;
outside S6 it no longer enforces that association by itself. Each selected
interaction object binds exactly one selected lifeline-message edge. Compact
messages without an object remain valid, retaining required positive integer
order and optional event/operation attributes. Explicit trigger/relates-to links
are optional. No automatic reconciliation of links versus legacy attributes.

Sequence views draw message object cards, captioned is equal to attachments and,
with showContext true, selected context cards/links in a separate area. Context
is not a new set of lifelines. The profile sequenceMessage flag distinguishes
messages from ordinary context edges. Explicit participants/messages still work.
Use orderAttribute order to sort by unique positive message positions; without
it, declaration or explicit list order remains authoritative.

Connected views retain free placement/routing for the same model. Sequence
layouts remain automatic: no place/route, custom card sizing, full UML fragments,
execution, time semantics or global crossing minimization. Some captions are
limited to two visual lines with the full text in the SVG title. Context layout
uses a fixed grid; omitted context is not interpreted as an implicit model edge.

Examples: [p.118](../../examples/naf41-service-sequence.arch),
[cut-out](../../examples/naf41-service-sequence-cutout.arch), both with a second
Connected inspection view. Help: @help viewpoints naf41-uaf S6,
@help types naf41-uaf ServiceInteraction, @help diagrams sequence.

Further confirmed PDF vocabulary/objectification gaps are tracked in [GAPS.md](GAPS.md).
Supporting every viewpoint ID is not a claim of complete cut-out or example coverage.

## S7 — Service function parameters and logical payloads

Revision `4.1.0-arch.17` adds the function-parameter branch of pp.119–120:

```arch
ServiceFunction receiving "Data Receiving"
ServiceFunctionParameter incoming "Incoming data"
InformationProduct report "Situational Report"
relation parameter receiving -> incoming "has" {type HasServiceFunctionParameter}
relation product incoming -> report "involves" {type InvolvesLogicalResource}
```

`InvolvesLogicalResource` is an application relationship from a function
parameter to native UAF `OperationalExchangeItem` or a subtype, including
InformationProduct and InformationElement. It does not accept physical data
products or active performers. `InvolvesPhysicalResource` remains the separate
operation-parameter relationship; neither its direction nor its targets change.

S7 requires function ownership and checks visibility of every known payload
association. Missing payload mappings produce non-blocking review notices,
not mandatory per-parameter cardinality errors. Drawn links and typed
`owner`/`resource` references remain supported. Those attributes are globally optional so explicit links suffice;
when provided, their types are checked globally. Legacy physical `resource`
references on function parameters remain accepted for backwards compatibility.
This exception does not broaden the endpoints of InvolvesLogicalResource.
Simultaneous references and links are not checked for equality.

[Service parameters example](../../examples/naf41-service-parameters.arch)
shows both branches and extends/embeds the S3 view. It supplies a physical
resource reference for the Resource operation parameter as an explicit modeling
choice. The compliant figures on pp.110 and 120 show `Resource` without an
`involves` edge. The unmodeled association produces a non-blocking mapping
review in arch.js. Keep it unmodeled when reproducing those figures. Add an
`InvolvesPhysicalResource` link if the architecture identifies a specific
involved passive resource. `EnablesService`
is also admitted in S7 for the optional service context. No complete UML
parameter ownership, signature, ordering or data compatibility semantics is
asserted.

## S8 service constraints

S8 accepts `SatisfiesServicePolicy` from Service to ServicePolicy, as drawn in
the cut-out and example on pp.121–122. `ServicePolicySatisfiedBy` remains
available in the inverse direction. Services and their satisfaction links are
optional context; policy-to-constraint grouping remains required through
`GroupsServiceConstraint` (the visible caption may be `"aggregates"`).

## L1 logical taxonomy (pp.126–127)

[naf41-logical-taxonomy.arch](../../examples/naf41-logical-taxonomy.arch)
reproduces all 12 elements and 11 relationships of the p.127 SAR example,
including the Crew, three logical equipment elements and Information Product.

`LogicalActor` and `LogicalEquipment` are separate concrete application
subtypes of `OperationalPerformer`. They retain their written stereotypes and
inherited relationships. They are not aliases, physical instances or imported
native UAF stereotypes. Existing `OperationalPerformer` models remain valid.

| Source caption | Application relationship | Direction |
|---|---|---|
| supports | `Exhibits` | Node → Capability |
| aggregates | `GroupsLogicalResource` | Node → Node, active/passive resource or activity |
| is a kind of | `OperationalGeneralization` | Specialized node/active resource → general node/active resource |

L1 requires a logical node, but no artificial activity or performer at each
grouping/specialization node. A singleton node taxonomy is valid. Every selected
active resource must be grouped by a selected logical node, directly or through
selected generalization ancestors. Selected activities and optional passive
resources require direct incoming grouping. An omitted ancestor cannot provide
view-local grouping evidence. Native generalization cycle/type checks remain.

The p.126 requirement to include all *relevant* resources and behavior cannot be
proved from the model alone. Their relevance and completeness remain review
obligations; the absence of activities alone does not invalidate the p.127
example. Capability context and passive resources remain optional. This change
does not add new projections for behavior/passive-resource specialization or
a distinct needs-capability relation.

Help: `@help types naf41-uaf LogicalActor`,
`@help connections naf41-uaf LogicalEquipment`,
`@help viewpoints naf41-uaf L1`.

## L2 needlines (pp.128–129)

[naf41-needlines.arch](../../examples/naf41-needlines.arch) reproduces all four
Nodes and six directed Needlines of p.129. Cycles across distinct nodes and
parallel needlines are supported; a plain LogicalDependency does not satisfy
the requirement for at least one Needline representation.

```arch
Node search "Search"
Node assetControl "Asset Control"
relation control search -> assetControl "control" {type Needline}
```

Needline has a node and relationship type in separate namespaces. Object cards
are optional. Bind an object with the edge's typed scalar `needline` attribute:

```arch
Needline taskingNeed "Rescue tasking"
InformationProduct order "Tasking Order"
relation tasking assetControl -> search "tasking" {
    type Needline
    needline taskingNeed
}
relation payload taskingNeed -> order "conveys" {type ConveysLogicalResource}
```

The binding draws an is equal to connector using the existing graphical
reference mechanism. `route taskingNeed -> tasking {from top 1/2 to 1/2}`
controls its ports, path fraction and via points. It is a presentation connector,
not an additional semantic relationship. Normal place, route, label and style
options remain available in connected views. A bound object may be excluded or
hidden while its compact edge is shown. Explicit payload links use normal routes.

Each selected Needline object needs one selected bound Needline edge, or a
complete legacy `source`/`target` reference pair whose endpoints are selected.
The node attributes are individually optional to permit bound objects, but
partial pairs are rejected in L2. More than one model edge bound to the same
object is rejected, even if the object card is omitted in the view. If legacy
references accompany a binding they must agree with its endpoints. Typed Node
endpoints are retained; logical actors/equipment and physical resources do not
replace Nodes at the ends of a Needline. Legacy reference pairs do not create
auto-generated edges: use explicit Needline edges for the p.129 visualization.

L2's may-show payload rule permits omission of known logical passive resources,
ConveysLogicalResource links and legacy `conveyed` targets. Optionality does not
relax model reference typing. Existing `conveyed` attributes on Needline objects
remain data and can be displayed with propertyFields; the explicit conveys
relationship supplies the cut-out's drawn semantic link. Completeness of exchange
needs, physical transport and full UML association-class semantics require review.

The [cut-out example](../../examples/naf41-needlines-cutout.arch) includes
objectified, compact and known-payload-omitted views of the same model.
L3 can show the same Needline edges, their Node endpoints, object cards and
requested resources as optional context (p.131). Context Nodes need no direct
LogicalInteraction. The interaction and its conveyed resources still belong
in the L3 view.

Help: `@help relations naf41-uaf Needline`, `@help types naf41-uaf Needline`,
`@help connections naf41-uaf Needline`, `@help viewpoints naf41-uaf L2`.
