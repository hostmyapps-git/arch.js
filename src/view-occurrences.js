import { ArchError } from './errors.js';
import { relationshipReferences } from './relationship-labels.js';
import { matches } from './profiles.js';

const fail = (message, loc, code = 'ARCH_VIEW_REUSE') => { throw new ArchError(message, loc, code); };
const append = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

// Each card retains its model identity and gains an address rooted at its
// embedding group. The unqualified ID is kept for uniquely represented cards,
// including existing layouts and exported SVG selectors.
export function occurrenceCatalogs(graph, views, profile) {
  const cache = new Map();
  function catalog(view) {
    if (cache.has(view.id)) return cache.get(view.id);
    const byModel = new Map(), byName = new Map(), byId = new Map(), groups = new Map(), edgeGroups = new Map();
    const selection = graph.project(view), visibleEdgeIds = new Set(selection.edges.map(edge => edge.id)), byModelEdge = new Map();
    for (const [id, embed] of Object.entries(view.embeddings ?? {})) {
      const child = catalog(views.get(embed.view)), group = new Map();
      for (const card of child.byId.values()) {
        const occurrence = { ...card, address:`${id}.${card.address}`, owner:id, childId:card.id };
        append(byModel, card.node.id, occurrence);
        group.set(card.id, occurrence);
      }
      groups.set(id, group);
      const edgeGroup = new Map();
      for (const edge of child.edges.values()) {
        if (!visibleEdgeIds.has(edge.modelId)) continue;
        const occurrence = { modelId:edge.modelId, address:`${id}.${edge.address}` };
        append(byModelEdge, edge.modelId, occurrence);
        edgeGroup.set(edge.id, occurrence);
      }
      edgeGroups.set(id, edgeGroup);
    }
    for (const node of selection.nodes) {
      if (!byModel.has(node.id)) byModel.set(node.id, [{ node, address:node.id, style:view.styles[node.id] }]);
      for (const card of byModel.get(node.id)) {
        card.id = byModel.get(node.id).length === 1 ? node.id : card.address;
        if (byId.has(card.id)) fail(`Conflicting card address: ${card.id}; rename an embedding alias or element`, view.loc);
        byId.set(card.id, card);
        append(byName, node.id, card);
        if (card.address !== node.id) append(byName, card.address, card);
      }
    }
    for (const [name, cards] of byName) {
      if (cards.length > 1 && cards.some(card => card.address === name && card.owner))
        fail(`Conflicting card address: ${name}; rename an embedding alias or element`, view.loc);
      if (Object.hasOwn(view.trees ?? {}, name))
        fail(`Card address ${name} conflicts with a layout group; rename the group or embedding alias`, view.loc);
    }
    const edges = new Map();
    for (const edge of selection.edges) {
      if (view.diagram?.type === 'tree' && view.diagram.relations &&
          !matches(edge.type ?? profile.defaultRelation, view.diagram.relations, profile.relationTypes)) continue;
      const occurrences = byModelEdge.get(edge.id);
      if (!occurrences && view._embeddedEdges?.has(edge.id)) continue;
      for (const occurrence of occurrences ?? [{ modelId:edge.id, address:edge.id }]) {
        occurrence.id = occurrences?.length > 1 ? occurrence.address : edge.id;
        if (edges.has(occurrence.id) || occurrence.id !== edge.id && graph.edgesById.has(occurrence.id))
          fail(`Conflicting relationship occurrence address: ${occurrence.id}; rename an embedding alias or relationship`, view.loc);
        edges.set(occurrence.id, occurrence);
      }
    }
    const result = { byId, byName, groups, edges, edgeGroups };
    cache.set(view.id, result);
    return result;
  }
  return catalog;
}

export function findCard(catalog, name, loc, code) {
  const cards = catalog?.byName.get(name);
  if (cards?.length > 1)
    fail(`Ambiguous card reference: ${name}. Use ${cards.map(card => card.address).join(' or ')}`, loc, code);
  return cards?.[0];
}

export function bindPresentation(graph, profile, view, catalog) {
  const selection = graph.project(view);
  const embedded = catalog.groups.size > 0;
  const explicitEndpoints = Object.values(view.routes).some(route => route.source !== undefined || route.target !== undefined);
  if (!embedded && !explicitEndpoints) return null;

  const nodes = [...catalog.byId.values()].map(({ node, id }) => id === node.id ? node : { ...node, id, modelId:node.id });
  const trees = Object.fromEntries(Object.entries(view.trees ?? {}).map(([id, tree]) =>
    [id, tree._embed ? { ...tree, nodes:[...catalog.groups.get(id).values()].map(card => card.id) } : tree]));
  const referenceOverrides = new Map(), referenceRoutes = [];
  const visibleEdgeIds = new Set(selection.edges.map(edge => edge.id));
  for (const route of view.referenceRoutes ?? []) {
    if (!visibleEdgeIds.has(route.edgeId) || view._embeddedEdges?.has(route.edgeId)) continue;
    const edge = graph.edgesById.get(route.edgeId), rule = profile.relationTypes[edge.type ?? profile.defaultRelation];
    if ((view.referenceDisplay ?? rule.referenceDisplay ?? 'labels') === 'labels') continue;
    const card = findCard(catalog, route.nodeId, route.loc, 'ARCH_ROUTING');
    if (!card) continue; // Hidden reference routes retain their declaration.
    const key = JSON.stringify([route.edgeId, card.node.id]);
    if (referenceOverrides.has(key)) fail(`Multiple attachment routes for ${card.node.id} on ${route.edgeId}`, route.loc, 'ARCH_ROUTING');
    referenceOverrides.set(key, card);
    referenceRoutes.push({ ...route, nodeId:card.id });
  }

  function endpoint(edge, side) {
    const route = view.routes[edge.id], requested = route?.[side], name = requested ?? edge[side];
    const card = findCard(catalog, name, route?.loc ?? edge.loc, 'ARCH_ROUTING');
    if (!card) fail(`${edge.id}: Unknown or hidden ${side} card: ${name}`, route?.loc ?? edge.loc, 'ARCH_ROUTING');
    if (card.node.id !== edge[side])
      fail(`${edge.id}: ${side} card ${name} must represent ${edge[side]}`, route.loc, 'ARCH_ROUTING');
    return card.id;
  }

  const edges = [];
  const referenceItems = new Map();
  for (const edge of selection.edges) {
    if (view._embeddedEdges?.has(edge.id)) continue; // Child layouts supply these paths.
    const source = endpoint(edge, 'source'), target = endpoint(edge, 'target');
    edges.push(source === edge.source && target === edge.target ? edge : { ...edge, source, target });
    const rule = profile.relationTypes[edge.type ?? profile.defaultRelation];
    if ((view.referenceDisplay ?? rule.referenceDisplay ?? 'labels') === 'labels') continue;
    const items = [];
    for (const item of relationshipReferences(edge, rule)) {
      if (!selection.ids.has(item.id) || profile.nodeTypes[graph.nodesById.get(item.id).type]?.container) continue;
      const card = referenceOverrides.get(JSON.stringify([edge.id, item.id]))
        ?? findCard(catalog, item.id, edge.loc, 'ARCH_ROUTING');
      items.push(card.id === item.id ? item : { ...item, id:card.id, modelId:item.id });
    }
    referenceItems.set(edge.id, items);
  }
  return { ...catalog, nodes, edges, trees, referenceItems, referenceRoutes };
}
