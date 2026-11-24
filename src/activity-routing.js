import { resolveVia } from './via.js';
import { fixedPort } from './routing-options.js';
import { textLength, wrap } from './text-layout.js';

export const laneLeft = 25;
export const laneWidth = 330;
export const laneTop = 20;
export const laneHeader = 65;
const boundaryGap = 5;

const point = (x, y) => ({x, y});
const controlSizes = {initial:[22,22], final:[40,40], decision:[200,80], bar:[220,12]};

// Keep the original activity layout: forward flows turn between rows,
// return flows use the left gutter, and self-loops exit on the right.
export function automaticActivityRoute(from, to, index) {
  const sx = from.x + from.width / 2, tx = to.x + to.width / 2;
  if (from === to) {
    const x = from.x + from.width, y = from.y;
    return [point(x, y + 20), point(x + 45, y + 20), point(x + 45, y + 70), point(x, y + 70)];
  }
  if (to.y > from.y) {
    const y = (from.outY + to.inY) / 2;
    return [point(sx, from.outY), point(sx, y), point(tx, y), point(tx, to.inY)];
  }
  if (to.y === from.y && to.x !== from.x) {
    // Context edges may connect activities on the same flow rank.
    const right = from.x < to.x;
    const a = activityPort(from,right?'right':'left').at;
    const b = activityPort(to,right?'left':'right').at;
    const x = (a.x+b.x)/2;
    return [a,point(x,a.y),point(x,b.y),b];
  }
  const x = laneLeft + index % 3 * 14;
  const ay = from.y + from.height / 2, by = to.y + to.height / 2;
  return [point(from.x, ay), point(x, ay), point(x, by), point(to.x, by)];
}

// Pass through each waypoint in order. The first and last turns retain the
// directions of the automatic ports so the line meets the card at its edge.
function throughWaypoints(automatic, via) {
  const start = automatic[0], end = automatic.at(-1);
  const leavesVertically = start.x === automatic[1].x;
  const entersVertically = end.x === automatic.at(-2).x;
  const points = [start];
  for (const next of via) {
    const previous = points.at(-1);
    if (previous.x === next.x && previous.y === next.y) continue;
    if (previous.x !== next.x && previous.y !== next.y)
      points.push(points.length === 1 && leavesVertically ? point(previous.x, next.y) : point(next.x, previous.y));
    points.push(next);
  }
  const last = points.at(-1);
  if (last.x !== end.x && last.y !== end.y)
    points.push(entersVertically ? point(end.x, last.y) : point(last.x, end.y));
  points.push(end);
  return points;
}

function activityPort(box, placement, fallback, next) {
  const control = controlSizes[box.control];
  const bounds = control ? {
    x:box.x + (box.width - control[0])/2,
    y:box.y + (box.control === 'bar' ? 30 : (box.height - control[1])/2),
    width:control[0], height:control[1],
  } : box;
  const shape=box.control==='decision'?'diamond':control&&box.control!=='bar'?'circle':undefined;
  return fixedPort(bounds,placement,shape) ??
    {at:fallback, bounds, direction:[Math.sign(next.x-fallback.x),Math.sign(next.y-fallback.y)]};
}

function portStub(port, toward) {
  if (!port.direction) return port.at;
  const [dx,dy] = port.direction, {at,bounds} = port;
  const distance = dx*(toward.x-at.x) + dy*(toward.y-at.y);
  // For a tapered symbol, first leave its surrounding box before turning.
  const bound = dx ? (dx > 0 ? bounds.x+bounds.width-at.x : at.x-bounds.x) :
    (dy > 0 ? bounds.y+bounds.height-at.y : at.y-bounds.y);
  const clearance = distance > 0 ? Math.min(16,distance/2) : 16;
  const length = Math.max(0,bound) + clearance;
  return point(at.x+dx*length,at.y+dy*length);
}

function cutsBox(a,b,box) {
  if (a.x === b.x) return a.x > box.x && a.x < box.x+box.width &&
    Math.max(a.y,b.y) > box.y && Math.min(a.y,b.y) < box.y+box.height && a.y !== b.y;
  return a.y > box.y && a.y < box.y+box.height && Math.max(a.x,b.x) > box.x && Math.min(a.x,b.x) < box.x+box.width;
}

