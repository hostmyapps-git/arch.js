import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.studio.js';

const source=rules=>`architecture "Labels" {model {system a "A" system b "B" relation send a -> b "Transfers data" relation reply b -> a "Acknowledges"} view v "V" {place b at (600,0) ${rules}} view clean "Clean" {}}`;
const xml=svg=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(svg,'image/svg+xml');
const groups=d=>[...d.getElementsByTagName('g')];

test('label none hides the entire label and icon while preserving relationship data, tooltip and other views',()=>{
 const model=arch.parse(source('routes {icon core.cloud} route send {label none}')),before=JSON.stringify(model),graph=arch.layout(model);
 const edge=graph.edges.find(e=>e.id==='send');assert.equal(edge.labelHidden,true);assert.deepEqual(edge.labelLines,[]);assert.equal(edge.labelWidth,0);assert.equal(edge.labelHeight,0);assert.equal(edge.labelIcon,undefined);
 assert.equal(edge.title,'Transfers data');assert.equal(edge.labelText,'Transfers data');
 for(const theme of ['light','dark']) {
  const d=xml(arch.renderToString(model,{theme}));
  assert.equal(groups(d).filter(g=>g.getAttribute('data-label-for')==='send').length,0);
  assert.equal(groups(d).filter(g=>g.getAttribute('class')==='arch-edge').length,2);
  assert.equal(groups(d).find(g=>g.getAttribute('data-edge')==='send').getElementsByTagName('title')[0].textContent,'Transfers data');
  assert.equal(groups(d).filter(g=>g.getAttribute('data-label-for')==='reply').length,1);
 }
 assert.ok(arch.layout(model,{view:'clean'}).edges.every(e=>e.labelLines.length));assert.equal(JSON.stringify(model),before);
});

test('global label none applies by default and specific positions restore inherited icons independently of declaration order',()=>{
 const defaults='routes {label none icon core.cloud}',local='route send {label (400,-100)}';
 const one=arch.layout(arch.parse(source(`${defaults} ${local}`))),two=arch.layout(arch.parse(source(`${local} ${defaults}`)));
 const geometry=graph=>graph.edges.map(({loc,labelIconLoc,...edge})=>edge);
 assert.deepEqual(geometry(one),geometry(two));
 const visible=one.edges.find(e=>e.id==='send'),hidden=one.edges.find(e=>e.id==='reply');
 assert.equal(visible.labelHidden,false);assert.deepEqual(visible.label,{x:400,y:-100});assert.equal(visible.labelIcon,'core.cloud');assert.ok(visible.labelLines.length);
 assert.equal(hidden.labelHidden,true);assert.equal(hidden.labelIcon,undefined);
 assert.doesNotThrow(()=>arch.renderToString(source('routes {label none icon missing.icon}')),'hidden icons are not resolved or rendered');
});

test('hidden labels do not expand bounds and work with Bezier and free-path routes',()=>{
 for(const route of ['curve bezier via (200,-100), (400,-100)','path "M 220 48 Q 350 -150 600 48"']) {
  const hidden=arch.layout(arch.parse(source(`routes {label (90000,90000)} route send {label none ${route}} route reply {label none}`)));
  assert.ok(hidden.bounds.width<2000&&hidden.bounds.height<2000);
  assert.ok(hidden.edges.every(e=>Number.isFinite(e.label.x)&&Number.isFinite(e.label.y)));
  assert.equal(groups(xml(arch.renderToString(source(`routes {label none} route send {${route}}`)))).filter(g=>g.getAttribute('class')==='arch-edge-label').length,0);
 }
});

test('hidden reference labels retain conveyed cards and annotations; invalid visibility values are rejected',()=>{
 const profile={nodeTypes:{actor:{template:'person'},item:{template:'artifact'}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'both'}}};
 const text=`architecture "Payload" {model {actor a "A" actor b "B" item data "Dataset" relation transfer a -> b "Sends" {type flow payload [data]}} view v "V" {routes {label none icon core.cloud}}}`;
 const graph=arch.layout(arch.parse(text,{profile}));assert.match(graph.edges[0].labelText,/Dataset \[data\]/);assert.equal(graph.referenceNodes.length,1);assert.equal(graph.referenceNodes[0].route,undefined);
 const d=xml(arch.renderToString(text,{profile}));assert.equal(groups(d).filter(g=>g.getAttribute('class')==='arch-edge-label').length,0);assert.equal(groups(d).filter(g=>g.getAttribute('class')==='arch-edge-reference').length,1);
 assert.equal([...d.getElementsByTagName('path')].filter(p=>p.getAttribute('class')==='arch-reference-connector').length,1);
 for(const rules of ['routes {label hidden}','route send {label false}','route send {label none label (0,0)}'])assert.equal(arch.validate(source(rules)).valid,false);
 const model=arch.parse(source(''));model.views[0].routeDefaults={label:'hidden'};assert.equal(arch.validate(model).valid,false);
 assert.match(arch.renderToString('@help routing'),/label none/);
});
