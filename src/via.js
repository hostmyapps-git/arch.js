import {ArchError} from './errors.js';
import {coordinateTerms,evaluateCoordinate,boxCoordinate} from './placement.js';
import {visibleNodeIds} from './profiles.js';
import {routingOptions} from './routing-options.js';
import {relationshipReferences} from './relationship-labels.js';

const fail=(message,loc)=>{throw new ArchError(message,loc,'ARCH_ROUTING');};
function references(route) {
  if(route?.via===undefined)return [];
  if(!Array.isArray(route.via))fail('via requires a list of coordinate pairs',route.loc);
  const refs=[];
  for(const point of route.via)for(const axis of ['x','y']) {
    if(!point||typeof point!=='object')fail('via requires coordinate pairs (X, Y)',route.loc);
    refs.push(...coordinateTerms(point[axis],route.loc).filter(t=>t.ref!==undefined));
  }
  return refs;
}

// Only effective, rendered via routes pin graphical reference cards as anchors.
// Hidden/overridden routes retain their source without requiring hidden geometry.
export function viaReferences(model,profile,view) {
  const known=new Set([...model.nodes.map(n=>n.id),...Object.keys(view.trees??{})]);
  for(const route of [view.routeDefaults,...Object.values(view.routes),...(view.referenceRoutes??[])])for(const ref of references(route))
    if(!known.has(ref.ref))fail(`Unknown via reference: ${ref.ref}; use a node or tree group ID`,route.loc);
  const visible=visibleNodeIds(model,view),available=new Set(visible),targets=new Set();
  for(const [id,tree]of Object.entries(view.trees??{}))if(tree.nodes.some(n=>visible.has(n)))available.add(id);
  const collect=route=>{
    if(route?.path!==undefined)return;
    for(const ref of references(route)) {
      if(!available.has(ref.ref))fail(`Hidden or excluded via reference: ${ref.ref}; use a visible node or tree group`,route.loc);
      targets.add(ref.ref);
    }
  };
  const nodes=new Map(model.nodes.map(n=>[n.id,n]));
  const refRoutes=new Map((view.referenceRoutes??[]).map(r=>[JSON.stringify([r.nodeId,r.edgeId]),r]));
  for(const edge of model.edges) {
    if(!visible.has(edge.source)||!visible.has(edge.target)||view.styles[edge.id]?.display==='none')continue;
    collect(routingOptions(view,view.routes[edge.id]));
    const rule=profile.relationTypes[edge.type??profile.defaultRelation];
    if((view.referenceDisplay??rule.referenceDisplay??'labels')==='labels')continue;
    for(const item of relationshipReferences(edge,rule))if(visible.has(item.id)&&!profile.nodeTypes[nodes.get(item.id).type]?.container)
      collect(routingOptions(view,refRoutes.get(JSON.stringify([item.id,edge.id])),true));
  }
  return targets;
}

export function resolveVia(route,boxes) {
  if(!route?.via||route.path!==undefined)return route;
  const reference=term=>{
    const box=boxes.get(term.ref);
    if(!box)fail(`Unavailable via reference: ${term.ref}; use a visible node or tree group`,route.loc);
    return boxCoordinate(box,term.field);
  };
  return {...route,via:route.via.map(point=>({
    x:evaluateCoordinate(point.x,reference,route.loc),y:evaluateCoordinate(point.y,reference,route.loc),
  }))};
}
