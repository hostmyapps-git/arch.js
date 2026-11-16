import { ArchError } from './errors.js';
import { visibleNodeIds, matches } from './profiles.js';
import { composite, contrast, foreground, normalizeColor } from './colors.js';
import { validateMetaView } from './meta-syntax.js';

export const DIAGRAMS = ['connected', 'sequence', 'state', 'activity', 'matrix', 'heatmap', 'timeline', 'class'];
export const DIAGRAM_OPTIONS = {
  connected: [], sequence: ['participants','messages','asyncMessages','returns'],
  state: ['initial','finals'], activity: ['lanes','laneAttribute','initial','finals','decisions','forks','joins'],
  matrix: ['rows','columns','relations'], heatmap: ['valueAttribute','parentAttribute','min','max','colorLow','colorHigh'],
  timeline: ['startAttribute','endAttribute'],
  class: ['attributes','methods','functions','interfaces','ports','parameters','ownerAttribute','signatureAttribute','propertyFields']
};
const fields = DIAGRAM_OPTIONS;
const lists = new Set(['participants','messages','asyncMessages','returns','finals','lanes','decisions','forks','joins','rows','columns','relations','attributes','methods','functions','interfaces','ports','parameters']);
const members = ['attributes','methods','functions','interfaces','ports','parameters'];
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fail = (message, view) => { throw new ArchError(`View ${view.id}: ${message}`, view.loc, 'ARCH_VALIDATION'); };
const value = (node, name) => node.attributes?.[name] ?? node[name];
function selected(model, view) {
  const ids=visibleNodeIds(model,view), nodes=model.nodes.filter(n=>ids.has(n.id));
  return {nodes, edges:model.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))};
}
export function validateDiagramView(model, profile, view) {
  if(validateMetaView(view))return;
  const c=view.diagram ?? {type:'connected'}, type=c.type;
  if(!DIAGRAMS.includes(type)) fail(`Unknown diagram type ${type}`,view);
  const {nodes,edges}=selected(model,view), ids=new Set(nodes.map(n=>n.id)), edgeIds=new Set(edges.map(e=>e.id));
  if(type!=='connected' && (view.referenceDisplay==='nodes'||view.referenceDisplay==='both')) fail('graphical referenceDisplay requires the connected renderer',view);
  if(type!=='connected' && view.routeDefaults!==undefined) fail('routes defaults require the connected renderer',view);
  if(type!=='connected' && view.referenceOccurrences!==undefined) fail('referenceOccurrences requires the connected renderer',view);
  if(type!=='connected' && Object.values(view.styles).some(style=>['showIcon','showLabel','showStereotype','showDescription','showTechnology'].some(key=>style[key]!==undefined))) fail('node visibility style overrides require the connected renderer',view);
  if(type!=='connected' && Object.values(view.styles).some(style=>style.iconPosition!==undefined)) fail('iconPosition style overrides require the connected renderer',view);
  if(type!=='connected' && Object.values(view.styles).some(style=>style.display==='logo')) fail('logo display requires the connected renderer',view);
  if(type!=='connected' && Object.values(view.styles).some(style=>['fontSize','width','height'].some(field=>style[field]!==undefined))) fail('fontSize/width/height style overrides require the connected renderer',view);
  for(const [key,v] of Object.entries(c)) {
    if(key==='type') continue;
    if(!fields[type].includes(key)) fail(`Option ${key} does not apply to ${type}`,view);
    if(key==='propertyFields') {
      const allowed=new Set(['id','type','title','description','technology','stereotype','tags',...nodes.flatMap(n=>Object.keys(profile.nodeTypes[n.type]?.attributes??{}))]);
      if(!Array.isArray(v)||v.length>128||v.some(x=>typeof x!=='string'||!allowed.has(x))||new Set(v).size!==v.length) fail('propertyFields requires unique declared attribute or public property names',view);
    } else if(lists.has(key)) {
      if(!Array.isArray(v)||v.some(x=>typeof x!=='string')||new Set(v).size!==v.length) fail(`${key} requires a list of unique values`,view);
      const allowed=['messages','asyncMessages','returns'].includes(key)?edgeIds:key==='relations'?new Set(Object.keys(profile.relationTypes)):ids;
      for(const id of v) if(!allowed.has(id)) fail(`${key}: unknown or invisible reference ${id}`,view);
    } else if(['min','max'].includes(key)) { if(!Number.isFinite(v)) fail(`${key} must be finite`,view); }
    else if(typeof v!=='string') fail(`${key} must be a string`,view);
    if(key.startsWith('color')&&!normalizeColor(v)) fail(`Invalid color ${key}`,view);
  }
  if(Object.keys(view.places).length||Object.keys(view.routes).length||view.referenceRoutes?.length) if(type!=='connected') fail('place/route are only supported for connected; this renderer determines the layout',view);
  if(c.initial&&!ids.has(c.initial)) fail('initial is not visible',view);
  if(type==='sequence') {
    const participants=new Set(c.participants??nodes.map(n=>n.id)), messages=c.messages??edges.map(e=>e.id);
    for(const id of messages) { const e=edges.find(e=>e.id===id); if(!participants.has(e.source)||!participants.has(e.target)) fail(`Message ${id} requires both participants`,view); }
    for(const id of [...(c.returns??[]),...(c.asyncMessages??[])]) if(!messages.includes(id)) fail(`Message ${id} is not included in messages`,view);
    if((c.returns??[]).some(id=>(c.asyncMessages??[]).includes(id))) fail('A message cannot be both return and async',view);
  }
  if(type==='matrix'&&((c.rows??nodes).length>100||(c.columns??nodes).length>100)) fail('Matrix supports at most 100 rows/columns',view);
  if(type==='activity') {
    const lanes=new Set(c.lanes??[]), tasks=nodes.filter(n=>!lanes.has(n.id));
    for(const n of tasks) if(lanes.size&&!lanes.has(value(n,c.laneAttribute??'owner'))) fail(`${n.id}: Missing valid lane assignment`,view);
    const kinds=[...(c.decisions??[]),...(c.forks??[]),...(c.joins??[])];
    if(new Set(kinds).size!==kinds.length) fail('Activity has multiple control node kinds',view);
    for(const id of c.decisions??[]) if(edges.filter(e=>e.source===id).length<2) fail(`${id}: Decision requires at least two outgoing edges`,view);
    for(const id of c.forks??[]) if(edges.filter(e=>e.source===id).length<2) fail(`${id}: Fork requires at least two outgoing edges`,view);
    for(const id of c.joins??[]) if(edges.filter(e=>e.target===id).length<2) fail(`${id}: Join requires at least two incoming edges`,view);
    for(const e of edges) if(lanes.has(e.source)||lanes.has(e.target)) fail('Lane elements cannot be flow nodes',view);
  }
  if(['state','activity'].includes(type)) {
    if(c.initial&&(c.finals??[]).includes(c.initial)) fail('Initial and final nodes must be different',view);
    if(c.initial&&edges.some(e=>e.target===c.initial)) fail('Initial node cannot have incoming transitions',view);
    if(edges.some(e=>(c.finals??[]).includes(e.source))) fail('Final nodes cannot have outgoing transitions',view);
  }
  if(type==='heatmap') {
    const min=c.min??0,max=c.max??5; if(min>=max) fail('Heatmap requires min < max',view);
    if(!c.valueAttribute) fail('Missing valueAttribute',view);
    const parents=new Map();
    for(const n of nodes) {
      const v=value(n,c.valueAttribute); if(v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)) fail(`${n.id}: Heatmap value outside ${min}–${max}`,view);
      const parent=c.parentAttribute?value(n,c.parentAttribute):n.parent;
      if(parent!==undefined&&parent!==null) { if(!ids.has(parent)) fail(`${n.id}: Heatmap parent is not visible`,view); parents.set(n.id,parent); }
    }
    for(const n of nodes) { const seen=new Set(); let p=n.id; while(parents.has(p)) { if(seen.has(p)||seen.size>=32) fail('Heatmap hierarchy is cyclic or too deep',view); seen.add(p);p=parents.get(p); } }
  }
  if(type==='timeline') for(const n of nodes) {
    const start=value(n,c.startAttribute??'start'), end=value(n,c.endAttribute??'end');
    for(const v of [start,end]) {
      const match=typeof v==='string'&&v.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/);
      if(!match||!Number.isFinite(Date.parse(v))||new Date(Date.parse(match[1])).toISOString().slice(0,10)!==match[1]) fail(`${n.id}: Valid ISO start/end values are required`,view);
    }
    if(Date.parse(start)>Date.parse(end)) fail(`${n.id}: start is after end`,view);
  }
  if(type==='class') {
    const all=members.flatMap(k=>c[k]??[]), memberIds=new Set(all), byId=new Map(nodes.map(n=>[n.id,n]));
    if(memberIds.size!==all.length) fail('A detail belongs to multiple compartments',view);
    for(const id of all) {
      const owner=value(byId.get(id),c.ownerAttribute??'owner');
      if(!byId.has(owner)||id===owner||memberIds.has(owner)&&!(c.parameters??[]).includes(id)) fail(`${id}: Missing valid owner`,view);
      if((c.parameters??[]).includes(id)&&![...(c.methods??[]),...(c.functions??[])].includes(owner)) fail(`${id}: Parameter requires a method/function as its owner`,view);
    }
  }
}

