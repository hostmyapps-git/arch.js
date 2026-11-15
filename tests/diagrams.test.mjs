import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';
const source=await readFile('examples/diagrams.arch','utf8');
const model=arch.parse(source);
const invalid=source=>assert.equal(arch.validate(source).valid,false);
const xml=svg=>new DOMParser({onError:(level,message)=>{throw Error(message);}}).parseFromString(svg,'image/svg+xml');

test('seven independent diagram layouts export safe SVG in both themes and retain immutable model semantics',()=>{
  assert.equal(model.views.length,7);const before=JSON.stringify(model);
  for(const view of model.views) for(const theme of ['light','dark']) {
    const graph=arch.layout(model,{view:view.id}),svg=arch.renderToString(model,{view:view.id,theme,idPrefix:'diagram-test'});
    assert.equal(xml(svg).documentElement.getAttribute('data-diagram'),view.diagram.type);
    assert.ok(Number.isFinite(graph.bounds.width)&&graph.bounds.width>0);
    assert.ok(Number.isFinite(graph.bounds.height)&&graph.bounds.height>0);
    assert.ok(!/NaN|Infinity|undefined/.test(svg));
  }
  assert.equal(JSON.stringify(model),before);
  assert.equal(arch.validate(JSON.parse(before)).valid,true);
  assert.match(arch.renderMarkdown('```arch\n'+source+'\n```'),/data-diagram="sequence"/);
  for(const type of ['sequence','state','activity','matrix','heatmap','timeline','class']) {
    const empty=`architecture "Empty" {model {} view v "V" {diagram ${type} ${type==='heatmap'?'{valueAttribute score}':''}}}`;
    xml(arch.renderToString(empty));
  }
});

test('sequence honors ordered messages, explicit participants, return/async styles and self messages',()=>{
  const doc=xml(arch.renderToString(model,{view:'interaction'}));
  const messages=[...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-message'));
  assert.deepEqual(messages.map(g=>g.getAttribute('data-edge')),['request','save','ack','audit','response']);
  assert.deepEqual(messages.map(g=>g.getAttribute('data-message-kind')),['sync','sync','return','async','return']);
  invalid(source.replace('participants [client, api, store]','participants [client, api]'));
  invalid(source.replace('returns [ack, response]','returns [ack, response, audit]'));
  invalid(source.replace('messages [request, save, ack, audit, response]','messages [request, request]'));
});

test('state and activity validate initial/final flow, decision degrees and ownership of swimlanes',()=>{
  invalid(source.replace('initial ready','initial closed'));
  invalid(source.replace('owner crew','owner mission'));
  invalid(source.replace('decisions [decision]','decisions [assess]'));
  invalid(source.replace('decisions [decision]','decisions [decision] forks [decision]'));
  assert.match(arch.renderToString(model,{view:'workflow'}),/data-state="decision"/);
  assert.match(arch.renderToString(source.replace('decisions [decision]','forks [decision]'),{view:'workflow'}),/data-state="decision"/);
});

test('matrix counts directed and parallel edges and filters relationship types',()=>{
  const doc=xml(arch.renderToString(model,{view:'mapping'}));
  const cells=[...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-cell'));
  assert.equal(cells.length,6);
  assert.match(cells.find(g=>g.getAttribute('data-cell')==='api:rescue').textContent,/Enables/);
  invalid(source.replace('rows [api, store]','rows [missing]'));
  const parallel=source.replace('relation enables api -> rescue "Enables"','relation enables api -> rescue "Enables" relation extra api -> rescue "More"');
  const d=xml(arch.renderToString(parallel,{view:'mapping'}));
  const cell=[...d.getElementsByTagName('g')].find(g=>g.getAttribute('data-cell')==='api:rescue');
  assert.equal(cell.getElementsByTagName('tspan')[0].textContent,'2');
});

test('heatmap has a real hierarchy, numeric scale, missing values, and rejects cycles and invalid ranges',()=>{
  const doc=xml(arch.renderToString(model,{view:'assessment'}));
  assert.equal([...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-tile')).length,5);
  assert.match(doc.documentElement.textContent,/No value/);
  invalid(source.replace('maturity 3','maturity 8'));
  invalid(source.replace('parentCapability rescue maturity 4','parentCapability maritime maturity 4'));
  invalid(source.replace('min 0 max 5','min 5 max 0'));
  invalid(source.replace('valueAttribute maturity','valueAttribute title'));
});

test('timeline preserves dates, draws milestones and dependencies, and rejects missing/reversed periods',()=>{
  const doc=xml(arch.renderToString(model,{view:'delivery'}));
  assert.equal([...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-bar')).length,3);
  assert.match(doc.documentElement.textContent,/2026-10-01/);
  invalid(source.replace('start "2026-01-01"','start "2027-01-01"'));
  invalid(source.replace('start "2026-01-01"',''));
});

test('class compartments, signatures, owned parameters and visible interface ports are explicit and validated',()=>{
  const svg=arch.renderToString(model,{view:'details'});
  for(const heading of ['ATTRIBUTES','METHODS','FUNCTIONS','INTERFACES','PORTS']) assert.match(svg,new RegExp(heading));
  assert.match(svg,/target: Location/);
  invalid(source.replace('owner launch','owner repository'));
  invalid(source.replace('attributes [identifier, status]','attributes [identifier, status, launch]'));
});

test('diagram options reject unknown fields, unsafe colors, manual routing, and invisible references without weakening profiles',()=>{
  invalid(source.replace('diagram sequence','diagram unknown'));
  invalid(source.replace('participants [client, api, store]','anything true'));
  invalid(source.replace('diagram sequence {','place client at (0,0) diagram sequence {'));
  invalid(source.replace('min 0 max 5','min 0 max 5 colorLow "url(x)"'));
  invalid(source.replace('methods [launch]','methods [invisible]'));
  assert.equal(arch.validate(source,{profile:'default'}).valid,false);
  const hostile=source.replace('Rescue operator','Operator & <script>alert(1)</script>');
  const svg=arch.renderToString(hostile);assert.ok(!svg.includes('<script>'));xml(svg);
});

test('both shipped bundles expose all seven renderers identically',async()=>{
  const expected=model.views.map(v=>arch.renderToString(source,{view:v.id,idPrefix:'stable'}));
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    const output=model.views.map(v=>context.arch.renderToString(source,{view:v.id,idPrefix:'stable'}));
    assert.deepEqual(output,expected);
  }
});
