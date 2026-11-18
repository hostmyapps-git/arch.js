import {ArchError} from './errors.js';
import {visibleNodeIds} from './profiles.js';

export const POSITION_FIELDS=['x','y','width','height','right','bottom','centerX','centerY'];
const limit=1e7;
const fail=(message,loc)=>{throw new ArchError(message,loc,'ARCH_PLACEMENT');};
const dimension=field=>['x','right','centerX'].includes(field)?'x':['y','bottom','centerY'].includes(field)?'y':null;
const fields=field=>({right:['x','width'],bottom:['y','height'],centerX:['x','width'],centerY:['y','height']}[field]??[field]);
const key=(id,field)=>JSON.stringify([id,field]);

const precedence={'+':1,'-':1,'*':2,'/':2,neg:3,pos:3};
const referencePattern=/^([A-Za-z_][A-Za-z0-9_.-]*)\.(centerX|centerY|width|height|right|bottom|x|y)(?=$|[+\-*/()\s])/;
function coordinateReference(rest,known) {
  // Preserve source spelling during syntax lowering; bind once IDs are known.
  if(!known)return rest.match(referencePattern);
  // Dots and hyphens also belong to IDs. Prefer the longest declared ID;
  // otherwise stop at the first complete ID.FIELD before an operator.
  // This keeps e.g. part.x-offset.y usable without swallowing a.x-b.height.
  let first,declared;
  for(const field of rest.matchAll(/\.(centerX|centerY|width|height|right|bottom|x|y)(?=$|[+\-*/()\s])/g)) {
    const id=rest.slice(0,field.index);
    if(!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id))break;
    const reference=[rest.slice(0,field.index+field[0].length),id,field[1]];
    first??=reference;if(known.has(id))declared=reference;
  }
  return declared??first;
}
function calculate(tokens,reference,loc) {
  const stack=[];
  for(const token of tokens) {
    if(!token.op){stack.push(token.ref===undefined?token.value:reference(token));continue;}
    const right=stack.pop(),left=['neg','pos'].includes(token.op)?undefined:stack.pop();
    if(token.op==='/'&&right===0)fail('Division by zero in placement coordinate',loc);
    const result=token.op==='neg'?(right===undefined?undefined:-right):token.op==='pos'?right:
      left===undefined||right===undefined?undefined:token.op==='+'?left+right:token.op==='-'?left-right:token.op==='*'?left*right:left/right;
    if(result!==undefined&&!Number.isFinite(result))fail('Placement calculation must remain finite',loc);
    stack.push(result);
  }
  return stack[0];
}

// A bounded arithmetic grammar, never JavaScript. RPN keeps evaluation iterative.
export function coordinateTerms(value,loc,known) {
  if(typeof value==='number') {
    if(!Number.isFinite(value)||Math.abs(value)>limit)fail('Coordinate outside the range ±10000000',loc);
    return [{value}];
  }
  if(typeof value!=='string'||!value.trim()||value.length>2048)fail('Expected a placement coordinate: number or ID.x/ID.y with +, -, * or /',loc);
  let rest=value.trim(),operand=true,count=0,depth=0;const terms=[],operators=[],source=[];
  while(rest) {
    const char=rest[0];
    if(operand&&char==='(') {
      if(++depth>16)fail('At most 16 nested parentheses are allowed in a placement coordinate',loc);
      operators.push('(');source.push('(');rest=rest.slice(1).trimStart();continue;
    }
    if(!operand&&char===')') {
      if(!depth--)fail('Unmatched closing parenthesis in placement coordinate',loc);
      while(operators.at(-1)!=='(')terms.push({op:operators.pop()});operators.pop();
      source.push(')');rest=rest.slice(1).trimStart();continue;
    }
    if('+-*/'.includes(char)) {
      if(operand&&!'+-'.includes(char))fail('Expected a placement coordinate operand after the operator',loc);
      const op=operand?(char==='-'?'neg':'pos'):char;
      while(operators.length&&operators.at(-1)!=='('&&(precedence[operators.at(-1)]>precedence[op]||!operand&&precedence[operators.at(-1)]===precedence[op]))terms.push({op:operators.pop()});
      operators.push(op);source.push(char);rest=rest.slice(1).trimStart();operand=true;continue;
    }
    if(!operand)fail('Placement expressions require +, -, * or / between terms',loc);
    const number=rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    const reference=coordinateReference(rest,known);
    if(number) {
      const value=Number(number[0]);if(!Number.isFinite(value)||value>limit)fail('Coordinate outside the range ±10000000',loc);
      terms.push({value});source.push(String(value));rest=rest.slice(number[0].length).trimStart();
    } else if(reference) {
      terms.push({ref:reference[1],field:reference[2]});source.push(reference[0]);rest=rest.slice(reference[0].length).trimStart();
    } else fail(`Invalid placement coordinate; use a number or ID.FIELD (${POSITION_FIELDS.join(', ')}) with +, -, * or /`,loc);
    if(++count>32)fail('At most 32 terms are allowed in a placement coordinate',loc);
    operand=false;
  }
  if(operand)fail('Expected a placement coordinate operand after the operator',loc);
  if(depth)fail('Unclosed parenthesis in placement coordinate',loc);
  while(operators.length)terms.push({op:operators.pop()});
  terms.source=source.join(' ').replace(/\(\s+/g,'(').replace(/\s+\)/g,')');
  calculate(terms,()=>undefined,loc); // Reject even a symbolic numerator divided by a constant zero.
  return terms;
}