// Independent layouts and SVG primitives; no DOM, CSS dependency or executable profile rules.
function scene(graph, theme, prefix) {
  const {nodes,edges,view,profileRules}=graph, c={...view.diagram,colorLow:normalizeColor(view.diagram.colorLow),colorHigh:normalizeColor(view.diagram.colorHigh)}, type=c.type;
  const dark=theme==='dark', bg=dark?'#111827':'#fafbfe', text=dark?'#f1f5f9':'#1e293b', border=dark?'#8b9ab2':'#64748b', muted=dark?'#b4bfd0':'#52627a';
  const byId=new Map(nodes.map(n=>[n.id,n])), out=[]; let width=900,height=300;
  const wrap=(s,limit)=> {
    const measure=s=>[...s].reduce((sum,c)=>sum+(/[MW@%]/.test(c)?1.6:/[ilI.,:! ]/.test(c)?0.5:1),0);
    const lines=[];for(const paragraph of String(s??'').split('\n')) {let line='';for(const word of paragraph.split(/\s+/)) {
      if(line&&measure(line+' '+word)>limit){lines.push(line);line='';}
      let part='';for(const ch of word){if(part&&measure(part+ch)>limit){lines.push(part);part='';}part+=ch;}
      line+=(line?' ':'')+part;
    }lines.push(line);}return lines;
  };
  const label=(s,x,y,w=200,size=13,color=text,anchor='start')=> {const all=wrap(s,Math.max(1,Math.floor(w/(size*.65)))), lines=all.slice(0,2); if(all.length>2) lines[1]=lines[1].slice(0,-1)+'…';out.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}"><title>${esc(s)}</title>${lines.map((s,i)=>`<tspan x="${x}" dy="${i?size*1.4:0}">${esc(s)}</tspan>`).join('')}</text>`);return lines.length*size*1.4;};
  const rect=(x,y,w,h,fill=bg,opacity=1,rx=6)=>out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" fill-opacity="${opacity}" stroke="${border}"/>`);
  const path=(d,arrow=false,dashed=false)=>out.push(`<path d="${d}" fill="none" stroke="${border}" stroke-width="1.5"${arrow?` marker-end="url(#${prefix}-${typeof arrow==='string'?arrow:'arrow'})"`:''}${dashed?' stroke-dasharray="6 5"':''}/>`);
  const card=(n,x,y,w=220,h=90,body)=> {
    Object.assign(n,{x,y,width:w,height:h});
    const fill=n.backgroundColor??(dark?'#1e293b':'#ffffff'), opacity=n.opacity??(n.backgroundColor?0.2:1), fg=foreground(composite(fill,bg,opacity));
    out.push(`<g data-node="${esc(n.id)}" data-type="${esc(n.type)}" transform="translate(${x} ${y})"><title>${esc(n.title)}</title>`);
    rect(0,0,w,h,fill,opacity);label(n.type,14,22,w-28,10,fg);label(n.title,14,45,w-28,14,fg); if(body) body(fg); out.push('</g>');
    return {x,y,width:w,height:h};
  };
  const edgeLabel=(e,x,y)=> {rect(x-80,y-14,160,20,bg,1,3);label(e.title,x,y,150,11,muted,'middle');};
  if(type==='sequence') {
    const participants=(c.participants??nodes.map(n=>n.id)).map(id=>byId.get(id));
    const messages=(c.messages??edges.map(e=>e.id)).map(id=>edges.find(e=>e.id===id));
    const gap=Math.max(280,...participants.map(n=>n.title.length*8+40));width=Math.max(500,participants.length*gap+160);height=180+messages.reduce((sum,e)=>sum+Math.max(90,Math.min(2,wrap(e.title,32).length)*18+50),0);
    const xs=new Map();participants.forEach((n,i)=>{const x=60+i*gap;xs.set(n.id,x+110);card(n,x,25,220,90);path(`M${x+110} 115 V${height-25}`,false,true);});
    let y=155;
    messages.forEach((e,i)=>{const a=xs.get(e.source),b=xs.get(e.target),ret=(c.returns??[]).includes(e.id),async=(c.asyncMessages??[]).includes(e.id);out.push(`<g data-edge="${esc(e.id)}" data-message="${i+1}" data-message-kind="${ret?'return':async?'async':'sync'}">`);
      if(a===b) {path(`M${a} ${y} h65 v35 h-65`,!async,ret);if(async)path(`M${a+10} ${y+29} L${a} ${y+35} l10 6`);label(`${i+1}. ${e.title}`,a+10,y-12,220,12);}
      else {path(`M${a} ${y} H${b}`,!async,ret);if(async)path(`M${b+(b>a?-10:10)} ${y-6} L${b} ${y} l${b>a?-10:10} 6`);label(`${i+1}. ${e.title}`,(a+b)/2,y-15,Math.abs(b-a)-25,12,text,'middle');}
      if(!ret&&!async)rect(b-4,y,8,35,dark?'#64748b':'#cbd5e1',1,0);out.push('</g>');y+=Math.max(90,Math.min(2,wrap(e.title,32).length)*18+50);
    });
  } else if(type==='matrix') {
    const rows=(c.rows??nodes.map(n=>n.id)).map(id=>byId.get(id)),cols=(c.columns??nodes.map(n=>n.id)).map(id=>byId.get(id));const cell=110,left=240,top=130;
    width=left+cols.length*cell+40;height=top+rows.length*70+60;
    cols.forEach((n,i)=>label(n.title,left+i*cell+cell/2,35,cell-12,12,text,'middle'));
    rows.forEach((n,r)=>{label(n.title,10,top+r*70+30,left-25,12);cols.forEach((m,k)=>{const matching=edges.filter(e=>e.source===n.id&&e.target===m.id&&(!c.relations||matches(e.type,c.relations,profileRules.relationTypes)));const x=left+k*cell,y=top+r*70;rect(x,y,cell,70,matching.length?(dark?'#134e4a':'#ccfbf1'):bg,1,0);out.push(`<g data-cell="${esc(n.id)}:${esc(m.id)}"><title>${esc(matching.map(e=>`${e.type}: ${e.title}`).join('\n')||'No relationship')}</title>`);label(matching.length||'·',x+cell/2,y+40,cell,16,text,'middle');out.push('</g>');});});
    label('Rows → columns · number of directed relationships',10,height-15,width-20,12,muted);
  } else if(type==='heatmap') {
    const parent=n=>c.parentAttribute?value(n,c.parentAttribute):n.parent,children=id=>nodes.filter(n=>(parent(n)??null)===id);
    const leaves=n=>Math.max(1,children(n.id).reduce((sum,k)=>sum+leaves(k),0));
    const levels=n=>1+Math.max(0,...children(n.id).map(levels));
    const roots=children(null);width=Math.max(600,roots.reduce((sum,n)=>sum+leaves(n)*250,0)+40);height=Math.max(270,...roots.map(n=>levels(n)*110+140));
    const mix=(a,b,t)=>composite(b,a,t),min=c.min??0,max=c.max??5;
    const tile=(n,x,y,w,h,backdrop=bg)=>{const v=value(n,c.valueAttribute),fill=v===undefined?(dark?'#64748b':'#94a3b8'):mix(c.colorLow??'#fee2e2',c.colorHigh??'#16a34a',(v-min)/(max-min)),fg=foreground(composite(fill,backdrop,n.opacity??0.2));out.push(`<g data-tile="${esc(n.id)}"><title>${esc(n.title)}: ${esc(v??'No value')}</title>`);rect(x,y,w,h,fill,n.opacity??0.2);label(`${n.title} · ${v??'—'}`,x+12,y+25,w-24,13,fg);out.push('</g>');let cx=x+12;for(const k of children(n.id)){const kw=(w-24)*leaves(k)/leaves(n);tile(k,cx,y+45,kw-8,h-57,composite(fill,backdrop,n.opacity??0.2));cx+=kw;}};
    let x=20;for(const n of roots){const w=leaves(n)*250;tile(n,x,20,w-15,height-105);x+=w;}
    for(let i=0;i<=10;i++)rect(25+i*28,height-55,28,18,mix(c.colorLow??'#fee2e2',c.colorHigh??'#16a34a',i/10),0.2,0);
    label(`${min} → ${max} · — = no value`,25,height-12,450,12,muted);
  } else if(type==='timeline') {
    const data=nodes.map(n=>({n,start:Date.parse(value(n,c.startAttribute??'start')),end:Date.parse(value(n,c.endAttribute??'end'))}));
    const min=Math.min(...data.map(d=>d.start),0===data.length?0:Infinity),max=Math.max(min+86400000,...data.map(d=>d.end));width=1200;height=130+data.length*90;const scale=t=>260+(t-min)/(max-min)*850,ys=new Map();
    for(let i=0;i<=5;i++){const x=260+i*170;path(`M${x} 65 V${height-25}`,false,true);label(new Date(min+(max-min)*i/5).toISOString().slice(0,10),x,35,140,11,text,'middle');}
    data.forEach(({n,start,end},i)=>{const y=85+i*90;ys.set(n.id,y+20);label(n.title,10,y+20,230,13);out.push(`<g data-bar="${esc(n.id)}"><title>${esc(n.title)}: ${esc(value(n,c.startAttribute??'start'))} – ${esc(value(n,c.endAttribute??'end'))}</title>`);const x=scale(start),w=scale(end)-x;if(!w)out.push(`<path d="M${x} ${y} l12 20 -12 20 -12 -20Z" fill="${text}"/>`);else rect(x,y,w,40,n.backgroundColor??'#6366f1',n.opacity??0.2);out.push('</g>');label(new Date(start).toISOString().slice(0,10),x,y+60,160,10,muted);});
    for(const e of edges){const a=data.find(d=>d.n.id===e.source),b=data.find(d=>d.n.id===e.target);if(a&&b)path(`M${scale(a.end)} ${ys.get(e.source)} H${scale(a.end)+15} V${ys.get(e.target)} H${scale(b.start)}`,true);}
  } else if(type==='class') {
    const memberIds=new Set(members.flatMap(k=>c[k]??[])),classes=nodes.filter(n=>!memberIds.has(n.id)),pos=new Map(),portPositions=new Map();
    const owner=n=>value(n,c.ownerAttribute??'owner'),signature=n=>value(n,c.signatureAttribute??'signature')??n.title;
    const memberText=m=>{const params=(c.parameters??[]).map(id=>byId.get(id)).filter(p=>owner(p)===m.id).map(signature).join(', ');const s=String(signature(m));return params?s.includes('()')?s.replace('()',`(${params})`):`${s} (${params})`:s;};
    const cardWidth=380, cardBorder=dark?'#37465d':'#dce3ed';
    const sectionColor=dark?'#a9b6cc':'#66758c';
    const symbols={properties:'·',attributes:'−',methods:'ƒ',functions:'ƒ',interfaces:'◇',ports:'□'};
    let x=30; height=220;
    for(const n of classes) {
      const sections=members.filter(k=>k!=='parameters').map(kind=>({kind,items:(c[kind]??[]).map(id=>byId.get(id)).filter(m=>owner(m)===n.id)})).filter(s=>s.items.length);
      const lines=sections.map(s=>({...s,rows:s.items.map(m=>({id:m.id,full:memberText(m),lines:wrap(memberText(m),32)}))}));
      const properties=(c.propertyFields??[]).filter(key=>value(n,key)!==undefined).map(key=>{
        const field=value(n,key), full=`${key}: ${Array.isArray(field)?'['+field.join(', ')+']':String(field)}`;
        return {id:`${n.id}.${key}`,full,lines:wrap(full,32)};
      });
      if(properties.length) lines.unshift({kind:'properties',rows:properties});
      const ownPorts=(c.ports??[]).map(id=>byId.get(id)).filter(p=>owner(p)===n.id);
      const h=Math.max(148,90+ownPorts.length*24,110+lines.reduce((sum,s)=>sum+50+s.rows.reduce((count,r)=>count+r.lines.length*21,0),0));
      const fill=n.backgroundColor??(dark?'#1e293b':'#ffffff'), opacity=n.opacity??(n.backgroundColor?0.2:1);
      const visible=composite(fill,bg,opacity), fg=n.backgroundColor||n.opacity!==undefined?foreground(visible):text;
      const subdued=n.backgroundColor?fg:sectionColor;
      const accent=n.accent&&contrast(n.accent,visible)>=4.5?n.accent:(n.backgroundColor?fg:dark?'#a5b4fc':'#6366f1');
      Object.assign(n,{x,y:40,width:cardWidth,height:h});pos.set(n.id,{x,y:40,width:cardWidth,height:h});
      out.push(`<g data-node="${esc(n.id)}" data-type="${esc(n.type)}" data-class-card="true" transform="translate(${x} 40)"><title>${esc(n.title)}</title>`);
      out.push(`<rect width="${cardWidth}" height="${h}" rx="16" fill="${fill}" fill-opacity="${opacity}" stroke="${cardBorder}" filter="url(#${prefix}-class-shadow)"/>`);
      out.push(`<path d="M16 1 H${cardWidth-16} Q${cardWidth-1} 1 ${cardWidth-1} 16 V95 H1 V16 Q1 1 16 1Z" fill="${accent}" fill-opacity="0.055"/>`);
      out.push(`<rect x="20" y="18" width="26" height="26" rx="7" fill="${accent}" fill-opacity="0.1"/><g font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-weight="600">`);
      label('{}',33,36,24,12,accent,'middle');out.push('</g><g font-weight="600" letter-spacing="1">');
      label(String(n.stereotype??n.type).toUpperCase(),58,35,cardWidth-80,10,subdued);out.push('</g><g font-weight="650">');
      label(n.title,20,65,cardWidth-40,18,fg);out.push('</g>');
      let y=116;
      for(const s of lines) {
        out.push(`<g data-compartment="${s.kind}"><title>${esc(s.rows.map(row=>row.full).join('\n'))}</title>`);
        out.push(`<path d="M20 ${y-16} H${cardWidth-20}" fill="none" stroke="${cardBorder}" stroke-width="0.8"/>`);
        out.push('<g font-weight="600" letter-spacing="1.2">');label(s.kind.toUpperCase(),22,y,cardWidth-85,9.5,subdued);out.push('</g>');
        out.push(`<rect x="${cardWidth-47}" y="${y-12}" width="25" height="17" rx="8.5" fill="${subdued}" fill-opacity="0.08"/>`);
        label(s.rows.length,cardWidth-34.5,y,22,9,subdued,'middle');y+=30;
        for(const row of s.rows) {
          out.push(`<g data-member="${esc(row.id)}"><title>${esc(row.full)}</title>`);
          label(symbols[s.kind],24,y,16,12,accent);
          out.push('<g font-family="ui-monospace,SFMono-Regular,Consolas,monospace">');
          for(const line of row.lines){label(line,46,y,cardWidth-68,12.5,fg);y+=21;}
          out.push('</g></g>');
        }
        y+=20;out.push('</g>');
      }
      out.push('</g>');
      ownPorts.forEach((p,index)=>{
        const py=64+index*24;
        out.push(`<g data-port="${esc(p.id)}"><title>${esc(p.title)}</title><rect x="${x+cardWidth-6}" y="${py-6}" width="12" height="12" rx="3" fill="${dark?'#1e293b':'#ffffff'}" stroke="${accent}" stroke-width="1.5"/><circle cx="${x+cardWidth}" cy="${py}" r="2" fill="${accent}"/></g>`);
        portPositions.set(p.id,{x:x+cardWidth,y:py});
      });
      x+=470;height=Math.max(height,h+120);
    }
    width=Math.max(500,x);for(const e of edges){const a=pos.get(e.source),b=pos.get(e.target),pa=portPositions.get(e.source),pb=portPositions.get(e.target);
      if((a||pa)&&(b||pb)){const start=pa??{x:a.x+a.width,y:a.y+56},end=pb??{x:b.x,y:b.y+56};
        path(`M${start.x} ${start.y} L${end.x} ${end.y}`,['generalization','realization'].includes(e.style)?'triangle':!['association','composition'].includes(e.style),['dependency','realization'].includes(e.style));
        edgeLabel(e,(start.x+end.x)/2,25);}}

  } else {
    // State and activity have control-node notation and independent row/lane layout.
    const laneIds=c.lanes??[],tasks=nodes.filter(n=>!laneIds.includes(n.id)),pos=new Map();
    const lanes=laneIds.length?laneIds:[null];width=Math.max(850,lanes.length*330+160);height=130+tasks.length*145;
    lanes.forEach((id,i)=>{if(id){rect(25+i*330,20,320,height-45,bg,1,0);label(byId.get(id).title,40+i*330,48,290,14);path(`M${25+i*330} 65 h320`);}});
    tasks.forEach((n,i)=>{const lane=laneIds.length?lanes.indexOf(value(n,c.laneAttribute??'owner')):0,x=laneIds.length?65+lane*330:Math.max(80,width/2-110),y=95+i*145;pos.set(n.id,{x,y,width:220,height:80,inY:y+(n.id===c.initial?29:(c.finals??[]).includes(n.id)?20:[...(c.forks??[]),...(c.joins??[])].includes(n.id)?30:0),outY:y+(n.id===c.initial?51:(c.finals??[]).includes(n.id)?60:[...(c.forks??[]),...(c.joins??[])].includes(n.id)?42:80)});
      out.push(`<g data-state="${esc(n.id)}">`);
      if(n.id===c.initial||(c.finals??[]).includes(n.id)){out.push(`<circle cx="${x+110}" cy="${y+40}" r="${n.id===c.initial?11:15}" fill="${text}"/>`);if(n.id!==c.initial)out.push(`<circle cx="${x+110}" cy="${y+40}" r="20" fill="none" stroke="${text}"/>`);label(n.title,x+140,y+44,110,11);}
      else if((c.decisions??[]).includes(n.id)){out.push(`<path d="M${x+110} ${y} l100 40 -100 40 -100 -40Z" fill="${bg}" stroke="${border}"/>`);label(n.title,x+110,y+44,150,12,text,'middle');}
      else if([...(c.forks??[]),...(c.joins??[])].includes(n.id)){rect(x,y+30,220,12,text,1,0);label(n.title,x,y+70,220,11);}
      else card(n,x,y,220,80);out.push('</g>');
    });
    edges.forEach((e,index)=>{const a=pos.get(e.source),b=pos.get(e.target);if(!a||!b)return;out.push(`<g data-edge="${esc(e.id)}">`);if(e.source===e.target){path(`M${a.x+220} ${a.y+20} h45 v50 h-45`,true);edgeLabel(e,a.x+300,a.y+45);}else if(b.y>a.y){const y=(a.outY+b.inY)/2;path(`M${a.x+110} ${a.outY} V${y} H${b.x+110} V${b.inY}`,true);if(e.title)edgeLabel(e,(a.x+b.x)/2+110,y-4);}else{const x=25+(index%3)*14;path(`M${a.x} ${a.y+40} H${x} V${b.y+40} H${b.x}`,true);if(e.title)edgeLabel(e,Math.max(110,a.x-90),(a.y+b.y)/2+40);}out.push('</g>');});
  }
  return {body:out.join(''),width:Math.max(300,width),height:Math.max(180,height)};
}
export function layoutDiagram(model,profile,view,nodes,edges) {
  const graph={title:model.title,description:model.description,profile:{id:profile.id,version:profile.version},profileRules:profile,view,nodes,edges};
  const result=scene(graph,view.theme,'measure');graph.bounds={x:-20,y:-20,width:result.width+40,height:result.height+40};return graph;
}
export function toDiagramSVG(graph,{theme,idPrefix}) {
  const result=scene(graph,theme,idPrefix),bg=theme==='dark'?'#111827':'#fafbfe',stroke=theme==='dark'?'#8b9ab2':'#64748b';
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${idPrefix}-diagram" data-arch-svg="${theme}" data-diagram="${graph.view.diagram.type}" role="img" aria-labelledby="${idPrefix}-title" width="${result.width+40}" height="${result.height+40}" viewBox="-20 -20 ${result.width+40} ${result.height+40}" style="max-width:100%;height:auto;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:${bg}"><title id="${idPrefix}-title">${esc(graph.title)} — ${esc(graph.view.title)}</title><defs><filter id="${idPrefix}-class-shadow" x="-15%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#0f172a" flood-opacity="${theme==='dark'?0.22:0.07}"/></filter><marker id="${idPrefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9Z" fill="${stroke}"/></marker><marker id="${idPrefix}-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1 L11 6 L1 11Z" fill="${bg}" stroke="${stroke}"/></marker></defs><rect x="-20" y="-20" width="${result.width+40}" height="${result.height+40}" fill="${bg}"/>${result.body}</svg>`;
}
