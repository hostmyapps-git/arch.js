import {ArchError} from './errors.js';
import {matches} from './profiles.js';
import { wrap } from './text-layout.js';
import { polyPath } from './svg-path.js';
import {shareEdgePaths} from './shared-paths.js';
import {DEFAULT_CURVE} from './routing-options.js';

const fail=(message,view)=>{throw new ArchError(`View ${view.id}: ${message}`,{...view.loc,help:'@help diagrams tree'},'ARCH_VALIDATION');};
const defaultPadding = 48;
const validPadding = value => Number.isFinite(value) && value >= 0 && value <= 1e7;
export const TREE_OPTIONS=['relations','parentDirection','orientation','direction','levelGap','siblingGap','padding','showLabels','curve','sharePath'];
export function validateTreeOptions(c,profile,view) {
  for(const key of Object.keys(c))if(!['type','nodes','loc','propertyFields',...TREE_OPTIONS].includes(key))fail(`Unknown tree option: ${key}`,view);
  if(c.orientation!==undefined&&c.direction!==undefined)fail('Choose direction or orientation for a tree, not both',view);
  for(const [key,allowed]of [['parentDirection',['auto','source','target']],['orientation',['down','right','up','left']],['direction',['down','right','up','left']],['curve',['orthogonal','rounded']]])if(c[key]!==undefined&&!allowed.includes(c[key]))fail(`${key} must be ${allowed.join(' or ')}`,view);
  for(const key of ['levelGap','siblingGap'])if(c[key]!==undefined&&(!Number.isFinite(c[key])||c[key]<16||c[key]>800))fail(`${key} must be between 16 and 800`,view);
  const padding = c.padding;
  if (padding !== undefined && !(Array.isArray(padding)
    ? padding.length === 4 && [...padding].every(validPadding) : validPadding(padding)))
    fail('padding must be a number or [top, right, bottom, left] with values between 0 and 10000000',view);
  if(c.showLabels!==undefined&&typeof c.showLabels!=='boolean')fail('showLabels must be true or false',view);
  if(c.sharePath!==undefined&&!['none','stereotypes','all'].includes(c.sharePath))fail('sharePath must be none, stereotypes or all',view);
  if(c.relations!==undefined) {
    if(!Array.isArray(c.relations)||new Set(c.relations).size!==c.relations.length||c.relations.some(t=>typeof t!=='string'||!Object.hasOwn(profile.relationTypes,t)))fail('Tree relations must be unique known relationship types',view);
  }
}

// Relationship direction and visual parenthood are deliberately independent.
// Generalization is child -> parent, composition/ordinary links parent -> child.
export function treeStructure(nodes,edges,profile,view) {
  const c=view.diagram, order=new Map(nodes.map((n,i)=>[n.id,i]));
  const children=new Map(nodes.map(n=>[n.id,[]])),parents=new Map(),links=[];
  for(const edge of edges) {
    const type=edge.type??profile.defaultRelation;
    if(c.relations&&!matches(type,c.relations,profile.relationTypes))continue;
    if(edge.direction==='both')fail(`Tree relationship ${edge.id} is bidirectional; use directed hierarchy relationships or diagram connected`,view);
    const reverse=c.parentDirection==='target'||(!c.parentDirection||c.parentDirection==='auto')&&profile.relationTypes[type].style==='generalization';
    const parent=reverse?edge.target:edge.source,child=reverse?edge.source:edge.target;
    if(parent===child)fail(`Tree relationship ${edge.id} is a self-link; hierarchy relationships must be acyclic`,view);
    if(parents.has(child)) {
      const previous=parents.get(child);
      fail(previous.parent===parent?`Parallel tree relationships ${previous.edge.id} and ${edge.id}; filter relation types or hide one edge`:
        `Tree node ${child} has multiple parents (${previous.parent}, ${parent}); select one hierarchy, hide an edge, or use diagram connected`,view);
    }
    const link={edge,parent,child,reverse};parents.set(child,link);children.get(parent).push(child);links.push(link);
  }
  for(const list of children.values())list.sort((a,b)=>order.get(a)-order.get(b));
  const roots=nodes.filter(n=>!parents.has(n.id)).map(n=>n.id),topological=[...roots],depths=new Map(roots.map(id=>[id,0]));
  for(let i=0;i<topological.length;i++)for(const child of children.get(topological[i])) {
    depths.set(child,depths.get(topological[i])+1);topological.push(child);
  }
  if(topological.length!==nodes.length)fail('Tree hierarchy contains a cycle; correct the relationships or use diagram connected',view);
  return {children,parents,links,roots,topological,depths};
}

