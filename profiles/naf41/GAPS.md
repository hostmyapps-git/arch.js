# NAFv4.1: confirmed vocabulary and objectification gaps

Review: 18 November 2026, against `naf41-uaf@4.1.0-arch.16`.
Source: `ReferenceDocs/nafv4/NATO-Architecture-Framework-v4-1-en.pdf`.
Page numbers below are the printed PDF pages.

The PDF text was searched across all 208 pages. The conceptual section
pp.88–190 was additionally rendered and OCR-scanned because much of the diagram
text is embedded in figures. The specific cut-outs listed below were inspected
visually and their names checked against the compiled profile. OCR alone is
not evidence of type identity or a complete conformance audit. This is a list
of confirmed gaps; the absence of another item does not assert coverage.

## Objectified relationships

| Viewpoint | PDF pages | Concept | Current implementation |
|---|---|---|---|
| S5 | 114–115 | Service State Transition | Node + edge + typed binding, captions and trigger links implemented in arch.15. |
| S6 | 117–118 | Service Interaction | Node + edge + typed binding, sequence/connected presentation and event/operation links implemented in arch.16. |
| L2 | 128–129 | Needline | Node exists with source/target/conveyed references; no matching Needline edge type or node-to-edge binding. |
| L3 | 131–132 | Logical Interaction | Relationship exists with conveyed/needline references; no interaction object node or object-to-edge binding. Needline objectification is also used here. |
| L4 | 134 | Operational Flow | Cut-out shows an Operational Flow object attached to the flow edge. No literal OperationalFlow type; LogicalObjectFlow is a binary projection. |
| L5 | 137–138 | Logical Transition | Cut-out shows transition object, state edge and trigger. LogicalStateTransition exists only as an edge; literal LogicalTransition is absent. The object-to-edge arrow has no is equal to caption in this cut-out. |
| L6 | 139–140 | Logical Interaction | Cut-out shows an interaction object attached to a lifeline message, triggered by an event and related to activities/functions. LogicalSequenceInteraction is only a binary message projection. |
| P2/P3 | 151, 154 | Resource Interaction | ResourceInteraction object exists with performer endpoint references. No matching edge type and typed object-to-edge binding; not the complete cut-out. |
| P4 | 157 | Resource Flow | ResourceFlow exists as a binary relationship; object node and binding are absent. |
| P5 | 161–162 | Resource Transition | Cut-out explicitly shows is equal to and event trigger. ResourceStateTransition exists only as an edge; literal ResourceTransition is absent. |
| P6 | 163–164 | Resource Interaction | Cut-out explicitly shows object-to-message binding, trigger and function relation. ResourceSequenceInteraction is a binary message projection. Existing ResourceInteraction node requires performer endpoints, so it is not a complete lifeline-message object projection. |

The exact word “objectified” occurs in the PDF text on pp.114, 117, 128, 132
and 151. That text search alone misses graphical objectification on other
cut-outs, including pp.134, 137, 139, 154, 157, 161 and 163.

Beyond S5/S6, these findings represent seven further concept families:
Needline, Logical Interaction, Operational Flow, Logical Transition,
Resource Interaction, Resource Flow and Resource Transition. Several families
appear in both structural/interaction and sequence contexts with different
endpoint categories. They must not be flattened into aliases without checking
those endpoint semantics.

## Confirmed names not available as node types

| PDF concept | Example cut-out | Profile observation |
|---|---|---|
| Logical Interaction | L3 p.131 / L6 p.139 | Relation-only under LogicalInteraction; no node type. |
| Operational Flow | L4 p.134 | No literal node or relationship type. |
| Role | L4 p.134 | Literal Role absent; native OperationalRole exists but equivalence needs review. |
| Logical Function | L5 p.137 / P1 p.148 | Literal LogicalFunction absent; a semantic/version mapping is needed. |
| Logical Transition | L5 p.137 | Literal name absent in both namespaces; existing LogicalStateTransition is relation-only. |
| Logical State Group | L5 p.137 | LogicalStateGroup absent. |
| Resource Function | P1 p.148 / P4 p.157 | Literal ResourceFunction absent; native UAF Function is available, but no declared alias/mapping for this vocabulary. |
| Resource Flow | P4 p.157 | Relation-only; no ResourceFlow node. |
| Resource Transition | P5 p.161 | Literal name absent in both namespaces; existing ResourceStateTransition is relation-only. |
| Resource State Group | P5 p.161 | ResourceStateGroup absent. |

The italic Logical Active Resource and Logical Passive Resource categories
on several cut-outs are not literal profile node names either. Their typography
and semantic breadth require an abstract-category mapping, not automatic
creation of concrete instantiable aliases. PhysicalPassiveResource is already
abstract in this profile; PhysicalActiveResource is an explicit application
specialization. Missing vocabulary, missing binding and missing rendering are
separate issues.

## Follow-up approach

- Reuse typed edge-to-object references, binding-cardinality checks and the
  generic reference/sequence presentation added for S5/S6.
- Preserve existing binary projections and source/target reference forms.
- Separate type renames from specializations and category mappings; retain
  explicit NAF/UAF/ADMBw mapping notes.
- Validate each complete cut-out and its example independently. A positive
  minimal fixture is insufficient evidence for complete viewpoint support.

No new L/P profile types were implemented as part of this review.