function compactPortPath(points) {
  const path = [];
  for (const next of points) {
    const a = path.at(-2), b = path.at(-1);
    if (b && b.x === next.x && b.y === next.y) continue;
    if (a && ((a.x === b.x && b.x === next.x && (b.y-a.y)*(next.y-b.y) > 0) ||
      (a.y === b.y && b.y === next.y && (b.x-a.x)*(next.x-b.x) > 0))) path.pop();
    path.push(next);
  }
  return path;
}

// Prefer a direct orthogonal connection between the outward stubs. Add a
// detour around endpoint boxes when a port faces away from the other end.
export function connectPorts(start,end,boxes,routing) {
  const a = portStub(start,end.at), b = portStub(end,start.at);
  const xPath = x => [a,point(x,a.y),point(x,b.y),b];
  const yPath = y => [a,point(a.x,y),point(b.x,y),b];
  const xMid = xPath((a.x+b.x)/2), yMid = yPath((a.y+b.y)/2);
  const candidates = start.direction?.[1] ? [yMid,xMid] : [xMid,yMid];
  candidates.push([a,point(b.x,a.y),b],[a,point(a.x,b.y),b],
    xPath(Math.min(a.x,b.x,...boxes.map(box=>box.x))-16),
    xPath(Math.max(a.x,b.x,...boxes.map(box=>box.x+box.width))+16),
    yPath(Math.min(a.y,b.y,...boxes.map(box=>box.y))-16),
    yPath(Math.max(a.y,b.y,...boxes.map(box=>box.y+box.height))+16));
  if (routing?.bounds) {
    const {left,right,top,bottom}=routing.bounds;
    candidates.push(xPath(left-16),xPath(right+16),yPath(top-16),yPath(bottom+16));
    // Shift the first elbow independently when a detour would otherwise
    // follow an existing rail immediately after leaving the source port.
    for (const offset of [-16,16]) {
      const x=a.x+offset, y=a.y+offset;
      for (const rail of [top-16,bottom+16]) candidates.push([a,point(x,a.y),point(x,rail),point(b.x,rail),b]);
      for (const rail of [left-16,right+16]) candidates.push([a,point(a.x,y),point(rail,y),point(rail,b.y),b]);
    }
  }
  let best, fewestCuts = Infinity, leastShared = Infinity, shortest = Infinity;
  for (const candidate of candidates) {
    let cuts = 0, length = 0;
    for (let i=1;i<candidate.length;i++) {
      const previous = candidate[i-1], next = candidate[i];
      length += Math.abs(next.x-previous.x)+Math.abs(next.y-previous.y);
      for (const box of boxes) if (cutsBox(previous,next,box)) cuts++;
    }
    if (cuts > fewestCuts || !routing && cuts === fewestCuts && length > shortest) continue;
    // Include the stubs when counting bends. An L and a path with several
    // extra bends can have identical Manhattan length between the ports.
    const path = compactPortPath([start.at,...candidate,end.at]);
    const shared=routing?.overlap(path)??0;
    if (cuts < fewestCuts || shared < leastShared || shared===leastShared &&
      (length<shortest || length===shortest && path.length<best.length)) {
      best=path; fewestCuts=cuts; leastShared=shared; shortest=length;
    }
  }
  return best;
}

// Preserve explicit waypoints in order. Route the endpoint legs with stubs
// and use deterministic orthogonal elbows between authored waypoints.
export function connectWaypoints(start,end,via,firstBoxes,lastBoxes,routing) {
  const points = connectPorts(start,{at:via[0]},firstBoxes,routing);
  for (let i=1;i<via.length;i++) {
    const a = via[i-1], b = via[i];
    if (a.x !== b.x && a.y !== b.y) points.push(point(b.x,a.y));
    points.push(b);
  }
  points.push(...connectPorts({at:via.at(-1)},end,lastBoxes,routing).slice(1));
  return points;
}

