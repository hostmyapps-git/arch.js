# NAFv4.1 with ArchiMate 3.2

Use `config { profile naf41-archimate validation strict }` in the Studio, or
load `archimate-3.2.js` before `naf41-archimate.js` in the browser. The
[standalone ArchiMate profile](../archimate-3.2.json) provides the base vocabulary
without a NAF viewpoint requirement. The [NAF example](../../examples/naf41-archimate.arch)
covers C1, L3, A2 and the viewpoint grid. In the editor, use
`@help viewpoints naf41-archimate A2` to inspect required alternatives and
connection rules.

## Sources and verification

The NATO implementation guide 2026.06 §1.1.1 explicitly targets ArchiMate 3.2.
All 47 viewpoint mapping tables have source pages in [guide-mappings.json](guide-mappings.json)
and executable rules in [coverage.json](coverage.json). The guide uses specialized
elements such as `NafNode` based on `Grouping`. `Node` remains the ordinary
ArchiMate technology element. The profile uses `NafConstraint` for the NATO
specialization of `Requirement`, alongside the independent ArchiMate
`Constraint` element. L7 and P7 support distinct entity, model and attribute
types for tables that share an ArchiMate specialism across those concepts.
[NATO implementation guide](https://www.nato.int/content/dam/nato/webready/documents/publications-and-reports/NATO-Architecture-Framework-ArchiMate-v4-1-en.pdf)

The binary relationship matrix comes from Archi 5.8.0 at the commit in
[sources.lock.json](sources.lock.json). The build packs rows with identical
targets into one pair rule, then applies inheritance so NATO specialisms
retain their base type restrictions. The tests compare every generated binary
element pair with the pinned matrix and run a separately authored positive DSL
and JSON scenario for each NAF viewpoint. This is verification against the
shipped matrix and reviewed guide mappings. The matrix is an implementation
reference and a full independent comparison against The Open Group's Appendix B
remains open. The license is in [ARCHI-LICENSE.txt](ARCHI-LICENSE.txt).
[Archi 5.8.0 matrix](https://github.com/archimatetool/archi/blob/ee6508693dc36889f954741b60e99411e70931d2/com.archimatetool.model/model/relationships.xml)

## Remaining conformance work

| Area | What is enforced today | What to inspect next |
|---|---|---|
| Native relation-to-relationship endpoints | L3 and P4 can express typed conveyed objects through `ConveyingFlow` and show their connectors. | In NATO L3 §26.3, associate the Information Object with the Flow itself. A declaration ending in `-> flowID` currently fails with `Unknown endpoint`. Add relation endpoints to the graph and preserve their identity across validation, include/exclude, layouts and exchange. The reference-based projection does not retain a distinct Association identity. |
| P3 direction and type conflict | `ResourceInteraction -> Protocol` fails under `Realization`, as `TechnologyInteraction -> Artifact` is absent from the matrix. The example fixture uses Association for that trace and retains Flow between resources. | Compare NATO p.104 table and p.105 prose with Appendix B. The latter direction appears in NATO guidance. Record the authoritative resolution before changing the matrix. The same comparison applies to the guide wording about Access between Standard and Resource Interaction. |
| Alternative source representations | Required groups admit alternative layer-specific elements and some equivalent relationship forms. C7 permits a Measure node related to an assessment criterion. Roadmaps support optional dated milestones, and S6/L6/P6 can use `RepresentsParticipant` to show context. | C7 §10.3 allows a measure as an attribute. Cr §12.3 and Sr/Lr/Pr allow milestone facts on capabilities, work packages or readiness levels. Per-view checks need to distinguish attribute evidence from missing data without forcing an arbitrary date or measure. |
| Semantics within a view | Mandatory presence and typed endpoints, including capability dependencies in C3 and transition/message endpoints in the state and sequence viewpoints. Per-element checks cover S3 service/interface assignment, A2 governance and both A3 correspondence targets. | Audit every cut-out edge for its mandatory, optional, or conditional status. For example, A4 still requires review of whether the project has methodology extensions that must be shown. Relevance and completeness depend on the architecture scope. |
| Junctions and derivation | A junction draws as an AND or OR connector, requires a declared kind and rejects mixed edge types and forbidden terminal pairs. | Test general derivation across the full model against Appendix B rules. The profile validates explicit edges and traced junction paths. Derivation, transitive inference, and native relation-to-relation composition remain open. |
| Notation | Connected/tree SVG supports aggregation diamonds, assignment dots, distinct access directions, directed association, triggering and flow arrows. Layer colors and labels identify the base and specialism. | Full ArchiMate glyphs, shape conventions and all official edge markers still require a notation-specific renderer. Specialized sequence, state and activity renderers use their existing diagram conventions. |
| Version boundary | The NAF profile is pinned to 3.2. For example, the A2 mapping uses Representation for a View. | The Open Group removed Representation in ArchiMate 4. A future 4-based profile needs its own reviewed NATO mapping and NISP baseline. |
| Exchange and formal assessment | DSL, arch.js JSON, SVG and dashboard output are covered. | Implement and verify ArchiMate Model Exchange XML against the selected exchange specification. Evaluate the project methodology, architecture scope and applicable NISP baseline separately from renderer and validator tests. |

Rebuild with `npm run build`. Changes to the source snapshots require reviewing
the edition and updating checksums. The three-column guide table snapshot uses
NAF name, specialism, and ArchiMate base type. The matrix snapshot stores one
row of relationship-code sets for each indexed concept. It preserves the
upstream XML ordering and uses a dash for an empty cell.