export function placementCoordinate(value,loc) {
  const terms=coordinateTerms(value,loc);
  if(terms.every(t=>t.ref===undefined)) {
    const result=calculate(terms,()=>undefined,loc);coordinateTerms(result,loc);return result;
  }
  return terms.source;
}

export function evaluateCoordinate(value,reference,loc,known) {
  const result=calculate(coordinateTerms(value,loc,known),reference,loc);
  coordinateTerms(result,loc);return result;
}

export function boxCoordinate(box,field) {
  return field==='right'?box.x+box.width:field==='bottom'?box.y+box.height:
    field==='centerX'?box.x+box.width/2:field==='centerY'?box.y+box.height/2:box[field];
}

// Track translation coefficients when arithmetic is affine in the parent origin.
// Nonlinear coordinate products/divisors conservatively depend on that origin.
function originCoefficients(tokens) {
  const stack=[];
  for(const t of tokens) {
    if(!t.op){const axis=dimension(t.field);stack.push({constant:t.ref===undefined?t.value:undefined,x:axis==='x'?-1:0,y:axis==='y'?-1:0});continue;}
    const b=stack.pop(),unary=['neg','pos'].includes(t.op),a=unary?undefined:stack.pop(),c={};
    if(unary) {for(const k of ['constant','x','y'])c[k]=b[k]===undefined?undefined:b[k]===null?null:b[k]*(t.op==='neg'?-1:1);}
    else {
      c.constant=a.constant===undefined||b.constant===undefined?undefined:calculate([{value:a.constant},{value:b.constant},{op:t.op}],()=>undefined);
      for(const axis of ['x','y']) {
        if(t.op==='+'||t.op==='-')c[axis]=a[axis]===null||b[axis]===null?null:a[axis]+b[axis]*(t.op==='-'?-1:1);
        else if(t.op==='*')c[axis]=a.constant!==undefined?(b[axis]===null?null:a.constant*b[axis]):b.constant!==undefined?(a[axis]===null?null:b.constant*a[axis]):a[axis]===0&&b[axis]===0?0:null;
        else c[axis]=b.constant!==undefined?(a[axis]===null?null:a[axis]/b.constant):a[axis]===0&&b[axis]===0?0:null;
      }
    }
    for(const axis of ['x','y'])if(!Number.isFinite(c[axis]))c[axis]=null;
    stack.push(c);
  }
  return stack[0];
}

