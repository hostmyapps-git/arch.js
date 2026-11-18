import {ArchError} from './errors.js';
import {relationshipReferences} from './relationship-labels.js';
import {matches} from './profiles.js';

// Generic profile metadata identifies message relationships without framework names.
export function sequenceProjection(nodes,edges,c,profile,view) {
  const tagged=edges.filter(e=>profile.relationTypes[e.type??profile.defaultRelation]?.sequenceMessage);
  const messageRules=Object.entries(profile.relationTypes).filter(([,rule])=>rule.sequenceMessage);
  const taggedMode=tagged.length>0||(profile.viewpoints?.[view.viewpoint]?.requiredRelations??[]).some(type=>profile.relationTypes[type]?.sequenceMessage);
  const selected=new Set(c.participants??[]);
  let messages=c.messages?c.messages.map(id=>edges.find(e=>e.id===id)).filter(Boolean)
    :taggedMode?tagged:selected.size?edges.filter(e=>selected.has(e.source)&&selected.has(e.target)):edges;
  const endpointIds=new Set(messages.flatMap(e=>[e.source,e.target]));
  const fallback=taggedMode&&!endpointIds.size?nodes.filter(n=>messageRules.some(([,rule])=>matches(n.type,rule.from,profile.nodeTypes)||matches(n.type,rule.to,profile.nodeTypes))).map(n=>n.id):[...endpointIds];
  const participants=(c.participants??(taggedMode||c.showContext?fallback:nodes.map(n=>n.id))).map(id=>nodes.find(n=>n.id===id)).filter(Boolean);
  if(c.orderAttribute) {
    const orders=messages.map(e=>e.attributes?.[c.orderAttribute]??e[c.orderAttribute]);
    if(orders.some(n=>!Number.isSafeInteger(n)||n<1)||new Set(orders).size!==orders.length)
      throw new ArchError(`View ${view.id}: ${c.orderAttribute} requires unique positive integer values on selected sequence messages`,view.loc);
    messages=[...messages].sort((a,b)=>(a.attributes?.[c.orderAttribute]??a[c.orderAttribute])-(b.attributes?.[c.orderAttribute]??b[c.orderAttribute]));
  }
  return {participants,messages};
}

