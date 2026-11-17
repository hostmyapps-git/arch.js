import { ArchError, validateModel } from './parser.js';
import { resolveProfile, visibleNodeIds } from './profiles.js';
import { layoutDiagram } from './diagrams.js';
import { relationshipLabel, relationshipReferences } from './relationship-labels.js';
import { routingOptions } from './routing-options.js';
import { attachReferenceNodes } from './reference-nodes.js';
import { layoutMeta } from './meta.js';
import { normalizeColor } from './colors.js';
import { layoutTree } from './tree.js';
import {placementPlan,resolvePlacements} from './placement.js';
import {viaReferences,resolveVia} from './via.js';
import {nodeProperties,positionProperties} from './property-fields.js';
import {shareEdgePaths} from './shared-paths.js';
import {routeStyle} from './route-styles.js';

export const num = (n) => String(Math.round(n * 1000) / 1000);
const pt = (p) => `${num(p.x)} ${num(p.y)}`;
const fail = (message, loc) => { throw new ArchError(message, loc, 'ARCH_VALIDATION'); };

// Validate path command arity and retain conservative bounds (control-point hulls).
// Arc bounds deliberately overestimate using corrected ellipse radii.
export function inspectPath(path, loc) {
  if (typeof path !== 'string' || !path.trim() || path.length > 100_000) fail('Invalid SVG path', loc);
  const pattern = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
  const tokens = path.match(pattern) ?? [];
  if (path.replace(pattern, '').replace(/[\s,]/g, '') || !/^[Mm]$/.test(tokens[0] ?? '')) fail('SVG path must start with M and contain valid path data', loc);
  const arities = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  const points = [];
  let index = 0, command, current = { x: 0, y: 0 }, start = current, previousControl = null, previousCommand = '';
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    else if (!command) fail('Missing SVG path command', loc);
    const upper = command.toUpperCase(), relative = command !== upper;
    if (upper === 'Z') {
      current = start; points.push(current); previousControl = null; previousCommand = upper; command = null; continue;
    }
    const count = arities[upper], args = tokens.slice(index, index + count).map(Number);
    if (args.length !== count || args.some(n => !Number.isFinite(n) || Math.abs(n) > 1e7)) fail('Invalid number or size of SVG path parameters', loc);
    index += count;
    const origin = current;
    const pair = (offset) => ({ x: args[offset] + (relative ? origin.x : 0), y: args[offset + 1] + (relative ? origin.y : 0) });
    if (upper === 'H') current = { x: args[0] + (relative ? origin.x : 0), y: origin.y };
    else if (upper === 'V') current = { x: origin.x, y: args[0] + (relative ? origin.y : 0) };
    else if (upper === 'A') {
      if (args[0] < 0 || args[1] < 0 || ![0, 1].includes(args[3]) || ![0, 1].includes(args[4])) fail('Invalid SVG arc parameters', loc);
      current = pair(5);
      // SVG endpoint-to-center radius correction, including rotated ellipses.
      // Every point is within two corrected maximum radii of an endpoint.
      const angle = args[2] * Math.PI / 180;
      const dx = (origin.x - current.x) / 2, dy = (origin.y - current.y) / 2;
      const xp = Math.cos(angle) * dx + Math.sin(angle) * dy;
      const yp = -Math.sin(angle) * dx + Math.cos(angle) * dy;
      const correction = args[0] && args[1] ? Math.max(1, Math.hypot(xp / args[0], yp / args[1])) : 0;
      const radius = correction * Math.max(args[0], args[1]) * 2;
      if (!Number.isFinite(radius) || radius > 1e10) fail('SVG arc exceeds the supported coordinate range', loc);
      for (const p of [origin, current]) points.push({ x: p.x - radius, y: p.y - radius }, { x: p.x + radius, y: p.y + radius });
    } else {
      for (let j = 0; j < count; j += 2) points.push(pair(j));
      current = pair(count - 2);
      if ((upper === 'S' && ['C', 'S'].includes(previousCommand)) || (upper === 'T' && ['Q', 'T'].includes(previousCommand))) {
        if (previousControl) points.push({ x: origin.x * 2 - previousControl.x, y: origin.y * 2 - previousControl.y });
      }
    }
    if (upper === 'M') { start = current; command = relative ? 'l' : 'L'; }
    if (['C', 'S', 'Q'].includes(upper)) previousControl = pair(count - 4);
    else if (upper === 'T' && ['Q', 'T'].includes(previousCommand) && previousControl)
      previousControl = { x: origin.x * 2 - previousControl.x, y: origin.y * 2 - previousControl.y };
    else previousControl = null;
    previousCommand = upper;
    points.push(current);
  }
  return points;
}

