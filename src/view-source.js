import { ArchError } from './errors.js';
import { modelSource, modelSources } from './source.js';

const diagramReferences = [
  'participants','messages','asyncMessages','returns','initial','final','lanes','decisions','forks','joins',
  'rows','columns','attributes','methods','functions','interfaces','ports','parameters'
];
const values = value => Array.isArray(value) ? value : value == null ? [] : [value];

// Use effective membership and authored declarations. The former includes
// inherited and embedded members while the latter preserves the DSL rules.
export function viewSourceProvider(model, report) {
  const views = new Map(model.views.map(view => [view.id,view]));
  const summaries = new Map(report.views.map(view => [view.id,view]));
  const elements = new Map(report.elements.map(node => [node.id,node]));
  const relations = new Map(report.relationships.map(edge => [edge.id,edge]));

  return function viewSource(id, format) {
    if (!views.has(id)) throw new ArchError(`Unknown view: ${id}`);
    const selectedViews = new Set(), selectedItems = new Set();
    const pendingViews = [id];
    while (pendingViews.length) {
      const next = pendingViews.pop();
      const view = views.get(next);
      if (!view || selectedViews.has(next)) continue;
      selectedViews.add(next);
      const summary = summaries.get(next);
      pendingViews.push(view.extends);
      for (const embed of Object.values(view.embeds ?? {})) pendingViews.push(embed.view);
      for (const item of view.include ?? []) {
        if (summary.grid && !elements.has(item) && views.has(item)) pendingViews.push(item);
        else selectedItems.add(item);
      }
      for (const list of [
        summary.elements, summary.relationships, view.exclude ?? [],
        Object.keys(view.places ?? {}), Object.keys(view.styles ?? {}), Object.keys(view.routes ?? {})
      ]) for (const item of list) selectedItems.add(item);
      if (view.represents) selectedItems.add(view.represents);
      for (const tree of Object.values(view.trees ?? {}))
        for (const item of tree.nodes ?? []) selectedItems.add(item);
      for (const route of view.referenceRoutes ?? []) {
        selectedItems.add(route.nodeId);
        selectedItems.add(route.edgeId);
      }
      const diagram = view.diagram;
      if (diagram) {
        for (const field of diagramReferences)
          for (const item of values(diagram[field])) selectedItems.add(item);
        if (diagram.virtualInitial) selectedItems.add(diagram.virtualInitial.target);
        for (const point of diagram.virtualFinal ?? []) {
          selectedItems.add(point.source);
          if (point.event) selectedItems.add(point.event);
        }
      }
    }

    // Set iteration also visits newly added IDs, including transitive
    // references and enclosing packages. Cycles terminate at the same ID.
    for (const item of selectedItems) {
      const node = elements.get(item), edge = relations.get(item);
      if (node?.parent) selectedItems.add(node.parent);
      if (edge) {
        selectedItems.add(edge.source);
        selectedItems.add(edge.target);
      }
      for (const ref of (node ?? edge)?.references ?? []) selectedItems.add(ref.id);
    }
    const source = {
      ...model, config:{...model.config, views:[id]},
      nodes:model.nodes.filter(node => selectedItems.has(node.id)),
      edges:model.edges.filter(edge => selectedItems.has(edge.id)),
      views:model.views.filter(view => selectedViews.has(view.id))
    };
    return format ? modelSource(source,format) : modelSources(source);
  };
}
