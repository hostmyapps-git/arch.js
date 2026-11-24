import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

const body='service a "A" service b "B" service c "C" relation e a -> b "Calls" relation f b -> c "Next"';
const doc=(view,model=body)=>`architecture "Via expressions" {model{${model}}view v "V"{${view}}}`;
const at='place a at (20,40) place b at (a.right + 300,a.y + 200) place c at (900,0)';
const get=(g,id)=>g.nodes.find(n=>n.id===id);
const edge=(g,id='e')=>g.edges.find(e=>e.id===id);

test('via expressions use final placed nodes with arithmetic/grouping and preserve source/model identity',()=>{
  const source=doc(`${at} route e {from right to left via (a.right + 20 * 2,b.centerY - b.height / 2), (b.x - 40,(b.y + b.bottom) / 2) curve straight}`),model=arch.parse(source),before=JSON.stringify(model),g=arch.layout(model);
  assert.deepEqual(edge(g).points,[{x:240,y:88},{x:280,y:240},{x:500,y:288},{x:540,y:288}]);
  assert.equal(JSON.stringify(model),before);assert.deepEqual(arch.layout(model),g);
  assert.equal(model.views[0].routes.e.via[0].x,'a.right + 20 * 2');
  assert.doesNotMatch(arch.renderToString(source),/NaN|undefined|Infinity/);
  for(const p of edge(g).points)assert.ok(p.x>=g.bounds.x&&p.y>=g.bounds.y&&p.x<=g.bounds.x+g.bounds.width&&p.y<=g.bounds.y+g.bounds.height);
});

test('via subtraction without spaces resolves known references and preserves ambiguous declared IDs',()=>{
  const source=doc(`${at} route e {curve straight via (b.x-a.width,b.y-a.height)}`),g=arch.layout(source);
  assert.deepEqual(edge(g).points[1],{x:320,y:144});
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'compact-via'}),arch.renderToString(source,{idPrefix:'compact-via'}));
  const model=body+' service root "Root" service offset "Offset" service root.x-offset "Long ID"';
  const places='place root at (300,100) place offset at (0,40) place root.x-offset at (800,500)';
  const long=arch.layout(doc(`${at} ${places} route e {curve straight via (root.x-offset.y,root.x - offset.y)}`,model));
  assert.deepEqual(edge(long).points[1],{x:500,y:260});
  assert.match(arch.validate(doc(`${at} ${places} route e {via (root.x-offset.y,0)} style root.x-offset {display none}`,model)).diagnostics[0].message,/Hidden or excluded via reference: root.x-offset/);
});

test('shared route defaults resolve after overrides, including ignored paths and hidden unused anchors',()=>{
  const g=arch.layout(doc(`${at} routes {via [(c.x - 100,c.y - 40)] curve straight} route e {via (a.right + 30,a.y)}`));
  assert.deepEqual(edge(g).points[1],{x:270,y:40});assert.deepEqual(edge(g,'f').points[1],{x:800,y:-40});
  const hidden=doc(`${at} routes {curve straight via (c.x,0)} route e {via (a.right + 30,a.y)} style c {display none}`);
  assert.equal(arch.validate(hidden).valid,true);assert.equal(arch.layout(hidden).edges.length,1);
  assert.equal(arch.validate(doc(`${at} route e {via (b.x,b.y)} style b {display none}`)).valid,true);
  const path=arch.layout(doc(`${at} routes {via (c.x,0)} route e {path "M 0 0 L 100 0"} style c {display none}`));
  assert.equal(edge(path).d,'M 0 0 L 100 0');
  assert.match(arch.validate(doc(`${at} routes {via (c.x,0)} style c {display none}`)).diagnostics[0].message,/Hidden or excluded via reference/);
});

