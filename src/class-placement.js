import {ArchError} from './errors.js';
import {indexGraph} from './graph-index.js';
import {placementPlan,resolvePlacements} from './placement.js';

const compartments = ['attributes','methods','functions','interfaces','ports','parameters'];

// Class geometry is flat except for ports. Compartment members are rows and
// deliberately absent from the placement coordinate system.
export function validateClassPlacement(profile, view, graph) {
  const placeIds = Object.keys(view.places);
  if (!placeIds.length) return null;
  const diagram = view.diagram, members = new Set(compartments.flatMap(key => diagram[key] ?? []));
  for (const id of placeIds) {
    if (members.has(id)) throw new ArchError(`Class detail ${id} is positioned through its owner; place its class card instead`, view.places[id].loc, 'ARCH_VALIDATION');
  }
  const visible = graph.project(view);
  const cards = visible.nodes.filter(n => !members.has(n.id)).map(n => ({ ...n, parent:null }));
  const cardIds = new Set(cards.map(n => n.id)), portIds = new Set(diagram.ports);
  const ownerAttribute = diagram.ownerAttribute ?? 'owner';
  const ports = [];
  for (const node of visible.nodes) {
    if (!portIds.has(node.id)) continue;
    const owner = node.attributes?.[ownerAttribute] ?? node[ownerAttribute];
    if (cardIds.has(owner)) ports.push({ ...node, parent:owner });
  }
  const layoutGraph = indexGraph({ nodes:[...cards, ...ports], edges:visible.edges });
  return placementPlan(layoutGraph, profile, { ...view, include:undefined, exclude:undefined }, true);
}
export function positionClassCards(view,cards,plan) {
  const boxes=[];
  for(const card of cards) {
    const at=view.places[card.n.id]?.at;
    if(at){card.n.x=typeof at.x==='number'?at.x:0;card.n.y=typeof at.y==='number'?at.y:0;}
    boxes.push(card.n);
    card.ownPorts.forEach((p,i)=>boxes.push({...p,x:card.n.x+card.n.width-6,y:card.n.y+64+i*24-6,width:12,height:12}));
  }
  resolvePlacements(view,boxes,[],plan);
  return new Map(boxes.map(n=>[n.id,n]));
}
