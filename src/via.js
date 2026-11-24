import {ArchError} from './errors.js';
import {coordinateTerms,evaluateCoordinate,boxCoordinate} from './placement.js';
import {routingOptions} from './routing-options.js';
import {relationshipReferences} from './relationship-labels.js';
import { findCard } from './view-occurrences.js';

const fail=(message,loc)=>{throw new ArchError(message,loc,'ARCH_ROUTING');};
const endpointFields = ['from', 'to'];
const calculatedPoint = point => typeof point?.x === 'string' || typeof point?.y === 'string';
const calculatedEndpoint = endpoint => typeof endpoint?.position === 'string' || calculatedPoint(endpoint);
// The target of a reference route is a scalar position along another path.
const calculatedAttachment = route => route?.edgeId !== undefined && typeof route.to === 'string';
const virtualEndpoints = new Set(['routeSource','routeTarget']);

export function routingReferences(route,known) {
  if(!route)return [];
  if(route.via!==undefined&&!Array.isArray(route.via))fail('via requires a list of coordinate pairs',route.loc);
  const refs=[];
  const collectCoordinate = (value, context) => {
    for (const term of coordinateTerms(value, route.loc, known)) {
      if (term.ref !== undefined) refs.push({...term,context});
    }
  };
  const collectPoint = (point, context) => {
    if(!point||typeof point!=='object')fail('Route coordinates require pairs (X, Y)',route.loc);
    collectCoordinate(point.x, context);
    collectCoordinate(point.y, context);
  };
  if (route.path === undefined) {
    if (calculatedAttachment(route)) collectCoordinate(route.to, 'reference route to');
    for (const field of endpointFields) {
      const endpoint = route[field];
      if (typeof endpoint?.position === 'string') collectCoordinate(endpoint.position, field);
      else if (calculatedPoint(endpoint)) collectPoint(endpoint, field);
    }
    for (const point of route.via ?? []) collectPoint(point, 'via');
  }
  if (route.label && typeof route.label === 'object') {
    if (Object.hasOwn(route.label, 'position')) {
      for (const name of ['offset','sideOffset']) if (Object.hasOwn(route.label,name))
        collectCoordinate(route.label[name],`label ${name}`);
    } else collectPoint(route.label, 'label');
  }
  if (route.sideOffset!==undefined) collectCoordinate(route.sideOffset,'sideOffset');
  return refs;
}

