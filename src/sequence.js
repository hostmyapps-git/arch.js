import {ArchError} from './errors.js';
import {relationshipReferences} from './relationship-labels.js';
import {matches} from './profiles.js';

// Generic profile metadata identifies message relationships without framework names.
export function sequenceProjection(nodes,edges,c,profile,view) {
  const tagged=edges.filter(e=>profile.relationTypes[e.type??profile.defaultRelation]?.sequenceMessage);
  const taggedMode=tagged.length>0||(profile.viewpoints?.[view.viewpoint]?.requiredRelations??[]).some(type=>profile.relationTypes[type]?.sequenceMessage);
  let messages = edges;
  if (c.messages) {
    const byId = new Map(edges.map(edge => [edge.id, edge]));
    messages = c.messages.map(id => byId.get(id)).filter(Boolean);
  } else if (taggedMode) {
    messages = tagged;
  } else if (c.participants?.length) {
    const selected = new Set(c.participants);
    messages = edges.filter(edge => selected.has(edge.source) && selected.has(edge.target));
  }

  let participants = nodes;
  if (c.participants) {
    const byId = new Map(nodes.map(node => [node.id, node]));
    participants = c.participants.map(id => byId.get(id)).filter(Boolean);
  } else if (taggedMode || c.showContext) {
    const endpoints = new Set();
    for (const edge of messages) { endpoints.add(edge.source); endpoints.add(edge.target); }
    if (taggedMode && !endpoints.size) {
      const rules = Object.values(profile.relationTypes).filter(rule => rule.sequenceMessage);
      participants = nodes.filter(node => rules.some(rule =>
        matches(node.type, rule.from, profile.nodeTypes) || matches(node.type, rule.to, profile.nodeTypes)));
    } else {
      // Preserve the message endpoint order in the implicit participant list.
      const byId = new Map(nodes.map(node => [node.id, node]));
      participants = [...endpoints].map(id => byId.get(id)).filter(Boolean);
    }
  }
  if(c.orderAttribute) {
    const order = edge => edge.attributes?.[c.orderAttribute] ?? edge[c.orderAttribute];
    const orders = messages.map(order);
    if(orders.some(n=>!Number.isSafeInteger(n)||n<1)||new Set(orders).size!==orders.length)
      throw new ArchError(`View ${view.id}: ${c.orderAttribute} requires unique positive integer values on selected sequence messages`,view.loc);
    messages = [...messages].sort((a,b) => order(a) - order(b));
  }
  return {participants,messages};
}

export function drawSequence({nodes,edges,c,profile,view,out,card,path,label,rect,esc,bg,muted,text,dark,measureOnly}) {
  const {participants,messages}=sequenceProjection(nodes,edges,c,profile,view),byId=new Map(nodes.map(n=>[n.id,n]));
  const participantIds=new Set(participants.map(n=>n.id));
  const references = new Map(), objectIds = new Set();
  for (const message of messages) {
    const items = message.referenceDisplay === 'labels' ? [] : (
      message.referenceItems ?? relationshipReferences(message, profile.relationTypes[message.type ?? profile.defaultRelation] ?? {})
    ).filter(ref => byId.has(ref.id) && !participantIds.has(ref.id));
    references.set(message.id, items);
    for (const item of items) objectIds.add(item.id);
  }
  const context=c.showContext?nodes.filter(n=>!participantIds.has(n.id)&&!objectIds.has(n.id)):[];
  const contextIds=new Set(context.map(node=>node.id));
  const above=new Map(), aboveIds=new Set();
  if (context.length) {
    const candidates=edges.filter(edge=>participantIds.has(edge.source)&&contextIds.has(edge.target)&&
      profile.relationTypes[edge.type??profile.defaultRelation]?.sequenceContext==='above');
    const targetCounts=new Map();
    for (const {target} of candidates) targetCounts.set(target,(targetCounts.get(target)??0)+1);
    // A shared context element stays a single card in the side area.
    for (const edge of candidates) if (targetCounts.get(edge.target)===1&&!above.has(edge.source)) {
      above.set(edge.source,edge);
      aboveIds.add(edge.target);
    }
  }
  const sideContext=context.filter(node=>!aboveIds.has(node.id));
  const gap=Math.max(320,...participants.map(n=>n.title.length*8+40),...messages.map(e=>references.get(e.id).length*260+60));
  const mainWidth=Math.max(600,participants.length*gap+160),contextX=mainWidth+100;
  const headerY=above.size?195:sideContext.length?100:25;
  // At most two label rows fit in the standard 90px gap. Only object
  // cards reserve a taller row, so text wrapping is purely presentational.
  const rowHeight = edge => references.get(edge.id).length ? 260 : 90;
  const sequenceHeight=headerY+140+messages.reduce((sum,e)=>sum+rowHeight(e),0);
  const height=Math.max(sequenceHeight,sideContext.length?headerY+Math.ceil(sideContext.length/2)*190+100:0);
  let width=sideContext.length?contextX+760:mainWidth;
  const xs=new Map(),drawn=new Map();
  const returns = new Set(c.returns), asyncMessages = new Set(c.asyncMessages);
  participants.forEach((n,i)=>{
    const x=60+i*gap, contextEdge=above.get(n.id);
    xs.set(n.id,x+110);
    if (contextEdge) drawn.set(contextEdge.target,card(byId.get(contextEdge.target),x,25,220,90));
    drawn.set(n.id,card(n,x,headerY,220,90));
    path(`M${x+110} ${headerY+90} V${height-25}`,false,true);
  });
  sideContext.forEach((n,i)=>drawn.set(n.id,card(n,contextX+(i%2)*460,headerY+Math.floor(i/2)*190,240,90)));
  let y=headerY+130;
  for(const [i,e]of messages.entries()) {
    const items=references.get(e.id),a=xs.get(e.source),b=xs.get(e.target),self=a===b;
    if(items.length)y+=150;
    const anchor={x:self?a+65:(a+b)/2,y:self?y+17.5:y};
    const ret=returns.has(e.id),async=asyncMessages.has(e.id);
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
  if (measureOnly || !c.showContext) return { width, height };
  for(const [i,e]of edges.filter(e=>!references.has(e.id)&&drawn.has(e.source)&&drawn.has(e.target)).entries()) {
    const a=drawn.get(e.source),b=drawn.get(e.target);let d,lx,ly;
    if(above.get(e.source)===e) {
      const x=a.x+a.width/2, end=b.y+b.height;
      d=`M${x} ${a.y} V${end}`;lx=x+98;ly=(a.y+end)/2;
    } else if(participantIds.has(e.source)&&contextIds.has(e.target)&&!aboveIds.has(e.target)) {
      const top=(above.size?133:20)+(i%4)*14,ax=a.x+a.width/2,bx=b.x+b.width/2;
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
