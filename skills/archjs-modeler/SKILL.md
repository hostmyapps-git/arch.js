---
name: archjs-modeler
description: Turn free-text architecture briefs into editable arch.js .arch files. Use for requirements, systems, services, integrations, processes, roadmaps, and architecture views, including revisions to an existing arch.js model.
---

# Model architecture in arch.js

Produce an editable model and views that answer the user's questions. Use one model for multiple views so a system, actor, or service keeps its identity wherever it appears.

## Model the brief

1. Identify the scope, the audience, and what each view should explain. Extract entities, relationships, behavior, and constraints from the brief. Track what is stated, inferred, proposed, or unknown. Ask only when a missing decision changes the deliverable materially. Otherwise proceed with a reversible interpretation and surface it.
2. Keep the profile, stable IDs, and local conventions when editing an existing model. For a new model with no framework requirement, start with `default`. If the brief names a framework, use the requested installed profile and look up its vocabulary. Consult [profile selection and syntax](references/modeling.md) for new models or unfamiliar profiles.
3. Define each concept once. Give relationships a readable verb, the correct direction, and an explicit profile type where applicable. Preserve distinctions that affect the result, such as actor vs. role, service vs. implementation, control vs. data flow, and current vs. planned state. Keep material unknowns visible in comments or the handoff. Derive sequence order from the brief when it provides order. Use dates, cardinalities, ownership, and delivery commitments only when there is evidence for them.

## Build and review views

4. Design each view around one question. Set the opening view deliberately and use focused selections. Keep an overview small enough to read and give details their own views when that helps. Use [view design and layout](references/views.md) to choose a renderer and review the result.
5. Start with automatic layout. Render before adjusting placement or routes. Fix selection and grouping first, then adjust spacing, alignment, labels, or waypoints where the rendered result needs them. Preserve the same model IDs across views and use view-local styling for presentation.
6. Check the source in strict mode and render every modeled view, including views outside the startup selection. Inspect the renders at the intended display size. Separate parse and profile diagnostics from layout problems. Keep a draft with named unknowns if completing a strict model would require unsupported assumptions. A clean validation run establishes the checks the installed profile enforces.
7. Deliver the `.arch` file, a short list of its views, any material assumptions, and the actual verification status. Provide an editable code block if file output is unavailable. Include a dashboard or SVG when requested.

## Use the installed arch.js runtime

From a trusted arch.js distribution or checkout, run the helper relative to this skill directory:

```text
node <skill>/scripts/archjs.mjs help syntax
node <skill>/scripts/archjs.mjs help viewpoints naf41-uaf L6
node <skill>/scripts/archjs.mjs check model.arch
node <skill>/scripts/archjs.mjs svg model.arch overview > overview.svg
node <skill>/scripts/archjs.mjs dashboard model.arch > dashboard.html
```

Set `ARCHJS_DIR` to the installed arch.js distribution when working elsewhere. The helper uses `arch.core.min.js` for SVG and `arch.min.js` for help, reports, and dashboards. It loads optional profiles from `profiles/profiles.js`. Node.js 22 or newer is required for this helper. It reports the semantic and rendered members of each view, which lets you trace a requirement or interaction through the output.

In Studio, use the equivalent `@help` commands, select every relevant view, and check its diagnostics. In an environment with no local runtime, use the syntax references and any supplied profile definitions, deliver the source, and mark parsing and rendering as unverified.