test('tree groups and nested package nodes expose final absolute coordinates to via, including bezier controls',()=>{
  const source=doc('tree g {nodes [a,b] direction up} place g at (c.right + 80,c.y) place c at (100,200) route e {via (g.centerX + 20,a.y + 40), (b.x - 40,b.y) curve bezier}');
  const g=arch.layout(source),group=g.treeGroups[0],e=edge(g);
  assert.deepEqual(e.points[1],{x:group.bounds.x+group.bounds.width/2+20,y:get(g,'a').y+40});assert.match(e.d,/ C /);
  const nested=arch.layout(doc('place p at (500,200) place a at (0,0) place b at (a.right + 80,a.y) route e {via (a.right + 40,a.bottom + 30)}','package p "P"{'+body+'}'));
  assert.ok(edge(nested).points.some(p=>p.x===get(nested,'a').x+get(nested,'a').width+40&&p.y===get(nested,'a').y+get(nested,'a').height+30));
});

test('reference connector via expressions use canonical cards, defaults/overrides and shared or perEdge occurrences',()=>{
  const profile={defaultRelation:'exchange',nodeTypes:{service:{template:'service'},document:{template:'artifact'}},relationTypes:{exchange:{style:'flow',attributes:{payload:{type:'reference',targets:['document'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
  const model='service a "A" service b "B" document info "Report" relation e a -> b "Sends" {payload [info]} relation f b -> a "Replies" {payload [info]}';
  for(const occurrences of ['shared','perEdge']) {
    const source=doc(`referenceOccurrences ${occurrences} routes {curve straight via (a.right + 40,a.y - 60)} route info -> e {via [(info.centerX + 20,a.y - 100), (b.x - 20,b.centerY)] curve bezier}`,model);
    const g=arch.layout(source,{profile}),info=get(g,'info'),ref=g.referenceNodes.find(r=>r.edgeId==='e');
    assert.ok(!info.referenceOnly);assert.equal(ref.node,info);assert.match(ref.d,/ C /);
    assert.deepEqual(ref.points[1],{x:info.x+info.width/2+20,y:get(g,'a').y-100});
    const other=g.referenceNodes.find(r=>r.edgeId==='f');assert.ok(other.points.some(p=>p.x===get(g,'a').x+260&&p.y===get(g,'a').y-60));
    const svg=arch.renderToString(source,{profile});assert.equal((svg.match(/data-node="info"/g)??[]).length,1);
  }
});

test('via validates targets and arithmetic and retains placement cycle errors',()=>{
  for(const [view,pattern]of [
    ['route e {via (missing.x,0)}',/Unknown via reference/],
    ['route e {via (e.x,0)}',/Unknown via reference/],
    ['route e {via (c.x,0)} exclude c',/Hidden or excluded via reference/],
    ['route e {via (c.x,0)} style c {display none}',/Hidden or excluded via reference/],
    ['route e {via (a.x / 0,0)}',/Division by zero/],
    ['route e {via (a.foo,0)}',/Invalid placement coordinate/],
    ['route e {curve bezier via (a.x,0)}',/two control points/],
    ['route e {via []}',/Expected: \(/],
    ['route e {via [(a.x,0)}',/Expected: \]/],
    ['place a at (b.x,0) place b at (a.x,0) route e {via (a.x,b.y)}',/Circular placement dependency/],
  ]) {const report=arch.validate(doc(view));assert.equal(report.valid,false,view);assert.match(report.diagnostics[0].message,pattern);}
  assert.throws(()=>arch.layout(doc(`${at} route e {via (a.x / (b.width - 220),0)}`)),/Division by zero/);
  assert.throws(()=>arch.layout(doc(`${at} route e {via (b.x + 10000000,0)}`)),/outside the range/);
});

test('calculated from/to tuples follow final card positions and sizes and round-trip through JSON',()=>{
  const source=doc(`${at} style a {width 300 height 360} style b {height 140}
    route e {from (a.x+a.width, b.centerY) to left curve straight}
    route f {from (b.right, b.y + b.height / 2) to (c.x, c.y + 10) curve straight}`);
  const graph=arch.layout(source);
  assert.deepEqual(edge(graph).points,[{x:320,y:310},{x:620,y:310}]);
  assert.deepEqual(edge(graph,'f').points,[{x:840,y:310},{x:900,y:10}]);
  const json=arch.translate(source);
  assert.deepEqual(JSON.parse(json).architecture.views.v.route.e.from,['a.x + a.width','b.centerY']);
  const options={idPrefix:'calculated-ports'};
  assert.equal(arch.renderToString(json,options),arch.renderToString(source,options));
  assert.equal(arch.renderToString(arch.translate(json),options),arch.renderToString(source,options));
});

test('calculated endpoints validate effective references after overrides and a free path',()=>{
  const path='M 0 0 L 100 0';
  const defaults=`${at} style c {display none} routes {from (c.right, c.centerY)}`;
  const local=arch.layout(doc(`${defaults} route e {from (a.right, b.centerY) to left curve straight}`));
  assert.deepEqual(edge(local).points[0],{x:240,y:288});
  const free=arch.layout(doc(`${defaults} route e {path "${path}"}`));
  assert.equal(edge(free).d,path);
  assert.ok(Number.isFinite(edge(free).label.x));
  for(const [view,pattern]of [
    [defaults,/Hidden or excluded from reference: c/],
    ['route e {to (missing.x, 0)}',/Unknown to reference: missing/],
    ['route e {from (a.width / 0, 0)}',/Division by zero/],
  ]) assert.match(arch.validate(doc(view)).diagnostics[0].message,pattern);
});

test('via JSON/DSL/meta translation preserves expressions with coordinate JSON diagnostics and both standalone bundles',async()=>{
  const waypoints='(a.right + 40,b.y / 2), ((b.x + c.x) / 2,b.y)';
  const source=doc(`${at} route e {via [${waypoints}] curve bezier}`),expected=arch.renderToString(source,{idPrefix:'via'}),json=arch.translate(source);
  assert.equal(arch.renderToString(doc(`${at} route e {via ${waypoints} curve bezier}`),{idPrefix:'via'}),expected);
  assert.deepEqual(JSON.parse(json).architecture.views.v.route.e.via[0],['a.right + 40','b.y / 2']);
  assert.equal(arch.renderToString(json,{idPrefix:'via'}),expected);assert.equal(arch.renderToString(arch.translate(json),{idPrefix:'via'}),expected);
  assert.match(arch.renderToString(source.replace('model{','@meta json\nmodel{')),/a.right \+ 40/);
  assert.match(arch.renderMarkdown('```arch\n'+source+'\n```'),/<svg/);
  const invalid=JSON.parse(json);invalid.architecture.views.v.route.e.via[0][0]='a.x / 0';assert.match(arch.validate(invalid).diagnostics[0].path,/via\/0\/0/);
  invalid.architecture.views.v.route.e.via[0][0]='missing.x';assert.match(arch.validate(invalid).diagnostics[0].path,/route\/e/);
  assert.match(arch.help('routing'),/Calculated via/);
  for(const file of ['arch.js','arch.min.js']){const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);assert.equal(context.arch.renderToString(source,{idPrefix:'via'}),expected);}
});

test('via expressions stay view-local across stacked views and template paths do not pin unused reference cards',()=>{
  const source=doc(`${at} route e {via (a.right + 40,a.y - 60)}`).replace(/}$/, 'view other "Other" {place a at (500,200) route e {via (a.right + 40,a.y - 60)}}}');
  assert.equal(arch.layout(source,{views:'all'}).layouts.length,2);
  assert.deepEqual(edge(arch.layout(source,{view:'v'})).points[1],{x:280,y:88});
  assert.ok(edge(arch.layout(source,{view:'other'})).points.some(p=>p.x===760&&p.y===140));
  const profile={defaultRelation:'exchange',nodeTypes:{service:{template:'service'},document:{template:'artifact'}},relationTypes:{exchange:{style:'flow',attributes:{payload:{type:'reference',targets:['document'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
  const g=arch.layout(doc('routes {via (info.x,info.y) path "M 0 0 L 100 0"}','service a "A" service b "B" document info "Report" relation e a -> b "Sends" {payload [info]}'),{profile});
  assert.equal(get(g,'info').referenceOnly,true);
});
