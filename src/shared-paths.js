// Presentation-only fan-in/fan-out networks. Every relationship keeps its full
// path for reference attachments; only its private branch is painted separately.
import {effectiveDasharray, routeStyleKey} from './route-styles.js';
import {pathPoint, roundedCorner} from './svg-path.js';
import {DEFAULT_CURVE} from './routing-options.js';
const opposite = {left:'right',right:'left',top:'bottom',bottom:'top'};
function side(box,p) {
  const distances=[['left',Math.abs(p.x-box.x)],['right',Math.abs(p.x-box.x-box.width)],['top',Math.abs(p.y-box.y)],['bottom',Math.abs(p.y-box.y-box.height)]];
  const [name,distance]=distances.sort((a,b)=>a[1]-b[1])[0];
  return distance<.01?name:null;
}
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const labelBox=(edge,p)=>({x:p.x-edge.labelWidth/2-4,y:p.y-edge.labelHeight/2-4,width:edge.labelWidth+8,height:edge.labelHeight+8});
function crosses(points,box) {
  // Touching a boundary is permitted; entering a card is not.
  const b={x:box.x+1,y:box.y+1,width:box.width-2,height:box.height-2};
  return points.slice(1).some((p,i)=> {
    const a=points[i];
    return a.x===p.x ? a.x>b.x&&a.x<b.x+b.width&&Math.max(a.y,p.y)>b.y&&Math.min(a.y,p.y)<b.y+b.height
      : a.y>b.y&&a.y<b.y+b.height&&Math.max(a.x,p.x)>b.x&&Math.min(a.x,p.x)<b.x+b.width;
  });
}

// Bound each outer bend by the nearest other attachment so it cannot consume
// another junction or paint any part of the shared spine twice.
function spineBends(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const positions = [...counts.keys()].sort((a,b) => a-b);
  const first = positions[0], last = positions.at(-1);
  const bends = new Map();
  if (counts.get(first) === 1) bends.set(first, positions[1]);
  if (counts.get(last) === 1) bends.set(last, positions.at(-2));
  return bends;
}

function clearBend(before, corner, after, obstacles) {
  const bend = roundedCorner(before, corner, after);
  if (!bend) return null;
  const {enter,leave} = bend;
  const sweep = {x:Math.min(enter.x,leave.x),y:Math.min(enter.y,leave.y),
    width:Math.abs(enter.x-leave.x),height:Math.abs(enter.y-leave.y)};
  return obstacles.some(node => overlap(sweep,node)) ? null : bend;
}

function terminal(point, corner, neighbor, obstacles) {
  const bend = neighbor && clearBend(point, corner, neighbor, obstacles);
  if (bend) return { point, join:bend.leave,
    inward:` L ${pathPoint(bend.enter)} Q ${pathPoint(corner)} ${pathPoint(bend.leave)}`,
    outward:` Q ${pathPoint(corner)} ${pathPoint(bend.enter)} L ${pathPoint(point)}` };
  return { point, join:corner, inward:` L ${pathPoint(corner)}`, outward:` L ${pathPoint(point)}` };
}

// Use the same radius for both arms so they meet at a single point on the
// stem. An aligned leaf can reach that point along the stem's axis.
function roundedJunction(junction, hubPoint, cross, values, obstacles) {
  const center = junction[cross];
  let lower = -Infinity, upper = Infinity;
  for (const value of values) {
    if (value < center) lower = Math.max(lower,value);
    else if (value > center) upper = Math.min(upper,value);
  }
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  const distance = Math.min(center-lower,upper-center);
  const low = clearBend({...junction,[cross]:center-distance},junction,hubPoint,obstacles);
  const high = clearBend({...junction,[cross]:center+distance},junction,hubPoint,obstacles);
  return low && high ? {corner:junction,low:low.enter,high:high.enter,join:low.leave} : null;
}

function spineCommands(leaf, hub, cross, incoming, merge) {
  if (!merge || leaf[cross] === hub[cross]) return ` L ${pathPoint(incoming?hub:leaf)}`;
  const arcStart=leaf[cross]<hub[cross]?merge.low:merge.high;
  return incoming ? ` L ${pathPoint(arcStart)} Q ${pathPoint(merge.corner)} ${pathPoint(hub)}` :
    ` Q ${pathPoint(merge.corner)} ${pathPoint(arcStart)} L ${pathPoint(leaf)}`;
}