// Effective route coordinates pin graphical reference cards as anchors.
// Hidden/overridden routes retain their source without requiring hidden geometry.
export function viaReferences(graph,profile,view,presentation) {
  const targets = new Set();
  let known, withEndpoints, hasReferences = false;
  for (const route of [view.routeDefaults, ...Object.values(view.routes), ...(view.referenceRoutes ?? [])]) {
    if (route?.via === undefined && route?.sideOffset===undefined && !(route?.label && typeof route.label === 'object') &&
      !calculatedAttachment(route) && !endpointFields.some(field=>calculatedEndpoint(route?.[field]))) continue;
    known ??= new Set([...graph.nodesById.keys(), ...Object.keys(view.trees ?? {}), ...(presentation?.byName.keys() ?? [])]);
    const local = (view.diagram?.type ?? 'connected') === 'connected' && route !== view.routeDefaults && route.edgeId===undefined;
    const names = local ? (withEndpoints ??= new Set([...known,...virtualEndpoints])) : known;
    for (const ref of routingReferences({ ...route, path:undefined }, names)) {
      if (local && !known.has(ref.ref) && virtualEndpoints.has(ref.ref)) { hasReferences = true; continue; }
      if (!known.has(ref.ref)) fail(`Unknown ${ref.context} reference: ${ref.ref}; use a node or tree group ID`, route.loc);
      hasReferences = true;
    }
  }
  // Effective defaults can discard coordinates, but they cannot introduce
  // references that are absent from every source statement.
  if (!hasReferences) return targets;
  const { ids:visible, edges } = graph.project(view), available = new Set(presentation?.byId.keys() ?? visible);
  for(const [id,tree]of Object.entries(view.trees??{}))if(tree.nodes.some(n=>visible.has(n)))available.add(id);
  const collect=(route,edge)=>{
    const names = edge && (view.diagram?.type ?? 'connected')==='connected'
      ? (withEndpoints ??= new Set([...known,...virtualEndpoints])) : known;
    for(const ref of routingReferences(route,names)) {
      if (edge && !known.has(ref.ref) && virtualEndpoints.has(ref.ref)) {
        targets.add(ref.ref==='routeSource' ? edge.source : edge.target);
        continue;
      }
      const id = findCard(presentation, ref.ref, route.loc, 'ARCH_ROUTING')?.id ?? ref.ref;
      if(!available.has(id))fail(`Hidden or excluded ${ref.context} reference: ${ref.ref}; use a visible node or tree group`,route.loc);
      targets.add(id);
    }
  };
  const nodes = graph.nodesById;
  const refRoutes=new Map((presentation?.referenceRoutes??view.referenceRoutes??[]).map(r=>[JSON.stringify([r.nodeId,r.edgeId]),r]));
  for(const edge of presentation?.edges ?? edges) {
    collect(routingOptions(view,view.routes[edge.id]),edge);
    const rule=profile.relationTypes[edge.type??profile.defaultRelation];
    if((view.referenceDisplay??rule.referenceDisplay??'labels')==='labels')continue;
    for(const item of presentation?.referenceItems.get(edge.id) ?? relationshipReferences(edge,rule))if(available.has(item.id)&&!profile.nodeTypes[nodes.get(item.modelId??item.id).type]?.container)
      collect(routingOptions(view,refRoutes.get(JSON.stringify([item.id,edge.id])),true));
  }
  return targets;
}

export function resolveVia(route,boxes,edge) {
  if(!route)return route;
  const endpoint = name => name==='routeSource' ? edge?.source : name==='routeTarget' ? edge?.target : undefined;
  const known = edge ? {has:name => boxes.has(name) || endpoint(name)!==undefined} : boxes;
  const reference=term=>{
    const box=boxes.get(term.ref) ?? boxes.get(endpoint(term.ref));
    if(!box)fail(`Unavailable route coordinate reference: ${term.ref}; use a visible node or group`,route.loc);
    return boxCoordinate(box,term.field);
  };
  const resolve=point=>({x:evaluateCoordinate(point.x,reference,route.loc,known),y:evaluateCoordinate(point.y,reference,route.loc,known)});
  const resolved = {...route,...(route.via&&route.path===undefined?{via:route.via.map(resolve)}:{})};
  if (calculatedAttachment(route)) {
    resolved.to = route.path === undefined ? evaluateCoordinate(route.to, reference, route.loc, known) : undefined;
    if (resolved.to < 0 || resolved.to > 1) fail(`Reference route to must be between 0 and 1, got ${resolved.to}`, route.loc);
  }
  if (route.sideOffset!==undefined) resolved.sideOffset=evaluateCoordinate(route.sideOffset,reference,route.loc,known);
  if (route.label && typeof route.label==='object') {
    if (Object.hasOwn(route.label,'position')) {
      resolved.label={...route.label};
      for (const name of ['offset','sideOffset']) if (Object.hasOwn(route.label,name))
        resolved.label[name]=evaluateCoordinate(route.label[name],reference,route.loc,known);
    } else resolved.label=resolve(route.label);
  }
  for (const field of endpointFields) {
    const endpoint = route[field];
    if (!calculatedEndpoint(endpoint)) continue;
    // An explicit SVG path can be drawn even if its unused anchors are hidden.
    if (route.path !== undefined) resolved[field] = undefined;
    else if (typeof endpoint.position === 'string') {
      const position = evaluateCoordinate(endpoint.position,reference,route.loc,known);
      if (position < 0 || position > 1) fail(`Port position for ${field} ${endpoint.side} must be between 0 and 1, got ${position}`, route.loc);
      resolved[field] = {side:endpoint.side,position};
    } else resolved[field] = resolve(endpoint);
  }
  return resolved;
}