// Freeze automatic layout once, then resolve symbolic placements in dependency order.
// Dependencies include parent translations, group membership, context alignment and
// package dimensions, so indirect cycles cannot escape through an automatic box.
export function placementPlan(model,profile,view) {
  const expressions=new Map(),known=new Set([...model.nodes.map(n=>n.id),...Object.keys(view.trees??{})]);
  for(const [id,place]of Object.entries(view.places))for(const axis of ['x','y']) {
    const terms=coordinateTerms(place.at?.[axis],place.loc,known);
    if(typeof place.at[axis]==='string')expressions.set(key(id,axis),terms);
  }
  if(!expressions.size)return null;
  const visible=visibleNodeIds(model,view),items=new Map(model.nodes.filter(n=>visible.has(n.id)).map(n=>[n.id,{id:n.id,parent:n.parent,container:profile.nodeTypes[n.type]?.container}]));
  const owners=new Map(),groups=new Map();
  for(const [id,options]of Object.entries(view.trees??{})) {
    const members=options.nodes.filter(id=>items.has(id));if(!members.length)continue;
    const group={id,parent:items.get(members[0]).parent,group:true,options};items.set(id,group);groups.set(id,group);
    for(const member of members){owners.set(member,id);items.get(member).parent=id;}
  }
  const anchors=new Map(),edges=model.edges.filter(e=>visible.has(e.source)&&visible.has(e.target)&&view.styles[e.id]?.display!=='none');
  for(const item of items.values())if(!item.group&&!item.container&&!item.parent&&!view.places[item.id]) {
    const link=edges.find(e=>e.source===item.id&&owners.has(e.target)||e.target===item.id&&owners.has(e.source));
    if(!link)continue;
    const member=link.source===item.id?link.target:link.source,group=groups.get(owners.get(member));if(group.parent)continue;
    const vertical=['up','down'].includes(group.options.direction??group.options.orientation??'down');
    anchors.set(key(item.id,'x'),{id:vertical?group.id:member,field:'x'});
    anchors.set(key(item.id,'y'),{id:vertical?member:group.id,field:'y'});
  }
  const children=new Map();
  for(const item of items.values())if(item.parent){if(!children.has(item.parent))children.set(item.parent,[]);children.get(item.parent).push(item.id);}
  const dependencies=new Map();
  for(const item of items.values())for(const field of ['x','y','width','height']) {
    const cell=key(item.id,field),deps=new Set(),terms=expressions.get(cell);
    const dep=(id,field)=>deps.add(key(id,field));
    if(field==='x'||field==='y') {
      if(terms) {
        const coefficients=originCoefficients(terms),nonlinear=coefficients.x===null||coefficients.y===null;
        const origin={x:field==='x'?1:0,y:field==='y'?1:0};
        for(const term of terms)if(term.ref!==undefined) {
          if(!items.has(term.ref))fail(`Unknown or hidden placement reference: ${term.ref}; use a visible node or tree group`,view.places[item.id]?.loc??view.loc);
          for(const property of fields(term.field))dep(term.ref,property);
          const axis=dimension(term.field);if(nonlinear&&axis)origin[axis]=1;
        }
        if(!nonlinear)for(const axis of ['x','y'])origin[axis]+=coefficients[axis];
        if(item.parent)for(const axis of ['x','y'])if(origin[axis])dep(item.parent,axis);
      } else if(anchors.has(cell)) {const a=anchors.get(cell);dep(a.id,a.field);}
      else if(item.parent)dep(item.parent,field);
    } else if(item.container) {
      const axis=field==='width'?'x':'y';dep(item.id,axis);
      for(const child of children.get(item.id)??[]){dep(child,axis);dep(child,field);}
    }
    dependencies.set(cell,deps);
  }
  const users=new Map(),pending=new Map(),queue=[];
  for(const [cell,deps]of dependencies) {
    pending.set(cell,deps.size);if(!deps.size)queue.push(cell);
    for(const dep of deps){if(!users.has(dep))users.set(dep,[]);users.get(dep).push(cell);}
  }
  for(let i=0;i<queue.length;i++)for(const user of users.get(queue[i])??[]) {
    pending.set(user,pending.get(user)-1);if(pending.get(user)===0)queue.push(user);
  }
  if(queue.length!==dependencies.size) {
    let cell=[...pending].find(([,count])=>count>0)[0];const path=[],seen=new Map();
    while(!seen.has(cell)){seen.set(cell,path.length);path.push(cell);cell=[...dependencies.get(cell)].find(d=>pending.get(d)>0);}
    const cycle=[...path.slice(seen.get(cell)),cell].map(c=>JSON.parse(c).join('.'));
    const id=JSON.parse(cell)[0];fail(`Circular placement dependency: ${cycle.join(' -> ')}. Anchor one coordinate with a number or an independent element.`,view.places[id]?.loc??view.loc);
  }
  return {items,owners,anchors,children,expressions,order:queue};
}

