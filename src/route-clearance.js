function intersects(a,b) {
  return a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
}

function enters(a,b,box) {
  return a.x===b.x
    ? a.x>box.x && a.x<box.x+box.width && Math.min(a.y,b.y)<box.y+box.height && Math.max(a.y,b.y)>box.y
    : a.y>box.y && a.y<box.y+box.height && Math.min(a.x,b.x)<box.x+box.width && Math.max(a.x,b.x)>box.x;
}

function stub(point,box) {
  const middle = {x:box.x+box.width/2,y:box.y+box.height/2};
  const nx = (point.x-middle.x)/box.width, ny = (point.y-middle.y)/box.height;
  const distance = 16;
  return Math.abs(nx) >= Math.abs(ny)
    ? {x:point.x+Math.sign(nx)*distance,y:point.y}
    : {x:point.x,y:point.y+Math.sign(ny)*distance};
}

const padding = 14;
const inflate = box => ({
  x:box.x-padding, y:box.y-padding, width:box.width+2*padding, height:box.height+2*padding
});

// Try progressively wider channels at card boundaries. The original ports
// stay fixed, and manual points/paths are handled before this heuristic.
export function detourAroundCards(points,source,target,cards) {
  const mask = cards.filter(box => box!==source && box!==target && !box.container && !box.referenceOnly).map(inflate);
  if (!points.slice(1).some((point,i) => mask.some(box => enters(points[i],point,box)))) return;
  const start=points[0], end=points.at(-1), a=stub(start,source), b=stub(end,target);
  if (mask.some(box => enters(start,a,box)||enters(b,end,box))) return;
  const obstacles = [...mask,source,target];
  let best, bestCost = Infinity;
  for (const axis of ['x','y']) {
    const other = axis==='x'?'y':'x';
    const size = axis==='x'?'width':'height';
    const mid = (a[axis]+b[axis])/2;
    const channels = new Set([mid,a[axis],b[axis],...obstacles.flatMap(box=>[box[axis],box[axis]+box[size]])]);
    for (const channel of channels) {
      const bend = (p,value) => ({[axis]:value,[other]:p[other]});
      const track=[a,bend(a,channel),bend(b,channel),b];
      if (track.slice(1).some((point,i)=>obstacles.some(box=>enters(track[i],point,box)))) continue;
      const cost = Math.abs(channel-a[axis])+Math.abs(channel-b[axis])+Math.abs(b[other]-a[other])+0.001*Math.abs(channel-mid);
      if (cost<bestCost) {
        bestCost=cost;
        best=[start,...track,end].filter((point,i,all)=>!i || point.x!==all[i-1].x || point.y!==all[i-1].y);
      }
    }
  }
  return best;
}

export function clearRouteLabels(edges,cards,routes) {
  const occupied = cards.filter(card=>!card.container && !card.referenceOnly);
  const box = (edge,point) => ({x:point.x-edge.labelWidth/2-3,y:point.y-edge.labelHeight/2-3,
    width:edge.labelWidth+6,height:edge.labelHeight+6});
  const automatic = edge => {
    const route = routes.get(edge.id);
    return route?.avoidObstacles && route.label===undefined && !route.sideOffset && !route.via && !route.path &&
      !['straight','bezier'].includes(route.curve);
  };
  const labelled = edges.filter(edge=>edge.labelLines?.length || edge.labelIcon);
  for (const edge of labelled) if (!automatic(edge)) occupied.push(box(edge,edge.label));
  for (const edge of labelled) {
    if (!automatic(edge)) continue;
    if (occupied.some(card=>intersects(card,box(edge,edge.label)))) {
      const candidates = [];
      for (let i=1;i<edge.points.length;i++) {
        const a=edge.points[i-1], b=edge.points[i], horizontal=a.y===b.y;
        const length=Math.hypot(b.x-a.x,b.y-a.y);
        if (!length) continue;
        for (const fraction of [.5,.25,.75]) for (const side of [0,-1,1]) candidates.push({
          x:a.x+(b.x-a.x)*fraction+(horizontal?0:side*(edge.labelWidth/2+10)),
          y:a.y+(b.y-a.y)*fraction+(horizontal?side*(edge.labelHeight/2+10):0)
        });
      }
      candidates.sort((a,b)=>Math.hypot(a.x-edge.label.x,a.y-edge.label.y)-Math.hypot(b.x-edge.label.x,b.y-edge.label.y));
      const clear=candidates.find(point=>!occupied.some(card=>intersects(card,box(edge,point))));
      if (clear) edge.label=clear;
    }
    occupied.push(box(edge,edge.label));
  }
}