function textLength(text) {
  return [...String(text)].reduce((sum, c) => sum + (/[MWmw@#%&]/.test(c) ? 1 : /[il.,' :!]/.test(c) ? 0.3 :
    c.codePointAt(0) > 0x2fff ? 1.15 : /[A-Z]/.test(c) ? 0.76 : c.codePointAt(0) > 0x2ff ? 0.9 : 0.62), 0);
}
export function wrap(text, width, fontSize = 13) {
  if (!text) return [];
  const result = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && textLength(`${line} ${word}`) * fontSize > width) { result.push(line); line = ''; }
      // Split unbroken identifiers so arbitrary labels never escape their card.
      for (const char of word) {
        if (textLength(line + char) * fontSize > width && line) { result.push(line); line = ''; }
        line += char;
      }
      line += ' ';
    }
    result.push(line.trimEnd());
  }
  return result.map(line => line.trim());
}

export function singleLine(text, width, fontSize) {
  const full=String(text??'').replace(/\s+/gu,' ').trim();
  if(textLength(full)*fontSize<=width)return full;
  const budget=Math.max(0,width/fontSize-textLength('…'));
  let result='',used=0;
  for(const char of full) {const units=textLength(char);if(used+units>budget)break;result+=char;used+=units;}
  return result.trimEnd()+'…';
}

const intersects = (a, b, margin = 24) => a.x < b.x + b.width + margin && a.x + a.width + margin > b.x &&
  a.y < b.y + b.height + margin && a.y + a.height + margin > b.y;

function arrange(items, edges, direction, spacing, places, nodesById) {
  if (!items.length) return;
  const itemIds = new Set(items.map(n => n.id)), incoming = new Map(items.map(n => [n.id, new Set()]));
  const outgoing = new Map(items.map(n => [n.id, new Set()]));
  const representative = (id) => {
    let node = nodesById.get(id);
    while (node && !itemIds.has(node.id)) node = nodesById.get(node.parent);
    return node?.id;
  };
  for (const edge of edges) {
    const a = representative(edge.source), b = representative(edge.target);
    if (a && b && a !== b) { incoming.get(b).add(a); outgoing.get(a).add(b); }
  }
  const remaining = new Set(itemIds), ranks = new Map(items.map(n => [n.id, 0]));
  while (remaining.size) {
    const ready = [...remaining].filter(id => [...incoming.get(id)].every(a => !remaining.has(a)));
    // A deterministic cycle break; only propagate to still-unprocessed nodes.
    for (const id of ready.length ? ready : [remaining.values().next().value]) {
      remaining.delete(id);
      for (const target of outgoing.get(id)) if (remaining.has(target)) ranks.set(target, Math.max(ranks.get(target), ranks.get(id) + 1));
    }
  }
  const down = direction === 'down', primarySize = down ? 'height' : 'width', secondarySize = down ? 'width' : 'height';
  const rankWidths = new Map();
  for (const item of items) rankWidths.set(ranks.get(item.id), Math.max(rankWidths.get(ranks.get(item.id)) ?? 0, item[primarySize]));
  const offsets = new Map(); let offset = 0;
  for (const rank of [...rankWidths.keys()].sort((a, b) => a - b)) { offsets.set(rank, offset); offset += rankWidths.get(rank) + spacing; }
  const used = items.filter(n => places[n.id]).map(n => Object.assign(n, places[n.id].at));
  const stacks = new Map();
  for (const item of items) {
    if (places[item.id]) continue;
    const rank = ranks.get(item.id), primary = offsets.get(rank);
    let secondary = stacks.get(rank) ?? 0;
    const setPosition = () => { item.x = down ? secondary : primary; item.y = down ? primary : secondary; };
    setPosition();
    let collision;
    while ((collision = used.find(other => intersects(item, other)))) {
      secondary = (down ? collision.x + collision.width : collision.y + collision.height) + spacing / 2;
      setPosition();
    }
    stacks.set(rank, secondary + item[secondarySize] + spacing / 2);
    used.push(item);
  }
}

