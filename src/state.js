import { composite, foreground, DEFAULT_BACKGROUND_OPACITY } from './colors.js';
import { ArchError } from './errors.js';
import { placementPlan, resolvePlacements } from './placement.js';
import { matches } from './profiles.js';
import { DEFAULT_CURVE, fixedPort } from './routing-options.js';
import { cubicPath, polyPath } from './svg-path.js';
import { textLength, wrap } from './text-layout.js';
import { connectPorts, connectWaypoints } from './activity-routing.js';
import { resolveVia, routingReferences } from './via.js';

const transitionRule = (edge, profile) => profile.relationTypes[edge.type ?? profile.defaultRelation];

export function stateProjection(nodes, edges, view, profile, semanticEdges = edges) {
  const tagged = semanticEdges.map(edge => transitionRule(edge, profile)).filter(rule => rule?.stateTrigger);
  const required = (profile.viewpoints?.[view.viewpoint]?.requiredRelations ?? [])
    .map(type => profile.relationTypes[type]).filter(rule => rule?.stateTrigger);
  // Profiles without state transition metadata keep the generic state view.
  if (!tagged.length && !required.length) {
    const {initial,final,virtualInitial,virtualFinal}=view.diagram;
    if (!Array.isArray(virtualFinal) || !virtualFinal.some(spec=>spec?.event)) return {nodes,edges};
    const events=new Set(virtualFinal.map(spec=>spec?.event));
    const endpoints=new Set([initial,...(Array.isArray(final)?final:[]),virtualInitial?.target,...virtualFinal.map(spec=>spec?.source),
      ...edges.flatMap(edge=>[edge.source,edge.target])]);
    return {nodes:nodes.filter(node=>!events.has(node.id)||endpoints.has(node.id)),edges};
  }

  const finals = new Set(view.diagram.final);
  const transitions = edges.filter(edge => transitionRule(edge, profile)?.stateTrigger ||
    edge.source === view.diagram.initial || finals.has(edge.target));
  const endpoints = new Set(transitions.flatMap(edge => [edge.source, edge.target]));
  const rules = [...new Set([...required, ...tagged])];
  const states = nodes.filter(node => node.id === view.diagram.initial || finals.has(node.id) || endpoints.has(node.id) ||
    rules.some(rule => matches(node.type, rule.from, profile.nodeTypes) || matches(node.type, rule.to, profile.nodeTypes)));
  return { nodes: states, edges: transitions };
}

export function stateObjectEvents(edges, profile, view) {
  const checks = (profile.viewpoints[view.viewpoint]?.objectifications ?? []).filter(check => check.stateEventRelations);
  return checks.map(check => {
    const byObject = new Map();
    for (const edge of edges) if (matches(edge.type,check.stateEventRelations,profile.relationTypes)) {
      if (!byObject.has(edge.target)) byObject.set(edge.target,[]);
      byObject.get(edge.target).push(edge.source);
    }
    return {check,byObject};
  });
}

export function stateTransitionLabels(edge, profile, nodesById, objectEvents) {
  const attribute = transitionRule(edge, profile)?.stateTrigger;
  const value = attribute === undefined ? [] : edge.attributes?.[attribute] ?? [];
  const explicit = objectEvents.flatMap(({check,byObject}) => matches(edge.type,check.relations,profile.relationTypes)
    ? byObject.get(edge.attributes?.[check.attribute]) ?? [] : []);
  const names = [value, ...explicit].flat().map(id => nodesById.get(id)?.title || id);
  const stateEvent = [...new Set(names)].join(', ');
  return { stateEvent, stateCaption:[stateEvent,edge.title === stateEvent ? '' : edge.title].filter(Boolean).join('\n') };
}

const virtualPoints = ({diagram}) => [
  ...(diagram.virtualInitial ? [{kind:'initial',spec:diagram.virtualInitial}] : []),
  ...(diagram.virtualFinal??[]).map(spec=>({kind:'final',spec}))
];

