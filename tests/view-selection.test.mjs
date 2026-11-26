import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.studio.js';

const source=(selection='',profile='')=>`architecture "Architecture <safe>" {
 ${selection||profile?`config {${profile} ${selection}}`:''}
 model {system a "Sender" system b "Receiver" relation send a -> b "Transfers"}
 view overview "Overview" {place b at (500,0)}
 view detail "Details <safe> & title" {theme dark style a {template database}}
 view matrix "Relation matrix" {diagram matrix {rows [a] columns [b]}}
}`;
const xml=s=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(s,'image/svg+xml');
const sectionIds=d=>[...d.getElementsByTagName('g')].filter(e=>e.hasAttribute('data-arch-view')).map(e=>e.getAttribute('data-arch-view'));
const selected=options=>arch.layout(arch.parse(source('views all')),options);

test('config views chooses a single view, a list in requested order, or all declared views; the old default stays unchanged',()=>{
 const plain=arch.parse(source());assert.equal(arch.layout(plain).view.id,'overview');
 assert.equal(arch.renderToString(plain,{idPrefix:'same'}),arch.renderToString(plain,{view:'overview',idPrefix:'same'}));
 assert.equal(arch.layout(arch.parse(source('views detail'))).view.id,'detail');
 assert.equal(arch.layout(arch.parse(source('views [detail]'))).view.id,'detail');
 const all=arch.layout(arch.parse(source('views all')));assert.equal(all.kind,'views');assert.deepEqual(all.layouts.map(g=>g.view.id),['overview','detail','matrix']);
 assert.deepEqual(sectionIds(xml(arch.renderToString(source('views [matrix, overview]')))),['matrix','overview']);
 const unbracketed=source('views matrix,\n overview validation draft','profile default');
 assert.deepEqual(sectionIds(xml(arch.renderToString(unbracketed))),['matrix','overview']);
 assert.deepEqual(JSON.parse(arch.translate(unbracketed)).architecture.config.views,['matrix','overview']);
 assert.equal(arch.layout(arch.parse('architecture "Implicit" {config {views all} model {}}')).view.id,'default');
});

test('view selection combines with registered and inline profiles without entering the profile schema',()=>{
 const registered=arch.parse(source('views all','profile default'));assert.equal(registered.profile.id,'default');assert.equal(arch.layout(registered).layouts.length,3);
 const inline='architecture "Inline" {config {views all type actor {template person}} model {actor a "A"} view first "First" {} view second "Second" {}}';
 assert.equal(arch.parse(inline).profile.nodeTypes.actor.template,'person');assert.equal(arch.layout(arch.parse(inline)).layouts.length,2);
 assert.equal(arch.parse(source('views all')).profile.id,'default');
 assert.equal(arch.validate(source('views all','profile default type invalid {}')).valid,false);
});

test('API view overrides API views, which overrides config; lists and literal IDs remain unambiguous',()=>{
 assert.equal(selected({view:'matrix',views:['overview','detail']}).view.id,'matrix');
 assert.deepEqual(selected({views:['detail','overview']}).layouts.map(g=>g.view.id),['detail','overview']);
 assert.equal(selected({views:'detail'}).view.id,'detail');assert.equal(selected({views:'all'}).layouts.length,3);
 const namedAll='architecture "Named all" {config {views [all]} model {} view first "First" {} view all "Literal all" {}}';
 assert.equal(arch.layout(arch.parse(namedAll)).view.id,'all');assert.equal(arch.layout(arch.parse(namedAll),{view:'all'}).view.id,'all');
 assert.equal(arch.layout(arch.parse(namedAll),{views:'all'}).layouts.length,2);
 assert.deepEqual(arch.layout(namedAll.replace('[all]','all, first')).layouts.map(g=>g.view.id),['all','first']);
 for(const options of [{views:[]},{views:['overview','overview']},{views:['missing']},{views:true},{views:null},{view:[]},{view:''}]) {
  assert.equal(arch.validate(source(),options).valid,false,JSON.stringify(options));assert.throws(()=>arch.renderToString(source(),options),arch.ArchError);
 }
});