function port(box, side, other) {
  if (typeof side === 'object') return side;
  if (!side || side === 'auto') {
    const dx = other.x + other.width / 2 - box.x - box.width / 2;
    const dy = other.y + other.height / 2 - box.y - box.height / 2;
    side = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
  }
  return {
    left: { x: box.x, y: box.y + box.height / 2 },
    right: { x: box.x + box.width, y: box.y + box.height / 2 },
    top: { x: box.x + box.width / 2, y: box.y },
    bottom: { x: box.x + box.width / 2, y: box.y + box.height },
  }[side];
}

export function polyPath(points, rounded) {
  let d = `M ${pt(points[0])}`;
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1], current = points[i], after = points[i + 1];
    if (!rounded || !after) { d += ` L ${pt(current)}`; continue; }
    const a = Math.hypot(current.x - before.x, current.y - before.y), b = Math.hypot(after.x - current.x, after.y - current.y);
    if (!a || !b) continue;
    const r = Math.min(10, a / 2, b / 2);
    const enter = { x: current.x + (before.x - current.x) * r / a, y: current.y + (before.y - current.y) * r / a };
    const leave = { x: current.x + (after.x - current.x) * r / b, y: current.y + (after.y - current.y) * r / b };
    d += ` L ${pt(enter)} Q ${pt(current)} ${pt(leave)}`;
  }
  return d;
}

function middle(points) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let left = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]) {
      const ratio = lengths[i] ? left / lengths[i] : 0;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * ratio, y: points[i].y + (points[i + 1].y - points[i].y) * ratio };
    }
    left -= lengths[i];
  }
  return points[0];
}

function routeEdge(edge, source, target, route, parallel) {
  const curve = route.curve ?? 'orthogonal';
  let a = port(source, route.from, target), b = port(target, route.to, source), points = [a], d;
  if (route.path !== undefined) {
    const pathPoints = inspectPath(route.path, route.loc);
    return { ...edge, d: route.path, points: pathPoints, label: route.label ?? middle([a, b]) };
  }
  if (route.via) points.push(...route.via);
  else if (source.id === target.id) {
    a = port(source, route.from ?? 'right', target); b = port(target, route.to ?? 'top', source);
    const reach = 48 + parallel * 24;
    points = [a, { x: a.x + reach, y: a.y }, { x: a.x + reach, y: source.y - reach }, { x: b.x, y: source.y - reach }];
  } else if (curve !== 'straight') {
    const shift = parallel * 22;
    if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
      const x = (a.x + b.x) / 2 + shift;
      if (parallel && a.y === b.y) {
        const stub = Math.sign(b.x - a.x || 1) * 24;
        points.push({ x: a.x + stub, y: a.y }, { x: a.x + stub, y: a.y + shift },
          { x: b.x - stub, y: b.y + shift }, { x: b.x - stub, y: b.y });
      } else points.push({ x, y: a.y }, { x, y: b.y });
    } else {
      const y = (a.y + b.y) / 2 + shift;
      if (parallel && a.x === b.x) {
        const stub = Math.sign(b.y - a.y || 1) * 24;
        points.push({ x: a.x, y: a.y + stub }, { x: a.x + shift, y: a.y + stub },
          { x: b.x + shift, y: b.y - stub }, { x: b.x, y: b.y - stub });
      } else points.push({ x: a.x, y }, { x: b.x, y });
    }
  } else if (parallel) points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + parallel * 28 });
  points.push(b);
  if (route.via && ['orthogonal', 'rounded'].includes(curve)) {
    const orthogonal = [points[0]];
    for (const next of points.slice(1)) {
      const previous = orthogonal.at(-1);
      if (previous.x !== next.x && previous.y !== next.y) orthogonal.push({ x: next.x, y: previous.y });
      orthogonal.push(next);
    }
    points = orthogonal;
  }
  if (curve === 'bezier' && source.id !== target.id) {
    const controls = route.via ?? points.slice(1, 3);
    d = `M ${pt(a)} C ${pt(controls[0])} ${pt(controls[1])} ${pt(b)}`;
  } else d = polyPath(points, curve === 'rounded');
  let label = route.label ?? middle(points);
  if (!route.label && curve === 'bezier' && source.id !== target.id) {
    const controls = route.via ?? points.slice(1, 3);
    label = { x: (a.x + 3 * controls[0].x + 3 * controls[1].x + b.x) / 8,
      y: (a.y + 3 * controls[0].y + 3 * controls[1].y + b.y) / 8 };
  }
  return { ...edge, d, points, label };
}

