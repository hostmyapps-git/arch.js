import { DOMParser } from '@xmldom/xmldom';
import svgpath from 'svgpath';
import { normalizeColor } from './colors.js';

const own = (o,k) => Object.hasOwn(o,k);
const record = o => o && typeof o === 'object' && !Array.isArray(o);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tags = new Set(['svg','g','defs','use','path','rect','circle','ellipse','line','polyline','polygon',
  'linearGradient','radialGradient','stop','clipPath','mask','pattern','title','desc',
  'filter','feFlood','feBlend','feGaussianBlur','feOffset','feColorMatrix','feMerge','feMergeNode','feMorphology','feComposite']);
const numeric = new Set(['x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','fx','fy','fr','width','height',
  'stroke-width','stroke-miterlimit','opacity','fill-opacity','stroke-opacity','stop-opacity','flood-opacity','offset','dx','dy','k1','k2','k3','k4']);
const lengths = new Set(['x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','fx','fy','fr','width','height','stroke-width','dx','dy']);
const vectors = new Set(['points','viewBox','stdDeviation','radius','values']);
const enums = {
  'stroke-linecap':['butt','round','square'], 'stroke-linejoin':['miter','round','bevel'],
  'fill-rule':['nonzero','evenodd'], 'clip-rule':['nonzero','evenodd'],
  gradientUnits:['userSpaceOnUse','objectBoundingBox'],maskUnits:['userSpaceOnUse','objectBoundingBox'],
  maskContentUnits:['userSpaceOnUse','objectBoundingBox'],clipPathUnits:['userSpaceOnUse','objectBoundingBox'],
  filterUnits:['userSpaceOnUse','objectBoundingBox'],primitiveUnits:['userSpaceOnUse','objectBoundingBox'],
  patternUnits:['userSpaceOnUse','objectBoundingBox'],patternContentUnits:['userSpaceOnUse','objectBoundingBox'],
  spreadMethod:['pad','reflect','repeat'], 'mask-type':['alpha','luminance'],
  'color-interpolation-filters':['sRGB','linearRGB','auto'], 'color-interpolation':['sRGB','linearRGB','auto'],
  type:['matrix','saturate','hueRotate','luminanceToAlpha'],operator:['over','in','out','atop','xor','arithmetic','erode','dilate'],
  mode:['normal','multiply','screen','darken','lighten','overlay'],display:['none','inline'],visibility:['visible','hidden','collapse']
};
const paints = new Set(['fill','stroke','color','stop-color','flood-color']);
const reference = new Set(['href','xlink:href','clip-path','mask','filter']);
const transforms = new Set(['transform','gradientTransform','patternTransform']);
const number = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
function numbers(value) {
  const parts=value.trim().split(/[\s,]+/);
  if(!parts.length||parts.length>20000||parts.some(p=>!number.test(p)||!Number.isFinite(Number(p))||Math.abs(Number(p))>1e15)) throw Error('Invalid SVG numbers');
  return parts;
}
function transform(value) {
  const pattern=/\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)\s*,?/g;
  let end=0,count=0;
  for(const m of value.matchAll(pattern)) {
    if(m.index!==end) throw Error('Invalid SVG transform');
    const n=numbers(m[2]).length, allowed={matrix:[6],translate:[1,2],scale:[1,2],rotate:[1,3],skewX:[1],skewY:[1]};
    if(!allowed[m[1]].includes(n)||++count>64) throw Error('Invalid SVG transform arity');end=m.index+m[0].length;
  }
  if(!count||end!==value.length) throw Error('Invalid SVG transform');return value;
}
export function iconPaint(value) {
  if(typeof value!=='string') return undefined;
  if(/^(none|inherit|transparent)$/i.test(value)) return value.toLowerCase();
  if(/^currentcolor$/i.test(value)) return 'currentColor';
  const hex=normalizeColor(value);if(hex) return hex;
  if(/^#(?:[a-f\d]{4}|[a-f\d]{8})$/i.test(value)) return value;
  const fn=value.match(/^(rgba?|hsla?)\(([-+\d.eE%,\s/]+)\)$/i);
  if(fn) {
    const values=fn[2].trim().split(/[\s,/]+/);
    if([3,4].includes(values.length)&&values.every(v=>number.test(v.replace(/%$/,''))&&Number.isFinite(Number(v.replace(/%$/,''))))) return value;
  }
  return undefined;
}
const freeze = o => {if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
function parseBody(body) {
  if(typeof body!=='string'||!body.length||body.length>1e6)throw Error('Invalid Iconify SVG body');
  // Editor exports can contain a harmless XML header and the standard SVG 1.1
  // public doctype. Remove these before parsing; never load or expand a DTD.
  body=body.replace(/^\s*<\?xml\s+[^?]*\?>/i,'').replace(/^\s*<!DOCTYPE\s+svg\s+PUBLIC\s+(["'])-\/\/W3C\/\/DTD SVG 1\.1\/\/EN\1\s+(["'])https?:\/\/www\.w3\.org\/Graphics\/SVG\/1\.1\/DTD\/svg11\.dtd\2\s*>/i,'');
  if(/<!DOCTYPE|<!ENTITY|<\?/i.test(body)) throw Error('Invalid Iconify SVG body');
  const doc=new DOMParser({onError:(level,message)=>{throw Error(`Invalid SVG XML: ${message}`);}})
    .parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${body}</svg>`,'image/svg+xml');
  const ids=new Map(),links=new Map();let count=0;
  const read=(element,depth=0)=>{
    if(depth>64||++count>4096) throw Error('SVG exceeds complexity limit');
    const tag=element.tagName;if(!tags.has(tag)) throw Error(`Unsupported SVG element: ${tag}`);
    const node={tag,attrs:Object.create(null),children:[]},refs=[];links.set(node,refs);
    const apply=(key,value,override=false)=>{
      if(key==='xlink:href')key='href';
      if(override){delete node.attrs[key];for(let i=refs.length-1;i>=0;i--)if(refs[i].key===key)refs.splice(i,1);}
      // CSS closes a local url() at EOF; normalize this harmless source form.
      if(/^url\(#[^\s\"'()<>]+$/.test(value))value+=')';
      const local=value.match(/^url\(\s*([\"'])(#[^\s\"'()<>]+)\1\s*\)$/);if(local)value=`url(${local[2]})`;
      if(key==='xmlns'||key==='xmlns:xlink') {
        if(value!==(key==='xmlns'?'http://www.w3.org/2000/svg':'http://www.w3.org/1999/xlink')) throw Error('Invalid SVG namespace');return;
      }
      if(key.startsWith('xmlns:'))return; // Inert editor namespace metadata; prefixed elements remain disallowed.
      if(key==='xml:space'&&['default','preserve'].includes(value))return;
      if(tag==='svg'&&key==='version'&&['1.0','1.1','2.0'].includes(value))return;
      if(key==='class') return; // External stylesheets are intentionally not imported.
      if(key==='id') {if(!value||/[\s"'()<>]/.test(value)||ids.has(value)) throw Error('Invalid/duplicate SVG ID');ids.set(value,node);}
      else if(key==='d') {const path=svgpath(value);if(path.err)throw Error(path.err);value=path.round(6).toString();}
      else if(numeric.has(key)) {const v=value.trim().replace(lengths.has(key)?/(?:px|%)$/:/%$/,'');numbers(v);if(numbers(v).length!==1)throw Error(`Invalid ${key}`);}
      else if(vectors.has(key)) {const n=numbers(value);if(key==='viewBox'&&n.length!==4)throw Error('Invalid viewBox');if(key==='points'&&(n.length<4||n.length%2))throw Error('Invalid points');}
      else if(transforms.has(key)) transform(value);
      else if(own(enums,key)) {if(!enums[key].includes(value))throw Error(`Invalid SVG ${key}`);}
      else if(key==='preserveAspectRatio') {if(!/^(none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/.test(value))throw Error('Invalid preserveAspectRatio');}
      else if(['in','in2','result'].includes(key)) {if(!/^[\w.-]+$/.test(value))throw Error('Invalid filter input');}
      else if(paints.has(key)||reference.has(key)) {
        if(/^url\(#[^\s"'()<>]+\)$/.test(value)) {const id=value.slice(5,-1);refs.push({key,id});}
        else if(['href','xlink:href'].includes(key)&&/^#[^\s"'()<>]+$/.test(value)) refs.push({key,id:value.slice(1)});
        else if(paints.has(key)) {value=iconPaint(value);if(!value)throw Error(`Invalid SVG paint: ${key}`);}
        else if(value!=='none') throw Error(`External/invalid SVG reference: ${key}`);
      } else throw Error(`Unsupported SVG attribute: ${key}`);
      if(own(node.attrs,key)) throw Error(`Duplicate SVG attribute: ${key}`);
      node.attrs[key]=value;
    };
    for(const attribute of Array.from(element.attributes)) if(attribute.name!=='style') apply(attribute.name,attribute.value);
    if(element.hasAttribute('style')) for(const declaration of element.getAttribute('style').split(';').filter(s=>s.trim())) {
      const match=declaration.match(/^\s*([a-z-]+)\s*:\s*([^:]+?)\s*$/);
      if(!match||(!paints.has(match[1])&&!numeric.has(match[1])&&!own(enums,match[1]))) throw Error('Unsupported SVG style');
      apply(match[1],match[2],true);
    }
    for(const child of Array.from(element.childNodes)) {
      if(child.nodeType===1) node.children.push(read(child,depth+1));
      else if(child.nodeType===3||child.nodeType===4) {if(['title','desc'].includes(tag))node.children.push(child.nodeValue);else if(child.nodeValue.trim())throw Error('Unexpected SVG text');}
      else if(child.nodeType!==8)throw Error('Unsupported SVG node');
    }
    return node;
  };
  const tree=read(doc.documentElement);
  const state=new Map(),cost=new Map();
  const visit=node=>{
    if(state.get(node)===1)throw Error('Cyclic SVG reference');if(state.get(node)===2)return cost.get(node);
    state.set(node,1);let size=1;
    for(const child of node.children)if(typeof child!=='string')size+=visit(child);
    for(const {id,key} of links.get(node)) {
      const target=ids.get(id);if(!target)continue; // SVG permits dangling local references; they never become external.
      const allowed={fill:['linearGradient','radialGradient','pattern'],stroke:['linearGradient','radialGradient','pattern'],'clip-path':['clipPath'],mask:['mask'],filter:['filter']};
      if(allowed[key]&&!allowed[key].includes(target.tag))throw Error('Invalid SVG reference target');
      size+=visit(target);
    }
    if(size>100000)throw Error('SVG reference expansion exceeds limit');
    state.set(node,2);cost.set(node,size);return size;
  };visit(tree);
  return tree;
}
function merged(parent,child) {
  const out={...parent};
  for(const key of ['left','top','width','height'])if(child[key]!==undefined)out[key]=child[key];
  for(const key of ['hFlip','vFlip'])if(child[key]!==undefined){if(typeof child[key]!=='boolean')throw Error(`Invalid ${key}`);out[key]=!!parent[key]!==child[key];}
  if(child.rotate!==undefined){if(!Number.isSafeInteger(child.rotate))throw Error('Invalid icon rotation');out.rotate=((parent.rotate??0)+child.rotate)%4;}
  return out;
}
export function readIconify(pack) {
  if(!record(pack.icons)||pack.aliases!==undefined&&!record(pack.aliases))throw Error('Invalid Iconify collection');
  const names=[...Object.keys(pack.icons),...Object.keys(pack.aliases??{})];
  if(!names.length||names.length>20000||new Set(names).size!==names.length)throw Error('Invalid Iconify names/count');
  const resolved=new Map(),pending=new Set();
  const resolve=(id,depth=0)=>{
    if(resolved.has(id))return resolved.get(id);
    if(!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(id)||pending.has(id)||depth>64)throw Error(`Invalid/cyclic Iconify alias: ${id}`);
    pending.add(id);let data;
    if(own(pack.icons,id)) {const icon=pack.icons[id];if(!record(icon))throw Error(`Invalid icon ${id}`);
      const tree=parseBody(icon.body), full=tree.children.length===1&&tree.children[0].tag==='svg'?tree.children[0]:null;
      const viewBox=full?.attrs.viewBox?.trim().split(/[\s,]+/).map(Number);
      const absolute=key=>{const raw=full?.attrs[key];return raw&&/^[-+\d.eE]+(?:px)?$/.test(raw)?Number(raw.replace(/px$/,'')):undefined;};
      const defaults={left:0,top:0,width:absolute('width')??viewBox?.[2]??16,height:absolute('height')??viewBox?.[3]??16,rotate:0,hFlip:false,vFlip:false};
      if(full){full.attrs.width='100%';full.attrs.height='100%';}
      const props=Object.fromEntries(Object.keys(defaults).map(key=>[key,icon[key]??pack[key]??defaults[key]]));
      data={...merged({},props),tree};
    } else {const alias=pack.aliases?.[id];if(!record(alias)||typeof alias.parent!=='string')throw Error(`Unknown Iconify alias parent: ${id}`);data=merged(resolve(alias.parent,depth+1),alias);}
    for(const key of ['left','top','width','height'])if(!Number.isFinite(data[key])||Math.abs(data[key])>4096||(['width','height'].includes(key)&&data[key]<=0))throw Error(`Invalid Iconify dimension: ${id}.${key}`);
    pending.delete(id);resolved.set(id,data);return data;
  };
  const result=new Map();
  for(const id of names) {
    try {
      const d=resolve(id),rotation=((d.rotate??0)%4+4)%4;
      let transform=`translate(${-d.left} ${-d.top})`;
      if(d.hFlip)transform=`matrix(-1 0 0 1 ${d.width} 0) ${transform}`;
      if(d.vFlip)transform=`matrix(1 0 0 -1 0 ${d.height}) ${transform}`;
      const rotations=['',`matrix(0 1 -1 0 ${d.height} 0)`,`matrix(-1 0 0 -1 ${d.width} ${d.height})`,`matrix(0 -1 1 0 0 ${d.width})`];
      result.set(id,freeze({width:rotation%2?d.height:d.width,height:rotation%2?d.width:d.height,tree:d.tree,transform:`${rotations[rotation]} ${transform}`}));
    } catch(error) {throw Error(`${id}: ${error.message}`);}
  }
  return result;
}
export function iconifyMarkup(icon,scope) {
  const ids=new Map();let next=0;
  const collect=node=>{if(own(node.attrs,'id')&&!ids.has(node.attrs.id))ids.set(node.attrs.id,`${scope}-${next++}`);for(const [key,v]of Object.entries(node.attrs)){const ref=/^url\(#/.test(v)?v.slice(5,-1):['href','xlink:href'].includes(key)&&v.startsWith('#')?v.slice(1):null;if(ref&&!ids.has(ref))ids.set(ref,`${scope}-${next++}`);}node.children.filter(c=>typeof c!=='string').forEach(collect);};collect(icon.tree);
  const write=node=>{
    if(typeof node==='string')return esc(node);
    const attrs=Object.entries(node.attrs).map(([key,v])=>{
      if(key==='id')v=ids.get(v);
      else if(/^url\(#/.test(v))v=`url(#${ids.get(v.slice(5,-1))})`;
      else if(['href','xlink:href'].includes(key)&&v.startsWith('#'))v=`#${ids.get(v.slice(1))}`;
      return ` ${key==='xlink:href'?'href':key}="${esc(v)}"`;
    }).join('');
    const tag=node===icon.tree?'g':node.tag;return `<${tag}${attrs}>${node.children.map(write).join('')}</${tag}>`;
  };
  // Establish an icon-local viewport, also when embedded in a larger diagram.
  return `<svg width="${icon.width}" height="${icon.height}" viewBox="0 0 ${icon.width} ${icon.height}" overflow="hidden"><g fill="currentColor" stroke="none" transform="${esc(icon.transform)}">${write(icon.tree)}</g></svg>`;
}
