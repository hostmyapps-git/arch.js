import svgpath from 'svgpath';
import { composite, normalizeColor } from '../colors.js';
import { pathSamples } from '../reference-nodes.js';
import { polyPath, traceLinearPath } from '../svg-path.js';
import { textLength } from '../text-layout.js';

const number = (node, name, fallback = 0) => node.hasAttribute(name) ? Number(node.getAttribute(name)) : fallback;
const children = node => Array.from(node.childNodes).filter(child => child.nodeType === 1);
const rawText = node => Array.from(node.childNodes).filter(child => [3,4].includes(child.nodeType)).map(child => child.nodeValue).join('');
const coordinates = text => text.trim().split(/[ ,]+/).map(Number);
const identity = [1,0,0,1,0,0];
const transformPoint = ([a,b,c,d,e,f],x,y) => [a*x+c*y+e,b*x+d*y+f];
function transform(parent, expression) {
  if (!expression) return parent;
  const path = svgpath('M0 0L1 0L0 1').transform(expression).matrix(parent);
  path.iterate(() => {}); // Resolve svgpath's lazy transform stack before reading segments.
  const [origin, x, y] = path.segments.map(([,a,b]) => [a,b]);
  return [x[0]-origin[0],x[1]-origin[1],y[0]-origin[0],y[1]-origin[1],...origin];
}

const marker = (node,name) => node.getAttribute(`marker-${name}`)?.match(/-(open-diamond|filled-arrow|diamond|triangle|arrow|dot)\)$/)?.[1];
function markers(paths) {
  return Object.fromEntries(['start','end'].map(name => [name,paths.map(path => marker(path,name)).find(Boolean)]));
}

function orthogonalConnector({d,points}) {
  if (!points || points.length < 2 || points.some((point,i) =>
    i && point.x !== points[i-1].x && point.y !== points[i-1].y)) return;
  const straight = polyPath(points,false), rounded = polyPath(points,true);
  if (d === straight || d === rounded) return {points,rounded:d !== straight};
  // Embeds translate and reserialize paths, so compare the commands with
  // a tolerance for the renderer's three-decimal coordinate rounding.
  const original = traceLinearPath(d).commands;
  const matches = path => {
    const commands = traceLinearPath(path).commands;
    return original.length === commands.length && commands.every((command,i) =>
      command.length === original[i].length && command[0] === original[i][0] &&
      command.slice(1).every((value,j) => Math.abs(value-original[i][j+1]) < 0.002));
  };
  if (matches(straight)) return {points,rounded:false};
  if (matches(rounded)) return {points,rounded:true};
}