function treeGroupRoute(view,id,options) {
  const route={...routingOptions(view,view.routes[id])};
  if(options?.showLabels!==undefined&&view.routes[id]?.showLabel===undefined)route.showLabel=options.showLabels;
  if(options?.curve!==undefined&&view.routes[id]?.curve===undefined)route.curve=options.curve;
  return route;
}

function edgeLabelMetrics(edge,route,profile,modelNodes) {
  const result={},labelHidden=route.label==='none';
  result.labelHidden=labelHidden;result.labelExplicit=route.label!==undefined;
  const omit=edge.referenceDisplay==='nodes'?new Set(edge.referenceItems.map(item=>`${item.attribute}\0${item.id}`)):new Set();
  const displayText=relationshipLabel(edge,profile.relationTypes[edge.type],modelNodes,omit);
  result.labelLines=labelHidden||route.showLabel===false?[]:wrap(displayText,displayText===edge.title?160:200,11);
  result.labelWidth=labelHidden?0:Math.max(28,...result.labelLines.map(line=>textLength(line)*11+18));
  result.labelHeight=labelHidden?0:result.labelLines.length*15+8;result.labelTextOffset={x:0,y:0};
  if(!labelHidden&&route.showIcon!==false&&route.icon&&route.icon!=='none') {
    result.labelIcon=route.icon;result.labelIconPosition=route.iconPosition??'left';result.labelIconLoc=route.loc;
    const size=16,hasText=result.labelLines.length>0,gap=hasText?6:0,textWidth=hasText?result.labelWidth-18:0,textHeight=result.labelLines.length*15;
    const horizontal=['left','right'].includes(result.labelIconPosition),before=['left','top'].includes(result.labelIconPosition),sign=before?1:-1;
    const width=horizontal?textWidth+size+gap:Math.max(textWidth,size),height=horizontal?Math.max(textHeight,size):textHeight+size+gap;
    result.labelWidth=width+18;result.labelHeight=height+8;
    result.labelTextOffset=horizontal?{x:sign*(size+gap)/2,y:0}:{x:0,y:sign*(size+gap)/2};
    result.labelIconBox={x:horizontal?(before?-width/2:width/2-size):-size/2,y:horizontal?-size/2:(before?-height/2:height/2-size),size};
  }
  if(!result.labelLines.length&&!result.labelIcon){result.labelWidth=0;result.labelHeight=0;}
  return result;
}

