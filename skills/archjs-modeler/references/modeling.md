# Model facts and choose a profile

Use the installed engine's help for the selected profile. For example:

```text
help profiles
help types naf41-admbw FitCriterion
help connections naf41-uaf LogicalLifeline
help relations naf41-archimate Triggering
help viewpoints naf41-archimate L3
```

| Brief or existing project | Profile choice |
|---|---|
| General software, organizational, or system architecture | `default` |
| An existing model with a registered or inline profile | Keep its declaration and inspect its rule set. |
| NAFv4.1 using the UAF vocabulary | `naf41-uaf` |
| NAFv4.1 with Bundeswehr ADMBw vocabulary | `naf41-admbw`, which inherits a versioned `naf41-uaf` profile |
| NAFv4.1 using NATO's ArchiMate mappings | `naf41-archimate`, based on ArchiMate 3.2 |
| Standalone ArchiMate 3.2 | `archimate-3.2` |

Check a named version against the actual installation before pinning it. Profiles can reuse a name with different semantics. Inspect endpoint types, direction, required attributes, and viewpoint-specific minimums before writing a typed link. When a validator suggests a candidate, use it only if it preserves the meaning in the brief. Keep ADMBw and ArchiMate interpretations distinct, even when concepts have similar labels.

## Source skeleton

This default-profile example uses a single set of element and relationship IDs in two views.

```arch
architecture "Work order intake" {
  config {
    views overview
    validation strict
  }
  model {
    person requester "Requester"
    application portal "Work Order Portal"
    database records "Work Order Store"

    relation submits requester -> portal "Submits work order" { type flow }
    relation saves portal -> records "Saves work order" { type access }
  }
  view overview "Request intake" {
    include requester, portal, records
  }
  view storage "Persistence" {
    include portal, records
  }
}
```

- Use stable identifiers and short human-readable names from the brief. Record qualifications and rationale in a description, a supported attribute, or a source comment.
- Put domain facts in `model`. Put selection, layout, rendering style, and the framework viewpoint in each `view`.
- `include` selects elements. Relationships between selected elements participate automatically. Use `exclude` for a specific relationship that belongs elsewhere. Select the full context that the viewpoint requires. View-local display hides can preserve semantic membership when a specialized renderer needs the context without drawing every card.
- Keep sequential arrows distinct from structural or ownership links. An interaction can exchange information while the participants' structural dependency belongs in an overview.
- A confirmed requirement can exist even if the responsible system or implementation is unknown. Preserve the requirement and call out the missing trace. Use the chosen profile's native requirement type when it has one. Cover a remaining fact in the model or handoff instead of inventing a profile element type.

For syntax details use `help syntax`, `help model` and `help views`. In a checkout, `examples/` and `profiles/README.md` provide runnable, version-matched references.
