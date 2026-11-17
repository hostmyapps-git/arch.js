# Cr — Capability Roadmap mapping

The acceptance example is NAFv4.1 (2026.03), printed pp.102–103, in
`ReferenceDocs/nafv4/NATO-Architecture-Framework-v4-1-en.pdf`.
The editable [Cr example](../../examples/naf41-capability-roadmap.arch) preserves
its six elements, seven relationships, arrow directions and stepped arrangement,
using the usual arch.js cards. It is also available in the demo as
**NAFv4.1 · Capability Roadmap**.

## Example vocabulary

| Source concept/link | arch.js application mapping | Direction |
|---|---|---|
| Capability | Inherited UAF `Capability` | — |
| Capability Increment | `CapabilityIncrement`, extends `UAFElement` | — |
| Enterprise Phase | Inherited UAF `EnterprisePhase` | — |
| delivers | `DeliversCapability` | Increment → Capability |
| relates to | `RelatesToEnterprisePhase` | Increment → EnterprisePhase |
| aggregates | `AggregatesEnterprisePhase` | Whole EnterprisePhase → temporal subphase |
| triggers | `TriggersEnterprisePhase` | Triggering EnterprisePhase → following phase |

In the p.103 example the increment relates to **IOC**. Horizon 2030 aggregates
IOC, MOC and FOC; IOC triggers MOC and MOC triggers FOC. Aggregation and trigger
relationships remain distinct even though their endpoint types are the same.
Both application types forbid self-links and cycles individually. This is an
explicit tool rule, not a claim that the PDF specifies a complete graph schema.
Multiple incoming trigger links and shared phase types are not forbidden.

## Milestone presentation

Page 102 describes Capability Milestones, while p.103 explains that milestones
are properties of the increment and are not shown separately. The structural Cr
view therefore requires an increment, a capability and delivery links, but does
not insist on a visible milestone or a defining edge at every increment.

Explicit visible `CapabilityMilestone` nodes still need a valid ISO `date` and
an outgoing `DefinesIncrement` relationship. The optional increment attribute
`milestones` is a list of typed references. These referenced milestone nodes may
remain outside the view, for example:

```arch
model {
  Capability maritime "Maritime SAR"
  CapabilityMilestone ready "Ready" {date "2030-01-01"}
  CapabilityIncrement aircraft "Aircraft rescue" {milestones [ready]}
  relation delivery aircraft -> maritime "delivers" {type DeliversCapability}
}
view roadmap "Cr" {
  viewpoint Cr
  include aircraft, maritime
  propertyFields [milestones]
}
```

This is a body fragment inside `architecture { config {profile naf41-uaf} ... }`.
No milestone/date values are invented for the p.103 reproduction. When milestone
properties are implicit, their completeness is not checked by the profile.

## UAF and ADMBw boundary

UAF 1.0 `TemporalPart` is a UML Property owned by an EnterprisePhase and typed by
another EnterprisePhase (`ReferenceDocs/uaf/UAFP-1.0.xmi`, TemporalPart.class/type).
The supplied ADMBw MDG also defines `TemporalPart` on UML Part, with class/type
constraints for EnterprisePhase. `AggregatesEnterprisePhase` is a binary
projection of that temporal membership, not a lossless UML Property/slot mapping
and not strong composition or single-parent ownership.

Neither the inspected UAF stereotype catalog nor the supplied ADMBw MDG defines
a direct phase-to-phase trigger stereotype. Their `MilestoneDependency` connects
ActualProjectMilestones; `ProjectSequence` connects ActualProjects. These must not
be substituted for edges between EnterprisePhase elements. `TriggersEnterprisePhase`
is an explicit NAF application adapter; it does not execute transitions, evaluate
guards or infer schedule/date constraints.

The NATO NAFv4@UAF-DMM guideline (2019), p.22, represents Cr using configurations,
Exhibits, actual projects and milestone release/withdrawal references. That is a
different representation of capability delivery, not a one-to-one import of the
newer NAFv4.1 example vocabulary.

## Layout

Use a Connected view for the complete graph: it combines hierarchy, dependencies
and external capability/increment nodes. `diagram tree` over every relationship
is not suitable because an element can have multiple parents across these roles.
A named tree group can select only `AggregatesEnterprisePhase` as its hierarchy;
other relationships stay independent. The supplied example uses `place`, routed
triggers and `routes {sharePath stereotypes}` for common aggregation paths.

The p.103 drawing is explanatory. Page 102 calls for a time-based representation
for roadmap readership. Actual Gantt/timeline schedules require dates and are
not inferred from the IOC/MOC/FOC labels.

## Migration to 4.1.0-arch.8

`CapabilityIncrement` no longer extends `ActualEnterprisePhase`. It therefore no
longer inherits Achiever/ActualState/CapableElement compatibility or phase-specific
attributes. Use `DeliversCapability` and `RelatesToEnterprisePhase` for the
respective roles, or an explicit ActualEnterprisePhase when actual-state semantics
are intended. Check older models that used AchievedEffect, Exhibits, Desires*
or phase architecture/vision/goal attributes on an increment.

Optional `startDate`/`endDate` remain declared directly on the adapter, with the
previous ISO date-time format and start ≤ end check. The existing node template
is preserved. Native UAF types and ADMBw source data are unchanged.