export function layout(model, options = {}) {
  validateModel(model, options);
  const profile = resolveProfile(model, options);
  const view = options.view ? model.views.find(v => v.id === options.view) : model.views[0];
  if (!view) fail(`Unknown view: ${options.view}`);
  if(view.meta!==undefined)return layoutMeta(model,profile,view);
  const visible = visibleNodeIds(model, view);
  const nodes = model.nodes.filter(n => visible.has(n.id)).map(n => {
    const definition = profile.nodeTypes[n.type], style = view.styles[n.id] ?? {};
    const template = style.template ?? definition.template;
    const width = style.width ?? view.places[n.id]?.size?.x ?? 220;
    const fontSize=style.fontSize??15,scale=fontSize/15;
    const textStyle={title:fontSize,badge:9*scale,description:12*scale,technology:10*scale,titleLeading:20*scale,descriptionLeading:17*scale,technologyLeading:13*scale};
    const position=style.iconPosition??'left',top=template==='database'?34:18;
    const sideInset=['component','queue','node','artifact','process'].includes(template)?34:18;
    const iconBox={x:position==='left'?18:position==='right'?width-sideInset-27:(width-27)/2,y:top,size:27};
    const showIcon=style.showIcon!==false;
    const badgeX=position==='left'&&showIcon?54:20;
    const badgeWidth=position==='left'&&showIcon?width-82:position==='right'&&showIcon?iconBox.x-badgeX-9:width-40;
    const titleLines = style.showLabel===false?[]:wrap(n.title, width - 40, textStyle.title), descLines = style.showDescription===false?[]:wrap(n.description, width - 40, textStyle.description);
    const badgeText=String(n.stereotype??n.type),badgeLines=style.showStereotype!==false&&badgeText.trim()?[singleLine(badgeText.toUpperCase(),badgeWidth,textStyle.badge)]:[];
    const technologyLines = style.showTechnology===false?[]:wrap(n.technology, width - 40, textStyle.technology);
    const textTop=top+(position==='top'&&showIcon?35:0),bottomReserve=position==='bottom'&&showIcon?39:0;
    textStyle.badgeX=badgeX;
    textStyle.badgeY=textTop+Math.max(18,textStyle.badge);
    const headerEnd=Math.max(badgeLines.length?textStyle.badgeY:top,showIcon?iconBox.y+iconBox.size:top);
    textStyle.titleY=badgeLines.length?Math.max(textTop+44,textStyle.badgeY+textStyle.title+11):Math.max(textTop+textStyle.title,headerEnd+textStyle.title+8);
    const titleEnd=titleLines.length?textStyle.titleY+(titleLines.length-1)*textStyle.titleLeading:headerEnd;
    textStyle.descriptionY=titleLines.length?titleEnd+25*scale:headerEnd+textStyle.description+12;
    let bodyEnd=descLines.length?textStyle.descriptionY+(descLines.length-1)*textStyle.descriptionLeading:titleEnd;
    const propertyRows=style.display==='logo'?[]:nodeProperties(n,view).map(row=>({...row,lines:wrap(row.full,width-40,textStyle.description)}));
    textStyle.propertyDividerY=bodyEnd+12*scale;
    if(propertyRows.length)bodyEnd=positionProperties({propertyRows},bodyEnd+30*scale,scale);
    const minHeight=style.height??view.places[n.id]?.size?.y??0;
    const height = style.display === 'logo' ? Math.max(minHeight,96) : Math.max(minHeight,96,
      bodyEnd+(technologyLines.length?26*scale+(technologyLines.length-1)*textStyle.technologyLeading:0)+22+bottomReserve);
    if(position==='bottom')iconBox.y=height-18-iconBox.size;
    textStyle.technologyY=height-18-bottomReserve-(technologyLines.length-1)*textStyle.technologyLeading;
    return { ...n, icon: n.icon ?? definition.icon, ...style,
      accent: normalizeColor(style.accent ?? n.accent ?? definition.accent),
      backgroundColor: normalizeColor(style.backgroundColor ?? definition.backgroundColor ?? profile.styleGroups?.[definition.styleGroup]?.backgroundColor),
      container: definition.container, template, width, height, textStyle, iconBox, titleLines, badgeText, badgeLines, descLines, technologyLines,propertyRows, x: 0, y: 0 };
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  const modelNodes = new Map(model.nodes.map(n => [n.id, n]));
  const edges = model.edges.filter(e => visible.has(e.source) && visible.has(e.target) && view.styles[e.id]?.display!=='none').map(edge => {
    const type = edge.type ?? profile.defaultRelation;
    const rule = profile.relationTypes[type];
    const referenceDisplay = view.referenceDisplay ?? rule.referenceDisplay ?? 'labels';
    const referenceItems = referenceDisplay === 'labels' ? [] : relationshipReferences(edge, rule).filter(item => byId.has(item.id) && !byId.get(item.id).container);
    const referenceOccurrences = view.referenceOccurrences ?? rule.referenceOccurrences ?? 'shared';
    return { ...edge, type, style: rule.style, referenceDisplay, referenceOccurrences, referenceItems, labelText: relationshipLabel(edge, rule, modelNodes) };
  });
  if(view.diagram?.type==='tree')return layoutTree(model,profile,view,nodes,edges);
  if (view.diagram && view.diagram.type !== 'connected') return layoutDiagram(model, profile, view, nodes, edges);
  const groupStates=[],treeEdges=new Map();
  const initialPlaces=Object.fromEntries(Object.entries(view.places).map(([id,p])=>[id,{...p,at:{x:typeof p.at.x==='number'?p.at.x:0,y:typeof p.at.y==='number'?p.at.y:0}}]));
  for(const [id,options]of Object.entries(view.trees??{})) {
    const members=options.nodes.map(id=>byId.get(id)).filter(Boolean);if(!members.length)continue;
    const ids=new Set(members.map(n=>n.id)),parents=new Map(members.map(n=>[n.id,n.parent]));
    const localEdges=edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(edge=>{
      const route=treeGroupRoute(view,edge.id,options);
      return {...edge,treeLabel:edgeLabelMetrics(edge,route,profile,modelNodes)};
    });
    const local=layoutTree(model,profile,{...view,diagram:{type:'tree',...options}},members,localEdges);
    const proxy={id,parent:parents.get(members[0].id),virtualTreeGroup:true,container:false,width:local.bounds.width,height:local.bounds.height,x:0,y:0};
    for(const item of local.nodes)Object.assign(byId.get(item.id),item,{parent:id,treeGroup:id,x:item.x-local.bounds.x,y:item.y-local.bounds.y});
    nodes.push(proxy);byId.set(id,proxy);groupStates.push({id,options,local,proxy,parents});
  }
  const referenced = new Set(edges.flatMap(e => e.referenceItems.map(item => item.id)));
  const endpoints = new Set(edges.flatMap(e => [e.source, e.target]));
  const positions=placementPlan(model,profile,view),positionTargets=new Set([...viaReferences(model,profile,view),...[...positions?.expressions.values()??[]].flatMap(terms=>terms.filter(t=>t.ref!==undefined).map(t=>t.ref))]);
  for (const node of nodes) if (referenced.has(node.id) && !endpoints.has(node.id) && !node.parent && !node.container && !view.places[node.id]&&!positionTargets.has(node.id)) node.referenceOnly = true;
  const process = (parent) => {
    const children = nodes.filter(n => n.parent === parent && !n.referenceOnly);
    for (const child of children) if (child.container) process(child.id);
    arrange(children, edges, view.direction, view.spacing, initialPlaces, byId);
    if (parent) {
      const box = byId.get(parent);
      // Shift automatic children if necessary; explicit negative positions remain meaningful.
      const minX = Math.min(0, ...children.map(n => n.x)), minY = Math.min(0, ...children.map(n => n.y));
      box.width = Math.max(box.width, ...children.map(n => n.x + 28 - minX + n.width + 28));
      const scale=box.textStyle.title/15;
      box.packageBadge=box.showStereotype===false?'':singleLine(box.type==='package'?'PACKAGE':'CONTAINER',Math.max(20,box.width*0.4),box.textStyle.badge);
      const badgeWidth=textLength(box.packageBadge)*box.textStyle.badge;
      box.packageTitleSize=14*scale;
      const position=box.iconPosition??'left';
      const showIcon=box.showIcon!==false,offset=position==='top'&&showIcon?35:0;
      box.packageTitleX=position==='left'&&showIcon?53:20;
      box.packageBadgeX=box.width-(position==='right'&&showIcon?53:18);
      box.packageTitleY=Math.max(32,17+box.packageTitleSize)+offset;
      box.packageBadgeY=Math.max(32,17+box.textStyle.badge)+offset;
      box.titleLines=box.showLabel===false?[]:wrap(box.title,Math.max(10,box.packageBadgeX-badgeWidth-12-box.packageTitleX),box.packageTitleSize);
      const textEnd=Math.max(17,box.packageBadge?box.packageBadgeY:0,box.titleLines.length?box.packageTitleY+(box.titleLines.length-1)*box.textStyle.titleLeading:0);
      box.iconBox={x:position==='left'?20:position==='right'?box.width-42:(box.width-22)/2,y:position==='bottom'?textEnd+12:17,size:22};
      box.headerHeight=Math.max(56,textEnd+24,showIcon?box.iconBox.y+box.iconBox.size+17:0);
      if(box.propertyRows.length) {
        box.textStyle.propertyDividerY=box.headerHeight;
        box.headerHeight=positionProperties(box,box.headerHeight+26*scale,scale)+24;
      }
      box.contentOffset = { x: 28 - minX, y: box.headerHeight + 16 - minY };
      box.width = Math.max(box.width, ...children.map(n => n.x + box.contentOffset.x + n.width + 28));
      box.height = Math.max(box.height,box.headerHeight+28, ...children.map(n => n.y + box.contentOffset.y + n.height + 28));
    }
  };
  process(null);
  const absolute = (parent, x, y) => {
    for (const node of nodes.filter(n => n.parent === parent)) {
      node.x += x; node.y += y;
      if(node.virtualTreeGroup)absolute(node.id,node.x,node.y);
      else if (node.container) absolute(node.id, node.x + node.contentOffset.x, node.y + node.contentOffset.y);
    }
  };
  absolute(null, 0, 0);
  const treeGroups=[];
  for(const state of groupStates) {
    const {id,options,local,proxy,parents}=state,dx=proxy.x-local.bounds.x,dy=proxy.y-local.bounds.y;
    for(const item of local.nodes)byId.get(item.id).parent=parents.get(item.id);
    for(const edge of local.edges) {
      const points=edge.points.map(p=>({x:p.x+dx,y:p.y+dy}));
      treeEdges.set(edge.id,{...edge,points,d:polyPath(points,(options.curve??'rounded')==='rounded'),label:{x:edge.label.x+dx,y:edge.label.y+dy},treeGroup:id});
    }
    treeGroups.push({id,parent:proxy.parent,nodes:local.nodes.map(n=>n.id),...local.tree,bounds:{x:proxy.x,y:proxy.y,width:proxy.width,height:proxy.height}});
    nodes.splice(nodes.indexOf(proxy),1);byId.delete(id);
  }
  // Align automatic top-level context cards beside their closest tree member.
  // Explicit place statements and semantic package bounds remain authoritative.
  for(const node of nodes)if(!node.treeGroup&&!node.container&&!node.parent&&!view.places[node.id]) {
    const link=edges.find(e=>e.source===node.id&&byId.get(e.target)?.treeGroup||e.target===node.id&&byId.get(e.source)?.treeGroup);
    if(!link)continue;
    const anchor=byId.get(link.source===node.id?link.target:link.source),group=treeGroups.find(g=>g.id===anchor.treeGroup);
    if(group.parent)continue;
    const vertical=['up','down'].includes(group.orientation),gap=view.spacing;
    node.x=vertical?group.bounds.x-gap-node.width:anchor.x+(anchor.width-node.width)/2;
    node.y=vertical?anchor.y+(anchor.height-node.height)/2:group.bounds.y+group.bounds.height+gap;
    while(nodes.some(n=>n!==node&&intersects(node,n)))if(vertical)node.y+=node.height+gap;else node.x+=node.width+gap;
  }
  const groupOrigins=new Map(groupStates.map(s=>[s.id,{x:s.proxy.x,y:s.proxy.y}]));
  resolvePlacements(model,profile,view,nodes,groupStates,positions);
  for(const group of treeGroups) {
    const proxy=groupStates.find(s=>s.id===group.id).proxy,old=groupOrigins.get(group.id),dx=proxy.x-old.x,dy=proxy.y-old.y;
    group.bounds={x:proxy.x,y:proxy.y,width:proxy.width,height:proxy.height};
    for(const edge of treeEdges.values())if(edge.treeGroup===group.id) {
      edge.points=edge.points.map(p=>({x:p.x+dx,y:p.y+dy}));edge.label={x:edge.label.x+dx,y:edge.label.y+dy};
    }
  }
  const parallel = new Map();
  const routeBoxes=new Map([...byId,...treeGroups.map(g=>[g.id,g.bounds])]);
  const resolvedRoutes=new Map();
  const routedEdges = edges.map(edge => {
    const key = [edge.source, edge.target].sort().join('\0'), count = parallel.get(key) ?? 0;
    parallel.set(key, count + 1);
    const preset=treeEdges.get(edge.id),groupOptions=preset?view.trees[preset.treeGroup]:null;
    const route = resolveVia(groupOptions?treeGroupRoute(view,edge.id,groupOptions):routingOptions(view,view.routes[edge.id])??{},routeBoxes);
    resolvedRoutes.set(edge.id,route);
    const labelHidden = route.label === 'none';
    const manual=preset&&['from','to','via','path'].some(key=>route[key]!==undefined)||route.curve==='bezier'||route.curve==='straight';
    const result=preset&&!manual?{...preset,label:route.label&&route.label!=='none'?route.label:preset.label}:routeEdge(edge, byId.get(edge.source), byId.get(edge.target), {...route, label: labelHidden ? undefined : route.label}, count);
    if(preset&&!manual)result.d=polyPath(preset.points,(route.curve??groupOptions.curve??'rounded')==='rounded');
    Object.assign(result,edgeLabelMetrics(edge,route,profile,modelNodes),routeStyle(route));
    return result;
  });
  const sharedPaths=shareEdgePaths(routedEdges,nodes,resolvedRoutes,polyPath);
  const referenceNodes = attachReferenceNodes(nodes, routedEdges, view, wrap, (card, anchor, route) =>
    routeEdge({}, card, {id: null, ...anchor, width: 0, height: 0}, {...route, to: {x: anchor.x, y: anchor.y}}, 0),route=>resolveVia(route,routeBoxes));
  const extents = nodes.flatMap(n => [{ x: n.x, y: n.y }, { x: n.x + n.width, y: n.y + n.height }]);
  for (const occurrence of referenceNodes) {
    extents.push({x:occurrence.node.x,y:occurrence.node.y},{x:occurrence.node.x+occurrence.node.width,y:occurrence.node.y+occurrence.node.height},...occurrence.points);
  }
  for (const edge of routedEdges) {
    extents.push(...edge.points);
    if (edge.labelLines.length || edge.labelIcon) extents.push({ x: edge.label.x - edge.labelWidth / 2, y: edge.label.y - edge.labelHeight / 2 },
      { x: edge.label.x + edge.labelWidth / 2, y: edge.label.y + edge.labelHeight / 2 });
  }
  // Markers use stroke-width units. Reserve their conservative maximum reach
  // for thick routes, including reference connectors, without changing defaults.
  const padding=Math.max(48,...[...routedEdges,...referenceNodes].map(e=>(e.width??1.5)*12));
  const minX = Math.min(0, ...extents.map(p => p.x)) - padding, minY = Math.min(0, ...extents.map(p => p.y)) - padding;
  const maxX = Math.max(160, ...extents.map(p => p.x)) + padding, maxY = Math.max(96, ...extents.map(p => p.y)) + padding;
  return { title: model.title, description: model.description, profile: { id: profile.id, version: profile.version }, view, nodes, edges: routedEdges,
    referenceNodes,...(sharedPaths.length?{sharedPaths}:{}),...(treeGroups.length?{treeGroups}:{}), bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}
