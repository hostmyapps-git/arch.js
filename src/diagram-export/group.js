import { boundsOf } from './scene.js';

export function groupedShapes(items) {
  const result = [], groups = new Map();
  for (const item of items) {
    if (!item.group) { result.push(item); continue; }
    let group = groups.get(item.group);
    if (!group) {
      group = {kind:'group',id:`group-${groups.size+1}`,key:item.group,items:[]};
      groups.set(item.group,group);
      result.push(group);
    }
    group.items.push(item);
  }
  for (const group of groups.values()) {
    const points = group.items.flatMap(item => item.points ?? [[item.x,item.y],[item.x+item.width,item.y+item.height]]);
    Object.assign(group,boundsOf(points));
  }
  return {items:result,groups};
}
