import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.studio.js';

const profile={defaultRelation:'link',nodeTypes:{item:{template:'node',attributes:{expression:{},value:{type:'number'},enabled:{type:'boolean'},links:{type:'reference',many:true,targets:['item']}}},box:{template:'package',container:true,attributes:{expression:{}}}},relationTypes:{link:{style:'dependency'}}};
const body='item a "Criterion" {expression "Time until found" value 0 enabled false links [b]} item b "Measure" {value 25} relation e a -> b "Evaluates"';
const doc=(view,model=body)=>`architecture "Properties"{model{${model}}view v "V"{${view}}}`;
const get=(g,id)=>g.nodes.find(n=>n.id===id);
const xml=s=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(s,'image/svg+xml');

test('connected properties display real values, retain 0/false/lists, escape text and resize before placement/routing',()=>{
  const source=doc('propertyFields [expression,value,enabled,links] place a at (-100,40) place b at (a.right + 40,a.bottom + 40) route e {via (a.right + 20,a.bottom + 20)}'),model=arch.parse(source,{profile}),before=JSON.stringify(model),g=arch.layout(model);
  assert.deepEqual(get(g,'a').propertyRows.map(r=>r.full),['expression: Time until found','value: 0','enabled: false','links: [b]']);
  assert.deepEqual(get(g,'b').propertyRows.map(r=>r.full),['value: 25']);assert.ok(get(g,'a').height>150);
  assert.equal(get(g,'b').y,get(g,'a').y+get(g,'a').height+40);assert.ok(g.edges[0].points.some(p=>p.y===get(g,'a').y+get(g,'a').height+20));
  assert.equal(JSON.stringify(model),before);assert.deepEqual(arch.layout(model),g);
  const hostile=arch.renderToString(source.replace('Time until found','<script>&'),{profile});assert.equal(xml(hostile).getElementsByTagName('script').length,0);assert.match(hostile,/&lt;script&gt;&amp;/);
});

test('property selection precedence is node style, view, diagram; empty selections and logo display hide rows',()=>{
  const source=doc('diagram connected {propertyFields [expression]} propertyFields [value] style a {propertyFields [enabled]}');
  const g=arch.layout(source,{profile});assert.deepEqual(get(g,'a').propertyRows.map(r=>r.key),['enabled']);assert.deepEqual(get(g,'b').propertyRows.map(r=>r.key),['value']);
  assert.equal(get(arch.layout(source.replace('[enabled]','[]'),{profile}),'a').propertyRows.length,0);
  const logo=arch.layout(doc('propertyFields [expression] style a {display logo}'),{profile});assert.equal(get(logo,'a').propertyRows.length,0);assert.equal(get(logo,'a').height,96);
  for(const diagram of ['tree','class'])assert.equal(arch.validate(doc(`diagram ${diagram} {propertyFields [value]} style a {propertyFields []}`),{profile}).valid,true);
});