export function validateStatePlacement(view,graph,{nodes:states,edges}) {
  const {diagram,virtualPlaces={},virtualRoutes={}}=view;
  const places={...view.places,...virtualPlaces};
  if (diagram.virtualInitial===undefined && diagram.virtualFinal===undefined && !Object.keys(places).length &&
    !Object.keys(view.routes).length && !Object.keys(virtualRoutes).length) return;
  const fail=(message,loc)=>{throw new ArchError(`View ${view.id}: ${message}`,loc??view.loc,'ARCH_VALIDATION');};
  if (diagram.virtualInitial!==undefined && (!diagram.virtualInitial || typeof diagram.virtualInitial!=='object'))
    fail('Invalid virtual initial point');
  if (diagram.virtualFinal!==undefined && !Array.isArray(diagram.virtualFinal)) fail('Virtual finals require a list');
  if (diagram.initial!==undefined && diagram.virtualInitial) fail('Duplicate diagram option: initial',diagram.virtualInitial.loc);
  const points=virtualPoints(view), ids=new Set(), byId=new Map(states.map(n=>[n.id,n]));
  const finals=new Set(diagram.final);
  for (const {kind,spec} of points) {
    const loc=spec?.loc;
    if (typeof spec?.id!=='string' || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(spec.id)) fail('Virtual points require an identifier',loc);
    if (ids.has(spec.id) || graph.nodesById.has(spec.id) || graph.edgesById.has(spec.id)) fail(`Duplicate virtual point ID: ${spec.id}`,loc);
    if (spec.title!==undefined && typeof spec.title!=='string') fail('Virtual point title must be a string',loc);
    const endpoint=kind==='initial'?spec.target:spec.source;
    if (!byId.has(endpoint)) fail(`Unknown or hidden state for virtual ${kind}: ${endpoint}`,loc);
    if (kind==='final' && finals.has(endpoint)) fail('Final nodes cannot have outgoing transitions',loc);
    if (spec.event!==undefined && (kind!=='final' || !graph.nodesById.has(spec.event))) fail(`Unknown virtual transition event: ${spec.event}`,loc);
    ids.add(spec.id);
  }
  const modelRoutes=Object.entries(view.routes), pointRoutes=Object.entries(virtualRoutes);
  if (modelRoutes.length || pointRoutes.length) {
    const known=new Set([...graph.nodesById.keys(),...ids]), renderedEdges=new Set(edges.map(edge=>edge.id));
    const checkRoute=(route,visible)=>{
      for (const {ref,context} of routingReferences(route,known)) {
        if (!known.has(ref)) fail(`Unknown ${context} reference: ${ref}; use a state or virtual point ID`,route.loc);
        if (visible && !byId.has(ref) && !ids.has(ref))
          fail(`Hidden or excluded ${context} reference: ${ref}; use a visible state or virtual point`,route.loc);
      }
    };
    for (const [id,route] of modelRoutes) checkRoute(route,renderedEdges.has(id));
    for (const [id,route] of pointRoutes) {
      if (!ids.has(id)) fail(`Unknown virtual point: ${id}`,route.loc);
      checkRoute(route,true);
    }
  }
  for (const [id,place] of Object.entries(virtualPlaces)) if (!ids.has(id)) fail(`Unknown virtual point: ${id}`,place.loc);
  for (const [id,place] of Object.entries(view.places)) {
    if (!byId.has(id)) fail(`Unknown or hidden state for place: ${id}`,place.loc);
    if (place.size) fail('State placements do not support size',place.loc);
  }
  if (!Object.keys(places).length) return;
  const nodes=[...states.map(({id})=>({id})),...points.map(({spec})=>({id:spec.id}))];
  return placementPlan({nodesById:new Map(nodes.map(node=>[node.id,node])),project:()=>({nodes,edges:[]})},
    null,{...view,places},true);
}

export function appendVirtualStates(view,modelNodes,nodes,edges) {
  const points=virtualPoints(view);
  if (!points.length) return {nodes,edges};
  const virtualNodes=[], virtualEdges=[];
  for (const {kind,spec} of points) {
    const initial=kind==='initial', stateEvent=modelNodes.get(spec.event)?.title??'';
    virtualNodes.push({id:spec.id,title:spec.title??'',type:initial?'Initial':'Final',virtual:kind});
    virtualEdges.push({id:`@virtual:${spec.id}`,virtual:true,type:'StateTransition',title:'',
      source:initial?spec.id:spec.source,target:initial?spec.target:spec.id,stateEvent,stateCaption:stateEvent});
  }
  return {nodes:[...nodes,...virtualNodes],edges:[...edges,...virtualEdges]};
}

