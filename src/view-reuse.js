import { ArchError } from './errors.js';
import { isGridDiagram } from './diagram-types.js';

const fail = (message, loc) => { throw new ArchError(message, loc, 'ARCH_VIEW_REUSE'); };
function mergeRules(base = {}, local = {}) {
  const inherited = Object.keys(base), declared = Object.keys(local);
  if (!inherited.length && !declared.length) return {};
  return Object.fromEntries([...new Set([...inherited,...declared])].map(id=>[id,{...base[id],...local[id]}]));
}

function mergeReferences(base = [], local = []) {
  if (!base.length && !local.length) return [];
  const key = route => JSON.stringify([route.nodeId, route.edgeId]);
  const merged = new Map(base.map(route => [key(route), route]));
  for (const route of local) merged.set(key(route), { ...merged.get(key(route)), ...route });
  return [...merged.values()];
}

function inheritView(base, raw, graph) {
  if (base.meta !== undefined || raw.meta !== undefined) fail('Meta views cannot use extends', raw.loc);
  const view = {
    ...base, ...raw,
    places: { ...base.places, ...raw.places },
    styles: mergeRules(base._hostStyles ?? base.styles, raw.styles),
    routes: mergeRules(base.routes, raw.routes),
    trees: { ...base.trees, ...raw.trees },
    embeds: { ...base.embeds },
    referenceRoutes: mergeReferences(base.referenceRoutes, raw.referenceRoutes)
  };
  if (base.routeDefaults || raw.routeDefaults) view.routeDefaults = { ...base.routeDefaults, ...raw.routeDefaults };
  for (const field of ['direction', 'theme', 'spacing']) {
    if (raw._explicit && !raw._explicit.includes(field)) view[field] = base[field];
  }
  if (base.diagram && raw.diagram && base.diagram.type === raw.diagram.type) view.diagram = { ...base.diagram, ...raw.diagram };
  if (view.diagram?.type==='state') {
    if (raw.diagram?.initial!==undefined && !raw.diagram.virtualInitial && view.diagram.virtualInitial) delete view.diagram.virtualInitial;
    if (raw.diagram?.virtualInitial && raw.diagram.initial===undefined && view.diagram.initial!==undefined) delete view.diagram.initial;
    const virtualPlaces={...base.virtualPlaces,...raw.virtualPlaces};
    const virtualIds=new Set([view.diagram.virtualInitial?.id,...(view.diagram.virtualFinal??[]).map(point=>point.id)]);
    view.virtualPlaces=Object.fromEntries(Object.entries(virtualPlaces).filter(([id])=>virtualIds.has(id)||Object.hasOwn(raw.virtualPlaces??{},id)));
    const virtualRoutes=mergeRules(base.virtualRoutes,raw.virtualRoutes);
    view.virtualRoutes=Object.fromEntries(Object.entries(virtualRoutes).filter(([id])=>virtualIds.has(id)||Object.hasOwn(raw.virtualRoutes??{},id)));
  } else {
    if (!raw.virtualPlaces) delete view.virtualPlaces;
    if (!raw.virtualRoutes) delete view.virtualRoutes;
  }

  // Start with the base's semantic selection. A local include can bring an
  // excluded base node back, while relationship exclusions stay inherited.
  const inherited = graph.project(base, false).ids;
  const excluded = base._hostExclude ?? base.exclude;
  if (raw.include?.length || raw.exclude?.length) {
    const selected = new Set(inherited);
    for (const id of raw.include ?? []) selected.add(id);
    for (const id of raw.exclude ?? []) selected.delete(id);
    view.include = [...selected];
  } else view.include = [...inherited];
  view.exclude = excluded?.length || raw.exclude?.length
    ? [...new Set([...(excluded ?? []), ...(raw.exclude ?? [])].filter(id => !graph.nodesById.has(id)))]
    : [];
  for (const [id, spec] of Object.entries(raw.embeds ?? {})) {
    if (view.embeds[id]) fail(`Duplicate inherited embed ID: ${id}`, raw.loc);
    view.embeds[id] = spec;
  }
  return view;
}

