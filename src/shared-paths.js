// Presentation-only fan-in/fan-out networks. Every relationship keeps its full
// path for reference attachments; only its private branch is painted separately.
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

export function shareEdgePaths(edges,nodes,routes,path) {
  const boxes=new Map(nodes.map(n=>[n.id,n])),used=new Set(),shared=[];
  const eligible=edge=>{
    const r=routes.get(edge.id)??{};
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
      const key=JSON.stringify([hub.id,port,r.sharePath,r.sharePath==='stereotypes'?edge.type:null,edge.style,edge.direction??'forward',r.curve??'orthogonal']);
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
        plans.push({edge,points,label,branch:incoming?[leafPoint,fork]:[fork,leafPoint]});
      }
      if(plans.length!==group.length)continue;
      const id=`shared-${shared.length/2+1}`,prototype=group[0].edge;
      const metadata={id,edgeIds:group.map(c=>c.edge.id),types:[...new Set(group.map(c=>c.edge.type))],style:prototype.style,direction:prototype.direction};
      const spine=[{...junction,[cross]:Math.min(...crossValues)},{...junction,[cross]:Math.max(...crossValues)}];
      const stem=incoming?[junction,hubPoint]:[hubPoint,junction];
      shared.push({...metadata,part:'spine',d:path(spine,false),drawStart:false,drawEnd:false},
        {...metadata,part:'stem',d:path(stem,false),drawStart:!incoming,drawEnd:incoming});
      for(const {edge,points,label,branch}of plans) {
        Object.assign(edge,{points,d:path(points,false),drawD:path(branch,false),label,sharedPath:id,drawStart:incoming,drawEnd:!incoming});
        used.add(edge.id);
      }
    }
  }
  return shared;
}
