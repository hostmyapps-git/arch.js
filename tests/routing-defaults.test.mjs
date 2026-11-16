import test from 'node:test';
import assert from 'node:assert/strict';
import * as arch from '../src/arch.js';

const profile={nodeTypes:{actor:{template:'person'},item:{template:'artifact'}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
const source=(rules='',extra='')=>`architecture "Routing defaults" {model {
 actor a "A" actor b "B" actor c "C" item data "Dataset"
 relation pickup a -> b "Collects" {type flow payload [data]}
 relation delivery b -> c "Delivers" {type flow payload [data]}}
 view v "Defaults" {place a at (0,0) place b at (500,100) place c at (1000,0) place data at (400,-240) ${rules}}
 ${extra}}`;
const parse=text=>arch.parse(text,{profile});
const layout=rules=>arch.layout(parse(source(rules)));
const point=({x,y})=>({x,y});

test('routes defaults apply to every relationship and reference connector, including otherwise automatic routes',()=>{
 const graph=layout('routes {curve straight from bottom}');
 for(const edge of graph.edges) {
  assert.equal(edge.points.length,2);
  const node=graph.nodes.find(n=>n.id===edge.source);
  assert.deepEqual(edge.points[0],{x:node.x+node.width/2,y:node.y+node.height});
 }
 for(const ref of graph.referenceNodes) {
  assert.equal(ref.points.length,2);assert.match(ref.d,/^M .* L /);
  assert.deepEqual(ref.points[0],{x:ref.node.x+ref.node.width/2,y:ref.node.y+ref.node.height});
 }
 const automatic=layout(''),empty=layout('routes {}');
 assert.ok(empty.referenceNodes.every(r=>r.d===undefined),'empty defaults keep automatic obstacle avoidance');
 assert.deepEqual(empty.referenceNodes.map(r=>r.points),automatic.referenceNodes.map(r=>r.points));
});

test('specific route properties override defaults regardless of source order while other properties remain inherited',()=>{
 const local='route pickup {curve rounded via (350,160), (420,160)} route data -> pickup {from left curve bezier via (300,-200), (400,40)}';
 const defaults='routes {curve straight from bottom}';
 const first=layout(`${defaults} ${local}`),second=layout(`${local} ${defaults}`);
 assert.deepEqual(first.edges.map(e=>e.d),second.edges.map(e=>e.d));
 assert.deepEqual(first.referenceNodes.map(r=>r.d),second.referenceNodes.map(r=>r.d));
 assert.match(first.edges[0].d,/ Q /);assert.equal(first.edges[1].points.length,2);
 const ref=first.referenceNodes.find(r=>r.edgeId==='pickup'),other=first.referenceNodes.find(r=>r.edgeId==='delivery');
 assert.match(ref.d,/ C /);assert.equal(ref.points[0].x,ref.node.x);assert.equal(other.points.length,2);
 const sourceNode=first.nodes.find(n=>n.id==='a');assert.equal(first.edges[0].points[0].y,sourceNode.y+sourceNode.height);
});

test('default endpoint types and labels apply to the appropriate route kind and remain individually overridable',()=>{
 const ports=layout('routes {curve straight to top label (700,-80)}');
 for(const edge of ports.edges) {
  const target=ports.nodes.find(n=>n.id===edge.target);
  assert.deepEqual(edge.points.at(-1),{x:target.x+target.width/2,y:target.y});
  assert.deepEqual(edge.label,{x:700,y:-80},'global label position must not be automatically shifted for reference cards');
 }
 assert.ok(ports.referenceNodes.every(r=>r.route.to===undefined&&r.route.label===undefined));
 const fractions=layout('routes {curve straight to 0} route data -> delivery {to 1} route pickup {to left label (900,-100)}');
 const pickup=fractions.edges.find(e=>e.id==='pickup'),delivery=fractions.edges.find(e=>e.id==='delivery');
 assert.deepEqual(pickup.label,{x:900,y:-100});assert.equal(pickup.points.at(-1).x,500);
 assert.deepEqual(point(fractions.referenceNodes.find(r=>r.edgeId==='pickup').anchor),point(pickup.points[0]));
 assert.deepEqual(point(fractions.referenceNodes.find(r=>r.edgeId==='delivery').anchor),point(delivery.points.at(-1)));
 const labelsOnly=layout('routes {label (700,-80)}');
 assert.ok(labelsOnly.referenceNodes.every(r=>!r.route),'relationship-only defaults preserve automatic reference routing');
});

test('free path defaults yield to specific geometry and paths; defaults and layout remain view-local and immutable',()=>{
 const fallback='M -100 -100 L 100 100',explicit='M -300 -300 Q 0 -500 800 100';
 const text=source(`routes {path "${fallback}" curve straight} route pickup {from right} route data -> pickup {path "${explicit}"}`,'view clean "Clean" {}');
 const model=parse(text),before=JSON.stringify(model),graph=arch.layout(model);
 assert.notEqual(graph.edges[0].d,fallback);assert.equal(graph.edges[1].d,fallback);
 assert.equal(graph.referenceNodes.find(r=>r.edgeId==='pickup').d,explicit);
 assert.equal(graph.referenceNodes.find(r=>r.edgeId==='delivery').d,fallback);
 const clean=arch.layout(model,{view:'clean'});assert.ok(clean.referenceNodes.every(r=>!r.route));
 assert.equal(JSON.stringify(model),before);
 assert.ok(graph.bounds.x<=-300&&graph.bounds.y<=-500);
});

test('defaults validate merged Bezier controls and reject duplicate blocks, bad values and incompatible renderers',()=>{
 const invalid=[
  ['routes {} routes {}',/Duplicate view option/],
  ['routes {curve invalid}',/Unknown curve/],
  ['routes {from nowhere}',/Unknown port/],
  ['routes {to nowhere}',/Unknown port/],
  ['routes {to 2}',/between 0 and 1/],
  ['routes {curve straight curve rounded}',/Duplicate routing attribute/],
  ['routes {foo bar}',/Unknown routing attribute/],
  ['routes {curve bezier} route pickup {via (100,100)}',/two control points/],
  ['routes {via (1,2), (3,4), (5,6)} route data -> pickup {curve bezier}',/two control points/]
 ];
 for(const [rules,message] of invalid) {
  const result=arch.validate(source(rules),{profile});assert.equal(result.valid,false,rules);assert.match(result.diagnostics[0].message,message);
 }
 assert.ok(arch.validate(source('routes {curve bezier via (0,0), (100,100)} route pickup {curve straight}'),{profile}).valid);
 const specialist=source('routes {curve straight} diagram class {}').replace(/place \w+ at \([^)]*\)/g,'');
 assert.match(arch.validate(specialist,{profile}).diagnostics[0].message,/connected renderer/);
});