function manualSharedPaths(edges,routes,shared) {
  // Geometry is authored in full. Extract coincident terminal commands only
  // when both routes still have a private branch after the shared stroke.
  const reverse = commands => {
    const points = commands.map(command=>command.split(' ').slice(-2).join(' '));
    return [`M ${points.at(-1)}`, ...commands.slice(1).map((cmd,index)=>cmd[0]==='L'
      ? `L ${points[index]}` : `${cmd.split(' ').slice(0,-2).join(' ')} ${points[index]}`).reverse()];
  };
  const used = new Set();
  for (const incoming of [false,true]) {
    const groups = new Map();
    for (const edge of edges) {
      const route = routes.get(edge.id);
      if (!route?.via?.length || route.path || !['all','stereotypes'].includes(route.sharePath) || used.has(edge.id) ||
          edge.source===edge.target || effectiveDasharray(edge).length || !['orthogonal','rounded'].includes(route.curve ?? DEFAULT_CURVE)) continue;
      const forward = edge.d.split(/ (?=[LQ] )/);
      const commands = incoming ? reverse(forward) : forward;
      if (commands.length<3) continue;
      const key = JSON.stringify([incoming?edge.target:edge.source,commands[0],commands[1],edge.style,
        edge.direction??'forward',routeStyleKey(edge),route.sharePath,route.sharePath==='stereotypes'?(edge.canonicalType??edge.type):null]);
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push({edge,commands});
    }
    for (const group of groups.values()) {
      if (group.length<2 || new Set(group.map(({edge})=>incoming?edge.source:edge.target)).size<2) continue;
      const first=group[0], shortest=Math.min(...group.map(item=>item.commands.length));
      let count=2;
      while(count<shortest-1 && group.every(item=>item.commands[count]===first.commands[count])) count++;
      const trunk=first.commands.slice(0,count);
      const junction=`M ${trunk.at(-1).split(' ').slice(-2).join(' ')}`;
      const id=`shared-waypoints-${shared.length+1}`;
      for (const {edge,commands} of group) {
        const branch=[junction,...commands.slice(count)];
        edge.drawD=(incoming?reverse(branch):branch).join(' ');
        edge.drawStart=incoming;
        edge.drawEnd=!incoming;
        edge.sharedPath=id;
        used.add(edge.id);
      }
      const {style,direction,color,width}=first.edge;
      shared.push({id,part:'stem',edgeIds:group.map(item=>item.edge.id),types:[...new Set(group.map(item=>item.edge.type))],
        d:(incoming?reverse(trunk):trunk).join(' '),style,direction,color,width,drawStart:!incoming,drawEnd:incoming});
    }
  }
}