// Pack occupied intervals at matching ranks. A shallow sibling can use the
// empty space above a wider subtree without entering any occupied lower rank.
function packContours(profiles,gap) {
  const contour=[],positions=[];
  for(const profile of profiles) {
    let shift=0;
    for(let depth=0;depth<Math.min(contour.length,profile.length);depth++)
      shift=Math.max(shift,contour[depth].right+gap-profile[depth].left);
    positions.push(shift);
    for(let depth=0;depth<profile.length;depth++) {
      const left=profile[depth].left+shift,right=profile[depth].right+shift;
      contour[depth]=contour[depth]?{left:Math.min(contour[depth].left,left),right:Math.max(contour[depth].right,right)}:{left,right};
    }
  }
  return {positions,contour};
}

export function layoutTree(model,profile,view,inputNodes,inputEdges,{sharePaths=true}={}) {
  // Packages are cards in this projection; model containment is unchanged.
  const nodes=inputNodes.map(n=>({...n,parent:null,container:false}));
  const byId=new Map(nodes.map(n=>[n.id,n])),tree=treeStructure(nodes,inputEdges,profile,view),c=view.diagram;
  const direction=c.direction??c.orientation??'down',down=['down','up'].includes(direction),flip=['up','left'].includes(direction),siblingGap=c.siblingGap??48;
  const labelData=new Map(tree.links.map(({edge,child})=>{
    if(edge.treeLabel)return [child,{lines:edge.treeLabel.labelLines,width:edge.treeLabel.labelWidth,height:edge.treeLabel.labelHeight,metrics:edge.treeLabel}];
    const lines=c.showLabels===false?[]:wrap(edge.labelText??edge.title,Math.min(180,byId.get(child).width-38),11);
    const width=lines.length?Math.min(198,byId.get(child).width-20):0,height=lines.length?lines.length*15+8:0;
    return [child,{lines,width,height}];
  }));
  const contours=new Map(),childOffsets=new Map();
  const levelSizes=[],levelGaps=[];
  for(const id of [...tree.topological].reverse()) {
    const node=byId.get(id),children=tree.children.get(id),label=labelData.get(id);
    const cross=Math.max(down?node.width:node.height,(down?label?.width:label?.height)??0);
    const major=down?node.height:node.width,depth=tree.depths.get(id);
    levelSizes[depth]=Math.max(levelSizes[depth]??0,major);
    if(label)levelGaps[depth-1]=Math.max(levelGaps[depth-1]??0,2*(down?label.height:label.width)+56);
    const packed=packContours(children.map(child=>contours.get(child)),siblingGap);
    const center=children.length?(packed.positions[0]+packed.positions.at(-1))/2:0;
    childOffsets.set(id,packed.positions.map(x=>x-center));
    contours.set(id,[{left:-cross/2,right:cross/2},...packed.contour.map(p=>({left:p.left-center,right:p.right-center}))]);
    // Children have one parent; their contours are no longer needed after merging.
    for(const child of children)contours.delete(child);
  }
  const levels=[0];
  for(let i=1;i<levelSizes.length;i++)levels[i]=levels[i-1]+levelSizes[i-1]+Math.max(c.levelGap??96,levelGaps[i-1]??0);
  const forest=packContours(tree.roots.map(root=>contours.get(root)),siblingGap*2);
  const inset=-Math.min(0,...forest.contour.map(p=>p.left));
  const centers=new Map(tree.roots.map((root,i)=>[root,forest.positions[i]+inset]));
  for(const id of tree.topological) {
    const node=byId.get(id),center=centers.get(id),depth=tree.depths.get(id);
    const cross=center-(down?node.width:node.height)/2;
    node.x=down?cross:levels[depth];node.y=down?levels[depth]:cross;
    node.treeDepth=depth;node.treeParent=tree.parents.get(id)?.parent??null;
    tree.children.get(id).forEach((child,i)=>centers.set(child,center+childOffsets.get(id)[i]));
  }
  const majorEnd=Math.max(0,...nodes.map(n=>down?n.y+n.height:n.x+n.width));
  if(flip)for(const node of nodes)if(down)node.y=majorEnd-node.y-node.height;else node.x=majorEnd-node.x-node.width;
  const edges=tree.links.map(({edge,parent,child,reverse})=>{
    const p=byId.get(parent),n=byId.get(child),siblings=tree.children.get(parent),index=siblings.indexOf(child),fraction=(index+1)/(siblings.length+1);
    const gap=levels[n.treeDepth]-levels[p.treeDepth]-levelSizes[p.treeDepth],baseBend=levels[n.treeDepth]-gap/2,bend=flip?majorEnd-baseBend:baseBend;
    const a=down?{x:p.x+p.width*fraction,y:p.y+(flip?0:p.height)}:{x:p.x+(flip?0:p.width),y:p.y+p.height*fraction};
    const b=down?{x:n.x+n.width/2,y:n.y+(flip?n.height:0)}:{x:n.x+(flip?n.width:0),y:n.y+n.height/2};
    const visual=down?[a,{x:a.x,y:bend},{x:b.x,y:bend},b]:[a,{x:bend,y:a.y},{x:bend,y:b.y},b];
    const points=reverse?visual.reverse():visual,info=labelData.get(child);
    const sign=flip?1:-1,label=down?{x:b.x,y:b.y+sign*(info.height/2+14)}:{x:b.x+sign*(info.width/2+14),y:b.y};
    return {...edge,points,d:polyPath(points,(c.curve??DEFAULT_CURVE)==='rounded'),label,labelLines:info.lines,labelWidth:info.width,labelHeight:info.height,labelTextOffset:{x:0,y:0},...info.metrics};
  });
  // Named groups share only after their final placement and route overrides.
  const sharedPaths=sharePaths?shareEdgePaths(edges,nodes,new Map(edges.map(edge=>[edge.id,{sharePath:c.sharePath??'none',curve:c.curve??DEFAULT_CURVE}]))):[];
  const points=nodes.flatMap(n=>[{x:n.x,y:n.y},{x:n.x+n.width,y:n.y+n.height}]);
  for(const edge of edges){points.push(...edge.points);if(edge.labelLines.length||edge.labelIcon)points.push({x:edge.label.x-edge.labelWidth/2,y:edge.label.y-edge.labelHeight/2},{x:edge.label.x+edge.labelWidth/2,y:edge.label.y+edge.labelHeight/2});}
  const padding = c.padding ?? defaultPadding;
  const [top,right,bottom,left] = Array.isArray(padding) ? padding : [padding,padding,padding,padding];
  // Explicit padding measures from the visible layout. Keep the legacy
  // canvas floor for unconfigured trees and for trees with no visible items.
  const start = c.padding !== undefined ? points[0] : undefined;
  let minX = start?.x ?? 0, minY = start?.y ?? 0, maxX = start?.x ?? 160, maxY = start?.y ?? 96;
  for (const {x,y} of points) {
    minX = Math.min(minX,x); minY = Math.min(minY,y);
    maxX = Math.max(maxX,x); maxY = Math.max(maxY,y);
  }
  const x = minX-left, y = minY-top;
  const bounds = {x,y,width:maxX+right-x,height:maxY+bottom-y};
  return {title:model.title,description:model.description,profile:{id:profile.id,version:profile.version},view,nodes,edges,referenceNodes:[],...(sharedPaths.length?{sharedPaths}:{}),
    tree:{roots:tree.roots,orientation:direction,parentDirection:c.parentDirection??'auto'},bounds};
}
