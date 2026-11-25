# Design and review views

| Question | Useful starting point | Verify |
|---|---|---|
| Who uses the system and what does it depend on? | Connected context or structure view | Keep the system boundary clear and external participants visible. Label each important direction of dependency or exchange. |
| How does the work proceed and who performs each step? | Activity view with lanes when ownership matters | Distinguish control flow from performer assignment. Derive branches and alternatives from the scenario. |
| What is sent and in what order? | Sequence view when the scenario specifies an order | Use explicit participants or the profile's lifelines and context. Use unique positive numbers with `orderAttribute`. Render a separate sequence when a different scenario changes the order. |
| What states can this thing enter? | State view | Keep state ownership, triggers, and transitions clear. Show initial or terminal points when the requirements imply them. |
| What is a kind of or part of what? | Tree for a true hierarchy | Verify direction and parent assignment. Use a connected view when several independent paths reach the same element. |
| What maps to what? | Matrix or focused connected view | Check row and column meaning and the represented relationship types. |
| What changes over time? | Timeline with the supplied dates | Check ISO values, units, ordering, and which items are dated. Use a connected roadmap when readiness, ownership, or other context matters more than a calendar. |

Use the installed help to confirm diagram options and input requirements, for example `help diagrams activity`, `help diagrams sequence`, and `help diagrams timeline`. Use a renderer permitted by the chosen viewpoint and useful to the audience.

Swimlane behavior depends on the profile's performer relations. If it treats a required performer link as lane flow, use a connected process view with role cards and separate control-flow arrows. This keeps the required assignment in the view's semantic selection and shows who performs each step.

For a default-profile sequence, list existing message relation IDs in order. This works with a profile that has no `order` attribute on messages.

```arch
view pickupNotice "Request and confirm pickup notice" {
  include circulation, notifications
  diagram sequence {
    participants [circulation, notifications]
    messages [requestNotice, confirmNotice]
  }
}
```

For lanes in a general model, the view can read `tags` as the activity's lane ID. For example, `process prepare "Prepare book" { tags desk }` belongs to the `desk` lane. Include the lane IDs and tasks, and connect the tasks with flow relations.

```arch
view pickupWorkflow "Prepare and collect" {
  include desk, patron, prepare, collect
  diagram activity {
    lanes [desk, patron]
    laneAttribute tags
  }
}
```

## Make a rendered view easy to read

- Give each view a descriptive title and an intentional reading direction. Put related elements near each other and favor left-to-right flow for handoffs when the content fits.
- Use relative placement, tree groups, or rows and columns for meaningful alignment. Anchor detailed placement to nearby elements. When refining a route, prioritize the start and end ports, then add waypoints only where needed. Consult `help views`, `help routing`, and `help styles`.
- Keep labels concise, use a limited color vocabulary, and keep endpoints meaningful without color. Show only the fields that support the view's purpose. Use the profile's visual conventions when they convey information. If a label hits a card, try a shorter verb or more space between its endpoints before moving the label by hand.
- Inspect whether labels, nodes, and crossings remain legible at the intended size. Check that relationship directions, shared paths, and visually hidden context still communicate the intended meaning. Split a crowded view by audience or concern when it improves traceability.

The helper's `check` command renders every view and reports both semantic membership and renderer-visible membership. Use `svg` to inspect one view. A validity check can find syntax, semantic, and rendering errors. Visual review catches problems such as overlap, weak emphasis, or a label that is hard to associate with its edge.
