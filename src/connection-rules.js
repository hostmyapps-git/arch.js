import { matches } from './profiles.js';
import { mappingVisibility } from './mapping-visibility.js';

const addTo = (map, id, value) => {
  let items = map.get(id);
  if (!items) map.set(id, items = []);
  items.push(value);
};

const asList = value => Array.isArray(value) ? value : [value];

export const throughDescription = through => asList(through)
  .map(({direction, relations}) => `${direction} ${relations.join(', ')}`).join(' or ');

function connectionIndex(edges, check, profile, nodes) {
  const connections = new Map(), reachable = new Map();
  const acceptable = id => !check.counterparts || matches(nodes.get(id)?.type, check.counterparts, profile.nodeTypes);
  const steps = check.through ? asList(check.through) : [];
  for (const edge of edges) {
    const type = edge.type ?? profile.defaultRelation;
    for (const step of steps) {
      if (!matches(type, step.relations, profile.relationTypes)) continue;
      // Traversal follows the written relationship roles. Bidirectionality
      // affects evidence counting below, not the configured through direction.
      const incoming = step.direction === 'incoming';
      addTo(reachable, incoming ? edge.target : edge.source, incoming ? edge.source : edge.target);
    }
    if (!matches(type, check.relations, profile.relationTypes)) continue;
    if (check.referencedByAttributes) {
      for (const attribute of check.referencedByAttributes) {
        for (const id of asList(edge.attributes?.[attribute])) {
          if (typeof id === 'string') addTo(connections, id, edge);
        }
      }
      continue;
    }
    const both = edge.direction === 'both';
    if ((both || check.direction !== 'incoming') && acceptable(edge.target)) addTo(connections, edge.source, edge);
    if ((both || check.direction !== 'outgoing') && acceptable(edge.source)) addTo(connections, edge.target, edge);
  }
  return { connections, reachable, acceptable };
}

function connectionCount(node, check, index, visible, nodes) {
  const origins = new Set([node.id]);
  // Set iteration includes new members. Each reachable node is visited once,
  // even when the configured through relationships contain cycles.
  if (check.through) {
    for (const id of origins) for (const next of index.reachable.get(id) ?? []) origins.add(next);
  }
  const connected = new Set(), endpoints = new Set(), references = new Set();
  for (const id of origins) {
    for (const edge of index.connections.get(id) ?? []) {
      if (connected.has(edge)) continue;
      connected.add(edge);
      endpoints.add(origins.has(edge.source) ? edge.target : edge.source);
    }
    for (const attr of check.referenceAttributes ?? []) {
      for (const target of asList(nodes.get(id)?.attributes?.[attr])) {
        if (typeof target === 'string' && visible.has(target) && index.acceptable(target)) references.add(target);
      }
    }
  }
  let count = check.distinctCounterparts ? endpoints.size : connected.size;
  for (const target of references) if (!endpoints.has(target)) count++;
  return count;
}

export function checkConnections(checks, profile, view, graph, selection, add) {
  for (const check of checks ?? []) {
    // Build the evidence index at most once per applicable rule and view.
    // Sparse views then touch only the evidence incident to each origin.
    let index;
    for (const node of selection.nodes) {
      if (!matches(node.type, check.nodes, profile.nodeTypes) ||
          check.nodesExclude && matches(node.type, check.nodesExclude, profile.nodeTypes)) continue;
      if (check.visibility) {
        if (check.visibility === 'shall') mappingVisibility(view, check, node, graph, matches, profile, add);
        continue;
      }
      index ??= connectionIndex(selection.edges, check, profile, graph.nodesById);
      const count = connectionCount(node, check, index, selection.ids, graph.nodesById);
      if (count >= check.min && (check.max === null || count <= check.max)) continue;

      const relationDetails = [check.relations.join(', ')];
      if (check.counterparts) relationDetails.push(`counterpart: ${check.counterparts.join(', ')}`);
      if (check.through) relationDetails.push(`directly or through ${throughDescription(check.through)}`);
      if (check.referenceAttributes) relationDetails.push(`reference attributes: ${check.referenceAttributes.join(', ')}`);
      if (check.referencedByAttributes) relationDetails.push(`referenced by: ${check.referencedByAttributes.join(', ')}`);
      add(`${view.id}: ${node.id} requires ${check.min}–${check.max ?? '∞'} ${check.direction} connections (${relationDetails.join('; ')}); found ${count}`,
        node, { elementId:node.id, viewId:view.id, ...(count < check.min ? { incomplete:true } : {}) });
    }
  }
}
