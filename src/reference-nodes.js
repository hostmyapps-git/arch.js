import svgpath from 'svgpath';
import { DEFAULT_CURVE, routingOptions } from './routing-options.js';
import {routeStyle} from './route-styles.js';
import { polyPath } from './svg-path.js';

const distance = (a,b) => Math.hypot(b.x-a.x,b.y-a.y);
const overlap = (a,b,gap=18) => a.x < b.x+b.width+gap && a.x+a.width+gap > b.x && a.y < b.y+b.height+gap && a.y+a.height+gap > b.y;
const point = (x,y) => ({x,y});

// Sampling the rendered path, rather than its control polygon, also handles
// manual curves, arcs, rounded routes and multiple subpaths without a DOM.
export function pathSamples(d) {
  const path=svgpath(d).abs().unarc().unshort(), result=[];
  let current=point(0,0), start=current;
  for(const s of path.segments) {
    const before=current, command=s[0];
    if(command==='M') {current=point(s[1],s[2]);start=current;result.push({...current,move:true});continue;}
    if(command==='Z') current=start;
    else if(command==='L') current=point(s[1],s[2]);
    else if(command==='H') current=point(s[1],before.y);
    else if(command==='V') current=point(before.x,s[1]);
    else if(command==='C'||command==='Q') {
      const p1=point(s[1],s[2]), p2=point(s[3],s[4]), end=command==='C'?point(s[5],s[6]):p2;
      const length=distance(before,p1)+distance(p1,p2)+(command==='C'?distance(p2,end):0);
      const steps=Math.min(256,2*Math.ceil(Math.max(24,Math.ceil(length/20))/2));
      for(let i=1;i<=steps;i++) {
        const t=i/steps,u=1-t;
        result.push(command==='C'?point(u**3*before.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t**3*end.x,u**3*before.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t**3*end.y):
          point(u*u*before.x+2*u*t*p1.x+t*t*end.x,u*u*before.y+2*u*t*p1.y+t*t*end.y));
      }
      current=end;continue;
    } else continue;
    result.push({...current});
  }
  return result;
}

export function pointOnPath(samples, fraction, offset = 0, sideOffset = 0) {
  const segments=samples.slice(1).map((p,i)=>({a:samples[i],b:p,length:p.move?0:distance(samples[i],p)}));
  const length=segments.reduce((sum,s)=>sum+s.length,0);
  let remaining=Math.max(0,Math.min(length,length*fraction+offset));
  for(const segment of segments) if(segment.length) {
    if(remaining<=segment.length) {
      const t=remaining/segment.length;
      const dx=segment.b.x-segment.a.x, dy=segment.b.y-segment.a.y;
      // SVG Y grows downwards. (dy, -dx) points left along the tangent.
      return {x:segment.a.x+dx*t+sideOffset*(dy/segment.length),
        y:segment.a.y+dy*t-sideOffset*(dx/segment.length),dx,dy};
    }
    remaining-=segment.length;
  }
  return {...(samples.at(-1)??point(0,0)),dx:0,dy:0};
}

export function labelOnPath(samples,label = 0.5) {
  const fraction=typeof label==='number'?label:label.position;
  return pointOnPath(samples,fraction,label.offset,label.sideOffset);
}

// An automatic or absolute label can be off the path already. Use the
// nearest segment to its original anchor, and preserve the final placement
// chosen by the label layout when applying the additional displacement.
export function shiftLabelAcrossPath(label, samples, anchor, offset) {
  let dx=anchor.dx, dy=anchor.dy;
  if (dx===undefined || dy===undefined) {
    let nearest=Infinity;
    for (let i=1;i<samples.length;i++) {
      const a=samples[i-1], b=samples[i];
      if (b.move) continue;
      const sx=b.x-a.x, sy=b.y-a.y, length=Math.hypot(sx,sy);
      if (!length) continue;
      const ux=sx/length, uy=sy/length;
      const along=Math.max(0,Math.min(length,(anchor.x-a.x)*ux+(anchor.y-a.y)*uy));
      const gap=Math.hypot(anchor.x-a.x-along*ux,anchor.y-a.y-along*uy);
      if (gap<nearest) {nearest=gap;dx=sx;dy=sy;}
    }
  }
  const length=Math.hypot(dx??0,dy??0);
  return length ? {...label,x:label.x+offset*(dy/length),y:label.y-offset*(dx/length)} : label;
}

function horizontalPath(samples) {
  const a=samples[0]??point(0,0),b=samples.at(-1)??a;
  const tangent=distance(a,b)>0.01?{dx:b.x-a.x,dy:b.y-a.y}:pointOnPath(samples,0.5);
  return Math.abs(tangent.dx)>=Math.abs(tangent.dy);
}

function segmentHits(a,b,box) {
  // Liang-Barsky clipping; boundary contact is allowed at a source port.
  const left=box.x+0.5,right=box.x+box.width-0.5,top=box.y+0.5,bottom=box.y+box.height-0.5;
  const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;
  for(const [p,q] of [[-dx,a.x-left],[dx,right-a.x],[-dy,a.y-top],[dy,bottom-a.y]]) {
    if(!p) {if(q<0)return false;continue;}
    const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
  }
  return hi>=lo;
}

