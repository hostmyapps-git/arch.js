import {ArchError} from './errors.js';

const publicFields=['id','type','title','description','technology','stereotype','tags'];
export function validatePropertyFields(fields,nodes,profile,loc) {
  if(fields===undefined)return;
  const allowed=new Set([...publicFields,...nodes.flatMap(n=>Object.keys(profile.nodeTypes[n.type]?.attributes??{}))]);
  if(!Array.isArray(fields)||fields.length>128||fields.some(f=>typeof f!=='string'||!allowed.has(f))||new Set(fields).size!==fields.length)
    throw new ArchError('propertyFields requires unique declared attribute or public property names',loc,'ARCH_VALIDATION');
}
export function nodeProperties(node,view) {
  const fields=view.styles[node.id]?.propertyFields??view.propertyFields??view.diagram?.propertyFields??[];
  return fields.flatMap(key=>{
    const value=node.attributes?.[key]??node[key];if(value===undefined)return [];
    return [{key,full:`${key}: ${Array.isArray(value)?'['+value.join(', ')+']':String(value)}`}];
  });
}
export function positionProperties(node,start,scale=1) {
  let y=start;
  for(const row of node.propertyRows??[]){row.y=y;y+=row.lines.length*17*scale+6*scale;}
  return node.propertyRows?.length?y-23*scale:start;
}