export function shareEdgePaths(edges,nodes,routes) {
  const boxes=new Map(nodes.map(n=>[n.id,n])),used=new Set(),shared=[];
  const eligible=edge=>{
    const r=routes.get(edge.id)??{};
    // Preserve explicit docking positions, including positioned side objects.
    return !used.has(edge.id)&&['all','stereotypes'].includes(r.sharePath)&&edge.source!==edge.target
      &&r.path===undefined&&r.via===undefined&&!['straight','bezier'].includes(r.curve)
      &&typeof r.from!=='object'&&typeof r.to!=='object';
  };
  // Fan-in takes precedence if an edge could participate in both patterns.
  for(const incoming of [true,false]) {
    const groups=new Map();
    for(const edge of edges.filter(eligible)) {
      const r=routes.get(edge.id),hub=boxes.get(incoming?edge.target:edge.source),leaf=boxes.get(incoming?edge.source:edge.target);
      if(!hub||!leaf||hub.container||leaf.container||hub.parent!==leaf.parent)continue;
      const hubPoint=incoming?edge.points.at(-1):edge.points[0],leafPoint=incoming?edge.points[0]:edge.points.at(-1),port=side(hub,hubPoint);
      if(!port||side(leaf,leafPoint)!==opposite[port])continue;
      const key=JSON.stringify([hub.id,port,r.sharePath,r.sharePath==='stereotypes'?(edge.canonicalType??edge.type):null,edge.style,edge.direction??'forward',r.curve??DEFAULT_CURVE,routeStyleKey(edge)]);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push({edge,hub,leaf,port,leafPoint});
    }
    for(const candidates of groups.values()) {
      const group=candidates.filter(c=>!used.has(c.edge.id));
      if(group.length<2||new Set(group.map(c=>c.leaf.id)).size!==group.length)continue;
      const {hub,port}=group[0],horizontal=['left','right'].includes(port),major=horizontal?'x':'y',cross=horizontal?'y':'x';
      const sign=['left','top'].includes(port)?-1:1;
      const hubPoint={x:hub.x+hub.width/2,y:hub.y+hub.height/2};
      hubPoint[major]=hub[major]+(sign===1?(horizontal?hub.width:hub.height):0);
      const gap=Math.min(...group.map(c=>(c.leafPoint[major]-hubPoint[major])*sign));
      if(gap<64)continue;
      const trunk=hubPoint[major]+sign*Math.max(24,gap*.28),junction={...hubPoint,[major]:trunk};
      const crossValues=[hubPoint[cross],...group.map(c=>c.leafPoint[cross])];
      if(Math.max(...crossValues)-Math.min(...crossValues)<16)continue;
      const members=new Set(group.map(c=>c.edge.id));
      const obstacles=nodes.filter(n=>!n.container&&!n.referenceOnly);
      const labels=edges.filter(e=>!members.has(e.id)&&(e.labelLines.length||e.labelIcon)).map(e=>labelBox(e,e.label));
      const plans=[];
      for(const {edge,leafPoint}of group) {
        const fork={...leafPoint,[major]:trunk};
        const points=incoming?[leafPoint,fork,junction,hubPoint]:[hubPoint,junction,fork,leafPoint];
        if(obstacles.some(n=>n.id!==edge.source&&n.id!==edge.target&&crosses(points,n)))break;
        let label=edge.label;
        if(!edge.labelExplicit&&(edge.labelLines.length||edge.labelIcon)) {
          const length=Math.abs(leafPoint[major]-trunk),needed=horizontal?edge.labelWidth:edge.labelHeight;
          if(length<needed+16)break;
          const middle={x:(leafPoint.x+fork.x)/2,y:(leafPoint.y+fork.y)/2};
          const offset=(horizontal?edge.labelHeight:edge.labelWidth)/2+8;
          const choices=[0,-offset,offset].map(delta=>({...middle,[cross]:middle[cross]+delta}));
          label=choices.find(p=>{const b=labelBox(edge,p);return !obstacles.some(n=>overlap(b,n))&&!labels.some(n=>overlap(b,n));});
          if(!label)break;
        }
        if(edge.labelLines.length||edge.labelIcon)labels.push(labelBox(edge,label));
        plans.push({edge,points,label,leafPoint,fork});
      }
      if(plans.length!==group.length)continue;
      const id=`shared-${shared.length/2+1}`,prototype=group[0].edge;
      const metadata={id,edgeIds:group.map(c=>c.edge.id),types:[...new Set(group.map(c=>c.edge.type))],style:prototype.style,direction:prototype.direction};
      for(const key of ['color','width','dasharray'])if(prototype[key]!==undefined)metadata[key]=prototype[key];
      const rounded=(routes.get(prototype.id).curve??DEFAULT_CURVE)==='rounded';
      const bends=rounded?spineBends(crossValues):null;
      const merge=rounded?roundedJunction(junction,hubPoint,cross,crossValues,obstacles):null;
      const join=(point,corner)=>{
        const neighbor=bends?.get(corner[cross]);
        return terminal(point,corner,neighbor===undefined?null:{...junction,[cross]:neighbor},obstacles);
      };
      const hubTerminal=merge?terminal(hubPoint,merge.join):join(hubPoint,junction);
      let first=hubTerminal.join, last=first;
      for(const {edge,points,label,leafPoint,fork}of plans) {
        const leafTerminal=merge&&fork[cross]===junction[cross]?terminal(leafPoint,merge.join):join(leafPoint,fork);
        if(leafTerminal.join[cross]<first[cross])first=leafTerminal.join;
        if(leafTerminal.join[cross]>last[cross])last=leafTerminal.join;
        const [from,to]=incoming?[leafTerminal,hubTerminal]:[hubTerminal,leafTerminal];
        const connector=spineCommands(leafTerminal.join,hubTerminal.join,cross,incoming,merge);
        const d=`M ${pathPoint(from.point)}${from.inward}${connector}${to.outward}`;
        const drawD=incoming?`M ${pathPoint(leafTerminal.point)}${leafTerminal.inward}`:
          `M ${pathPoint(leafTerminal.join)}${leafTerminal.outward}`;
        Object.assign(edge,{points,d,drawD,label,sharedPath:id,drawStart:incoming,drawEnd:!incoming});
        used.add(edge.id);
      }
      const stem=incoming?`M ${pathPoint(hubTerminal.join)}${hubTerminal.outward}`:
        `M ${pathPoint(hubTerminal.point)}${hubTerminal.inward}`;
      // Paint each arm and the stem only once. Use the same connector commands
      // in the complete relationship paths for labels and reference cards.
      const arm=end=>`M ${pathPoint(incoming?end:hubTerminal.join)}${spineCommands(end,hubTerminal.join,cross,incoming,merge)}`;
      const spine=merge?`${arm(first)} ${arm(last)}`:`M ${pathPoint(first)} L ${pathPoint(last)}`;
      shared.push({...metadata,part:'spine',d:spine,drawStart:false,drawEnd:false},
        {...metadata,part:'stem',d:stem,drawStart:!incoming,drawEnd:incoming});
    }
  }
  manualSharedPaths(edges,routes,shared);
  return shared;
}
