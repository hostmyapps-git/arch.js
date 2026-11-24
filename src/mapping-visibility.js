// Generic viewpoint checks for known mappings. A missing model association is
// a review obligation, not evidence of a violated per-element cardinality.
export function mappingVisibility(view,check,node,graph,matches,profile,add) {
 const nodes = graph.nodesById, shown = graph.project(view).ids;
 const links=graph.incident(node.id).filter(e=>matches(e.type??profile.defaultRelation,check.relations,profile.relationTypes)&&
  ((check.direction!=='incoming'&&e.source===node.id||e.direction==='both'&&e.target===node.id)||
   (check.direction!=='outgoing'&&e.target===node.id||e.direction==='both'&&e.source===node.id)));
 const counterpart=e=>e.source===node.id?e.target:e.source;
 const valid=id=>nodes.has(id)&&(!check.counterparts||matches(nodes.get(id).type,check.counterparts,profile.nodeTypes));
 const knownLinks=links.filter(e=>valid(counterpart(e)));
 const refs=[...new Set((check.referenceAttributes??[]).flatMap(a=>[node.attributes?.[a]].flat()).filter(id=>typeof id==='string'&&valid(id)))];
 const extra={elementId:node.id,viewId:view.id,relations:check.relations};
 if(!knownLinks.length&&!refs.length) {
  add(`${view.id}: ${node.id}: Mapping not modeled — review completeness (${check.relations.join(', ')})`,node,{...extra,severity:'warning',code:'ARCH_MAPPING_REVIEW',mappingStatus:'review'});return;
 }
 const hiddenLinks=knownLinks.filter(e=>!shown.has(e.source)||!shown.has(e.target)||view.exclude?.includes(e.id)||view.styles[e.id]?.display==='none');
 const hiddenRefs=refs.filter(id=>!shown.has(id));
 if(hiddenLinks.length||hiddenRefs.length)add(`${view.id}: ${node.id}: Required mapping is hidden (${[...hiddenLinks.map(e=>e.id),...hiddenRefs].join(', ')}); show the relationship and its resource`,node,{...extra,code:'ARCH_MAPPING_HIDDEN',mappingStatus:'hidden',incomplete:true,relationshipIds:hiddenLinks.map(e=>e.id),resourceIds:[...new Set([...hiddenLinks.map(counterpart),...hiddenRefs])]});
}