const stateWidth = 220, stateHeight = 68, rowPitch = 152;
const captionWidth = 180, captionGap = 10, maxCaptionBox = captionWidth+24, loopInset = 14;
const initialRadius = 10, finalRadius = 16, controlLabelGap = 12;
const trackPitch = maxCaptionBox+captionGap+30;
const point = (x,y) => ({ x,y });
const rowTop = row => 42+row*rowPitch;
const gapCenter = row => rowTop(row)+(stateHeight+rowPitch)/2;
const centerOf = box => point(box.x+box.width/2,box.y+box.height/2);

function cubicPoint([a,b,c,d],t) {
  const u=1-t, w0=u**3, w1=3*u*u*t, w2=3*u*t*t, w3=t**3;
  return point(w0*a.x+w1*b.x+w2*c.x+w3*d.x,w0*a.y+w1*b.y+w2*c.y+w3*d.y);
}

function cubicExtrema(cubic) {
  const extrema=[];
  // A cubic reaches its axis-aligned bounds at the endpoints or roots of
  // its first derivative. The endpoints are already in the sampled stroke.
  for (const axis of ['x','y']) {
    const [a,b,c,d]=cubic.map(p=>p[axis]);
    const first=b-a, second=c-b, third=d-c;
    const quadratic=first-2*second+third, linear=2*(second-first);
    const discriminant=linear**2-4*quadratic*first;
    if (discriminant<0) continue;
    const offset=Math.sqrt(discriminant);
    const roots=quadratic===0 ? [-first/linear] : [
      (-linear-offset)/(2*quadratic), (-linear+offset)/(2*quadratic)
    ];
    for (const t of roots) if (t>0 && t<1) extrema.push(cubicPoint(cubic,t));
  }
  return extrema;
}

function stateCubic(from,to,via,loop) {
  const start=from.at, end=to.at;
  if (via.length) return [start,via[0],via[1],end];
  const reach=Math.max(loop?64:16,Math.hypot(end.x-start.x,end.y-start.y)/2);
  const control=(port,other)=>{
    if (!port.direction) return point((2*port.at.x+other.x)/3,(2*port.at.y+other.y)/3);
    return point(port.at.x+port.direction[0]*reach,port.at.y+port.direction[1]*reach);
  };
  return [start,control(from,end),control(to,start),end];
}

const directionKey=([x,y])=>`${x},${y}`;
function statePort(node,other,used,radius) {
  const at=centerOf(node), target=centerOf(other);
  const dx=target.x-at.x, dy=target.y-at.y;
  const horizontal=[Math.sign(dx)||1,0], vertical=[0,Math.sign(dy)||1];
  const primary=Math.abs(dx)*node.height>Math.abs(dy)*node.width ? [horizontal,vertical] : [vertical,horizontal];
  const directions=[...primary,...primary.map(([x,y])=>[-x,-y])];
  const direction=directions.find(side=>!used?.has(directionKey(side)))??directions[0];
  const prior=used?.get(directionKey(direction))??0;
  const [nx,ny]=direction;
  // Once all sides are in use, spread new ports along the chosen side.
  const offset=prior ? (prior%2?1:-1)*(.13+.16*(1-1/Math.ceil(prior/2)))*(nx?node.height:node.width) : 0;
  const normal=radius?Math.sqrt(radius**2-offset**2):(nx?node.width:node.height)/2;
  at.x+=nx*normal+ny*offset;
  at.y+=ny*normal+nx*offset;
  return {at,direction,bounds:node};
}

