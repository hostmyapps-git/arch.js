import {routingOptions} from './routing-options.js';
import {linearSpanProjection,pathPoint} from './svg-path.js';
import {num} from './svg-values.js';

const epsilon=1e-8;
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;

function intersection(a,b) {
  const divisor=cross(a.dx,a.dy,b.dx,b.dy);
  // Near-parallel overlaps have no distinct crossing to mark at this scale.
  if (Math.abs(divisor)<a.length*b.length/8) return;
  const dx=b.a.x-a.a.x, dy=b.a.y-a.a.y;
  const t=cross(dx,dy,b.dx,b.dy)/divisor, u=cross(dx,dy,a.dx,a.dy)/divisor;
  if (t<=epsilon||u<=epsilon||t>=1-epsilon||u>=1-epsilon) return;
  return {x:a.a.x+t*a.dx,y:a.a.y+t*a.dy};
}

function bridgeD({commands,spans}) {
  const segments=new Map(spans.filter(span=>span.jumps).map(span=>[span.index,span]));
  const arcs=[];
  const d=commands.map((cmd,index)=>{
    const span=segments.get(index);
    if (!span) return cmd.join(' ');
    const forward=span.b[span.axis]>span.a[span.axis];
    const bridges=span.jumps.sort((a,b)=>a.t-b.t).map(({arc})=>{
      const r=num(arc.radius), start=forward?arc.from:arc.to, end=forward?arc.to:arc.from;
      const command=`A ${r} ${r} 0 0 ${Number(forward)} ${end}`;
      arcs.push({arc,d:`M ${start} ${command}`});
      return `L ${start} ${command}`;
    });
    return `${bridges.join(' ')} ${cmd.join(' ')}`;
  }).join(' ');
  return {d,arcs};
}

