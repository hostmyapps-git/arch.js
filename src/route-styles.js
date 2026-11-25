import {ArchError} from './errors.js';
import {normalizeColor} from './colors.js';

function color(value) {
  const hex=normalizeColor(value)?.toLowerCase();
  return hex?.length===4?'#'+[...hex.slice(1)].map(c=>c+c).join(''):hex;
}

// Restrict SVG presentation data to plain finite lengths: no CSS, units or URLs.
export function dashArray(value) {
  if(value===undefined)return undefined;
  if(value==='none')return [];
  if(typeof value==='string') {
    const number='(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
    if(value.length>1024||!new RegExp(`^${number}(?:(?:\\s*,\\s*|\\s+)${number})*$`).test(value.trim()))return null;
    value=value.trim().split(/[\s,]+/).map(Number);
  }
  if(!Array.isArray(value)||value.length>32||value.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>10000)||value.length&&!value.some(n=>n>0))return null;
  // SVG repeats odd-length patterns. Canonical values also make sharing exact.
  return value.length%2?[...value,...value]:[...value];
}

export function validateRouteStyle(route) {
  const fail=message=>{throw new ArchError(message,route.loc,'ARCH_VALIDATION');};
  if(route.color!==undefined&&!color(route.color))fail('color requires a hex color or CSS3 color name');
  if(route.width!==undefined&&(typeof route.width!=='number'||!Number.isFinite(route.width)||route.width<0.1||route.width>64))fail('Route width must be a number between 0.1 and 64');
  if(route.dasharray!==undefined&&dashArray(route.dasharray)===null)fail('dasharray must be none, an empty list, or 1–32 lengths from 0 to 10000 with at least one positive value');
}

export function routeStyle(route={}) {
  const result={};
  if(route?.color!==undefined)result.color=color(route.color);
  if(route?.width!==undefined)result.width=route.width;
  if(route?.dasharray!==undefined)result.dasharray=dashArray(route.dasharray);
  return result;
}

export const effectiveDasharray=(edge,reference=false)=>edge.dasharray??(!reference&&['dependency','realization','transfer','archimate-access'].includes(edge.style)?[6,5]:[]);
export const markerOptions=edge=>edge.style==='archimate-access'?{accessType:edge.attributes?.accessType}:
  edge.style==='association'&&edge.attributes?.directed===true?{directed:true}:undefined;
export const routeStyleKey=edge=>[edge.color??null,edge.width??1.5,effectiveDasharray(edge),markerOptions(edge)];
