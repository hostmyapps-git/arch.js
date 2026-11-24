import svgpath from 'svgpath';
import { ArchError } from './errors.js';
import { inspectPath, polyPath, cubicPath } from './svg-path.js';
import { singleLine, textLength, wrap } from './text-layout.js';

import { canonicalType } from './profiles.js';
import { groupByParent } from './graph-index.js';
import { layoutDiagram } from './diagrams.js';
import { relationshipLabel, relationshipReferences } from './relationship-labels.js';
import { DEFAULT_CURVE, routingOptions, sidePort } from './routing-options.js';
import { pathSamples, labelOnPath, shiftLabelAcrossPath, attachReferenceNodes } from './reference-nodes.js';
import { layoutMeta } from './meta.js';
import { normalizeColor } from './colors.js';
import { layoutTree } from './tree.js';
import {resolvePlacements} from './placement.js';
import {resolveVia} from './via.js';
import {nodeProperties,positionProperties} from './property-fields.js';
import {shareEdgePaths} from './shared-paths.js';
import {resolveStyleExpressions} from './style-expressions.js';
import {routeStyle} from './route-styles.js';
import {geometrySource, rememberGeometry} from './draft-geometry.js';
import {clearRouteLabels, detourAroundCards} from './route-clearance.js';

// A measured card's width/height include content and placement. Keep the
// resolved explicit style values separately for qualified .style references.
const explicitCardStyles = new WeakMap();

const fail = (message, loc) => { throw new ArchError(message, loc, 'ARCH_VALIDATION'); };
const cardClearance = 24;
const intersects = (a, b, margin = cardClearance) => a.x < b.x + b.width + margin && a.x + a.width + margin > b.x &&
  a.y < b.y + b.height + margin && a.y + a.height + margin > b.y;

function arrange(items, edges, direction, spacing, places, nodesById) {
  if (!items.length) return;
  const outgoing = new Map(items.map(n => [n.id, new Set()]));
  const incoming = new Map(items.map(n => [n.id, 0]));
  const representatives = new Map();
  // An edge to a nested card ranks its containing sibling at this level.
  // Cache the ancestor lookup per group, including edges that leave the group.
  const representative = (id) => {
    if (representatives.has(id)) return representatives.get(id);
    let node = nodesById.get(id);
    while (node && !outgoing.has(node.id)) node = nodesById.get(node.parent);
    representatives.set(id, node?.id);
    return node?.id;
  };
  for (const edge of edges) {
    const a = representative(edge.source), b = representative(edge.target);
    if (!a || !b || a === b || outgoing.get(a).has(b)) continue;
    outgoing.get(a).add(b);
    incoming.set(b, incoming.get(b) + 1);
  }
  const remaining = new Set(outgoing.keys()), ranks = new Map(items.map(n => [n.id, 0]));
  const ready = [...remaining].filter(id => incoming.get(id) === 0);
  let head = 0;
  // Kahn's walk updates a successor only when an incoming edge is removed.
  // When the queue empties, break a cycle at the first remaining source item.
  // That tie-break preserves deterministic ranks for cyclic/disconnected graphs.
  while (remaining.size) {
    const id = head < ready.length ? ready[head++] : remaining.values().next().value;
    remaining.delete(id);
    const nextRank = ranks.get(id) + 1;
    for (const target of outgoing.get(id)) {
      if (!remaining.has(target)) continue;
      ranks.set(target, Math.max(ranks.get(target), nextRank));
      const degree = incoming.get(target) - 1;
      incoming.set(target, degree);
      if (!degree) ready.push(target);
    }
  }
  const down = direction === 'down', primarySize = down ? 'height' : 'width', secondarySize = down ? 'width' : 'height';
  const rankWidths = new Map();
  for (const item of items) rankWidths.set(ranks.get(item.id), Math.max(rankWidths.get(ranks.get(item.id)) ?? 0, item[primarySize]));
  const offsets = new Map(); let offset = 0;
  for (const rank of [...rankWidths.keys()].sort((a, b) => a - b)) { offsets.set(rank, offset); offset += rankWidths.get(rank) + spacing; }
  const fixed = items.filter(n => places[n.id]).map(n => Object.assign(n, places[n.id].at));
  const stacks = new Map();
  const gap = Math.max(cardClearance, spacing / 2);
  // Automatic ranks have at least cardClearance between their primary bands.
  // Within one rank, stacks already guarantee clearance. Only explicitly
  // placed cards can intersect a new automatic card. The minimum gap also
  // ensures a collision retry always advances at low spacing settings.
  for (const item of items) {
    if (places[item.id]) continue;
    const rank = ranks.get(item.id), primary = offsets.get(rank);
    let secondary = stacks.get(rank) ?? 0;
    const setPosition = () => { item.x = down ? secondary : primary; item.y = down ? primary : secondary; };
    setPosition();
    let collision;
    while ((collision = fixed.find(other => intersects(item, other)))) {
      secondary = (down ? collision.x + collision.width : collision.y + collision.height) + gap;
      setPosition();
    }
    stacks.set(rank, secondary + item[secondarySize] + gap);
  }
}

