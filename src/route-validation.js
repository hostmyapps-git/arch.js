import { ArchError } from './errors.js';
import { routingOptions } from './routing-options.js';
import { relationshipReferences } from './relationship-labels.js';
import { validateRouteStyle } from './route-styles.js';
import { findCard } from './view-occurrences.js';

const fail = (message, loc) => { throw new ArchError(message, {...loc, help:'@help routing'}, 'ARCH_VALIDATION'); };

// Route declarations are checked even for hidden relationships. Validation of
// their effective merge follows: a default curve and a route-local via can
// each be legal on its own, yet invalid together.
export function validateViewRoutes(view, profile, { nodesById: nodes, edgesById: edges }, catalog) {
  const referenceRoutes = view.referenceRoutes ?? [], referenceRouteMap = new Map();
  for (const route of referenceRoutes) {
    const modelId = nodes.has(route.nodeId) ? route.nodeId : findCard(catalog, route.nodeId, route.loc)?.node.id;
    if (!modelId) fail(`Unknown reference element: ${route.nodeId}`, route.loc);
    const edge = edges.get(route.edgeId);
    if (!edge) fail(`Unknown relationship: ${route.edgeId}`, route.loc);
    const key = JSON.stringify([modelId, route.edgeId]);
    if (referenceRouteMap.has(key)) fail(`Duplicate reference route: ${route.nodeId} -> ${route.edgeId}`, route.loc);
    referenceRouteMap.set(key, route);
    const rule = profile.relationTypes[edge.type ?? profile.defaultRelation] ?? {};
    if (!relationshipReferences(edge, rule).some(item => item.id === modelId) || profile.nodeTypes[nodes.get(modelId).type]?.container)
      fail(`Element ${route.nodeId} is not a graphical reference of relationship ${route.edgeId}`, route.loc);
  }
  for (const [id, route] of Object.entries(view.routes)) if (!edges.has(id)) fail(`Unknown relationship: ${id}`, route.loc);
  const checkRouting = (route, reference = false, defaults = false) => {
    if (!route) return;
    validateRouteStyle(route);
    if (route.avoidObstacles !== undefined && typeof route.avoidObstacles !== 'boolean')
      fail('avoidObstacles must be true or false',route.loc);
    if (route.crossings!==undefined && (reference || !['bridge','none'].includes(route.crossings)))
      fail('crossings must be bridge or none on a relationship route or in routes defaults',route.loc);
    if (route.crossingRadius!==undefined && (reference || !Number.isFinite(route.crossingRadius) || route.crossingRadius<2 || route.crossingRadius>24))
      fail('crossingRadius must be a number between 2 and 24 on a relationship route or in routes defaults',route.loc);
    for (const field of ['source', 'target']) {
      if (route[field] === undefined) continue;
      if (reference || defaults || typeof route[field] !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(route[field]))
        fail(`${field} requires a card ID on an individual relationship route`, route.loc);
    }
    if (route.sharePath !== undefined && !['none', 'stereotypes', 'all'].includes(route.sharePath)) fail('sharePath must be none, stereotypes or all', route.loc);
    for (const key of ['from', ...(!reference ? ['to'] : [])]) {
      const endpoint = route[key];
      if (endpoint === undefined || defaults && key === 'to' && typeof endpoint === 'number') continue;
      if (typeof endpoint === 'string') {
        if (!['auto', 'top', 'right', 'bottom', 'left'].includes(endpoint)) fail(`Unknown port: ${endpoint}`, route.loc);
      } else if (endpoint && typeof endpoint === 'object' && !Array.isArray(endpoint)) {
        if (Object.hasOwn(endpoint, 'side') || Object.hasOwn(endpoint, 'position')) {
          if (!['top', 'right', 'bottom', 'left'].includes(endpoint.side)) fail('Positioned port side must be top, right, bottom or left', route.loc);
          if (typeof endpoint.position !== 'string' && (!Number.isFinite(endpoint.position) || endpoint.position < 0 || endpoint.position > 1)) fail('Port position must be a number or an expression that evaluates to a value between 0 and 1', route.loc);
          if (Object.keys(endpoint).some(key => !['side', 'position'].includes(key))) fail('Positioned port accepts only side and position', route.loc);
        } else if (!['x', 'y'].every(key => typeof endpoint[key] === 'string' || Number.isFinite(endpoint[key]) && Math.abs(endpoint[key]) <= 1e7) || Object.keys(endpoint).some(key => !['x', 'y'].includes(key))) fail('Port must be a side, a positioned side or an absolute point (X, Y)', route.loc);
      } else fail('Port must be a side, a positioned side or an absolute point (X, Y)', route.loc);
    }
    if ((reference && route.to !== undefined && typeof route.to !== 'string' || defaults && typeof route.to === 'number') &&
      (!Number.isFinite(route.to) || route.to < 0 || route.to > 1))
      fail('Reference route to must be a number or an expression that evaluates to a value between 0 and 1', route.loc);
    for (const key of ['showIcon', 'showLabel']) if (route[key] !== undefined && typeof route[key] !== 'boolean') fail(`${key} must be true or false`, route.loc);
    if (route.sideOffset!==undefined && typeof route.sideOffset!=='string' &&
      (!Number.isFinite(route.sideOffset)||Math.abs(route.sideOffset)>1e7))
      fail('sideOffset must be a finite offset within ±10000000',route.loc);
    if(route.label!==undefined&&route.label!=='none') {
      if(typeof route.label==='number'){if(!Number.isFinite(route.label)||route.label<0||route.label>1)fail('label path position must be between 0 and 1',route.loc);}
      else if(route.label&&typeof route.label==='object'&&Object.hasOwn(route.label,'position')) {
        const {position}=route.label;
        const offsets=Object.keys(route.label).filter(key=>key!=='position');
        if (!Number.isFinite(position)||position<0||position>1||!offsets.length)
          fail('label requires a position from 0 to 1 and offset or sideOffset',route.loc);
        for (const key of offsets) {
          if (key!=='offset'&&key!=='sideOffset') fail(`Unknown label option: ${key}`,route.loc);
          const value=route.label[key];
          if (typeof value!=='string'&&(!Number.isFinite(value)||Math.abs(value)>1e7))
            fail(`label ${key} must be a finite offset within ±10000000`,route.loc);
        }
      }
      else if(!route.label||typeof route.label!=='object'||Array.isArray(route.label)||Object.keys(route.label).some(k=>!['x','y'].includes(k))||!['x','y'].every(k=>route.label[k]!==undefined))fail('label must be none, a path position from 0 to 1, or a point (X, Y)',route.loc);
    }
    if (route.icon !== undefined && (typeof route.icon !== 'string' || route.icon !== 'none' && !/^[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(route.icon))) fail('icon must be PACK.NAME or none', route.loc);
    if (route.iconPosition !== undefined && !['top', 'left', 'bottom', 'right'].includes(route.iconPosition)) fail('iconPosition must be top, left, bottom or right', route.loc);
    if (route.curve !== undefined && !['orthogonal', 'straight', 'rounded', 'bezier'].includes(route.curve)) fail(`Unknown curve: ${route.curve}`, route.loc);
  };
  const isBezier = route => route?.curve === 'bezier';
  const checkBezier = route => {
    if (isBezier(route) && route.via && route.via.length !== 2)
      fail('bezier requires exactly two control points', route.loc);
  };
  const routes = Object.values(view.routes);
  checkRouting(view.routeDefaults, false, true);
  for (const route of routes) checkRouting(route);
  for (const route of Object.values(view.virtualRoutes ?? {})) {
    checkRouting(route);
    checkBezier(route);
  }
  for (const route of referenceRoutes) checkRouting(route, true);

  // Everything except the combination of curve and control points is already
  // validated on the source declarations. Skip merging automatic routes.
  if (!isBezier(view.routeDefaults) && !routes.some(isBezier) && !referenceRoutes.some(isBezier)) return;
  for (const edge of edges.values()) {
    checkBezier(routingOptions(view, view.routes[edge.id]));
    if (!isBezier(view.routeDefaults) && !referenceRoutes.length) continue;
    const rule = profile.relationTypes[edge.type ?? profile.defaultRelation] ?? {};
    for (const item of relationshipReferences(edge, rule))
      checkBezier(routingOptions(view, referenceRouteMap.get(JSON.stringify([item.id, edge.id])), true));
  }
}