test('config selection rejects unknown IDs, duplicates and malformed values with source locations',()=>{
 for(const selection of ['views missing','views [overview, missing]','views []','views [overview, overview]','views overview, overview','views overview, missing','views overview,','views true','views 1','views all views detail']) {
  const report=arch.validate(source(selection));assert.equal(report.valid,false,selection);assert.ok(report.diagnostics[0].line>0);assert.throws(()=>arch.parse(source(selection)),arch.ArchError);
 }
 const model=arch.parse(source('views all'));model.config.views=['missing'];assert.equal(arch.validate(model).valid,false);
});

test('stacked layout and SVG preserve independent themes, renderer geometry, headings, order and bounds',()=>{
 const model=arch.parse(source('views [detail, overview, matrix]')),before=JSON.stringify(model),graph=arch.layout(model),d=xml(arch.renderToString(model,{idPrefix:'stack'}));
 assert.equal(graph.nodes.length,2);assert.equal(graph.edges.length,1);assert.equal(graph.bounds.x,0);assert.equal(graph.bounds.y,0);
 for(const [index,section] of graph.sections.entries()) {
  assert.ok(section.x>=0&&section.y>=0);assert.ok(section.x+section.graph.bounds.width<=graph.bounds.width);
  assert.ok(section.y+section.headingHeight+section.graph.bounds.height<=graph.bounds.height);
  if(index)assert.ok(section.y>graph.sections[index-1].y+graph.sections[index-1].headingHeight+graph.sections[index-1].graph.bounds.height);
 }
 assert.equal(d.documentElement.getAttribute('data-arch-views'),'3');assert.deepEqual(sectionIds(d),['detail','overview','matrix']);
 const children=[...d.getElementsByTagName('svg')].filter(e=>e.hasAttribute('data-view-id'));
 assert.deepEqual(children.map(e=>e.getAttribute('data-arch-svg')),['dark','light','light']);assert.equal(children[2].getAttribute('data-diagram'),'matrix');
 assert.ok([...d.getElementsByTagName('text')].some(e=>e.textContent==='Details <safe> & title'));assert.equal(d.getElementsByTagName('safe').length,0);
 const dark=xml(arch.renderToString(model,{theme:'dark'}));assert.ok([...dark.getElementsByTagName('svg')].every(e=>e.getAttribute('data-arch-svg')==='dark'));
 assert.equal(JSON.stringify(model),before);assert.throws(()=>arch.renderToString(model,{idPrefix:'bad"'}),/Invalid idPrefix/);
});

test('repeated nodes and colored icons receive isolated SVG IDs across views and exports',()=>{
 arch.registerIconPack('stack-logo',{icons:{sample:{body:'<defs><linearGradient id="paint"><stop stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><path fill="url(#paint)" d="M0 0h24v24H0Z"/>'}}});
 const text=source('views all').replace('system a "Sender"','system a "Sender" {icon stack-logo.sample}');
 const d=xml(arch.renderToString(text,{idPrefix:'unique'})),ids=[...d.getElementsByTagName('*')].map(e=>e.getAttribute('id')).filter(Boolean);
 assert.equal(ids.length,new Set(ids).size);
 for(const element of d.getElementsByTagName('*'))for(const attribute of [...element.attributes])for(const match of attribute.value.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(match[1]));
 const repeat=xml(`<root>${arch.renderToString(text)}${arch.renderToString(text)}</root>`),all=[...repeat.getElementsByTagName('*')].map(e=>e.getAttribute('id')).filter(Boolean);assert.equal(all.length,new Set(all).size);
});

test('Markdown, help and both browser bundles support view selection with a standalone SVG result',async()=>{
 const text=source('views [detail, overview]'),html=arch.renderMarkdown('```arch\n'+text+'\n```');assert.match(html,/data-arch-views="2"/);
 assert.match(arch.renderToString('architecture "Help" {config {views all} @help views\n}'),/data-arch-help="views"/);
 const expected=arch.renderToString(text,{idPrefix:'bundle'});
 for(const file of ['arch.core.min.js', 'arch.min.js']) {
  const context={};vm.runInNewContext(await readFile(file,'utf8'),context);assert.equal(context.arch.renderToString(text,{idPrefix:'bundle'}),expected);
 }
});