function adoptEmbeds(view, raw, resolve, graph, specs) {
  const taken = new Set(), embeddings = {};
  const localReferenceEdges = new Set(view.referenceRoutes?.map(route => route.edgeId));
  const exclusions = new Set(view.exclude);
  const internalEdges = new Map();
  view._hostStyles = { ...view.styles };
  view._hostExclude = [...exclusions];
  for (const [id, spec] of specs) {
    const loc = spec?.loc ?? raw.loc;
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id) || graph.nodesById.has(id) || graph.edgesById.has(id) || view.trees[id])
      fail(`Conflicting embed ID: ${id}; use embed VIEW as ALIAS`, loc);
    if (!spec || typeof spec.view !== 'string' || spec.frame !== undefined && typeof spec.frame !== 'boolean') fail(`Invalid embed: ${id}`, raw.loc);
    const child = resolve(spec.view);
    if (view.meta !== undefined || child.meta !== undefined || (view.diagram?.type ?? 'connected') !== 'connected' || !['connected', 'tree'].includes(child.diagram?.type ?? 'connected'))
      fail('embed requires a connected host and a connected or tree source', loc);

    // Embedded placement and visibility belong to the source view. The host
    // owns only the group anchor and relationships crossing its boundary.
    const display = graph.project(child);
    const members = display.ids;
    if (!members.size) fail(`Cannot embed empty view: ${spec.view}`, raw.loc);
    for (const member of members) {
      taken.add(member);
      if (view.places[member] || view.styles[member]) fail(`Embedded node ${member} is controlled by ${spec.view}; extend the source view to change it`, raw.loc);
    }
    const semanticEdges = new Set(graph.project(child, false).edges.map(edge => edge.id));
    const shownEdges = new Set(display.edges.map(edge => edge.id));
    for (const edge of graph.edgesById.values()) {
      if (!members.has(edge.source) || !members.has(edge.target)) continue;
      const semantic = semanticEdges.has(edge.id);
      if (semantic && exclusions.has(edge.id))
        fail(`Cannot exclude embedded relationship ${edge.id}; extend the source view instead`,raw.loc);
      if (view.routes[edge.id] || view.styles[edge.id] || localReferenceEdges.has(edge.id))
        fail(`Embedded relationship ${edge.id} is controlled by ${spec.view}; extend the source view to change it`,raw.loc);
      const previous = internalEdges.get(edge.id);
      internalEdges.set(edge.id, {
        semantic: previous?.semantic || semantic,
        shown: previous?.shown || shownEdges.has(edge.id)
      });
    }
    if (Object.values(view.trees).some(tree => !tree._embed && tree.nodes?.some(node => members.has(node))))
      fail('Embedded nodes cannot also belong to an outer tree group',raw.loc);
    if (raw.exclude?.some(node => members.has(node))) fail('Cannot exclude embedded nodes; extend the source view instead',raw.loc);

    const memberIds = [...members];
    embeddings[id] = { ...spec, nodes:memberIds };
    view.trees[id] = { nodes:memberIds, _embed:true, loc };
  }
  // Each child owns its internal edge presentation. The host's semantic
  // projection contains one relationship if any of those children includes it.
  for (const [id, status] of internalEdges) {
    if (!status.semantic) exclusions.add(id);
    else if (!status.shown) view.styles[id] = { display:'none' };
  }
  if (exclusions.size && taken.size) view.exclude = [...exclusions];
  if (taken.size) {
    view.include = [...new Set([...(view.include ?? []), ...taken])];
    view.embeddings = embeddings;
    view._embeddedEdges = internalEdges;
  }
}

// Resolve the view DAG before validation so each inherited/embedded view uses
// one effective definition. Keep the public model's authored views intact.
export function resolveViewReuse(model, graph, profile) {
  if (!model.views.some(view => view.extends || view.embeds ||
    Array.isArray(view.include) && isGridDiagram(view.diagram?.type,profile))) return model;
  const sources = new Map(), completed = new Map(), active = [];
  for (const view of model.views) {
    if (sources.has(view.id)) fail(`Duplicate view ID: ${view.id}`, view.loc);
    sources.set(view.id, view);
  }
  const catalogue = model._viewCatalogue ?? sources;
  function resolve(id) {
    if (completed.has(id)) return completed.get(id);
    if (active.includes(id)) fail(`Circular view reuse: ${[...active, id].join(' -> ')}`,sources.get(id)?.loc);
    const raw = sources.get(id);
    if (!raw) fail(`Unknown source view: ${id}`, sources.get(active.at(-1))?.loc);
    active.push(id);
    const base = raw.extends ? resolve(raw.extends) : undefined;
    const view = base ? inheritView(base, raw, graph) : {
      ...raw, places:{ ...raw.places }, styles:{ ...raw.styles }, routes:{ ...raw.routes }, trees:{ ...raw.trees }
    };
    if (isGridDiagram(view.diagram?.type,profile)) {
      // View IDs choose diagrams for the grid. Element IDs still participate
      // in the ordinary model projection and viewpoint checks.
      view._gridIncludes = raw.include ?? base?._gridIncludes;
      if (Array.isArray(view.include)) view.include=view.include.filter(id=>graph.nodesById.has(id) || !catalogue.has(id));
    } else delete view._gridIncludes;
    for (const [treeId,tree] of Object.entries(view.trees)) if (tree._embed) delete view.trees[treeId];
    const embeds = view.embeds && Object.entries(view.embeds);
    if (embeds?.length) adoptEmbeds(view, raw, resolve, graph, embeds);
    if (!Object.keys(view.trees).length) delete view.trees;
    active.pop();
    completed.set(id, view);
    return view;
  }
  return { ...model, views:model.views.map(view => resolve(view.id)) };
}
