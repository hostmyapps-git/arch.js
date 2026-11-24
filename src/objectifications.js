import { matches, matchesPair } from './profiles.js';

// Generic profile-defined object/relationship identity, including a legacy
// endpoint-reference form. References do not synthesize semantic model edges.
export function objectificationDiagnostics(model,profile,view,checks,graph,selection,cache,add) {
  const {nodesById:byId}=graph, {ids:selectedIds,edges:selectedEdges}=selection;
  for(const check of checks) {
    // The rule's model bindings are shared by every view using this check.
    // Visible edges and payload evidence are still checked per view below.
    let bindings=cache.get(check);
    if (!bindings) {
      bindings=new Map();
      for (const node of model.nodes)
        if (matches(node.type,check.nodes,profile.nodeTypes)) bindings.set(node,[]);
      const byObjectId = new Map([...bindings].map(([node,edges])=>[node.id,edges]));
      for (const edge of model.edges) {
        const edges=byObjectId.get(edge.attributes?.[check.attribute]);
        if (edges && matches(edge.type??profile.defaultRelation,check.relations,profile.relationTypes)) edges.push(edge);
      }
      cache.set(check,bindings);
    }
    const localEdges=selectedEdges.filter(e=>matches(e.type??profile.defaultRelation,check.relations,profile.relationTypes));
    const localIds=new Set(localEdges.map(e=>e.id));
    if (check.payload) {
      const {attribute,relations} = check.payload;
      const conveyingObjects = new Set(selectedEdges
        .filter(edge => matches(edge.type??profile.defaultRelation,relations,profile.relationTypes))
        .map(edge => edge.source));
      // A compact typed reference or a selected conveyance link from the
      // bound object supplies the same required payload evidence.
      for (const edge of localEdges) {
        const payload = [edge.attributes?.[attribute]].flat();
        if (!payload.some(id => selectedIds.has(id)) && !conveyingObjects.has(edge.attributes?.[check.attribute])) {
          add(`${view.id}: ${edge.id}: Requires a visible payload through ${attribute} or ${relations.join(', ')} from its bound object`,
            edge,{elementId:edge.id,viewId:view.id,attribute,incomplete:true});
        }
      }
    }
    let legacyCount=0;
    for(const [node,bound] of bindings) {
      const selected=selectedIds.has(node.id), locallyBound=bound.some(e=>localIds.has(e.id));
      if(!selected&&!locallyBound)continue;
      const extra={elementId:node.id,viewId:view.id};
      const source=check.endpoints?node.attributes?.[check.endpoints.source]:undefined;
      const target=check.endpoints?node.attributes?.[check.endpoints.target]:undefined;
      const complete=typeof source==='string'&&typeof target==='string';
      const from=byId.get(source),to=byId.get(target);
      const compatible=complete&&from&&to&&check.relations.some(type=>{
        const rule=profile.relationTypes[type];
        return !rule.abstract&&(rule.allowSelf||source!==target)&&matches(from.type,rule.from,profile.nodeTypes)&&matches(to.type,rule.to,profile.nodeTypes)&&(!rule.pairs||rule.pairs.some(pair=>matchesPair(from.type,to.type,pair,profile.nodeTypes)));
      });
      if(check.endpoints&&(source!==undefined||target!==undefined)&&!complete)
        add(`${view.id}: ${node.id}: Provide both ${check.endpoints.source} and ${check.endpoints.target}, or bind the object through ${check.attribute}`,node,{...extra,incomplete:true});
      if(complete&&from&&to&&!compatible)add(`${view.id}: ${node.id}: Endpoint references are not allowed for ${check.relations.join(', ')}`,node,extra);
      if(bound.length>1)add(`${view.id}: ${node.id}: Object must bind exactly one ${check.relations.join(', ')} relationship; found ${bound.length}`,node,extra);
      for(const edge of bound)if(complete&&(source!==edge.source||target!==edge.target))
        add(`${view.id}: ${node.id}: Endpoint references disagree with relationship ${edge.id} (${edge.source} -> ${edge.target})`,node,extra);
      if(selected&&!locallyBound) {
        if(check.allowLegacy&&compatible&&selectedIds.has(source)&&selectedIds.has(target))legacyCount++;
        else add(`${view.id}: ${node.id}: Requires a selected ${check.relations.join(', ')} relationship bound through ${check.attribute}${check.allowLegacy?' or visible legacy endpoint references':''}`,node,{...extra,incomplete:true});
      }
    }
    if(check.required&&!localEdges.length&&!legacyCount)
      add(`${view.id}: Requires a ${check.relations.join(', ')} relationship${check.allowLegacy?' or a legacy object with visible endpoints':''}`,view,{viewId:view.id,incomplete:true});
  }
}