function routeReservations() {
  const horizontal=new Map(), vertical=new Map();
  const tracks=(points,visit)=>{
    for (let i=1;i<points.length;i++) {
      const a=points[i-1], b=points[i], upright=a.x===b.x;
      // Only reserve runs that can share an orthogonal routing rail.
      if (!upright && a.y!==b.y) continue;
      const map=upright?vertical:horizontal, key=Math.round((upright?a.x:a.y)*1000);
      const p=upright?a.y:a.x,q=upright?b.y:b.x;
      if (p!==q) visit(map,key,Math.min(p,q),Math.max(p,q));
    }
  };
  return {
    bounds:null,
    add(points) {
      const bounds=this.bounds??={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
      for (const {x,y} of points) {
        bounds.left=Math.min(bounds.left,x); bounds.right=Math.max(bounds.right,x);
        bounds.top=Math.min(bounds.top,y); bounds.bottom=Math.max(bounds.bottom,y);
      }
      tracks(points,(map,key,low,high)=>{
        if (!map.has(key)) map.set(key,[]);
        map.get(key).push([low,high]);
      });
    },
    overlap(points) {
      let length=0;
      tracks(points,(map,key,low,high)=>{
        for (const [a,b] of map.get(key)??[]) length+=Math.max(0,Math.min(high,b)-Math.max(low,a));
      });
      return length;
    }
  };
}

function captionLines(value,maxWidth,size,maxLines) {
  const wrapped=wrap(value,maxWidth,size), lines=wrapped.slice(0,maxLines);
  if (wrapped.length>maxLines) lines[maxLines-1]+='…';
  return lines;
}

const eventSize=12, eventPadding=6, eventLineHeight=eventSize*1.4;
function eventMetrics(event) {
  const lines=captionLines(event,captionWidth,eventSize,2);
  return {event,lines,width:Math.ceil(Math.max(...lines.map(textLength))*eventSize)+eventPadding*2,
    height:Math.ceil(lines.length*eventLineHeight)+eventPadding};
}

function overlapsCaption(box,left,top,right,bottom) {
  const boxRight=box.x+box.width;
  if (left>=boxRight || right<=box.x || top>=box.y+box.height || bottom<=box.y) return false;
  if (!box.diagonal) return true;
  const [a,b]=box.diagonal, slope=(b.y-a.y)/(b.x-a.x);
  const y0=a.y+(Math.max(left,box.x)-a.x)*slope;
  const y1=a.y+(Math.min(right,boxRight)-a.x)*slope;
  return Math.min(y0,y1)<bottom && Math.max(y0,y1)>top;
}

function manualCaption({edge,points,cubic},obstacles) {
  const event=edge.stateEvent ? eventMetrics(edge.stateEvent) : null;
  const title=edge.title===edge.stateEvent ? '' : edge.title;
  const lines=captionLines(title,captionWidth,eventSize,3);
  if (!event && !lines.length) return;
  const titleWidth=lines.length ? Math.ceil(Math.max(...lines.map(textLength))*eventSize)+4 : 0;
  const titleHeight=lines.length*eventLineHeight, gap=event && lines.length ? 4 : 0;
  const width=Math.max(event?.width??0,titleWidth), height=(event?.height??0)+gap+titleHeight;
  let best, fewest=Infinity, longest=-1;
  for (let i=1;i<points.length;i++) {
    const a=points[i-1], b=points[i];
    // Use the actual Bézier midpoint for each sampled span so the event
    // connector touches the rendered curve, even on a tight bend.
    const {x:ax,y:ay}=cubic ? cubicPoint(cubic,(i-.5)/(points.length-1)) : point((a.x+b.x)/2,(a.y+b.y)/2);
    const dx=Math.abs(b.x-a.x), dy=Math.abs(b.y-a.y);
    const length=Math.hypot(dx,dy), vertical=dy>dx;
    if (!length) continue;
    const labelCenter=(event?.height??height)/2;
    // Leave room for a sloped stroke along the full span of the label box.
    const clearance=captionGap+(vertical ? dx/dy*(height-labelCenter) : dy/dx*width/2);
    for (const side of [1,-1]) {
      const x=vertical ? ax+(side>0?clearance:-clearance-width) : ax-width/2;
      const y=vertical ? ay-labelCenter : ay+(side>0?clearance:-clearance-height);
      let collisions=0;
      for (const box of obstacles) if (overlapsCaption(box,x-2,y-2,x+width+2,y+height+2)) collisions++;
      if (collisions>fewest || collisions===fewest && length<=longest) continue;
      const above=!vertical && side<0;
      const anchor=vertical ? side>0?'start':'end' : 'middle';
      const badge=event ? {...event, x:vertical?x+(side>0?0:width-event.width):ax-event.width/2,
        y:above?y+titleHeight+gap:y, start:point(ax,ay),
        end:vertical?point(ax+side*clearance,ay):point(ax,ay+side*clearance)} : null;
      best={x,y,width,height,badge,text:{value:title,lines,x:vertical?x+(side>0?0:width):ax,
        baseline:y+(event&&!above?event.height+gap:0)+eventSize,anchor}};
      fewest=collisions; longest=length;
    }
  }
  return best;
}

export function drawState({nodes,edges,view,c,out,path,rect,cardBackground,labelLines,esc,bg,muted,text,dark,measureOnly,placement}) {
  const finals = new Set(c.final), positions = new Map();
  const hasStatePins=Object.keys(view.places).length>0;
  const pinned={...view.places,...view.virtualPlaces}, byId=new Map(nodes.map(node=>[node.id,node]));
  const pins=Object.keys(pinned).map(id=>byId.get(id));
  const kindOf=node=>node.virtual??(node.id===c.initial?'initial':finals.has(node.id)?'final':'state');
  // Keep ordinary states in model order with the explicit start and finish
  // symbols at the ends. This also gives transition routing a stable row order.
  const first = [], middle = [], last = [];
  for (const node of nodes) if (!Object.hasOwn(pinned,node.id)) {
    const kind=kindOf(node);
    (kind==='initial'?first:kind==='final'?last:middle).push(node);
  }
  const ordered = [...first,...middle,...last];
  ordered.forEach((node,row) => {
    const kind = kindOf(node);
    positions.set(node.id,{row,kind,y:rowTop(row),radius:kind==='initial'?initialRadius:kind==='final'?finalRadius:0,left:[],right:[]});
  });

  const direct = new Set(), routed = [], manualEdges=[];
  const tracks = {left:0,right:0};
  for (const edge of edges) {
    const source = positions.get(edge.source), target = positions.get(edge.target);
    const virtualId=edge.virtual && (byId.get(edge.source).virtual ? edge.source : edge.target);
    const options=virtualId ? view.virtualRoutes?.[virtualId] : view.routes[edge.id];
    const curve=options?.curve??DEFAULT_CURVE;
    const explicit=options && (curve==='straight' || curve==='bezier' || options.via?.length ||
      options.from && options.from!=='auto' || options.to && options.to!=='auto');
    if (hasStatePins || !source || !target || explicit) {manualEdges.push({edge,options});continue;}
    const straight = target.row === source.row+1 && !direct.has(source.row);
    const side = target.row < source.row ? 'left' : 'right';
    const route = {edge,source,target,side,straight,curve};
    if (straight) direct.add(source.row);
    else {
      route.track=tracks[side]++;
      source[side].push({route,key:'from'});
      target[side].push({route,key:'to'});
    }
    routed.push(route);
  }

  const leftControlCaption = [...positions.values()].some(box => box.radius && box.right.length);
  const controlMargin = leftControlCaption ? maxCaptionBox+finalRadius+controlLabelGap-stateWidth/2 : 0;
  let left = Math.max(36+tracks.left*trackPitch,controlMargin);
  if (hasStatePins && ordered.length) {
    // Reserve one column for automatic states beyond any fixed boxes that
    // intersect their rows. Resolve formulas only after fixing that column.
    const fixed=pins.map(node=>pinned[node.id].at).filter(({x,y})=>typeof x==='number' &&
      (typeof y!=='number'||y+stateHeight+24>rowTop(0) && y-24<rowTop(ordered.length-1)+stateHeight));
    for (const {x} of fixed.sort((a,b)=>a.x-b.x)) {
      if (x-24>=left+stateWidth) break;
      left=Math.max(left,x+stateWidth+24);
    }
  }
  const right=left+stateWidth, center=left+stateWidth/2;
  const half = stateHeight/2, directCaptionX = center+captionGap;
  // Keep right-hand rails beyond the labels of straight transitions.
  const rightRail = direct.size ? directCaptionX+maxCaptionBox+captionGap+loopInset : right+26;
  const width = tracks.right ? rightRail+(tracks.right-1)*trackPitch+captionGap+maxCaptionBox+24 : right+120;
  const lastRow = ordered.length-1;
  const lastRowLoop = routed.some(route => route.source === route.target && route.source.row === lastRow);
  const height = rowTop(lastRow)+(lastRowLoop ? rowPitch : stateHeight+42);
  for (const node of ordered) {
    const box = positions.get(node.id), y = box.y+half, radius = box.radius;
    Object.assign(node, radius ? {x:center-radius,y:y-radius,width:2*radius,height:2*radius} :
      {x:left,y:box.y,width:stateWidth,height:stateHeight});
    for (const side of ['left','right']) {
      const ports = box[side], sign = side === 'left' ? -1 : 1;
      // Outer tracks approach the upper ports first. Two transitions into
      // the same state therefore have independent arrowheads and endpoints.
      ports.sort((a,b) => b.route.track-a.route.track);
      ports.forEach(({route,key},i) => {
        const delta = ((i+1)/(ports.length+1)-0.5)*(radius ? radius*1.6 : stateHeight-24);
        const distance = radius ? Math.sqrt(radius**2-delta**2) : stateWidth/2;
        route[key] = point(center+sign*distance,y+delta);
      });
    }
  }
  for (const node of pins) {
    const {at}=pinned[node.id], kind=kindOf(node), radius=kind==='initial'?initialRadius:kind==='final'?finalRadius:0;
    Object.assign(node,{x:typeof at.x==='number'?at.x:left,y:typeof at.y==='number'?at.y:rowTop(0),
      width:radius?radius*2:stateWidth,height:radius?radius*2:stateHeight});
    positions.set(node.id,{kind,radius,right:[]});
  }
  if (placement) resolvePlacements({places:pinned},nodes,[],placement);
  if (measureOnly && !manualEdges.length && !pins.length) return {width,height};

  // Measure the same automatic and placed transition paths before drawing so
  // negative placements and their captions are included in standalone SVGs.
  for (const route of routed) {
    const {source,target,side,straight,track,from,to}=route;
    if (straight) {
      const start=source.y+half+(source.radius||half), end=target.y+half-(target.radius||half);
      Object.assign(route,{points:[point(center,start),point(center,end)],rail:center,labelY:gapCenter(source.row),anchor:'start'});
    } else {
      const sign=side==='left'?-1:1, rail=(side==='left'?left-26:rightRail)+sign*track*trackPitch;
      const loop=source===target, labelY=gapCenter(loop?source.row:Math.floor((source.row+target.row-1)/2));
      const corners=loop?[point(rail,labelY+16),point(rail-loopInset,labelY+16),point(rail-loopInset,to.y)]:[point(rail,to.y)];
      Object.assign(route,{points:[from,point(rail,from.y),...corners,to],rail,labelY,anchor:side==='left'?'end':'start'});
    }
  }
  const occupied=new Map(), reservations=manualEdges.length?routeReservations():null;
  const reserve=(id,a,b)=>{
    if (!b) return;
    if (!occupied.has(id)) occupied.set(id,new Map());
    const ports=occupied.get(id), side=directionKey([Math.sign(b.x-a.x),Math.sign(b.y-a.y)]);
    ports.set(side,(ports.get(side)??0)+1);
  };
  if (manualEdges.length) for (const {edge,points} of routed) {
    reserve(edge.source,points[0],points[1]);
    reserve(edge.target,points.at(-1),points.at(-2));
    reservations.add(points);
  }
  const manual=manualEdges.map(({edge,options})=>{
    const source=byId.get(edge.source), target=byId.get(edge.target);
    const route=resolveVia(options,byId), via=route?.via??[], curve=route?.curve??DEFAULT_CURVE;
    const port=(node,other,selection,waypoint)=>{
      const radius=positions.get(node.id).radius;
      const fixed=fixedPort(node,selection,radius?'circle':undefined);
      const toward=waypoint ? {...waypoint,width:0,height:0} : other;
      return fixed??statePort(node,toward,occupied.get(node.id),radius);
    };
    const from=port(source,target,route?.from,via[0]), to=port(target,source,route?.to,via.at(-1));
    if (source===target) {
      // Enter the same side at two distinct ports to keep a visible loop.
      const sides=occupied.get(source.id), left=sides?.get('-1,0')??0,right=sides?.get('1,0')??0;
      const side=left<right?-1:1, shift=.16+.13*(1-1/(1+Math.min(left,right)));
      for (const [port,offset,selected] of [[from,-1,route?.from],[to,1,route?.to]]) {
        if (selected!==undefined && selected!=='auto') continue;
        Object.assign(port,fixedPort(source,{side:side>0?'right':'left',position:.5+offset*shift},
          positions.get(source.id).radius?'circle':undefined));
      }
    }
    let points, cubic;
    if (curve==='bezier') {
      cubic=stateCubic(from,to,via,source===target);
      // Samples describe the stroke for choosing captions and reserving
      // nearby orthogonal routing space. Measure the exact extrema below.
      points=Array.from({length:17},(_,i)=>cubicPoint(cubic,i/16));
    } else if (curve==='straight' && (source!==target || via.length)) {
      points=[from.at,...via,to.at];
    } else {
      points=via.length ? connectWaypoints(from,to,via,nodes,nodes,reservations) : connectPorts(from,to,nodes,reservations);
    }
    if (points[1]?.x>points[0].x) positions.get(source.id).right.push(edge);
    if (points.at(-2)?.x>points.at(-1).x) positions.get(target.id).right.push(edge);
    reserve(source.id,points[0],points[1]);
    reserve(target.id,points.at(-1),points.at(-2));
    reservations.add(points);
    return {edge,points,curve,cubic};
  });
  let bounds;
  if (pins.length || manual.length) {
    const obstacles=[...nodes];
    for (const {points} of [...routed,...manual]) for (let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i];
      const width=Math.abs(a.x-b.x), height=Math.abs(a.y-b.y);
      obstacles.push({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width,height,diagonal:width&&height?[a,b]:null});
    }
    for (const node of nodes) if (positions.get(node.id).radius && node.title) {
      const labelWidth=Math.min(maxCaptionBox,textLength(node.title)*12+4), leftSide=positions.get(node.id).right.length;
      obstacles.push({x:leftSide?node.x-controlLabelGap-labelWidth:node.x+node.width+controlLabelGap,
        y:centerOf(node).y-20,width:labelWidth,height:40});
    }
    for (const route of manual) {
      route.caption=manualCaption(route,obstacles);
      if (route.caption) obstacles.push(route.caption);
    }
    let minX=ordered.length?-20:Infinity, minY=minX;
    let maxX=ordered.length?width+20:-Infinity, maxY=ordered.length?height+20:-Infinity;
    for (const {x,y,width,height} of obstacles) {
      minX=Math.min(minX,x-20);minY=Math.min(minY,y-20);
      maxX=Math.max(maxX,x+width+20);maxY=Math.max(maxY,y+height+20);
    }
    for (const {cubic} of manual) if (cubic) for (const {x,y} of cubicExtrema(cubic)) {
      minX=Math.min(minX,x-20);minY=Math.min(minY,y-20);
      maxX=Math.max(maxX,x+20);maxY=Math.max(maxY,y+20);
    }
    bounds={x:minX,y:minY,width:maxX-minX,height:maxY-minY};
  }
  if (measureOnly) return {width,height,bounds};

  const caption = (value,x,y,anchor,color,size,maxWidth,maxLines=3) => {
    if (!value) return;
    const lines = captionLines(value,maxWidth,size,maxLines);
    labelLines(value,lines,x,y-(lines.length-1)*size*0.7+size*0.32,size,color,anchor);
  };
  const drawEventBadge=({event,lines,x,y,width,height,start,end},anchor='start')=>{
    const fill = dark ? '#20345b' : '#e9efff', color = dark ? '#e0ebff' : '#1f3d7a';
    const border = dark ? '#647eb0' : '#8da8de';
    out.push(`<g data-state-event="true" aria-label="${esc(`Event: ${event}`)}" font-weight="600">`);
    out.push(`<line data-state-event-connector="true" x1="${start.x}" x2="${end.x}" y1="${start.y}" y2="${end.y}" stroke="${border}" stroke-width="1.5" aria-hidden="true"/>`);
    out.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${fill}" stroke="${border}"/>`);
    labelLines(event,lines,anchor==='end'?x+width-eventPadding:x+eventPadding,y+eventSize+2,eventSize,color,anchor);
    out.push('</g>');
  };
  const transitionCaption = (edge,rail,y,anchor) => {
    const sign = anchor === 'end' ? -1 : 1;
    const x = rail+sign*captionGap;
    if (!edge.stateEvent) return caption(edge.stateCaption,x,y,anchor,muted,12,captionWidth);

    const metrics=eventMetrics(edge.stateEvent);
    const title = edge.title === edge.stateEvent ? '' : edge.title;
    const titleLines=captionLines(title,captionWidth,eventSize,2);
    const gap = titleLines.length ? 4 : 0;
    const top=y-(metrics.height+gap+titleLines.length*eventLineHeight)/2;
    const attachmentY=top+metrics.height/2;
    drawEventBadge({...metrics,x:sign<0?x-metrics.width:x,y:top,start:point(rail,attachmentY),end:point(x,attachmentY)},anchor);
    if (titleLines.length) labelLines(title,titleLines,x,top+metrics.height+gap+eventSize,eventSize,muted,anchor);
  };
  for (const {edge,points,curve,cubic,rail,labelY,anchor,caption:label} of [...routed,...manual]) {
    out.push(`<g data-edge="${esc(edge.id)}"${edge.virtual?' data-virtual="true"':''}>`);
    path(cubic ? cubicPath(...cubic) : polyPath(points,curve==='rounded'),true);
    if (label) {
      if (label.badge) drawEventBadge(label.badge);
      const {value,lines,x,baseline,anchor}=label.text;
      if (lines.length) labelLines(value,lines,x,baseline,eventSize,muted,anchor);
    } else if (rail!==undefined) transitionCaption(edge,rail,labelY,anchor);
    out.push('</g>');
  }
  for (const node of [...ordered,...pins]) {
    const {kind,radius,right:ports}=positions.get(node.id);
    out.push(`<g data-state="${esc(node.id)}" data-state-kind="${kind}" data-type="${esc(node.type)}"${node.virtual?' data-virtual="true"':''}><title>${esc(node.title||node.id)}</title>`);
    if (radius) {
      const {x,y}=centerOf(node);
      if (kind==='final') out.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="${bg}" stroke="${text}"/>`);
      out.push(`<circle cx="${x}" cy="${y}" r="${kind==='final'?radius-5:radius}" fill="${text}"/>`);
      // A side-entering transition uses the circle's center row. Put the
      // control node title on the free side so its arrowhead stays visible.
      const side = ports.length ? -1 : 1;
      caption(node.title,x+side*(radius+controlLabelGap),y,side<0?'end':'start',text,12,captionWidth,2);
    } else {
      const fill = node.backgroundColor ?? (dark ? '#1e293b' : '#ffffff');
      const opacity = node.opacity ?? (node.backgroundColor ? DEFAULT_BACKGROUND_OPACITY : 1);
      out.push(`<g data-node="${esc(node.id)}" data-type="${esc(node.type)}" transform="translate(${node.x} ${node.y})">`);
      rect(0,0,stateWidth,stateHeight,fill,opacity,12);
      out.push(cardBackground(node,stateWidth,stateHeight,12));
      caption(node.title,stateWidth/2,half,'middle',foreground(composite(fill,bg,opacity)),15,stateWidth-30,2);
      out.push('</g>');
    }
    out.push('</g>');
  }
  return {width,height,bounds};
}
