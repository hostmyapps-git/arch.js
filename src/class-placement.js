import {ArchError} from './errors.js';
import {visibleNodeIds} from './profiles.js';
import {placementPlan,resolvePlacements} from './placement.js';

const compartments=['attributes','methods','functions','interfaces','ports','parameters'];
export function classPlacementContext(model,profile,view) {
  const c=view.diagram,visible=visibleNodeIds(model,view),members=new Set(compartments.flatMap(k=>c[k]??[]));
  for(const id of Object.keys(view.places))if(members.has(id))throw new ArchError(`Class detail ${id} is positioned through its owner; place its class card instead`,view.places[id].loc,'ARCH_VALIDATION');
  const cards=model.nodes.filter(n=>visible.has(n.id)&&!members.has(n.id)).map(n=>({...n,parent:null})),cardIds=new Set(cards.map(n=>n.id));
  const ports=model.nodes.filter(n=>visible.has(n.id)&&(c.ports??[]).includes(n.id)).flatMap(n=>{
    const owner=n.attributes?.[c.ownerAttribute??'owner']??n[c.ownerAttribute??'owner'];return cardIds.has(owner)?[{...n,parent:owner}]:[];
  });
  return {model:{...model,nodes:[...cards,...ports]},profile:{...profile,nodeTypes:Object.fromEntries(Object.entries(profile.nodeTypes).map(([id,r])=>[id,{...r,container:false}]))},view:{...view,include:undefined,exclude:undefined}};
}
export function validateClassPlacement(model,profile,view) {
  const context=classPlacementContext(model,profile,view);return placementPlan(context.model,context.profile,context.view);
}
export function positionClassCards(model,profile,view,cards) {
  const context=classPlacementContext(model,profile,view),boxes=[];
  for(const card of cards) {
    const at=view.places[card.n.id]?.at;
    if(at){card.n.x=typeof at.x==='number'?at.x:0;card.n.y=typeof at.y==='number'?at.y:0;}
    boxes.push(card.n);
    card.ownPorts.forEach((p,i)=>boxes.push({...p,x:card.n.x+card.n.width-6,y:card.n.y+64+i*24-6,width:12,height:12}));
  }
  resolvePlacements(context.model,context.profile,context.view,boxes,[]);
  return new Map(boxes.map(n=>[n.id,n]));
}