function port(box, side, other) {
  let position = 0.5;
  if (side && typeof side === 'object') {
    if (!Object.hasOwn(side, 'side')) return side;
    position = side.position; side = side.side;
  }
  if (!side || side === 'auto') {
    const dx = other.x + other.width / 2 - box.x - box.width / 2;
    const dy = other.y + other.height / 2 - box.y - box.height / 2;
    side = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
  }
  return sidePort(box,side,position);
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

function routeEdge(edge, source, target, route, parallel, cards) {
  const curve = route.curve ?? DEFAULT_CURVE;
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
  }
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
  if (cards && route.avoidObstacles && !route.via && source!==target && source.id!==target.id && ['rounded','orthogonal'].includes(curve))
    points=detourAroundCards(points,source,target,cards)??points;
  if (curve === 'bezier' && source.id !== target.id) {
    const controls = route.via ?? points.slice(1, 3);
    d = cubicPath(a,controls[0],controls[1],b);
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
  for(const key of ['curve','sharePath'])if(options?.[key]!==undefined&&view.routes[id]?.[key]===undefined)route[key]=options[key];
  return route;
}

function edgeLabelMetrics(edge,route,profile,modelNodes) {
  const result={},labelHidden=route.label==='none';
  result.labelHidden=labelHidden;result.labelExplicit=route.label!==undefined;
  const omit=edge.referenceDisplay==='nodes'?new Set(edge.referenceItems.map(item=>`${item.attribute}\0${item.modelId??item.id}`)):new Set();
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

export function layoutView(document, viewId) {
  const { model, profile, views, graph, plans } = document;
  const view = views.get(viewId);
  if(view.meta!==undefined)return layoutMeta(model,profile,view);
  const draft = document.mode === 'draft';
  const projection = graph.project(view), visible = projection.ids;
  const { styles: stylePlan, placement: positions, routeReferences, presentation, statePlacement } = plans.get(viewId);
  const trees = presentation?.trees ?? view.trees ?? {};
  // Reuse validation for embedded views. Each layout still owns its positioned
  // cards and paths because hosts can translate and resize their local copies.
  const embedded = new Map(Object.entries(view.embeddings ?? {}).map(([id, spec]) => [id, layoutView(document, spec.view)]));
  const embeddedCards = new Map();
  for (const [id, child] of embedded) {
    const group = presentation.groups.get(id);
    for (const node of child.nodes) {
      embeddedCards.set(group.get(node.id).id, node);
    }
  }
  const measureNode = (n,style=view.styles[n.id]??{}) => {
    const existing = embeddedCards.get(n.id);
    if (existing) {
      const card = { ...existing, id:n.id };
      if (n.modelId) card.modelId = n.modelId;
      const explicit = explicitCardStyles.get(existing);
      if (explicit) explicitCardStyles.set(card, explicit);
      return card;
    }
    const definition = profile.nodeTypes[n.type];
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
    const card = { ...n, icon: n.icon ?? definition.icon, ...style,
      showBackgroundImage: style.showBackgroundImage ?? view.showBackgroundImage ?? false,
      accent: normalizeColor(style.accent ?? n.accent ?? definition.accent),
      backgroundColor: normalizeColor(style.backgroundColor ?? definition.backgroundColor ?? profile.styleGroups?.[definition.styleGroup]?.backgroundColor),
      container: definition.container, template, width, height, textStyle, iconBox, titleLines, badgeText, badgeLines, descLines, technologyLines,propertyRows, x: 0, y: 0 };
    if (style.width !== undefined || style.height !== undefined || style.fontSize !== undefined) explicitCardStyles.set(card, style);
    return card;
  };
  const resolvedStyles=resolveStyleExpressions(stylePlan,view,measureNode,embeddedCards,explicitCardStyles);
  const nodes=(presentation?.nodes??projection.nodes).map(n=>resolvedStyles?.measured.get(n.id)??measureNode(n,resolvedStyles?.styles[n.id]??view.styles[n.id]??{}));
  const byId = new Map(nodes.map(n => [n.id, n]));
  if (draft) for (const card of nodes) {
    const embeddedCard = embeddedCards.get(card.id);
    const style = view.styles[card.id], place = view.places[card.id];
    if (embeddedCard) rememberGeometry(card, geometrySource(embeddedCard));
    else if (style || place) rememberGeometry(card, {style,place,resolvedStyle:resolvedStyles?.styles[card.id]});
  }
  const modelNodes = graph.nodesById;
  const edges = (presentation?.edges ?? projection.edges).map(edge => {
    const type = edge.type ?? profile.defaultRelation;
    const rule = profile.relationTypes[type];
    const referenceDisplay = view.referenceDisplay ?? rule.referenceDisplay ?? 'labels';
    const referenceItems = referenceDisplay === 'labels' ? [] : presentation?.referenceItems.get(edge.id) ??
      relationshipReferences(edge, rule).filter(item => byId.has(item.id) && !byId.get(item.id).container);
    const referenceOccurrences = view.referenceOccurrences ?? rule.referenceOccurrences ?? 'shared';
    return { ...edge, type, ...(rule.aliasOf ? { canonicalType: canonicalType(type, profile.relationTypes) } : {}), style: rule.style, referenceDisplay, referenceOccurrences, referenceItems, ...(rule.referenceConnectorLabels ? {referenceConnectorLabels:true} : {}), labelText: relationshipLabel(edge, rule, modelNodes) };
  });
  if (view.diagram?.type === 'tree') {
    const tree = layoutTree(model,profile,view,nodes,edges);
    for (const card of tree.nodes) {
      const explicit = explicitCardStyles.get(byId.get(card.id));
      if (explicit) explicitCardStyles.set(card, explicit);
      if (draft) rememberGeometry(card, geometrySource(byId.get(card.id)));
    }
    return tree;
  }
  if (view.diagram && view.diagram.type !== 'connected') return layoutDiagram(model, profile, view, nodes, edges, positions,
    ['state','activity'].includes(view.diagram.type) ? graph.project(view,false).edges : undefined,statePlacement,document);
  const groupStates=[],treeEdges=new Map();
  const initialPlaces=Object.fromEntries(Object.entries(view.places).map(([id,p])=>[id,{...p,at:{x:typeof p.at.x==='number'?p.at.x:0,y:typeof p.at.y==='number'?p.at.y:0}}]));
  for(const [id,options]of Object.entries(trees)) {
    const members=options.nodes.map(id=>byId.get(id)).filter(Boolean);if(!members.length)continue;
    const ids=new Set(members.map(n=>n.id)),parents=new Map(members.map(n=>[n.id,n.parent]));
    const localEdges=options._embed?[]:edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(edge=>{
      const route=treeGroupRoute(view,edge.id,options);
      return {...edge,treeLabel:edgeLabelMetrics(edge,route,profile,modelNodes)};
    });
    const local=options._embed?embedded.get(id):layoutTree(model,profile,{...view,diagram:{type:'tree',...options}},members,localEdges,{sharePaths:false});
    const occurrences = presentation?.groups.get(id);
    const localIds = new Map(local.nodes.map(node => [node.id, occurrences?.get(node.id).id ?? node.id]));
    if (options._embed) for (const item of local.nodes) {
      parents.set(localIds.get(item.id), item.parent ? localIds.get(item.parent) ?? null : item.parent);
    }
    const proxy={id,parent:options._embed?null:parents.get(members[0].id),virtualTreeGroup:true,container:false,width:local.bounds.width,height:local.bounds.height,x:0,y:0};
    for(const item of local.nodes) {
      const card = byId.get(localIds.get(item.id));
      if (!options._embed) Object.assign(card, item);
      Object.assign(card, {parent:id,treeGroup:id,x:item.x-local.bounds.x,y:item.y-local.bounds.y});
    }
    nodes.push(proxy);byId.set(id,proxy);groupStates.push({id,options,local,proxy,parents,localIds});
  }
  const referenced = new Set(edges.flatMap(e => e.referenceItems.map(item => item.id)));
  const endpoints = new Set(edges.flatMap(e => [e.source, e.target]));
  const positionTargets = new Set(routeReferences);
  for (const terms of positions?.expressions.values() ?? []) {
    for (const term of terms) if (term.ref !== undefined) positionTargets.add(term.ref);
  }
  for(const parsed of stylePlan?.expressions.values()??[])for(const term of parsed)if(term.ref!==undefined&&!term.field.startsWith('style.'))positionTargets.add(term.ref);
  for (const node of nodes) if (referenced.has(node.id) && !endpoints.has(node.id) && !node.parent && !node.container && !view.places[node.id]&&!positionTargets.has(node.id)) node.referenceOnly = true;
  const childrenByParent = groupByParent(nodes);
  const process = (parent) => {
    const children = (childrenByParent.get(parent) ?? []).filter(n => !n.referenceOnly);
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
    for (const node of childrenByParent.get(parent) ?? []) {
      node.x += x; node.y += y;
      if(node.virtualTreeGroup)absolute(node.id,node.x,node.y);
      else if (node.container) absolute(node.id, node.x + node.contentOffset.x, node.y + node.contentOffset.y);
    }
  };
  absolute(null, 0, 0);
  const treeGroups=[],embeddedReferences=[],embeddingGroups=[],embeddedEdges=new Map();
  for(const state of groupStates) {
    const {id,options,local,proxy,parents,localIds}=state,dx=proxy.x-local.bounds.x,dy=proxy.y-local.bounds.y;
    for(const occurrenceId of localIds.values())byId.get(occurrenceId).parent=parents.get(occurrenceId);
    if(options._embed){
      const shiftPoint=p=>({...p,x:p.x+dx,y:p.y+dy});
      const localEdgeIds = new Map();
      for (const edge of local.edges) {
        const occurrence = presentation.edgeGroups.get(id).get(edge.id);
        if (!occurrence) continue;
        const { id:edgeId, modelId } = occurrence;
        localEdgeIds.set(edge.id, edgeId);
        const shifted = { ...edge, id:edgeId, source:localIds.get(edge.source), target:localIds.get(edge.target),
          drawD:undefined, drawStart:undefined, drawEnd:undefined, points:edge.points.map(shiftPoint),
          d:svgpath(edge.d).translate(dx,dy).toString(), label:shiftPoint(edge.label), embeddedGroup:id };
        if (draft) rememberGeometry(shifted, geometrySource(edge));
        if (edgeId !== modelId) shifted.modelId = modelId;
        else delete shifted.modelId;
        if (!embeddedEdges.has(modelId)) embeddedEdges.set(modelId, []);
        embeddedEdges.get(modelId).push(shifted);
        treeEdges.set(edgeId, shifted);
      }
      const shiftedCards = new Map();
      for (const ref of local.referenceNodes ?? []) {
        if (!localEdgeIds.has(ref.edgeId)) continue;
        const nodeId = localIds.get(ref.nodeId), semantic = byId.get(nodeId);
        if (!shiftedCards.has(ref.node)) {
          const node = { ...ref.node, id:nodeId, x:ref.node.x+dx, y:ref.node.y+dy };
          if (semantic.modelId) node.modelId = semantic.modelId;
          shiftedCards.set(ref.node, node);
        }
        embeddedReferences.push({ ...ref, nodeId, node:shiftedCards.get(ref.node), embeddedGroup:id,
          edgeId:localEdgeIds.get(ref.edgeId), edgeIds:ref.edgeIds.filter(key => localEdgeIds.has(key)).map(key => localEdgeIds.get(key)),
          anchor:shiftPoint(ref.anchor), points:ref.points.map(shiftPoint),
          ...(ref.d ? { d:svgpath(ref.d).translate(dx,dy).toString() } : {}),
          ...(ref.connectorLabel ? { connectorLabel:shiftPoint(ref.connectorLabel) } : {}) });
      }
      for(const g of local.embeddingGroups??[])embeddingGroups.push({...g,id:`${id}.${g.id}`,owner:id,bounds:{...g.bounds,x:g.bounds.x+dx,y:g.bounds.y+dy}});
      embeddingGroups.push({id,title:local.view.title,frame:view.embeddings[id].frame===true,
        ...(local.view.backgroundImage?{backgroundImage:local.view.backgroundImage}:{}),
        bounds:{x:proxy.x,y:proxy.y,width:proxy.width,height:proxy.height}});
    } else for(const edge of local.edges) {
      const points=edge.points.map(p=>({x:p.x+dx,y:p.y+dy}));
      treeEdges.set(edge.id,{...edge,points,d:polyPath(points,(options.curve??DEFAULT_CURVE)==='rounded'),label:{x:edge.label.x+dx,y:edge.label.y+dy},treeGroup:id});
    }
    treeGroups.push({id,parent:proxy.parent,nodes:[...localIds.values()],...local.tree,bounds:{x:proxy.x,y:proxy.y,width:proxy.width,height:proxy.height}});
    nodes.splice(nodes.indexOf(proxy),1);byId.delete(id);
  }
  // Align automatic top-level context cards beside their closest tree member.
  // Explicit place statements and semantic package bounds remain authoritative.
  if (treeGroups.length) {
    const groupsById = new Map(treeGroups.map(group=>[group.id,group]));
    const anchors = new Map();
    // First matching edge wins, in source order as in the original search.
    for (const {source,target} of edges) {
      const from = byId.get(source), to = byId.get(target);
      if (to?.treeGroup && !anchors.has(source)) anchors.set(source,to);
      if (from?.treeGroup && !anchors.has(target)) anchors.set(target,from);
    }
    for(const node of nodes)if(!node.treeGroup&&!node.container&&!node.parent&&!view.places[node.id]) {
      const anchor=anchors.get(node.id);
      if(!anchor)continue;
      const group=groupsById.get(anchor.treeGroup);
      if(group.parent)continue;
      const vertical=['up','down'].includes(group.orientation),gap=view.spacing;
      node.x=vertical?group.bounds.x-gap-node.width:anchor.x+(anchor.width-node.width)/2;
      node.y=vertical?anchor.y+(anchor.height-node.height)/2:group.bounds.y+group.bounds.height+gap;
      while(nodes.some(n=>n!==node&&intersects(node,n)))if(vertical)node.y+=node.height+gap;else node.x+=node.width+gap;
    }
  }
  const groupOrigins=new Map(groupStates.map(s=>[s.id,{x:s.proxy.x,y:s.proxy.y}]));
  resolvePlacements(view,nodes,groupStates,positions);
  for(const group of treeGroups) {
    const proxy=groupStates.find(s=>s.id===group.id).proxy,old=groupOrigins.get(group.id),dx=proxy.x-old.x,dy=proxy.y-old.y;
    group.bounds={x:proxy.x,y:proxy.y,width:proxy.width,height:proxy.height};
    const embeddedGroup = embeddingGroups.find(g => g.id === group.id);
    if (embeddedGroup) {
      embeddedGroup.bounds = { ...group.bounds };
      for (const child of embeddingGroups) if (child.owner === group.id) {
        child.bounds.x += dx;
        child.bounds.y += dy;
      }
      const movedCards = new Set();
      for (const ref of embeddedReferences) if (ref.embeddedGroup === group.id) {
        if (!movedCards.has(ref.node)) {
          ref.node.x += dx;
          ref.node.y += dy;
          movedCards.add(ref.node);
        }
        ref.anchor.x += dx;
        ref.anchor.y += dy;
        ref.points = ref.points.map(p => ({ ...p, x:p.x+dx, y:p.y+dy }));
        if (ref.d) ref.d = svgpath(ref.d).translate(dx,dy).toString();
        if (ref.connectorLabel) {
          ref.connectorLabel.x += dx;
          ref.connectorLabel.y += dy;
        }
      }
    }
    for(const edge of treeEdges.values())if(edge.treeGroup===group.id||edge.embeddedGroup===group.id) {
      if(edge.embeddedGroup){edge.d=svgpath(edge.d).translate(dx,dy).toString();if(edge.drawD)edge.drawD=svgpath(edge.drawD).translate(dx,dy).toString();}
      edge.points=edge.points.map(p=>({x:p.x+dx,y:p.y+dy}));edge.label={x:edge.label.x+dx,y:edge.label.y+dy};
    }
  }
  const parallel = new Map();
  const routeBoxes=new Map([...byId,...treeGroups.map(g=>[g.id,g.bounds])]);
  for (const [name, cards] of presentation?.byName ?? []) {
    if (cards.length === 1) routeBoxes.set(name, byId.get(cards[0].id));
  }
  const resolvedRoutes=new Map();
  const hostEdges = edges.map(edge => {
    const { source, target } = edge;
    const key = source < target ? `${source}\0${target}` : `${target}\0${source}`;
    const count = parallel.get(key) ?? 0;
    parallel.set(key, count + 1);
    const preset=treeEdges.get(edge.id);
    const groupOptions=preset?trees[preset.treeGroup]:null;
    const inputRoute = groupOptions?treeGroupRoute(view,edge.id,groupOptions):routingOptions(view,view.routes[edge.id]);
    const route = resolveVia(inputRoute??{},routeBoxes,edge);
    resolvedRoutes.set(edge.id,route);
    const labelHidden = route.label === 'none',relativeLabel=typeof route.label==='number'||route.label&&typeof route.label==='object'&&Object.hasOwn(route.label,'position');
    const manual=preset&&['from','to','via','path'].some(key=>route[key]!==undefined)||route.curve==='bezier'||route.curve==='straight';
    const result=preset&&!manual?{...preset,label:route.label&&route.label!=='none'&&!relativeLabel?route.label:preset.label}:routeEdge(edge, byId.get(edge.source), byId.get(edge.target), {...route, label: labelHidden||relativeLabel ? undefined : route.label}, count,nodes);
    if(preset&&!manual) {
      route.curve??=DEFAULT_CURVE;
      result.d=polyPath(preset.points,route.curve==='rounded');
    }
    Object.assign(result,edgeLabelMetrics(edge,route,profile,modelNodes),routeStyle(route));
    if (draft && inputRoute) rememberGeometry(result, {route:inputRoute,resolvedRoute:route});
    return result;
  });
  const hostById = embedded.size ? new Map(hostEdges.map(edge => [edge.id, edge])) : null;
  const routedEdges = embedded.size ? projection.edges.flatMap(edge => embeddedEdges.get(edge.id) ??
    (hostById.has(edge.id) ? [hostById.get(edge.id)] : [])) : hostEdges;
  const sharedPaths=shareEdgePaths(routedEdges,nodes,resolvedRoutes);
  if ([...resolvedRoutes.values()].some(route=>route.avoidObstacles)) clearRouteLabels(routedEdges,nodes,resolvedRoutes);
  const sideOffsets=[];
  for (const edge of routedEdges) {
    const {label,sideOffset}=resolvedRoutes.get(edge.id)??{};
    const relative=typeof label==='number' || label && Object.hasOwn(label,'position');
    if (!relative && !sideOffset) continue;
    const samples=pathSamples(edge.d);
    const anchor=relative ? labelOnPath(samples,label) : {...edge.label};
    if (relative) edge.label={x:anchor.x,y:anchor.y};
    if (sideOffset && (edge.labelLines.length||edge.labelIcon)) sideOffsets.push({edge,samples,anchor,sideOffset});
  }
  const referenceNodes = attachReferenceNodes(nodes, hostEdges, presentation ? {...view, referenceRoutes:presentation.referenceRoutes} : view, wrap, (card, anchor, route) =>
    routeEdge({}, card, {id: null, ...anchor, width: 0, height: 0}, {...route, to: {x: anchor.x, y: anchor.y}}, 0),route=>resolveVia(route,routeBoxes));
  for (const {edge,samples,anchor,sideOffset} of sideOffsets)
    edge.label=shiftLabelAcrossPath(edge.label,samples,anchor,sideOffset);
  for (const ref of embeddedReferences) referenceNodes.push(ref);
  const extents = nodes.flatMap(n => [{ x: n.x, y: n.y }, { x: n.x + n.width, y: n.y + n.height }]);
  for(const group of embeddingGroups)if(group.frame||group.backgroundImage)extents.push({x:group.bounds.x,y:group.bounds.y},{x:group.bounds.x+group.bounds.width,y:group.bounds.y+group.bounds.height});
  for (const occurrence of referenceNodes) {
    extents.push({x:occurrence.node.x,y:occurrence.node.y},{x:occurrence.node.x+occurrence.node.width,y:occurrence.node.y+occurrence.node.height});
    for (const point of occurrence.points) extents.push(point);
    if (occurrence.connectorLabel) {
      const label=occurrence.connectorLabel;
      extents.push({x:label.x-label.width/2,y:label.y-label.height/2},{x:label.x+label.width/2,y:label.y+label.height/2});
    }
  }
  for (const edge of routedEdges) {
    for (const point of edge.points) extents.push(point);
    if (edge.labelLines.length || edge.labelIcon) extents.push({ x: edge.label.x - edge.labelWidth / 2, y: edge.label.y - edge.labelHeight / 2 },
      { x: edge.label.x + edge.labelWidth / 2, y: edge.label.y + edge.labelHeight / 2 });
  }
  // Markers use stroke-width units. Reserve their conservative maximum reach
  // for thick routes, including reference connectors, without changing defaults.
  let padding = 48;
  for (const edge of routedEdges) padding = Math.max(padding, (edge.width ?? 1.5) * 12);
  for (const ref of referenceNodes) padding = Math.max(padding, (ref.width ?? 1.5) * 12);
  // Fit the visible drawing, not the coordinate origin. Moving the last card
  // away from (0,0) must not leave an empty canvas back to its former position.
  let minX = 0, minY = 0, maxX = 160, maxY = 96;
  if (extents.length) {
    minX = maxX = extents[0].x;
    minY = maxY = extents[0].y;
    for (const {x,y} of extents) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { title: model.title, description: model.description, profile: { id: profile.id, version: profile.version }, view, nodes, edges: routedEdges,
    referenceNodes,...(embeddingGroups.length?{embeddingGroups}:{}),...(sharedPaths.length?{sharedPaths}:{}),...(treeGroups.length?{treeGroups}:{}),
    bounds: { x:minX-padding, y:minY-padding, width:(maxX+padding)-(minX-padding), height:(maxY+padding)-(minY-padding) } };
}
