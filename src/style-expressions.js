import {ArchError} from './errors.js';
import {coordinateTerms,evaluateCoordinate,evaluateTerms} from './placement.js';
import { findCard } from './view-occurrences.js';

export const STYLE_NUMBERS=['width','height','fontSize'];
const referenceFields=[...STYLE_NUMBERS,...STYLE_NUMBERS.map(f=>`style.${f}`)];
const bounds={width:[160,1e7],height:[96,1e7],fontSize:[6,64]};
const key=(id,field)=>JSON.stringify([id,field]);
const fail=(message,loc)=>{throw new ArchError(message,loc,'ARCH_STYLE');};
function terms(value,loc,known) {
  try{return coordinateTerms(value,loc,known,referenceFields);}
  catch(error){if(error instanceof ArchError)fail(`Style expression: ${error.message}`,loc);throw error;}
}
export function styleReferences(style, known) {
  return STYLE_NUMBERS.flatMap(field => typeof style[field] === 'string' ? terms(style[field], style.loc, known).filter(term => term.ref !== undefined) : []);
}
export function styleNumber(value,loc) {
  const parsed=terms(value,loc);
  if(parsed.every(t=>t.ref===undefined))return evaluateCoordinate(value,()=>undefined,loc,undefined,referenceFields);
  return parsed.source;
}
export function checkStyleNumber(value,field,loc) {
  if(typeof value==='string'){const parsed=styleNumber(value,loc);if(typeof parsed==='number')checkStyleNumber(parsed,field,loc);return;}
  const [min,max]=bounds[field];
  if(!Number.isFinite(value)||value<min||value>max)fail(`${field} must resolve to a number between ${min} and ${max}`,loc);
}

// Style dimensions depend on explicit style cells or pre-layout card metrics.
// Positions, package contents and tree-group boxes intentionally do not enter
// this graph: they are determined after intrinsic card measurement.
export function styleExpressionPlan(graph,profile,view,presentation) {
  const all = graph.nodesById;
  let known, visible;
  const expressions=new Map();
  for(const [id,style]of Object.entries(view.styles))if(all.has(id))for(const field of STYLE_NUMBERS)if(style[field]!==undefined) {
    if(typeof style[field]!=='string')continue;
    known ??= new Set([...all.keys(), ...(presentation?.byName.keys() ?? [])]);
    visible ??= graph.project(view);
    const parsed = terms(style[field], style.loc, known);
    for(const token of parsed)if(token.ref!==undefined) {
      const card = findCard(presentation, token.ref, style.loc, 'ARCH_STYLE');
      const modelId = card?.node.id ?? token.ref;
      if(!visible.ids.has(modelId))fail(`Unknown or hidden style reference: ${token.ref}; use a visible node`,style.loc);
      if(token.field.startsWith('style.')&&(card?.owner ? card.style : view.styles[modelId])?.[token.field.slice(6)]===undefined)
        fail(`Missing explicit style value: ${token.ref}.${token.field}; set it or use ${token.ref}.${token.field.slice(6)} for the effective card value`,style.loc);
      if(['width','height'].includes(token.field)&&profile.nodeTypes[all.get(modelId).type]?.container)
        fail(`Style expressions cannot reference final package size ${token.ref}.${token.field}; use ${token.ref}.style.${token.field} instead`,style.loc);
      if (card) token.ref = card.id;
    }
    expressions.set(key(id,`style.${field}`),parsed);
  }
  if(!expressions.size)return null;
  const nodes = new Map((presentation?.nodes ?? visible.nodes).map(n => [n.id, n]));
  const dependencies=new Map();
  for(const [id,node]of nodes) {
    for(const field of STYLE_NUMBERS) {
      const cell=key(id,`style.${field}`),parsed=expressions.get(cell);
      dependencies.set(cell,new Set((parsed??[]).filter(t=>t.ref!==undefined).map(t=>key(t.ref,t.field))));
    }
    dependencies.set(key(id,'fontSize'),new Set([key(id,'style.fontSize')]));
    if(!profile.nodeTypes[node.type]?.container) {
      dependencies.set(key(id,'width'),new Set([key(id,'style.width')]));
      dependencies.set(key(id,'height'),new Set(STYLE_NUMBERS.map(f=>key(id,`style.${f}`))));
    }
  }
  const users=new Map(),pending=new Map(),order=[];
  for(const [cell,deps]of dependencies) {
    pending.set(cell,deps.size);if(!deps.size)order.push(cell);
    for(const dep of deps){if(!users.has(dep))users.set(dep,[]);users.get(dep).push(cell);}
  }
  for(let i=0;i<order.length;i++)for(const user of users.get(order[i])??[]) {
    pending.set(user,pending.get(user)-1);if(!pending.get(user))order.push(user);
  }
  if(order.length!==dependencies.size) {
    let cell=[...pending].find(([,n])=>n>0)[0];const chain=[],seen=new Map();
    while(!seen.has(cell)){seen.set(cell,chain.length);chain.push(cell);cell=[...dependencies.get(cell)].find(dep=>pending.get(dep)>0);}
    const cycle=[...chain.slice(seen.get(cell)),cell].map(k=>JSON.parse(k).join('.'));
    fail(`Circular style dependency: ${cycle.join(' -> ')}`,view.styles[JSON.parse(cell)[0]]?.loc??view.loc);
  }
  return {nodes,expressions,order};
}

export function resolveStyleExpressions(plan,view,measure,metrics=new Map(), explicitStyles) {
  if(!plan)return null;
  const values=new Map(),styles=Object.fromEntries(Object.entries(view.styles).map(([id,s])=>[id,{...s}])),measured=new Map();
  for(const cell of plan.order) {
    const [id,field]=JSON.parse(cell),style=styles[id]??={},loc=style.loc??view.loc;let value;
    const embedded = metrics.get(id);
    if(field.startsWith('style.')) {
      const name=field.slice(6);value=embedded ? explicitStyles?.get(embedded)?.[name] : style[name];
      if(plan.expressions.has(cell)) {
        try{value=evaluateTerms(plan.expressions.get(cell),t=>values.get(key(t.ref,t.field)),loc);}
        catch(error){if(error instanceof ArchError)fail(`Style expression ${id}.${field}: ${error.message}`,loc);throw error;}
        checkStyleNumber(value,name,loc);style[name]=value;styles[id]=style;
      }
    } else if(field==='fontSize')value=embedded?.textStyle?.title??style.fontSize??15;
    else if(field==='width')value=embedded?.width??style.width??view.places[id]?.size?.x??220;
    else {
      const card=measure(plan.nodes.get(id),style);measured.set(id,card);value=card.height;
    }
    values.set(cell,value);
  }
  return {styles,measured};
}
