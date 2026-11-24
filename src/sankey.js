import { escape } from './svg-values.js';
import { matches } from './profiles.js';
import { singleLine } from './text-layout.js';

const palette = ['#5964c8','#37877f','#b47a36','#a75586','#477fac','#779157'];
const nodeWidth = 12, columnGap = 254, nodeGap = 22;
const number = value => Math.round(value*100)/100;

export function sankeyFlow(edges, options, profile) {
  return edges.filter(edge => !options.relations?.length || matches(edge.type,options.relations,profile.relationTypes));
}

// Kahn ranks keep the layout independent of model declaration order for
// precedence. Keep model order when several actors occupy the same rank.
export function sankeyRanks(edges) {
  const ranks = new Map(), incoming = new Map(), outgoing = new Map();
  for (const {source,target} of edges) {
    ranks.set(source,0); ranks.set(target,0);
    incoming.set(target,(incoming.get(target) ?? 0)+1);
    if (!outgoing.has(source)) outgoing.set(source,[]);
    outgoing.get(source).push(target);
  }
  const queue = [...ranks.keys()].filter(id => !incoming.has(id));
  for (let index=0; index<queue.length; index++) {
    const id = queue[index];
    for (const target of outgoing.get(id) ?? []) {
      ranks.set(target,Math.max(ranks.get(target),ranks.get(id)+1));
      const left = incoming.get(target)-1;
      incoming.set(target,left);
      if (!left) queue.push(target);
    }
  }
  return queue.length === ranks.size ? ranks : null;
}

export function sankeyLayout(nodes, edges, options) {
  const ranks = sankeyRanks(edges), byId = new Map(), layers = [], flows = [];
  const add = (band,rank) => (layers[rank] ??= []).push(band);
  for (const node of nodes) if (ranks.has(node.id)) {
    const rank = ranks.get(node.id);
    const actor = {node,rank,incoming:0,outgoing:0,color:palette[byId.size%palette.length]};
    byId.set(node.id,actor);
    add(actor,rank);
  }
  const weightOf = edge => options.weightAttribute ? edge.attributes?.[options.weightAttribute] : 1;
  // Normalize before summing to avoid overflowing for valid large weights.
  let max = 1;
  for (const edge of edges) max = Math.max(max,weightOf(edge));
  for (const edge of edges) {
    const start = byId.get(edge.source), end = byId.get(edge.target);
    const weight = weightOf(edge)/max, chain = [start];
    start.outgoing += weight; end.incoming += weight;
    // A long link gets one invisible slot in each intervening column, so
    // it never passes through a node that happens to occupy that rank.
    for (let rank=start.rank+1; rank<end.rank; rank++) {
      const transit = {rank,incoming:weight,outgoing:weight};
      add(transit,rank);
      chain.push(transit);
    }
    chain.push(end);
    flows.push({edge,weight,chain});
  }
  let scale = Infinity;
  for (const layer of layers) {
    const total = layer.reduce((sum,node)=>sum+Math.max(node.incoming,node.outgoing),0);
    if (total>0) scale = Math.min(scale,340/total);
  }
  if (!Number.isFinite(scale)) scale = 1;
  const heights = layers.map(layer => layer.reduce((sum,node)=>sum+Math.max(node.node?30:0,scale*Math.max(node.incoming,node.outgoing))+nodeGap,0));
  const height = Math.max(180,...heights)+52, width = Math.max(400, (layers.length-1)*columnGap+220);
  layers.forEach((layer,index) => {
    let y = (height-heights[index])/2;
    for (const actor of layer) {
      const h = Math.max(actor.node?30:0,scale*Math.max(actor.incoming,actor.outgoing));
      actor.x = index*columnGap+17; actor.y = y; actor.height = h;
      y += h+nodeGap;
    }
  });
  return {width,height,byId,flows,scale,weightOf};
}

export function drawSankey({width,height,byId,flows,scale,weightOf},dark) {
  const ink = dark?'#ecf2ff':'#22324a', surface = dark?'#172238':'#fff', border = dark?'#344662':'#dce5ef';
  const base = `<rect width="${width}" height="${height}" rx="12" fill="${surface}" stroke="${border}"/>`;
  if (!flows.length) return base + `<text x="22" y="58" font-size="14" fill="${ink}">No flows in this view</text>`;
  const incoming = new Map(), outgoing = new Map();
  const slot = (offsets, actor, side, thickness) => {
    const y = offsets.get(actor) ?? actor.y+(actor.height-actor[side]*scale)/2;
    offsets.set(actor,y+thickness);
    return y+thickness/2;
  };
  const bands = flows.map(({edge,weight,chain}) => {
    const thickness = weight*scale;
    let path = '';
    for (let index=1; index<chain.length; index++) {
      const a = chain[index-1], b = chain[index], x = a.x+(a.node?nodeWidth:0);
      const y = slot(outgoing,a,'outgoing',thickness), endY = slot(incoming,b,'incoming',thickness), mid = (x+b.x)/2;
      path += index===1 ? `M${x} ${number(y)}` : '';
      path += `C${mid} ${number(y)} ${mid} ${number(endY)} ${b.x} ${number(endY)}`;
    }
    const start = chain[0].node.title, target = chain.at(-1).node.title;
    return `<path data-edge="${escape(edge.id)}" d="${path}" fill="none" stroke="${chain[0].color}" stroke-opacity="${dark?.7:.49}" stroke-width="${number(thickness)}"><title>${escape(`${start} → ${target} · ${edge.title || edge.type} · ${weightOf(edge)}`)}</title></path>`;
  }).join('');
  const nodes = [...byId.values()].map(({node,x,y,height,color}) => {
    return `<g data-node="${escape(node.id)}"><title>${escape(node.title)}</title><rect x="${x}" y="${number(y)}" width="${nodeWidth}" height="${number(height)}" rx="4" fill="${color}"/><text x="${x+nodeWidth+7}" y="${number(y+height/2+5)}" font-size="13" font-weight="650" fill="${ink}" stroke="${surface}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${escape(singleLine(node.title,170,13))}</text></g>`;
  }).join('');
  return base+bands+nodes;
}
