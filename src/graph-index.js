// Index the document once per operation. Parsed models are mutable, so these
// derived sets and arrays are never cached across public API calls. Consumers
// treat the projections as read-only and retain source ordering.
export function indexGraph(model, omitRelationship) {
  const nodesById = new Map(model.nodes.map(node => [node.id, node]));
  const edgesById = new Map(model.edges.map(edge => [edge.id, edge]));
  const views = new WeakMap();
  const canIndexSparseViews = (model.views?.length ?? 0) >= 8 && model.nodes.length >= 128 && nodesById.size===model.nodes.length;
  let children, allIds, incidentById, nodePositions, outgoingPositions;

  function descendants(roots) {
    const ids = new Set(roots);
    if (!ids.size) return ids;
    children ??= groupByParent(model.nodes);
    const pending = [...ids];
    while (pending.length) {
      for (const child of children.get(pending.pop()) ?? []) {
        if (ids.has(child.id)) continue;
        ids.add(child.id);
        pending.push(child.id);
      }
    }
    return ids;
  }

  function select(view, excluded, hidden) {
    const all = !view.include && !excluded.size && !hidden.size;
    if (all) return { ids: allIds ??= new Set(nodesById.keys()), nodes: model.nodes, edges: model.edges };

    const ids = view.include ? descendants(view.include) : new Set(nodesById.keys());
    // Exclusions win even if a descendant was explicitly included. Restore
    // ancestor containers only for selections that survived those exclusions.
    for (const id of descendants([...excluded, ...hidden])) ids.delete(id);
    if (view.include) {
      const visited = new Set();
      for (const id of ids) {
        let parent = nodesById.get(id)?.parent;
        while (parent && !visited.has(parent)) {
          visited.add(parent);
          ids.add(parent);
          parent = nodesById.get(parent)?.parent;
        }
      }
    }
    if (!ids.size) return { ids, nodes:[], edges:[] };
    if (canIndexSparseViews && ids.size * 8 <= model.nodes.length) return selectSparse(ids,excluded,hidden);
    const nodes = model.nodes.filter(node => ids.has(node.id));
    const edges = model.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target) && !excluded.has(edge.id) && !hidden.has(edge.id));
    return { ids, nodes, edges };
  }

  function selectSparse(ids, excluded, hidden) {
    // Build the indexes only for documents likely to amortize them over
    // multiple small projections. Numeric positions restore source order
    // even if the authored include list or its expanded packages are reordered.
    if (!nodePositions) {
      nodePositions = new Map(model.nodes.map((node,index)=>[node.id,index]));
      outgoingPositions = new Map();
      model.edges.forEach((edge,index) => {
        let outgoing = outgoingPositions.get(edge.source);
        if (!outgoing) outgoingPositions.set(edge.source,outgoing = []);
        outgoing.push(index);
      });
    }
    const nodeIndices = [], edgeIndices = [];
    for (const id of ids) {
      const position = nodePositions.get(id);
      if (position!==undefined) nodeIndices.push(position);
      for (const index of outgoingPositions.get(id) ?? []) {
        const edge = model.edges[index];
        if (ids.has(edge.target) && !excluded.has(edge.id) && !hidden.has(edge.id)) edgeIndices.push(index);
      }
    }
    return {ids,
      nodes:nodeIndices.sort((a,b)=>a-b).map(index=>model.nodes[index]),
      edges:edgeIndices.sort((a,b)=>a-b).map(index=>model.edges[index])};
  }

  function project(view, respectDisplay = true) {
    let projection = views.get(view);
    if (!projection) {
      const excluded = new Set(view.exclude);
      let semantic = select(view, excluded, new Set());
      if (omitRelationship) {
        const edges = semantic.edges.filter(edge => {
          if (!omitRelationship(view, edge)) return true;
          excluded.add(edge.id);
          return false;
        });
        if (edges.length !== semantic.edges.length) semantic = { ...semantic, edges };
      }
      projection = { excluded, semantic };
      views.set(view, projection);
    }
    // Presentation hides never affect semantic viewpoint requirements. Reuse
    // the semantic projection when no view-local display override hides an ID.
    if (!respectDisplay) return projection.semantic;
    if (!projection.display) {
      const hidden = new Set(Object.keys(view.styles ?? {}).filter(id => view.styles[id]?.display === 'none'));
      projection.display = hidden.size ? select(view, projection.excluded, hidden) : projection.semantic;
    }
    return projection.display;
  }

  function incident(id) {
    if (!incidentById) {
      incidentById = new Map();
      for (const edge of model.edges) {
        for (const endpoint of edge.source === edge.target ? [edge.source] : [edge.source, edge.target]) {
          let entries = incidentById.get(endpoint);
          if (!entries) incidentById.set(endpoint, entries = []);
          entries.push(edge);
        }
      }
    }
    return incidentById.get(id) ?? [];
  }

  return { nodesById, edgesById, project, incident };
}

export function groupByParent(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    let siblings = groups.get(node.parent);
    if (!siblings) groups.set(node.parent, siblings = []);
    siblings.push(node);
  }
  return groups;
}