export function crossingBridges(graph,trace) {
  const result=new Map(), {view,edges}=graph;
  if (graph.tree || edges.length<2 || view.routeDefaults?.crossings==='none'&&
    !Object.values(view.routes).some(route=>route.crossings==='bridge')) return result;

  const shared=graph.sharedPaths??[], paths=shared.map(edge=>({edge,group:edge.id}));
  for (const edge of edges) {
    const route=routingOptions(view,view.routes[edge.id]);
    paths.push({edge,group:edge.sharedPath,radius:route?.crossingRadius??6,
      enabled:route?.crossings!=='none'&&route?.path===undefined&&!edge.embeddedGroup});
  }
  if (!paths.some(path=>path.enabled)) return result;

  const lines=new Map();
  const spans=paths.flatMap((path,i)=>{
    path.order=i;
    const geometry=trace(path.edge.drawD??path.edge.d);
    path.commands=geometry.commands;
    path.spans=geometry.spans.map(span=>{
      const {a,b,dx,dy}=span;
      const placed={...span,path,...linearSpanProjection(span),left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),
        top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y),length:Math.hypot(dx,dy)};
      if (!lines.has(placed.line)) lines.set(placed.line,[]);
      lines.get(placed.line).push(placed);
      return placed;
    });
    return path.spans;
  }).sort((a,b)=>a.left-b.left);
  const boxes=graph.nodes.filter(node=>!node.container&&!node.referenceOnly);
  const junctions=[];
  for (const {node,anchor,connectorLabel} of graph.referenceNodes??[]) {
    boxes.push(node);
    junctions.push(anchor);
    if (connectorLabel) boxes.push(connectorLabel);
  }
  for (const edge of edges) if (edge.labelLines.length||edge.labelIcon) {
    boxes.push({x:edge.label.x-edge.labelWidth/2,y:edge.label.y-edge.labelHeight/2,width:edge.labelWidth,height:edge.labelHeight});
  }
  for (const path of paths) if (path.group&&path.spans.length) {
    junctions.push(path.spans[0].a,path.spans.at(-1).b);
  }

  const crossed=new Set(), tried=new Set(), changed=new Set(), active=[];
  const fraction=(span,point)=>(point[span.axis]-span.a[span.axis])/(span.b[span.axis]-span.a[span.axis]);
  const room=(span,point)=>{
    const t=fraction(span,point);
    return Math.min(t,1-t)*span.length;
  };
  const maxWidth=spans=>spans.reduce((width,span)=>Math.max(width,span.path.edge.width??1.5),0);
  function bundle(span,point) {
    const coordinate=point[span.axis];
    const members=lines.get(span.line).filter(s=>s.low<=coordinate+epsilon&&s.high>=coordinate-epsilon);
    const last=members.reduce((latest,member)=>member.path.order>latest.path.order?member:latest,span);
    return {last,members};
  }
  function addBridge({last},under,hit) {
    const {x,y}=hit, {path,axis,length}=last, {radius}=path;
    if (!path.enabled) return false;
    const halfInterval=radius*(last.high-last.low)/length, center=hit[axis];
    // Any collinear stroke touching the arc's interval could paint across the
    // jump. Move the whole bundle together, or try the crossing bundle if
    // an opt-out, free path, shared stem or nearby branch prevents that.
    const overlapping=lines.get(last.line).filter(s=>s.low<center+halfInterval&&s.high>center-halfInterval);
    if (overlapping.some(span=>!span.path.enabled)) return false;
    const width=maxWidth(overlapping), otherWidth=maxWidth(under.members);
    if (radius<(width+otherWidth)/2+1) return false;
    const clearance=radius+Math.max(3,width,otherWidth);
    if (overlapping.some(span=>room(span,hit)<=clearance)||under.members.some(span=>room(span,hit)<=clearance)) return false;
    if (overlapping.some(span=>span.jumps?.some(jump=>
      Math.abs(fraction(span,hit)-jump.t)*span.length<=radius+jump.arc.radius+2))) return false;
    if (junctions.some(p=>Math.abs(x-p.x)<clearance&&Math.abs(y-p.y)<clearance)) return false;
    if (boxes.some(b=>x+clearance>b.x&&x-clearance<b.x+b.width&&y+clearance>b.y&&y-clearance<b.y+b.height)) return false;
    const direction=Math.sign(last.b[axis]-last.a[axis]);
    const dx=last.dx*direction*radius/length,dy=last.dy*direction*radius/length;
    const arc={radius,from:pathPoint({x:x-dx,y:y-dy}),to:pathPoint({x:x+dx,y:y+dy})};
    for (const span of overlapping) {
      (span.jumps??=[]).push({t:fraction(span,hit),arc});
      changed.add(span.path);
    }
    return true;
  }

  // Sweep by X extents. Most spans leave the active set before they meet a
  // later segment, and the Y extent rejects disjoint pairs before intersection.
  for (const span of spans) {
    let keep=0;
    for (const other of active) {
      if (other.right<span.left) continue;
      active[keep++]=other;
      if (span.path===other.path||span.path.group&&span.path.group===other.path.group||
        (!span.path.enabled&&!other.path.enabled)||span.top>other.bottom||span.bottom<other.top) continue;
      const hit=intersection(span,other);
      if (!hit) continue;
      const key=`${num(hit.x)},${num(hit.y)}`;
      if (crossed.has(key)) continue;
      const pair=[span.line,other.line].sort().join('|'), attempt=`${key}:${pair}`;
      if (tried.has(attempt)) continue;
      tried.add(attempt);
      const a=bundle(span,hit), b=bundle(other,hit);
      // Prefer the bundle painted later, with the original fallback for a
      // crossing where only one side has room for a bridge.
      const bridged=a.last.path.order>b.last.path.order
        ? addBridge(a,b,hit)||addBridge(b,a,hit)
        : addBridge(b,a,hit)||addBridge(a,b,hit);
      if (bridged) crossed.add(key);
    }
    active.length=keep;
    active.push(span);
  }
  for (const path of changed) result.set(path.edge,bridgeD(path));
  return result;
}
