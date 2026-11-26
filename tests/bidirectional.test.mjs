import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.studio.js';

const doc=(relations='relation exchange a <-> b "Exchange"',view='',config='')=>`architecture "Exchange" {${config} model {service a "A" service b "B" ${relations}} ${view}}`;
const schema=()=>({nodeTypes:{service:{template:'service'},other:{template:'node'}},relationTypes:{exchange:{from:['service'],to:['service'],style:'flow',directions:['forward','both']}},defaultRelation:'exchange'});
const diagnostics=(source,profile)=>arch.validate(source,{profile}).diagnostics.map(d=>d.message).join('\n');

test('bidirectional syntax, adjacent tokens, defaults, explicit direction and all compatible edge styles',()=>{
  for(const arrow of ['a <-> b','a<->b']) {
    const source=doc(`relation exchange ${arrow} "Exchange"`),model=arch.parse(source);
    assert.equal(model.edges.length,1);assert.equal(model.edges[0].direction,'both');
    assert.equal(arch.layout(model).edges[0].direction,'both');
    const svg=arch.renderToString(model,{idPrefix:'both'});
    assert.match(svg,/marker-start="url\(#both-arrow\)"/);assert.match(svg,/marker-end="url\(#both-arrow\)"/);
  }
  assert.equal(arch.parse(doc('relation exchange a -> b "Forward"')).edges[0].direction,undefined);
  assert.equal(arch.parse(doc('relation exchange a -> b "Exchange" {direction both}')).edges[0].direction,'both');
  for(const style of ['flow','access','association','dependency']) {
    const svg=arch.renderToString(doc(`relation exchange a <-> b "Exchange" {type ${style}}`));
    assert.match(svg,/marker-start=/);assert.match(svg,/marker-end=/);
    if(style==='dependency')assert.match(svg,/stroke-dasharray="6 5"/);
  }
  for(const style of ['composition','generalization','realization'])assert.match(diagnostics(doc(`relation exchange a <-> b "Exchange" {type ${style}}`)),/does not allow direction both/);
  assert.match(diagnostics(doc('relation exchange a -> b "Exchange" {direction sideways}')),/direction must be forward or both/);
  assert.throws(()=>arch.parse(doc('relation exchange a <-> b "Exchange" {direction both}')),/Duplicate attribute: direction/);
});

test('profile directions inherit, can require both, reject unsupported styles and preserve written endpoint roles',()=>{
  const p=schema();assert.equal(arch.validate(doc(),{profile:p}).valid,true);
  delete p.relationTypes.exchange.directions;assert.match(diagnostics(doc(),p),/allowed directions: forward/);
  p.relationTypes.exchange.directions=['both'];assert.match(diagnostics(doc('relation exchange a -> b "Forward"'),p),/allowed directions: both/);
  p.relationTypes.special={extends:'exchange'};
  assert.equal(arch.validate(doc('relation exchange a <-> b "Both" {type special}'),{profile:p}).valid,true);
  p.relationTypes.special.directions=['forward'];assert.match(diagnostics(doc('relation exchange a <-> b "Both" {type special}'),p),/allowed directions: forward/);
  p.relationTypes.exchange.from=['other'];
  assert.equal(arch.validate(doc().replace('service a','other a'),{profile:p}).valid,true);
  assert.match(diagnostics(doc().replace('service b','other b'),p),/source of type service|target of type other/);
  for(const directions of [[],['reverse'],true]) {
    const bad=schema();bad.relationTypes.exchange.directions=directions;assert.throws(()=>arch.registerProfile('bad-directions',bad),arch.ArchError);
  }
  for(const style of ['composition','generalization','realization']) {
    const bad=schema();bad.relationTypes.exchange.style=style;assert.throws(()=>arch.registerProfile('bad-directions',bad),/does not support bidirectional/);
  }
});

test('incoming/outgoing cardinality, pair constraints, cycles, self-links and viewpoint connections count both directions',()=>{
  const p=schema(),r=p.relationTypes.exchange;r.outgoing={min:1,max:1};r.incoming={min:1,max:1};
  assert.equal(arch.validate(doc(),{profile:p}).valid,true);
  assert.match(diagnostics(doc('relation exchange a <-> b "Exchange" relation extra b -> a "Extra"'),p),/expected 1–1 relationships, found 2/);
  r.acyclic=true;assert.match(diagnostics(doc(),p),/Cycles are not allowed/);delete r.acyclic;
  r.allowSelf=false;assert.match(diagnostics(doc('relation exchange a <-> a "Self"'),p),/Self-relationships/);r.allowSelf=true;
  assert.equal(arch.validate(doc('relation x a <-> a "Self" relation y b <-> b "Self"'),{profile:p}).valid,true);
  r.pairs=[{from:['service'],to:['other']}];assert.match(diagnostics(doc(),p),/Type combination/);delete r.pairs;
  p.viewpoints={all:{nodes:['service'],relations:['exchange'],connections:[{nodes:['service'],relations:['exchange'],direction:'incoming',min:1,max:1},{nodes:['service'],relations:['exchange'],direction:'outgoing',min:1,max:1},{nodes:['service'],relations:['exchange'],direction:'either',min:1,max:1}]}};
  assert.equal(arch.validate(doc(undefined,'view v "V" {viewpoint all}'),{profile:p}).valid,true);
});

