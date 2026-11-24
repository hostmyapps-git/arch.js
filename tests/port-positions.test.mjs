import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
import {pathSamples,pointOnPath} from '../src/reference-nodes.js';

const profile={nodeTypes:{actor:{template:'person'},item:{template:'artifact'}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
const source=(routes='')=>`architecture "Ports" {model {
 actor a "A" actor b "B" item data "Dataset"
 relation e a -> b "Carries" {type flow payload [data]}}
 view v "Ports" {place a at (30,40) place b at (600,360) place data at (400,-200)
 style a {width 300 height 160} style b {width 280 height 140} ${routes}}}`;
const parse=s=>arch.parse(s,{profile});
const layout=r=>arch.layout(parse(source(r)));
const expected=(box,side,p)=>({
 top:{x:box.x+box.width*p,y:box.y},bottom:{x:box.x+box.width*p,y:box.y+box.height},
 left:{x:box.x,y:box.y+box.height*p},right:{x:box.x+box.width,y:box.y+box.height*p}
})[side];
const point=({x,y})=>({x,y});

test('all source/target sides accept decimal positions and fractions, including corners and every curve mode',()=>{
 for(const from of ['top','right','bottom','left'])for(const to of ['top','right','bottom','left'])
 for(const [written,value]of [['0',0],['0.25',.25],['1/2',.5],['3 / 4',.75],['1',1]])
 for(const curve of ['straight','orthogonal','rounded','bezier']) {
  const graph=layout(`route e {from ${from} ${written} to ${to} ${written} curve ${curve}}`),edge=graph.edges[0];
  assert.deepEqual(edge.points[0],expected(graph.nodes.find(n=>n.id==='a'),from,value));
  assert.deepEqual(edge.points.at(-1),expected(graph.nodes.find(n=>n.id==='b'),to,value));
  const samples=pathSamples(edge.d);
  assert.deepEqual(point(samples[0]),edge.points[0]);assert.deepEqual(point(samples.at(-1)),edge.points.at(-1));
 }
 const half=layout('route e {from bottom 1/2 to left 1/2}'),legacy=layout('route e {from bottom to left}');
 assert.equal(half.edges[0].d,legacy.edges[0].d);
});

test('relative endpoints follow final sizes and placements, and local endpoints replace defaults as a whole',()=>{
 const graph=arch.layout(parse(source('routes {from bottom 1/4 to left 3/4} route e {from right to top 1/2}')
  .replace('place a at (30,40)','place a at (150,200)').replace('width 280 height 140','width 420 height 200')));
 const a=graph.nodes.find(n=>n.id==='a'),b=graph.nodes.find(n=>n.id==='b');
 assert.deepEqual(graph.edges[0].points[0],expected(a,'right',.5));
 assert.deepEqual(graph.edges[0].points.at(-1),expected(b,'top',.5));
 const inherited=layout('routes {from bottom 1/4 to left 3/4}');
 assert.deepEqual(inherited.edges[0].points[0],expected(inherited.nodes.find(n=>n.id==='a'),'bottom',.25));
 assert.deepEqual(inherited.edges[0].points.at(-1),expected(inherited.nodes.find(n=>n.id==='b'),'left',.75));
 const free=layout('routes {from bottom 1/4} route e {path "M 0 0 L 20 20"}');
 assert.equal(free.edges[0].d,'M 0 0 L 20 20');
 const absolute=layout('route e {from (0,0) to (500,50)}');
 assert.deepEqual(absolute.edges[0].points[0],{x:0,y:0});
 assert.deepEqual(absolute.edges[0].points.at(-1),{x:500,y:50});
});

test('side calculations use final dimensions and positions and retain expressions through DSL and JSON',()=>{
 for(const side of ['top','right','bottom','left']) {
  const dim=['top','bottom'].includes(side)?'width':'height';
  const graph=layout(`route e {from ${side} 10 / a.${dim} to ${side} (b.${dim} - 20) / b.${dim} curve straight}`);
  const a=graph.nodes.find(node=>node.id==='a'),b=graph.nodes.find(node=>node.id==='b');
  assert.deepEqual(graph.edges[0].points[0],expected(a,side,10/a[dim]));
  assert.deepEqual(graph.edges[0].points.at(-1),expected(b,side,(b[dim]-20)/b[dim]));
 }
 const text=source('routes {from right (b.centerY - a.y) / a.height} route e {to left curve straight}').replace('place b at (600,360)','place b at (600,80)');
 const model=parse(text),original=JSON.stringify(model),json=arch.translate(text,{format:'json'});
 assert.deepEqual(JSON.parse(json).architecture.views.v.routes.from,{side:'right',position:'(b.centerY - a.y) / a.height'});
 for(const input of [model,parse(json),parse(arch.translate(json,{format:'dsl'}))]) {
  const [edge]=arch.layout(input).edges;
  assert.deepEqual(edge.points,[{x:330,y:150},{x:600,y:150}]);
 }
 assert.equal(JSON.stringify(model),original);
 const reference=layout('route data -> e {from right 10 / data.height to 1/2 curve straight}').referenceNodes[0];
 assert.deepEqual(reference.points[0],{x:reference.node.x+reference.node.width,y:reference.node.y+10});
});

test('side calculations validate effective anchors and disallow results outside the card side',()=>{
 assert.throws(()=>layout('route e {from left a.height / 10}'),/Port position for from left must be between 0 and 1/);
 assert.throws(()=>layout('route e {to right 1 / (a.width - 300)}'),/Division by zero/);
 assert.throws(()=>layout('route e {from left missing.x}'),/Unknown from reference: missing/);
 const ignored=layout('routes {from right 10 / data.height} route e {path "M 0 0 L 20 20"} exclude data');
 assert.equal(ignored.edges[0].d,'M 0 0 L 20 20');
});

test('reference connectors support every positioned source side and fractional path targets, including defaults',()=>{
 for(const side of ['top','right','bottom','left'])for(const fraction of ['0','1/4','1 / 2','3/4','1']) {
  const graph=layout(`route data -> e {from ${side} ${fraction} to ${fraction} curve rounded}`),r=graph.referenceNodes[0];
  const value=Number(fraction.replaceAll(' ', '').split('/')[0])/Number(fraction.includes('/')?fraction.split('/')[1]:1);
  assert.deepEqual(r.points[0],expected(r.node,side,value));
  assert.deepEqual(point(r.anchor),point(pointOnPath(pathSamples(graph.edges[0].d),value)));
 }
 const graph=layout('routes {from bottom 1/4 to 3/4}'),r=graph.referenceNodes[0];
 assert.deepEqual(r.points[0],expected(r.node,'bottom',.25));assert.equal(r.route.to,.75);
 assert.equal(graph.edges[0].points.at(-1).x,600,'reference path target default is not a node-side target');
 const local=layout('routes {from bottom 1/4 to left 1/4} route data -> e {from right to 1/2}').referenceNodes[0];
 assert.deepEqual(local.points[0],expected(local.node,'right',.5));assert.equal(local.route.to,.5);
 const calculated=layout('route data -> e {from (data.right, data.y + 10) to 1/2 curve straight}').referenceNodes[0];
 assert.deepEqual(calculated.points[0],{x:calculated.node.x+calculated.node.width,y:calculated.node.y+10});
 assert.equal(calculated.route.to,.5);
});

test('positioned endpoints round-trip through JSON, DSL, meta and both bundles without mutating models',async()=>{
 const text=source('routes {from bottom 1/4} route e {to left 3/4} route data -> e {from right 1/2 to 1/4}');
 const model=parse(text),before=JSON.stringify(model),json=JSON.parse(arch.translate(text,{format:'json'}));
 assert.deepEqual(json.architecture.views.v.routes.from,{side:'bottom',position:.25});
 assert.deepEqual(json.architecture.views.v.route.e.to,{side:'left',position:.75});
 json.architecture.views.v.routes.from.position='1 / 4';
 json.architecture.views.v.route['data -> e'].to='1/4';
 const dsl=arch.translate(json,{format:'dsl'});
 assert.match(dsl,/from bottom 1 \/ 4/);assert.match(dsl,/to 1\/4/);
 const original=arch.layout(model),translated=arch.layout(parse(dsl)),fromJSON=arch.layout(arch.parse(json,{profile}));
 for(const graph of [translated,fromJSON]) {
  assert.deepEqual(graph.edges.map(e=>e.d),original.edges.map(e=>e.d));
  assert.deepEqual(graph.referenceNodes.map(e=>e.d),original.referenceNodes.map(e=>e.d));
 }
 assert.ok(arch.inspectSource(text,{profile}).valid);assert.equal(JSON.stringify(model),before);
 assert.match(arch.renderToString('@help routing'),/Positions along node sides/);
 for(const bundle of ['arch.js','arch.min.js']) {
  const context=vm.createContext({});vm.runInContext(await readFile(bundle,'utf8'),context);
  const options={profile,idPrefix:'ports'};
  assert.equal(context.arch.renderToString(text,options),arch.renderToString(text,options));
 }
});

test('positioned ports work on packages and internal tree edges and remain independent of shared-path layout',()=>{
 const graph=arch.layout(`architecture "Containers" {model {
  package p "Package" {service a "A" service b "B" relation inside a -> b "Inside"}
  service c "C" service d "D" relation e p -> c "Package edge" relation f p -> d "Other edge"}
  view v "Ports" {tree g {nodes [a,b] direction right} place g at (0,0) place p at (0,0)
   place c at (800,0) place d at (800,400)
   routes {sharePath all} route inside {from bottom 1/4 to top 3/4}
   route e {from right 1/4 to left 1/2} route f {from right 3/4 to left 1/2}}}`);
 for(const [id,from,to]of [['inside','bottom','top'],['e','right','left'],['f','right','left']]) {
  const edge=graph.edges.find(e=>e.id===id),a=graph.nodes.find(n=>n.id===edge.source),b=graph.nodes.find(n=>n.id===edge.target);
  assert.deepEqual(edge.points[0],expected(a,from,id==='f'?.75:.25));
  assert.deepEqual(edge.points.at(-1),expected(b,to,id==='inside'?.75:.5));
  assert.equal(edge.sharedPath,undefined);
 }
});

test('invalid sides, positions and fractions report actionable diagnostics in DSL, JSON and model input',()=>{
 for(const [route,message]of [
  ['from bottom -0.1',/between 0 and 1/],['to right 1.1',/between 0 and 1/],
  ['from left 2/1',/between 0 and 1/],['to top 1/0',/Division by zero/],
  ['from auto 1/2',/side must/],['from nowhere 0.5',/side must/],
  ['from bottom 1/',/operand/],
 ]) {
  const result=arch.validate(source(`route e {${route}}`),{profile});assert.equal(result.valid,false,route);
  assert.match(result.diagnostics[0].message,message);assert.ok(result.diagnostics[0].line>0);
 }
 for(const command of ['from top 1/0','from right 3/2','to 1/0','to -1/2','to left 1/2'])
  assert.equal(arch.validate(source(`route data -> e {${command}}`),{profile}).valid,false,command);
 const json=JSON.parse(arch.translate(source('route e {from bottom 1/2}'),{format:'json'}));
 for(const invalid of [{side:'auto',position:.5},{side:'left',position:2},{side:'top',position:'1/0'},{side:'top',position:'2/1'},{side:'left'},{side:'left',position:.5,offset:20},{side:'left',position:'1/2 } model {'}]) {
  json.architecture.views.v.route.e.from=invalid;
  const result=arch.validate(json,{profile});assert.equal(result.valid,false);
  assert.match(result.diagnostics[0].path,/\/route\/e\/from/);
 }
 const model=parse(source('route e {from bottom 1/2}'));
 for(const invalid of [{side:'top',position:Infinity},{side:'left',position:-1},null,[],{x:NaN,y:0}]) {
  model.views[0].routes.e.from=invalid;assert.equal(arch.validate(model,{profile}).valid,false);
 }
 const report=arch.inspectSource(source('route e {from left 1/0}'),{profile});
 assert.ok(report.diagnostics[0].candidates.some(c=>c.example.includes('1/2')));
});
