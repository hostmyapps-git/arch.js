import {effectiveDasharray} from './route-styles.js';
import {linearSpanProjection,pathPoint} from './svg-path.js';

// Each line keeps a sorted union of what earlier edges already cover. The
// first compatible stroke owns the interval, including its gaps.
const tolerance=0.001;
function firstInterval(intervals,position) {
  let low=0, high=intervals.length;
  while (low<high) {
    const mid=(low+high)>>1;
    if (intervals[mid][1]<position) low=mid+1;
    else high=mid;
  }
  return low;
}

function addInterval(intervals,low,high) {
  const first=firstInterval(intervals,low);
  let last=first;
  while (last<intervals.length&&intervals[last][0]<=high) {
    low=Math.min(low,intervals[last][0]);
    high=Math.max(high,intervals[last++][1]);
  }
  intervals.splice(first,last-first,[low,high]);
}

export function dashedOverlaps(edges,color,pathFor,trace,bridges) {
  const lines=new Map(), arcOwners=new Map(), masks=new Map();
  const mask=(edge,path)=>{
    if (!masks.has(edge)) masks.set(edge,[]);
    masks.get(edge).push(path);
  };
  for (const edge of edges) {
    const pattern=effectiveDasharray(edge);
    if (!pattern.length) continue;
    const style=`${color(edge)};${edge.width??1.5};${pattern.join(',')}`;
    for (const {arc,d} of bridges.get(edge)?.arcs??[]) {
      if (!arcOwners.has(arc)) arcOwners.set(arc,new Map());
      const owners=arcOwners.get(arc);
      if (!owners.has(style)) owners.set(style,edge);
      else if (owners.get(style)!==edge) mask(edge,d);
    }
    for (const span of trace(pathFor(edge)).spans) {
      const {a,b}=span, {axis,line,low,high}=linearSpanProjection(span);
      const key=`${style};${line}`;
      if (!lines.has(key)) lines.set(key,new Map());
      const byEdge=lines.get(key);
      if (!byEdge.has(edge)) byEdge.set(edge,[]);
      byEdge.get(edge).push({a,b,axis,low,high});
    }
  }
  for (const byEdge of lines.values()) {
    if (byEdge.size<2) continue;
    const intervals=[];
    for (const [edge,spans] of byEdge) {
      for (const {a,b,axis,low,high} of spans) {
        for (let i=firstInterval(intervals,low);i<intervals.length&&intervals[i][0]<high;i++) {
          const [begin,end]=intervals[i], from=Math.max(begin,low), to=Math.min(end,high);
          if (to-from<=tolerance) continue;
          const at=value=>{
            const t=(value-a[axis])/(b[axis]-a[axis]);
            return pathPoint({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});
          };
          mask(edge,`M ${at(from)} L ${at(to)}`);
        }
      }
      // Only intervals from earlier edges can hide this edge's stroke.
      for (const {low,high} of spans) addInterval(intervals,low,high);
    }
  }
  return masks;
}