function routedPoints(automatic,from,to,route) {
  const via = route?.via ?? [];
  if ([route?.from,route?.to].every(port=>port === undefined || port === 'auto'))
    return via.length ? throughWaypoints(automatic,via) : automatic;
  const start = activityPort(from,route.from,automatic[0],automatic[1]);
  const end = activityPort(to,route.to,automatic.at(-1),automatic.at(-2));
  return via.length ? connectWaypoints(start,end,via,[start.bounds],[end.bounds]) :
    connectPorts(start,end,[start.bounds,end.bounds]);
}

function captionFor(route,to,cards,lanes,strokes) {
  const {edge,points}=route, title=edge.title;
  const margin = 8, inset = 8, fontSize = 11;
  const preferred = Math.min(180, Math.max(64,textLength(title)*fontSize + inset*2 + 4));
  const layouts = new Map();
  const measure = width => {
    if (layouts.has(width)) return layouts.get(width);
    const all = wrap(title,width-inset*2,fontSize), lines = all.slice(0,2);
    if (all.length > 2) lines[1] = lines[1].slice(0,-1) + '…';
    const layout = {width,fontSize,lines,height:22+(lines.length-1)*16};
    layouts.set(width,layout);
    return layout;
  };
  let best, bestScore = Infinity;
  const offer = (x,y,width,column,horizontal,available) => {
    const layout = measure(width);
    const top = y-layout.height/2, bottom = top+layout.height;
    const left = x-width/2, right = left+width;
    const lane = lanes[column];
    const overlapsFrame = lane && [laneTop,laneHeader,lane.y+lane.height].some(level=>top < level+2 && bottom > level-2);
    const overlapsCard = cards[column]?.some(card=>top < card.y+card.height+2 && bottom > card.y-2 &&
      left < card.x+card.width+2 && right > card.x-2);
    const overlapsAnotherEdge = strokes[column]?.some(stroke=>stroke.id !== edge.id &&
      left < stroke.right+2 && right > stroke.left-2 && top < stroke.bottom+2 && bottom > stroke.top-2);
    // Keep the center on the edge in all cases. Prefer an uncluttered leg
    // with room before the next bend, then favor the destination lane.
    const score = (overlapsFrame || overlapsCard ? 100 : 0) + (overlapsAnotherEdge ? 32 : 0) +
      (available < (horizontal ? width : layout.height) ? 16 : 0) +
      (column === to.lane ? 0 : 8) + (horizontal ? 0 : 4) + (layout.lines.length-1)*2;
    if (score >= bestScore) return;
    bestScore = score;
    best = {...layout,x:left,y:top};
  };
  const path = compactPortPath(points);
  for (let i=path.length-1;i>0;i--) {
    const a = path[i-1], b = path[i];
    if (a.y === b.y) {
      const start = Math.min(a.x,b.x)+margin, end = Math.max(a.x,b.x)-margin;
      const first = Math.max(0,Math.floor((start-laneLeft)/laneWidth));
      const last = Math.min(lanes.length-1,Math.floor((end-laneLeft)/laneWidth));
      for (let column=first;column<=last;column++) {
        const lane = lanes[column], left = lane.x+margin, right = lane.x+lane.width-margin;
        const low = Math.max(start,left), high = Math.min(end,right);
        if (low > high) continue;
        const room = high-low, middle = (low+high)/2;
        if (room >= 64) offer(middle,a.y,Math.min(preferred,room),column,true,room);
        // A label may extend past a short leg if its center still fits there.
        const x = Math.min(Math.max(middle,left+preferred/2),right-preferred/2);
        if (x >= low && x <= high) offer(x,a.y,preferred,column,true,room);
      }
    } else {
      const column = Math.floor((a.x-laneLeft)/laneWidth), lane = lanes[column];
      if (!lane) continue;
      const width = Math.min(preferred,2*(Math.min(a.x-lane.x,lane.x+lane.width-a.x)-margin));
      if (width >= 64) offer(a.x,(a.y+b.y)/2,width,column,false,Math.abs(b.y-a.y)-2*margin);
    }
  }
  if (best) return best;
  // A route can run outside the lane frame or be too short for an in-lane
  // label. Use an actual segment midpoint and let the SVG bounds grow.
  let a = path[0], b = a, longest = 0;
  for (let i=1;i<path.length;i++) {
    const previous = path[i-1], next = path[i];
    const length = Math.abs(next.x-previous.x)+Math.abs(next.y-previous.y);
    if (length > longest) { a = previous; b = next; longest = length; }
  }
  const layout = measure(preferred);
  return {...layout,x:(a.x+b.x-layout.width)/2,y:(a.y+b.y-layout.height)/2};
}

