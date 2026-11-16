import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';

const source=(rules='',title='Transfers data')=>`architecture "Edge icons" {model {
 person a "Sender" system b "Receiver" relation transfer a -> b "${title}"
 relation response b -> a "Acknowledges"}
 view v "Icons" {place a at (0,0) place b at (600,120) ${rules}}
 view clean "Plain" {}}`;
const xml=svg=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(svg,'image/svg+xml');
const labels=d=>[...d.getElementsByTagName('g')].filter(g=>g.getAttribute('class')==='arch-edge-label');
const inside=(graph,p)=>assert.ok(p.x>=graph.bounds.x&&p.y>=graph.bounds.y&&p.x<=graph.bounds.x+graph.bounds.width&&p.y<=graph.bounds.y+graph.bounds.height);

test('edge label icons support all four positions and reserve space for multiline text inside export bounds',()=>{
 const title='A deliberately long transfer label that wraps across several lines';
 for(const position of ['top','left','bottom','right']) {
  const model=arch.parse(source(`route transfer {icon core.shield iconPosition ${position} label (-900,-500)}`,title)),before=JSON.stringify(model),graph=arch.layout(model),edge=graph.edges[0];
  assert.equal(edge.labelIconPosition,position);assert.ok(edge.labelLines.length>1);
  const icon=edge.labelIconBox,offset=edge.labelTextOffset;
  if(position==='left')assert.ok(icon.x+icon.size<offset.x);
  if(position==='right')assert.ok(icon.x>offset.x);
  if(position==='top')assert.ok(icon.y+icon.size<offset.y);
  if(position==='bottom')assert.ok(icon.y>offset.y);
  inside(graph,{x:edge.label.x-edge.labelWidth/2,y:edge.label.y-edge.labelHeight/2});
  inside(graph,{x:edge.label.x+edge.labelWidth/2,y:edge.label.y+edge.labelHeight/2});
  for(const theme of ['light','dark']) {
   const d=xml(arch.renderToString(model,{theme})),label=labels(d).find(g=>g.getAttribute('data-label-for')==='transfer');
   assert.equal(label.getAttribute('data-icon-position'),position);assert.equal(label.textContent,edge.labelLines.join(''));
   assert.ok([...label.getElementsByTagName('g')].some(g=>g.getAttribute('data-icon')==='core.shield'));
  }
  assert.equal(JSON.stringify(model),before);
 }
});

test('global icon defaults and per-route icon, position and none overrides are view-local',()=>{
 const model=arch.parse(source('routes {icon core.cloud iconPosition top} route transfer {icon core.shield iconPosition right} route response {icon none}'));
 const graph=arch.layout(model);assert.equal(graph.edges[0].labelIcon,'core.shield');assert.equal(graph.edges[0].labelIconPosition,'right');assert.equal(graph.edges[1].labelIcon,undefined);
 const inherited=arch.layout(arch.parse(source('routes {icon core.cloud iconPosition bottom} route transfer {icon core.shield}')));
 assert.equal(inherited.edges[0].labelIconPosition,'bottom');assert.equal(inherited.edges[1].labelIcon,'core.cloud');
 const clean=arch.layout(model,{view:'clean'});assert.ok(clean.edges.every(edge=>!edge.labelIcon));
 const plain=arch.layout(arch.parse(source('route transfer {iconPosition top}')));
 assert.ok(plain.edges.every(edge=>!edge.labelIcon));
 const standard=arch.layout(arch.parse(source('route transfer {icon core.cloud}')));assert.equal(standard.edges[0].labelIconPosition,'left');
});

test('icon-only labels render without text, preserve accessible relationship titles and can be disabled',()=>{
 const text=source('route transfer {icon core.shield}',''),model=arch.parse(text),graph=arch.layout(model),edge=graph.edges[0];
 assert.equal(edge.labelLines.length,0);assert.equal(edge.labelWidth,34);assert.equal(edge.labelHeight,24);
 const label=labels(xml(arch.renderToString(model))).find(g=>g.getAttribute('data-label-for')==='transfer');
 assert.equal(label.getElementsByTagName('text').length,0);assert.equal(label.getAttribute('aria-label'),'flow');
 assert.equal(labels(xml(arch.renderToString(source('routes {icon core.cloud} route transfer {icon none}','')))).filter(g=>g.getAttribute('data-label-for')==='transfer').length,0);
});

test('colored non-square label icons fit their slots and isolate repeated gradient IDs from other instances',()=>{
 arch.registerIconPack('edge-logo',{icons:{wide:{width:300,height:100,body:'<defs><linearGradient id="paint"><stop stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect width="300" height="100" fill="url(#paint)"/>'}}});
 const d=xml(arch.renderToString(source('routes {icon edge-logo.wide}'),{idPrefix:'edge-colored'}));
 const ids=[...d.getElementsByTagName('*')].map(e=>e.getAttribute('id')).filter(Boolean);assert.equal(ids.length,new Set(ids).size);
 for(const label of labels(d)) {
  const group=[...label.getElementsByTagName('g')].find(g=>g.getAttribute('data-icon')==='edge-logo.wide');
  assert.ok(group);assert.match(group.getAttribute('transform'),/scale\(0\.053\)/);
 }
 for(const element of d.getElementsByTagName('*'))for(const attribute of [...element.attributes])for(const match of attribute.value.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(match[1]));
});

test('label icon options validate, reject reference-only labels, and do not change automatic reference connectors',()=>{
 for(const rules of ['route transfer {icon bad}','route transfer {icon "javascript:x"}','routes {iconPosition center}','route transfer {iconPosition above}','route transfer {icon core.cloud icon core.shield}'])assert.equal(arch.validate(source(rules)).valid,false,rules);
 assert.throws(()=>arch.renderToString(source('route transfer {icon missing.icon}')),/Unknown icon/);
 assert.throws(()=>arch.renderToString(source('routes {icon core.missing}')),/Unknown icon/);
 const profile={nodeTypes:{actor:{template:'person'},item:{template:'artifact'}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
 const document=rules=>`architecture "References" {model {actor a "A" actor b "B" item data "Dataset" relation transfer a -> b "" {type flow payload [data]}} view v "V" {${rules}}}`;
 const graph=arch.layout(arch.parse(document('routes {icon core.cloud iconPosition top}'),{profile}));
 assert.equal(graph.referenceNodes[0].route,undefined);assert.equal(graph.edges[0].labelIcon,'core.cloud');assert.equal(graph.edges[0].labelLines.length,0);
 assert.equal(arch.validate(document('route data -> transfer {icon core.cloud}'),{profile}).valid,false);
 assert.equal(arch.validate(document('route data -> transfer {iconPosition top}'),{profile}).valid,false);
});
