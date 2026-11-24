import { matches, lineageOf } from './profiles.js';
import { profileHelp } from './diagnostic-help.js';

// Keep source order in the adjacency lists. This makes the first reported
// back edge stable even if relationship types use multiple inheritance.
function firstCycle(edges) {
  const adjacency = new Map(), state = new Map();
  const connect = (from, to, edge) => {
    let arcs = adjacency.get(from);
    if (!arcs) adjacency.set(from, arcs = []);
    arcs.push({ to, edge });
  };
  for (const edge of edges) {
    connect(edge.source, edge.target, edge);
    if (edge.direction === 'both') connect(edge.target, edge.source, edge);
  }
  function visit(id) {
    state.set(id, 1);
    for (const arc of adjacency.get(id) ?? []) {
      if (state.get(arc.to) === 1) return arc.edge;
      if (!state.has(arc.to)) {
        const cycle = visit(arc.to);
        if (cycle) return cycle;
      }
    }
    state.set(id, 2);
  }
  for (const id of adjacency.keys()) {
    if (state.has(id)) continue;
    const cycle = visit(id);
    if (cycle) return cycle;
  }
}

function count(map, id) {
  map.set(id, (map.get(id) ?? 0) + 1);
}

export function checkRelationshipConstraints(model, profile, add) {
  const definitions = profile.relationTypes;
  const cycles = new Map(), multiplicities = new Map();
  for (const [type, rule] of Object.entries(definitions)) {
    if (rule.aliasOf) continue;
    if (rule.acyclic) cycles.set(type, []);
    if (rule.outgoing || rule.incoming) multiplicities.set(type, { source:new Map(), target:new Map() });
  }
  if (!cycles.size && !multiplicities.size) return;

  // Classify each edge once by semantic ancestry. Count only relationships
  // that actually have a global multiplicity or acyclicity constraint.
  for (const edge of model.edges) {
    for (const type of lineageOf(edge.type ?? profile.defaultRelation, definitions)) {
      cycles.get(type)?.push(edge);
      const totals = multiplicities.get(type);
      if (!totals) continue;
      count(totals.source, edge.source);
      count(totals.target, edge.target);
      if (edge.direction === 'both' && edge.source !== edge.target) {
        count(totals.source, edge.target);
        count(totals.target, edge.source);
      }
    }
  }
  for (const [type, edges] of cycles) {
    const cycle = firstCycle(edges);
    if (cycle) add(`${type}: Cycles are not allowed`, cycle, {elementId:cycle.id, help:profileHelp(profile,'relations',type)});
  }
  for (const [type, totals] of multiplicities) {
    const rule = definitions[type];
    for (const direction of ['outgoing', 'incoming']) {
      const constraint = rule[direction];
      if (!constraint) continue;
      const outgoing = direction === 'outgoing';
      const counts = outgoing ? totals.source : totals.target, applicable = outgoing ? rule.from : rule.to;
      for (const node of model.nodes) {
        const total = counts.get(node.id);
        if (total === undefined && !matches(node.type, applicable, profile.nodeTypes)) continue;
        const actual = total ?? 0;
        if (actual < constraint.min || constraint.max !== null && actual > constraint.max)
          add(`${node.id}: ${type}.${direction} expected ${constraint.min}–${constraint.max ?? '∞'} relationships, found ${actual}`,
            node, { elementId:node.id, help:profileHelp(profile,'relations',type),
              ...(actual < constraint.min ? { incomplete:true } : {}) });
      }
    }
  }
}