// Translate the existing rendered geometry, including specialized diagrams.
// Connected routes use their full logical path so each connector can be edited
// independently even if the SVG paints several routes as a single shared stroke.
export function exportScene(graph, root, {nativeOrthogonal = false} = {}) {
  const [left,top,width,height] = coordinates(root.getAttribute('viewBox'));
  const bg = children(root).find(node => node.localName === 'rect' && number(node,'width') === width &&
    number(node,'height') === height && number(node,'x') === left && number(node,'y') === top);
  const background = normalizeColor(bg?.getAttribute('fill')) ?? 'none';
  const items = [];
  const edges = new Map(graph.edges.filter(edge => edge.d).map(edge => [edge.id,edge]));
  const sharedMarkers = new Map();
  for (const group of children(root)) {
    const sharedFor = group.getAttribute('data-shared-for');
    if (!sharedFor) continue;
    const paint = markers(children(group));
    for (const id of sharedFor.split(' ')) {
      const existing = sharedMarkers.get(id) ?? {};
      sharedMarkers.set(id,{start:existing.start ?? paint.start,end:existing.end ?? paint.end});
    }
  }

  const themeInk = root.getAttribute('data-arch-svg') === 'dark' ? '#f1f5f9' : '#1e293b';
  const swatches = new Map();
  for (const tag of ['linearGradient','radialGradient','pattern']) for (const definition of Array.from(root.getElementsByTagName(tag))) {
    const first = children(definition)[0];
    const color = normalizeColor(first?.getAttribute('stop-color') ?? first?.getAttribute('fill'));
    if (color) swatches.set(definition.getAttribute('id'),color);
  }
  function ink(value,color) {
    if (value === 'currentColor') return color;
    const swatch = value.match(/^url\(#([^)]*)\)$/)?.[1];
    return swatch ? swatches.get(swatch) ?? 'none' : normalizeColor(value) ?? 'none';
  }
  function appearance(node, parent) {
    const style = {...parent};
    style.color = normalizeColor(node.getAttribute('color')) ?? parent.color;
    for (const name of ['fill','stroke','text-anchor','dominant-baseline','font-weight']) {
      if (node.hasAttribute(name)) style[name] = node.getAttribute(name);
    }
    for (const name of ['fill-opacity','stroke-opacity','stroke-width','font-size']) {
      style[name] = number(node,name,parent[name]);
    }
    style.opacity = parent.opacity * number(node,'opacity',1);
    if (node.hasAttribute('stroke-dasharray')) {
      style.dash = coordinates(node.getAttribute('stroke-dasharray')).filter(value => value > 0);
    }
    return style;
  }
  function paint(style,matrix) {
    const scale = Math.hypot(matrix[0],matrix[1]);
    return {fill:ink(style.fill,style.color), stroke:ink(style.stroke,style.color),
      fillOpacity:style.opacity*style['fill-opacity'], strokeOpacity:style.opacity*style['stroke-opacity'],
      strokeWidth:style['stroke-width']*scale,dash:style.dash?.map(value => value*scale)};
  }
  function emit(item, group) {
    items.push({...item,id:`shape-${items.length+1}`,group});
  }

  function emitPath(d, matrix, style, group, route = {}) {
    // pathSamples flattens curves and preserves subpath boundaries.
    const points = pathSamples(d);
    let path = [];
    const flush = () => {
      if (path.length > 1) emit({kind:'line',points:path,...style,...route},group);
      path = [];
    };
    for (const {x,y,move} of points) {
      if (move) flush();
      path.push(transformPoint(matrix,x,y));
    }
    flush();
  }
  function emitText(node, style, matrix, group) {
    let x = number(node,'x'), y = number(node,'y');
    const scale = Math.hypot(matrix[0],matrix[1]);
    const angle = Math.atan2(matrix[1],matrix[0]);
    const add = (content, layer) => {
      if (!content) return;
      const size = layer['font-size'];
      const span = Math.max(1,textLength(content)*size), height = size*1.25;
      const align = layer['text-anchor'] === 'middle' ? 'center' : layer['text-anchor'] === 'end' ? 'right' : 'left';
      const origin = x - (align === 'center' ? span/2 : align === 'right' ? span : 0);
      const ascent = layer['dominant-baseline'] === 'central' ? height/2 : size;
      const [cx,cy] = transformPoint(matrix,origin+span/2,y-ascent+height/2);
      const color = ink(layer.fill,layer.color);
      emit({kind:'text',text:content,x:cx-span*scale/2,y:cy-height*scale/2,
        width:span*scale,height:height*scale,angle,align,fontSize:size*scale,
        color:color === 'none' ? themeInk : color,bold:layer['font-weight'] === 'bold' || layer['font-weight'] >= 600},group);
      if (align === 'left') x += span;
    };
    add(rawText(node),style);
    for (const child of children(node).filter(child => child.localName === 'tspan')) {
      x = number(child,'x',x) + number(child,'dx');
      y = number(child,'y',y) + number(child,'dy');
      add(rawText(child),appearance(child,style));
    }
  }
  function visit(node, state, parent, inheritedGroup) {
    const tag = node.localName;
    if (node === bg || ['defs','style','title','desc','use'].includes(tag) ||
        node.getAttribute('display') === 'none' || node.getAttribute('visibility') === 'hidden' ||
        node.hasAttribute('data-shared-for')) return;
    const matrix = transform(parent,node.getAttribute('transform'));
    const style = appearance(node,state);
    if (!style.opacity) return;
    const nodeId = node.getAttribute('data-node');
    const edgeId = node.getAttribute('data-edge');
    const label = node.getAttribute('data-label-for');
    const tile = node.getAttribute('data-grid-tile');
    const group = nodeId ? `node:${nodeId}` : edgeId ? `edge:${edgeId}` : label ? `label:${label}` :
      tile ? `tile:${tile}` : inheritedGroup;
    const edge = edgeId && edges.get(edgeId);
    const kind = node.getAttribute('class');
    if (edge && kind === 'arch-edge') {
      const paths = children(node).filter(child => child.localName === 'path');
      const path = paths[0];
      const actual = markers(paths), shared = sharedMarkers.get(edgeId);
      const colors = paint(appearance(path,style),matrix);
      const terminals = {
        start:actual.start ?? shared?.start,end:actual.end ?? shared?.end,
        source:`node:${edge.source}`,target:`node:${edge.target}`
      };
      const orthogonal = nativeOrthogonal ? orthogonalConnector(edge) : undefined;
      if (orthogonal) {
        const points = orthogonal.points.filter((point,i,list) => !i || point.x !== list[i-1].x || point.y !== list[i-1].y);
        if (points.length >= 2) {
          emit({kind:'line',points:points.map(({x,y})=>transformPoint(matrix,x,y)),
            rounded:orthogonal.rounded,...colors,...terminals},group);
          return;
        }
      }
      emitPath(edge.d,matrix,colors,group,terminals);
      return;
    }
    if (tag === 'text') { emitText(node,style,matrix,group); return; }
    if (tag === 'g' || tag === 'svg') {
      for (const child of children(node)) visit(child,style,matrix,group);
      return;
    }
    const colors = paint(style,matrix);
    if ((colors.fill === 'none' || !colors.fillOpacity) && (colors.stroke === 'none' || !colors.strokeOpacity)) return;
    if (tag === 'path') {
      emitPath(node.getAttribute('d') ?? '',matrix,colors,group,markers([node]));
      return;
    }
    if (['line','polyline','polygon'].includes(tag)) {
      const list = tag === 'line' ? ['x1','y1','x2','y2'].map(name => number(node,name)) : coordinates(node.getAttribute('points') ?? '');
      const points = [];
      for (let i=0;i+1<list.length;i+=2) points.push(transformPoint(matrix,list[i],list[i+1]));
      if (tag === 'polygon' && points.length) points.push(points[0]);
      if (points.length>1) emit({kind:'line',points,...colors,...markers([node])},group);
      return;
    }
    if (['rect','circle','ellipse','image'].includes(tag)) {
      const rect = tag === 'rect' || tag === 'image', rx = number(node,'r',number(node,'rx')), ry = number(node,'r',number(node,'ry'));
      const w = rect ? number(node,'width') : 2*rx, h = rect ? number(node,'height') : 2*ry;
      if (w<=0 || h<=0) return;
      const [cx,cy] = transformPoint(matrix,rect ? number(node,'x')+w/2 : number(node,'cx'),rect ? number(node,'y')+h/2 : number(node,'cy'));
      const sx = Math.hypot(matrix[0],matrix[1]), sy = Math.hypot(matrix[2],matrix[3]);
      emit({kind:tag==='image'?'image':rect?'rectangle':'ellipse',x:cx-w*sx/2,y:cy-h*sy/2,width:w*sx,height:h*sy,
        radius:rect?rx*sx:0,angle:Math.atan2(matrix[1],matrix[0]),...colors,
        ...(tag==='image'?{data:node.getAttribute('href')}:null)},group);
    }
  }
  const state = {color:themeInk,fill:'black',stroke:'none',opacity:1,'fill-opacity':1,'stroke-opacity':1,'stroke-width':1,'font-size':13};
  const matrix = [...identity.slice(0,4),-left,-top];
  for (const child of children(root)) visit(child,state,matrix);
  return {title:graph.view.title,width,height,background,items};
}

export const boundsOf = points => {
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for (const [px,py] of points) { x=Math.min(x,px); y=Math.min(y,py); right=Math.max(right,px); bottom=Math.max(bottom,py); }
  return {x,y,width:right-x,height:bottom-y};
};

export const solidPaint = (fill, opacity, background) => fill === 'none' || opacity === 0 ? 'none' :
  opacity === 1 ? fill : composite(fill,background==='none'?'#ffffff':background,opacity);