function pathHitsBox(samples, box) {
  for (let i=1; i<samples.length; i++) {
    if (!samples[i].move && segmentHits(samples[i-1],samples[i],box)) return true;
  }
  return false;
}

function connector(card,anchor,obstacles) {
  obstacles=[...obstacles,card];
  const ports=[point(card.x+card.width/2,card.y+card.height),point(card.x+card.width/2,card.y),point(card.x,card.y+card.height/2),point(card.x+card.width,card.y+card.height/2)];
  const xs=[anchor.x,...obstacles.flatMap(b=>[b.x-16,b.x+b.width+16])].sort((a,b)=>Math.abs(a-anchor.x)-Math.abs(b-anchor.x)).slice(0,24);
  const ys=[anchor.y,...obstacles.flatMap(b=>[b.y-16,b.y+b.height+16])].sort((a,b)=>Math.abs(a-anchor.y)-Math.abs(b-anchor.y)).slice(0,24);
  const candidates=[];
  for(const p of ports) {
    candidates.push([p,anchor],[p,point(p.x,anchor.y),anchor],[p,point(anchor.x,p.y),anchor]);
    for(const x of xs)candidates.push([p,point(x,p.y),point(x,anchor.y),anchor]);
    for(const y of ys)candidates.push([p,point(p.x,y),point(anchor.x,y),anchor]);
  }
  const length=path=>path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0);
  candidates.sort((a,b)=>length(a)-length(b));
  return candidates.find(path=>!path.slice(1).some((p,i)=>obstacles.some(box=>segmentHits(path[i],p,box))))??candidates[0];
}