export function drawSequence({nodes,edges,c,profile,view,out,card,path,label,rect,esc,bg,muted,text,dark,wrap}) {
  const {participants,messages}=sequenceProjection(nodes,edges,c,profile,view),byId=new Map(nodes.map(n=>[n.id,n]));
  const participantIds=new Set(participants.map(n=>n.id));
  const refs=e=>e.referenceDisplay==='labels'?[]:(e.referenceItems??relationshipReferences(e,profile.relationTypes[e.type??profile.defaultRelation]??{})).filter(r=>byId.has(r.id)&&!participantIds.has(r.id));
  const objectIds=new Set(messages.flatMap(e=>refs(e).map(r=>r.id)));
  const context=c.showContext?nodes.filter(n=>!participantIds.has(n.id)&&!objectIds.has(n.id)):[];
  const gap=Math.max(320,...participants.map(n=>n.title.length*8+40),...messages.map(e=>refs(e).length*260+60));
  const mainWidth=Math.max(600,participants.length*gap+160),contextX=mainWidth+100;
  const headerY=context.length?100:25;
  const rowHeight=e=>refs(e).length?260:Math.max(90,Math.min(2,wrap(e.title,32).length)*18+50);
  const sequenceHeight=headerY+140+messages.reduce((sum,e)=>sum+rowHeight(e),0);
  const height=Math.max(sequenceHeight,context.length?headerY+Math.ceil(context.length/2)*190+100:0);
  let width=context.length?contextX+760:mainWidth;
  const xs=new Map(),drawn=new Map();
  participants.forEach((n,i)=>{const x=60+i*gap;xs.set(n.id,x+110);drawn.set(n.id,card(n,x,headerY,220,90));path(`M${x+110} ${headerY+90} V${height-25}`,false,true);});
  context.forEach((n,i)=>drawn.set(n.id,card(n,contextX+(i%2)*460,headerY+Math.floor(i/2)*190,240,90)));
  let y=headerY+130;
  for(const [i,e]of messages.entries()) {
    const items=refs(e),a=xs.get(e.source),b=xs.get(e.target),self=a===b;
    if(items.length)y+=150;
    const anchor={x:self?a+65:(a+b)/2,y:self?y+17.5:y};
    const ret=(c.returns??[]).includes(e.id),async=(c.asyncMessages??[]).includes(e.id);
    out.push(`<g data-edge="${esc(e.id)}" data-message="${i+1}" data-message-kind="${ret?'return':async?'async':'sync'}">`);
    if(self){path(`M${a} ${y} h65 v35 h-65`,!async,ret);if(async)path(`M${a+10} ${y+29} L${a} ${y+35} l10 6`);}
    else {path(`M${a} ${y} H${b}`,!async,ret);if(async)path(`M${b+(b>a?-10:10)} ${y-6} L${b} ${y} l${b>a?-10:10} 6`);}
    const caption=e.referenceDisplay==='labels'||e.referenceDisplay==='both'?e.labelText??e.title:e.title;
    label(`${i+1}. ${caption}`,self?a+10:(a+b)/2,items.length?y+(self?55:24):y-15,self?240:Math.max(200,Math.abs(b-a)-25),12,text,self?'start':'middle');
    if(!ret&&!async)rect(b-4,self?y+35:y,8,35,dark?'#64748b':'#cbd5e1',1,0);
    out.push('</g>');
    for(const [j,item]of items.entries()) {
      const n=byId.get(item.id);
      if(!drawn.has(n.id)) {
        const x=self?a+80:anchor.x-items.length*260/2+j*260+10;
        drawn.set(n.id,card(n,x,y-160,240,90));width=Math.max(width,x+280);
      }
      const box=drawn.get(n.id),sx=box.x+box.width/2,sy=box.y+box.height;
      out.push(`<g class="arch-sequence-reference" data-reference-for="${esc(e.id)}" data-reference-node="${esc(n.id)}">`);
      path(`M${sx} ${sy} L${anchor.x} ${anchor.y}`,true);
      if(e.referenceConnectorLabels) {
        const lx=(sx+anchor.x)/2,ly=(sy+anchor.y)/2;
        rect(lx-90,ly-12,180,24,bg,1,4);label(item.label,lx,ly+4,170,11,muted,'middle');
      }
      out.push('</g>');
    }
    y+=rowHeight(e)-(items.length?150:0);
  }
  const messageIds=new Set(messages.map(e=>e.id));
  if(c.showContext)for(const [i,e]of edges.filter(e=>!messageIds.has(e.id)&&drawn.has(e.source)&&drawn.has(e.target)).entries()) {
    const a=drawn.get(e.source),b=drawn.get(e.target);let d,lx,ly;
    if(participantIds.has(e.source)&&context.some(n=>n.id===e.target)) {
      const top=20+(i%4)*14,ax=a.x+a.width/2,bx=b.x+b.width/2;
      d=`M${ax} ${a.y} V${top} H${bx} V${b.y}`;lx=(ax+bx)/2;ly=top-4;
    } else if(a.x<contextX&&b.x>=contextX) {
      // Approach context cards from the row gutter so an attachment to the
      // second column cannot run through a first-column card.
      const ax=a.x+a.width,ay=a.y+a.height/2,bx=b.x+b.width/2,bridge=b.y-30,gutter=contextX-30;
      d=`M${ax} ${ay} H${gutter} V${bridge} H${bx} V${b.y}`;
      lx=(ax+contextX)/2;ly=ay-18;
    } else if(a.x===b.x&&a.y!==b.y) {
      const down=b.y>a.y,ax=a.x+a.width/2,ay=down?a.y+a.height:a.y,by=down?b.y:b.y+b.height;
      d=`M${ax} ${ay} V${by}`;lx=ax+86;ly=(ay+by)/2;
    } else {
      const right=b.x>a.x,ax=right?a.x+a.width:a.x,bx=right?b.x:b.x+b.width,ay=a.y+a.height/2,by=b.y+b.height/2;
      const mid=(ax+bx)/2;d=`M${ax} ${ay} H${mid} V${by} H${bx}`;lx=mid;ly=(ay+by)/2-8;
    }
    out.push(`<g class="arch-sequence-context-edge" data-edge="${esc(e.id)}" data-type="${esc(e.type)}">`);
    path(d,true);rect(lx-90,ly-12,180,24,bg,1,4);label(e.title||e.type,lx,ly+4,170,11,muted,'middle');out.push('</g>');
  }
  return {width,height};
}