export function swimlaneRoutes(edges, boxes, viewRoutes, laneBoxes) {
  const routes = [];
  const references = new Map([...boxes,...laneBoxes]);
  const lanes = [...laneBoxes.values()], cards = lanes.map(()=>[]);
  edges.forEach((edge,index) => {
    const from = boxes.get(edge.source), to = boxes.get(edge.target);
    if (!from || !to) return;
    const automatic = automaticActivityRoute(from, to, index);
    const route = viewRoutes[edge.id];
    const resolved = route ? resolveVia(route,references) : undefined;
    const points = routedPoints(automatic,from,to,resolved)
      .filter((p,i,all) => !i || p.x !== all[i-1].x || p.y !== all[i-1].y);
    routes.push({edge,points,route,resolved});
  });
  if (!routes.some(({edge})=>edge.title)) return routes;
  // Index complete paths before placing labels, so a badge cannot hide an
  // unrelated crossing when another part of its own path has room.
  for (const card of boxes.values()) cards[card.lane].push(card);
  const strokes = lanes.map(()=>[]);
  for (const {edge,points} of routes) for (let i=1;i<points.length;i++) {
    const a=points[i-1], b=points[i];
    const bounds={id:edge.id,left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};
    const first=Math.max(0,Math.floor((bounds.left-laneLeft)/laneWidth));
    const last=Math.min(lanes.length-1,Math.floor((bounds.right-laneLeft)/laneWidth));
    for (let column=first;column<=last;column++) strokes[column].push(bounds);
  }
  for (const route of routes) {
    const {edge} = route;
    if (edge.title) route.caption=captionFor(route,boxes.get(edge.target),cards,lanes,strokes);
  }
  return routes;
}

// Make room where a flow crosses or runs along the frame. For a vertical
// boundary, positions in the cut list are Y coordinates, and vice versa.
function boundaryPath(fixed, start, end, cuts, vertical) {
  const segments = [];
  const line = (a,b) => vertical ? `M${fixed} ${a} V${b}` : `M${a} ${fixed} H${b}`;
  let cursor = start;
  for (const [low, high] of cuts.sort((a,b) => a[0]-b[0])) {
    if (low > cursor) segments.push(line(cursor,low));
    cursor = Math.max(cursor,high);
  }
  if (cursor < end) segments.push(line(cursor,end));
  return segments.join(' ');
}

export function swimlaneFrame(routes, laneCount, bottom) {
  const right = laneLeft + laneWidth * laneCount;
  const vertical = Array.from({length:laneCount + 1},() => []);
  const levels = [laneTop,laneHeader,bottom], horizontal = [[],[],[]];
  const cut = (cuts, low, high, start, end) => {
    low = Math.max(start,low - boundaryGap);
    high = Math.min(end,high + boundaryGap);
    if (low < high) cuts.push([low,high]);
  };
  for (const {points} of routes) for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const x0 = Math.min(a.x,b.x), x1 = Math.max(a.x,b.x), y0 = Math.min(a.y,b.y), y1 = Math.max(a.y,b.y);
    const first = Math.max(0,Math.ceil((x0-laneLeft)/laneWidth));
    const last = Math.min(laneCount,Math.floor((x1-laneLeft)/laneWidth));
    for (let column = first; column <= last; column++) cut(vertical[column],y0,y1,laneTop,bottom);
    for (let row = 0; row < levels.length; row++) {
      if (levels[row] >= y0 && levels[row] <= y1) cut(horizontal[row],x0,x1,laneLeft,right);
    }
  }
  return {
    dividers:vertical.map((cuts,i) => boundaryPath(laneLeft+i*laneWidth,laneTop,bottom,cuts,true)),
    rails:horizontal.map((cuts,i) => boundaryPath(levels[i],laneLeft,right,cuts,false)).join(' '),
  };
}