export function resolvePlacements(model,profile,view,nodes,groupStates,plan=placementPlan(model,profile,view)) {
  if(!plan)return;
  const boxes=new Map([...nodes,...groupStates.map(s=>s.proxy)].map(n=>[n.id,n]));
  const initial=new Map([...boxes].map(([id,n])=>[id,{x:n.x,y:n.y,width:n.width,height:n.height}])),values=new Map();
  const value=(id,field)=>values.get(key(id,field));
  const origin=(item,axis,current=true)=>{
    if(!item.parent)return 0;
    return (current?value(item.parent,axis):initial.get(item.parent)[axis])+(boxes.get(item.parent).contentOffset?.[axis]??0);
  };
  for(const cell of plan.order) {
    const [id,field]=JSON.parse(cell),item=plan.items.get(id),before=initial.get(id),terms=plan.expressions.get(cell);
    let result=before[field];
    if(field==='x'||field==='y') {
      if(terms) {
        const coefficients=originCoefficients(terms),nonlinear=coefficients.x===null||coefficients.y===null;
        result=calculate(terms,t=>{
            const f=t.field;
            let term=f==='right'?value(t.ref,'x')+value(t.ref,'width'):f==='bottom'?value(t.ref,'y')+value(t.ref,'height'):
              f==='centerX'?value(t.ref,'x')+value(t.ref,'width')/2:f==='centerY'?value(t.ref,'y')+value(t.ref,'height')/2:value(t.ref,f);
            const axis=dimension(f);if(nonlinear&&axis)term-=origin(item,axis);
            return term;
        },view.places[id].loc);
        if(nonlinear)result+=origin(item,field);
        else for(const axis of ['x','y']) {
          const coefficient=coefficients[axis]+(field===axis?1:0);if(coefficient)result+=coefficient*origin(item,axis);
        }
        if(!Number.isFinite(result)||Math.abs(result)>limit)fail(`Resolved placement ${id}.${field} is outside the range ±10000000`,view.places[id].loc);
      } else if(plan.anchors.has(cell)) {
        const a=plan.anchors.get(cell);result=before[field]+value(a.id,a.field)-initial.get(a.id)[a.field];
      } else result=before[field]+origin(item,field)-origin(item,field,false);
    } else if(item.container) {
      const axis=field==='width'?'x':'y';
      for(const child of plan.children.get(id)??[])result=Math.max(result,value(child,axis)-value(id,axis)+value(child,field)+28);
    }
    values.set(cell,result);
  }
  for(const [id,item]of plan.items) {
    const box=boxes.get(id),old=initial.get(id);
    for(const field of ['x','y','width','height'])box[field]=value(id,field);
    if(item.container&&box.width!==old.width) {
      const delta=box.width-old.width;box.packageBadgeX+=delta;
      if(box.iconPosition==='right')box.iconBox.x+=delta;
      else if(['top','bottom'].includes(box.iconPosition))box.iconBox.x+=delta/2;
    }
    if(item.parent&&plan.items.get(item.parent).container) {
      const parent=boxes.get(item.parent);
      if(box.x<parent.x+28-1e-6||box.y<parent.y+parent.headerHeight+16-1e-6)
        fail(`Resolved placement ${id} falls outside parent ${item.parent} content. Move the parent or choose coordinates inside its content area.`,view.places[id]?.loc??view.loc);
    }
  }
}