export function attachReferenceNodes(nodes, edges, view, wrapText, routeConnector, resolveRoute=route=>route) {
  const byId=new Map(nodes.map(n=>[n.id,n])), occurrences=[], boxes=nodes.filter(n=>!n.container&&!n.referenceOnly);
  const containers=nodes.filter(n=>n.container),headers=containers.map(n=>({...n,height:n.headerHeight}));
  const automaticLabels=new Map();
  const labeledEdges=edges.filter(edge=>edge.labelLines.length||edge.labelIcon);
  const labelBox=({x,y},width,height)=>({x:x-width/2,y:y-height/2,width,height});
  const edgeLabelBox=edge=>labelBox(edge.label,edge.labelWidth,edge.labelHeight);
  const labels=labeledEdges.map(edgeLabelBox);
  // Keep one attachment record per edge/reference, but group visual cards by
  // model identity unless the view/profile requests one occurrence per edge.
  const groups=new Map(),edgesById=new Map(edges.map(edge=>[edge.id,edge]));
  const routes=new Map((view.referenceRoutes??[]).map(route=>[JSON.stringify([route.nodeId,route.edgeId]),route]));
  for(const edge of edges) {
    if(!edge.referenceItems?.length)continue;
    const samples=pathSamples(edge.d);
    const horizontal=horizontalPath(samples);
    if (!edge.labelExplicit && (edge.labelLines.length||edge.labelIcon)) automaticLabels.set(edge,horizontal);
    const rowWidth=edge.referenceItems.reduce((sum,item)=>sum+byId.get(item.id).width,0)+28*(edge.referenceItems.length-1);
    let rowLeft=pointOnPath(samples,0.5).x-rowWidth/2;
    for(const [index,item] of edge.referenceItems.entries()) {
      const route=resolveRoute(routingOptions(view,routes.get(JSON.stringify([item.id,edge.id])),true));
      const original=byId.get(item.id), anchor=pointOnPath(samples,route?.to??(index+1)/(edge.referenceItems.length+1));
      // Already visible (including explicitly placed) model cards stay canonical.
      // A reference card carried in an embedding already has source geometry.
      // A host attachment can target it without allocating another visual card.
      const explicit=!original.referenceOnly || Object.hasOwn(view.embeddings ?? {}, original.treeGroup);
      const key=JSON.stringify([item.id,explicit||edge.referenceOccurrences!=='perEdge'?null:edge.id]);
      if(!groups.has(key))groups.set(key,[]);
      const occurrence={edgeId:edge.id,attribute:item.attribute,nodeId:item.id,anchor,explicit,route,...routeStyle(route),
        horizontal,preferredX:rowLeft};
      if(edge.referenceConnectorLabels)occurrence.connectorLabelText=item.label;
      groups.get(key).push(occurrence);occurrences.push(occurrence);
      rowLeft+=original.width+28;
    }
  }
  const cardCounts=new Map();
  for(const group of groups.values())cardCounts.set(group[0].nodeId,(cardCounts.get(group[0].nodeId)??0)+1);
  const cards=[];
  for(const group of groups.values()) {
    const first=group[0],original=byId.get(first.nodeId);
    let card;
    if(first.explicit)card=original;
    else {
      const identityLines=cardCounts.get(first.nodeId)>1?wrapText(`ID: ${original.id}`,original.width-20,11):[];
      const height=original.height+(identityLines.length?identityLines.length*16+8:0);
      const anchor=point(group.reduce((sum,o)=>sum+o.anchor.x,0)/group.length,group.reduce((sum,o)=>sum+o.anchor.y,0)/group.length);
      const horizontal=first.horizontal,preferredX=group.reduce((sum,o)=>sum+o.preferredX,0)/group.length;
      const endpoints=group.flatMap(o=>{
        const edge=edgesById.get(o.edgeId);return [byId.get(edge.source),byId.get(edge.target)];
      });
      const gap=horizontal?Math.max(80,anchor.y-Math.min(...endpoints.map(n=>n.y))+32):80;
      const obstacles=[...boxes,...(original.parent?headers:containers),...labels,...cards];
      for(let level=0;!card;level++)for(const side of [-1,1]) {
        const candidate={...original,parent:null,height,referenceContentHeight:original.height,referenceIdentityLines:identityLines,
          x:horizontal?preferredX:anchor.x+(side<0?-gap-original.width:gap)+side*level*(original.width+28),
          y:horizontal?anchor.y+(side<0?-gap-height:gap)+side*level*(height+28):anchor.y-height/2};
        if(!obstacles.some(b=>overlap(candidate,b))) {card=candidate;break;}
      }
    }
    cards.push(card);
    const edgeIds=[...new Set(group.map(o=>o.edgeId))];
    for(const occurrence of group)Object.assign(occurrence,{node:card,edgeIds});
  }
  for(const occurrence of occurrences) {
    const obstacles=[...boxes,...headers,...cards].filter(box=>box!==occurrence.node);
    const curve=occurrence.route?.curve??DEFAULT_CURVE;
    if(occurrence.route&&(['straight','bezier'].includes(curve)||['from','to','via','path'].some(key=>occurrence.route[key]!==undefined))) {
      const routed=routeConnector(occurrence.node,occurrence.anchor,occurrence.route);
      occurrence.points=routed.points;occurrence.d=routed.d;
    } else {
      occurrence.points=connector(occurrence.node,occurrence.anchor,obstacles);
      // Keep the automatically selected ports and bends. On tight routes keep
      // the original corner when a rounded stroke would cross a nearby card.
      if(curve==='rounded'&&occurrence.points.length>2) {
        const rounded=polyPath(occurrence.points,true);
        if(rounded.includes(' Q ')) {
          const samples=pathSamples(rounded);
          if(!obstacles.some(box=>pathHitsBox(samples,box)))occurrence.d=rounded;
        }
      }
    }
    const label=occurrence.route?.label;
    if (occurrence.connectorLabelText && label !== 'none') {
      const lines=wrapText(occurrence.connectorLabelText,180,11),height=lines.length*15+8;
      const absolute=label && Object.hasOwn(label,'x'), sideOffset=occurrence.route?.sideOffset;
      const samples=!absolute||sideOffset ? (occurrence.d?pathSamples(occurrence.d):occurrence.points) : undefined;
      let center=absolute ? label : labelOnPath(samples,label);
      if (sideOffset) center=shiftLabelAcrossPath(center,samples,center,sideOffset);
      occurrence.connectorLabel={...center,lines,width:Math.min(204,Math.max(40,...lines.map(line=>[...line].length*13))+16),height};
    }
  }
  if (automaticLabels.size) {
    const captions=occurrences.flatMap(({connectorLabel:label})=>label?[labelBox(label,label.width,label.height)]:[]);
    const connectors=occurrences.map(o=>o.d?pathSamples(o.d):o.points);
    const crossings=box=>connectors.filter(path=>pathHitsBox(path,box)).length;
    for (const [edge,horizontal] of automaticLabels) {
      const originalBox=edgeLabelBox(edge);
      let bestCrossings=crossings(originalBox);
      if (!bestCrossings) continue;

      const obstacles=[...boxes,...headers,...cards,...captions,...labeledEdges.filter(other=>other!==edge).map(edgeLabelBox)];
      const overlaps=box=>obstacles.filter(other=>overlap(box,other,0)).length;
      let bestTotal=bestCrossings+overlaps(originalBox);
      const {x,y}=edge.label;
      const offset=(horizontal?edge.labelHeight:edge.labelWidth)/2+14;
      // Only a crossing triggers this search. If both sides are obstructed,
      // prefer the fewest overlaps and keep the original position on a tie.
      for (const delta of [offset,-offset]) {
        const candidate=horizontal?point(x,y+delta):point(x+delta,y);
        const box=labelBox(candidate,edge.labelWidth,edge.labelHeight);
        const candidateCrossings=crossings(box);
        const total=candidateCrossings+overlaps(box);
        if (total<bestTotal || total===bestTotal && candidateCrossings<bestCrossings) {
          edge.label=candidate;
          bestTotal=total;
          bestCrossings=candidateCrossings;
        }
      }
    }
  }
  // Give reference-only semantic nodes the geometry of their first occurrence;
  // visual occurrences never duplicate the source model elements.
  for(const node of nodes.filter(n=>n.referenceOnly)) {
    const first=occurrences.find(o=>o.nodeId===node.id);
    if(first) {node.x=first.node.x;node.y=first.node.y;}
  }
  return occurrences;
}