test('JSON, inline and registered profiles, source translations, semantic candidates and restored AST retain bidirectionality',()=>{
  const config='config {extends default relation exchange {from service to service style flow directions [forward,both]} defaultRelation exchange}';
  const source=doc(undefined,'',config),json=arch.translate(source),object=JSON.parse(json);
  assert.equal(object.architecture.model.relations.exchange.direction,'both');
  assert.deepEqual(object.architecture.config.relation.exchange.directions,['forward','both']);
  const back=arch.translate(json);assert.match(back,/a <-> b/);
  for(const input of [source,json,object,arch.translate(back)])assert.equal(arch.renderToString(input,{idPrefix:'same'}),arch.renderToString(source,{idPrefix:'same'}));
  assert.equal(arch.layout(JSON.parse(JSON.stringify(arch.parse(source)))).edges[0].direction,'both');
  object.architecture.model.relations.exchange.direction='sideways';const report=arch.inspectSource(object);
  assert.equal(report.valid,false);assert.match(report.diagnostics[0].path,/direction/);
  arch.registerProfile('both-required',{...schema(),relationTypes:{exchange:{...schema().relationTypes.exchange,directions:['both']}}});
  const invalid=doc('relation exchange a -> b "Forward"','','config {profile both-required}');
  assert.match(arch.inspectSource(invalid).diagnostics[0].message,/allowed directions: both/);
});

test('routed references remain one logical relationship, and matrices and class views represent both directions',()=>{
  const p=schema();p.nodeTypes.info={template:'artifact'};p.relationTypes.exchange.attributes={conveyed:{type:'reference',targets:['info'],many:true}};p.relationTypes.exchange.referenceLabels={conveyed:'Conveys'};p.relationTypes.exchange.referenceDisplay='nodes';
  const source=doc('info i "Information" relation exchange a <-> b "Exchange" {conveyed [i]}','view v "V" {route exchange {curve bezier via (150,-80), (250,-80)} route i -> exchange {curve straight to 0.5}}');
  const graph=arch.layout(source,{profile:p});assert.equal(graph.edges.length,1);assert.equal(graph.referenceNodes.length,1);assert.match(graph.edges[0].d,/C/);
  const svg=arch.renderToString(source,{profile:p});assert.equal((svg.match(/class="arch-reference-connector"/g)??[]).length,1);
  const matrix=arch.renderToString(doc(undefined,'view m "Matrix" {diagram matrix {rows [a,b] columns [a,b]}}'));
  for(const cell of ['a:b','b:a'])assert.match(matrix,new RegExp(`data-cell="${cell}"[\\s\\S]*?<tspan[^>]*>1</tspan>`));
  const classes=arch.renderToString(doc(undefined,'view c "Class" {diagram class}'),{idPrefix:'classes'});
  assert.match(classes,/marker-start="url\(#classes-arrow\)"/);assert.match(classes,/orient="auto-start-reverse"/);
  for(const type of ['sequence','state','activity','timeline'])assert.match(diagnostics(doc(undefined,`view v "V" {diagram ${type}}`)),new RegExp(`Bidirectional relationships are not supported in ${type}`));
});

test('help and both standalone bundles expose directions and render the same single bidirectional edge',async()=>{
  assert.match(arch.renderToString('@help model'),/Bidirectional relationships/);
  assert.match(arch.renderToString('@help relations default flow'),/both/);
  assert.match(arch.renderToString('@help connections default service'),/directions: forward, both/);
  const expected=arch.renderToString(doc(),{idPrefix:'same'});
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    assert.equal(context.arch.renderToString(doc(),{idPrefix:'same'}),expected);
    assert.equal(JSON.parse(context.arch.translate(doc())).architecture.model.relations.exchange.direction,'both');
  }
});

test('nested packages retain style and containment rules alongside bidirectional edges',async()=>{
  const source=await readFile('examples/bidirectional.arch','utf8');assert.equal(arch.validate(source).valid,true);
  const graph=arch.layout(source,{view:'overview'}),outer=graph.nodes.find(n=>n.id==='enterprise'),inner=graph.nodes.find(n=>n.id==='datacenter');
  assert.equal(inner.parent,outer.id);assert.equal(inner.backgroundColor,'#dbeafe');assert.equal(inner.opacity,1);
  assert.ok(outer.width>=inner.width);assert.match(arch.renderToString(source,{view:'overview'}),/fill="#dbeafe" fill-opacity="1"/);
});
