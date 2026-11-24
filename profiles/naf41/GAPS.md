# NAFv4.1 modeling and representation limits

Reviewed for `naf41-uaf@4.1.0-arch.34` against the March 2026 English
specification, printed pp. 79–82 and 88–190. The 47 viewpoint rules and the
coverage of each representation are listed in [COVERAGE.md](COVERAGE.md).

## Modeling choices

| Source | Projection in arch.js |
|---|---|
| S5/S6, L2–L6, P2–P6 objectified relationships | Bind a typed model element to the corresponding edge via `transition`, `interaction`, `needline` or `flow`. The object can have its own typed relationships. Connected views draw the binding. Sequence views can show message objects and their context. State views surface selected events from explicit triggers or compact event references. |
| L3 required passive resources | Each interaction supplies a selected `conveyed` reference or an explicit `ConveysLogicalResource` relationship from the bound object. A Needline's payload and relationship context are optional. |
| Physical/logical resources and behavior | The profile uses typed categories based on UAF 1.0, with explicit adapters for NAF vocabulary. Both physical resource categories are abstract. The S2 and P2 examples use concrete types and preserve the source category labels as stereotypes. Concrete type choices are visible in `@help types`. UML metaclass ownership and lifecycle rules require external review. |
| A3 correspondence | Reference two selected elements through `source` and `target`, create explicit `CorrespondenceRelatesElement` relationships, or combine the forms. Use `ArchitectureDescriptionElement` for generic endpoints or a concrete type when known. The correspondence method stores a readable rule. |
| Roadmaps | The model graph can describe planned stages without dates on its contextual elements. A timeline requires real date values for displayed rows. Example dates are illustrative where the source leaves them open. |

## Boundaries of validation

The profile checks modeled identities, endpoint types, selected content,
structural cardinalities, designated reference visibility and object
bindings. The spec's requirements for relevance, completeness,
stakeholder concerns and governance need evidence beyond the file.
Architecture methodology, applicable standards, approval, model execution
and external tool interchange require assessment outside arch.js.
The [native UAF constraints inventory](../uaf/COVERAGE.md) still applies.

The cut-outs take precedence where an illustrative arrow appears reversed.
For example, C7 uses Measure → AssessmentCriterion (p.98), and L7 uses
InformationModel → InformationProduct (p.141). Runtime names and source
references are available in the viewpoint and relationship help.

## Representation limits

- Connected views cover structural relationships, free positioning, labeled
  routes, graphics, icons and background images. Rich pictures such as L2–L3
  require author-supplied artwork.
- Tree and class views offer hierarchy and class-like detail. SysML internal
  block notation and formal ER multiplicity or crow's feet remain open.
- Table, matrix and A2 grid views show different projections of the same model.
  The A2 grid maps model View objects to explicit viewpoint cells. Navigation
  and project-specific grids are outside the static SVG.
- Sankey encodes directed acyclic flows and consistent positive weights.
  Connected views show cycles or both directions.
- Sequence, state and activity views communicate behavior. Execution, UML
  timing diagrams, protocol simulation and executable parametric models
  require dedicated tools or notation.
- The timeline covers dated ranges and milestones. Native herringbone and
  specialized dashboards remain open. Multiple views can be exported together.