test('properties fit package headers, tree groups and reference cards without changing model containment',()=>{
  const source=doc('propertyFields [expression,value] tree g {nodes [a,b]} place g at (0,0)','box p "Package" {expression "Header properties" '+body+'}');
  const g=arch.layout(source,{profile}),p=get(g,'p');assert.ok(p.headerHeight>72);assert.equal(get(g,'a').parent,'p');assert.ok(get(g,'a').y>=p.y+p.headerHeight+16);
  assert.ok(get(g,'a').propertyRows.length>0);assert.match(arch.renderToString(source,{profile}),/data-node-properties="true"/);
  const empty=get(arch.layout(doc('propertyFields [expression] style p {width 180 fontSize 20}','box p "Package" {expression "Very long header properties repeated repeatedly for visibility"}'),{profile}),'p');assert.ok(empty.height>=empty.headerHeight+28);
  const refProfile={defaultRelation:'exchange',nodeTypes:{item:{template:'node',attributes:{expression:{}}}},relationTypes:{exchange:{style:'flow',attributes:{payload:{type:'reference',many:true,targets:['item']}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
  const ref=arch.layout(doc('propertyFields [expression] referenceOccurrences perEdge','item a "A" item b "B" item info "Report" {expression "Report properties"} relation e a -> b "Sends" {payload [info]} relation f b -> a "Returns" {payload [info]}'),{profile:refProfile});
  assert.equal(ref.referenceNodes.length,2);assert.ok(ref.referenceNodes.every(r=>r.node.propertyRows[0].full==='expression: Report properties'));
});

test('class cards retain compartments and accept numeric/relative placements, sizes, negative bounds and per-node fields',()=>{
  const source=doc('diagram class {propertyFields [expression,value]} style b {propertyFields [id,value]} place a at (-300,-200) size (420,300) place b at (a.right + 60,a.bottom + 40)'),model=arch.parse(source,{profile}),before=JSON.stringify(model),g=arch.layout(model);
  assert.deepEqual([get(g,'a').x,get(g,'a').y,get(g,'a').width,get(g,'a').height],[-300,-200,420,300]);assert.equal(get(g,'b').x,180);assert.equal(get(g,'b').y,140);
  assert.ok(g.bounds.x<=-320&&g.bounds.y<=-220);assert.equal(JSON.stringify(model),before);
  for(const theme of ['light','dark']){const svg=arch.renderToString(model,{theme});assert.match(svg,/data-compartment="properties"/);assert.match(svg,/transform="translate\(-300 -200\)"/);assert.match(svg,/id: b/);assert.doesNotMatch(svg,/NaN|undefined|Infinity/);}
  assert.match(arch.validate(source.replace('a.right + 60','b.x'),{profile}).diagnostics[0].message,/Circular placement dependency/);
});

test('class ports move with their owner, can anchor placements and cannot be individually placed',()=>{
  const portProfile={defaultRelation:'link',nodeTypes:{item:{attributes:{owner:{type:'reference',targets:['item']}}}},relationTypes:{link:{}}};
  const source=doc('diagram class {ports [port]} place a at (100,200) place b at (port.right + 40,port.y)','item a "A" item port "Port" {owner a} item b "B" relation e port -> b "Calls"');
  const g=arch.layout(source,{profile:portProfile}),a=get(g,'a'),p=get(g,'port'),b=get(g,'b');assert.equal(p.x,a.x+a.width-6);assert.equal(p.y,a.y+58);assert.equal(b.x,p.x+52);assert.equal(b.y,p.y);
  assert.match(arch.renderToString(source,{profile:portProfile}),/data-port="port"/);
  assert.match(arch.validate(source.replace('place a at','place port at'),{profile:portProfile}).diagnostics[0].message,/positioned through its owner/);
});

test('invalid properties, unsupported renderers/meta and class routing fail explicitly',()=>{
  for(const view of ['propertyFields [missing]','propertyFields [value,value]','propertyFields true','style b {propertyFields [expression,missing]}','propertyFields [value] diagram matrix','diagram sequence {participants [a,b]} style a {propertyFields [value]}','diagram class route e {from right}'])assert.equal(arch.validate(doc(view),{profile}).valid,false,view);
  assert.equal(arch.validate('architecture "Meta"{model{} view meta "Meta"{ @meta json\n propertyFields [] }}').valid,false);
});

test('JSON/meta/stacked views and both bundles preserve freely positioned properties',async()=>{
  const source=doc('propertyFields [expression,value] place a at (0,0) place b at (a.right + 40,a.y)').replace(/}$/, 'view classes "Classes" {diagram class {propertyFields [expression,value]} place b at (a.right + 40,a.bottom + 40)}}');
  const json=arch.translate(source,{profile}),expected=arch.renderToString(source,{profile,views:'all',idPrefix:'props'});
  assert.deepEqual(JSON.parse(json).architecture.views.v.propertyFields,['expression','value']);assert.equal(arch.renderToString(json,{profile,views:'all',idPrefix:'props'}),expected);
  assert.equal(arch.renderToString(arch.translate(json,{profile}),{profile,views:'all',idPrefix:'props'}),expected);
  for(const file of ['arch.core.min.js', 'arch.min.js']){const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);assert.equal(context.arch.renderToString(source,{profile,views:'all',idPrefix:'props'}),expected);}
  assert.match(arch.help('styles'),/propertyFields/);
});

test('C5 criterion/measure example validates strictly and renders both presentation variants',async()=>{
  for(const p of ['uaf','naf41-uaf'])arch.registerProfile(p,JSON.parse(await readFile(`profiles/${p}.json`,'utf8')));
  const source=await readFile('examples/property-fields.arch','utf8');assert.equal(arch.validate(source).valid,true);assert.equal(arch.layout(source).layouts.length,2);
  for(const view of ['cards','classes'])assert.match(arch.renderToString(source,{view}),/Elapsed time in minutes/);
});
