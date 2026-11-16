import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';
import { pathSamples, pointOnPath } from '../src/reference-nodes.js';

const profile={nodeTypes:{actor:{template:'person'},item:{template:'artifact'}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
const source=(routing='',extra='')=>`architecture "Reference routing" {
 model {actor a "A" actor b "B" actor c "C" item data "Dataset"
 relation pickup a -> b "Collects" {type flow payload [data]}
 relation delivery b -> c "Delivers" {type flow payload [data]}}
 view v "Routed" {place a at (0,0) place b at (600,0) place c at (1200,0)
 place data at (480,-240) ${routing}}
 ${extra}
}`;
const graphOf=text=>arch.layout(arch.parse(text,{profile}));
const xml=svg=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(svg,'image/svg+xml');
const ref=(graph,id='pickup')=>graph.referenceNodes.find(r=>r.edgeId===id);
const point=({x,y})=>({x,y});
const bounded=(graph,p)=>assert.ok(p.x>=graph.bounds.x&&p.y>=graph.bounds.y&&p.x<=graph.bounds.x+graph.bounds.width&&p.y<=graph.bounds.y+graph.bounds.height);

test('reference routes independently control each attachment of a shared card and preserve the model and other views',()=>{
 const text=source(`route data -> pickup {from left to 0.25 via (350,-185), (350,48) curve rounded}
 route data -> delivery {from right to 0.75 via (1050,-185), (1050,48) curve straight}`,'view automatic "Automatic" {}');
 const model=arch.parse(text,{profile}),before=JSON.stringify(model),graph=arch.layout(model),a=ref(graph),b=ref(graph,'delivery');
 assert.equal(a.node,b.node);assert.notEqual(a.d,b.d);assert.match(a.d,/ Q /);assert.doesNotMatch(b.d,/ Q /);
 for(const r of [a,b]) {
  const edge=graph.edges.find(e=>e.id===r.edgeId),expected=pointOnPath(pathSamples(edge.d),r.route.to);
  assert.deepEqual(point(r.anchor),point(expected));assert.deepEqual(r.points.at(-1),point(expected));
  for(const p of r.points)bounded(graph,p);
 }
 assert.equal(graph.edges.length,2);assert.equal(graph.nodes.filter(n=>n.id==='data').length,1);
 assert.equal(a.points[0].x,a.node.x);assert.equal(b.points[0].x,b.node.x+b.node.width);
 const automatic=arch.layout(model,{view:'automatic'});assert.ok(automatic.referenceNodes.every(r=>!r.route));
 assert.equal(JSON.stringify(model),before);
 const d=xml(arch.renderToString(model)),paths=[...d.getElementsByTagName('path')].filter(p=>p.getAttribute('class')==='arch-reference-connector');
 assert.deepEqual(paths.map(p=>p.getAttribute('d')),[a.d,b.d]);
 assert.equal([...d.getElementsByTagName('g')].filter(g=>g.getAttribute('data-node')==='data').length,1);
 assert.ok(arch.validate(source('route data->pickup {curve straight}'),{profile}).valid);
 assert.ok(arch.validate(source('route data -> pickup {curve straight}').replaceAll('data','reference'),{profile}).valid);
 assert.equal(arch.validate(source('route reference data -> pickup {}'),{profile}).valid,false);
 // Preserve ordinary relationships whose ID happens to be "reference".
 assert.ok(arch.validate(source('route reference {from bottom}').replaceAll('pickup','reference'),{profile}).valid);
});

test('reference ports, absolute starts, waypoints and all four curve modes use the normal routing geometry',()=>{
 for(const curve of ['orthogonal','straight','rounded','bezier']) {
  const graph=graphOf(source(`route data -> pickup {from bottom to 0.5 via (400,-100), (400,48) curve ${curve}}`)),r=ref(graph);
  assert.deepEqual(r.points[0],{x:r.node.x+r.node.width/2,y:r.node.y+r.node.height});
  assert.ok(r.points.some(p=>p.x===400&&p.y===-100));
  assert.match(r.d,curve==='bezier'?/ C /:curve==='rounded'?/ Q /:/ L /);
 }
 const r=ref(graphOf(source('route data -> pickup {from (501,-150) to 1 curve straight}')));
 assert.deepEqual(r.points[0],{x:501,y:-150});
 const edge=graphOf(source()).edges.find(e=>e.id==='pickup');
 assert.deepEqual(point(r.anchor),point(pathSamples(edge.d).at(-1)));
 const start=ref(graphOf(source('route data -> pickup {to 0}')));
 assert.deepEqual(point(start.anchor),point(pathSamples(edge.d)[0]));
});

test('attachment fractions follow curved relationship paths and remain independent of relationship labels',()=>{
 const graph=graphOf(source('route pickup {path "M 220 48 C 300 -100 500 -100 600 48" label (800,200)} route data -> pickup {to 0.3 curve bezier}'));
 const r=ref(graph),edge=graph.edges.find(e=>e.id==='pickup');
 assert.deepEqual(point(r.anchor),point(pointOnPath(pathSamples(edge.d),0.3)));
 assert.ok(r.anchor.y<48);assert.match(r.d,/ C /);assert.deepEqual(edge.label,{x:800,y:200});
});

test('free SVG reference paths preserve their exact data, conservative bounds and safe validation',()=>{
 const d='M 480 -185 C -900 -700 1300 -700 410 48';
 const graph=graphOf(source(`route data -> pickup {path "${d}"}`)),r=ref(graph);
 assert.equal(r.d,d);for(const p of r.points)bounded(graph,p);
 const parsed=xml(arch.renderToString(source(`route data -> pickup {path "${d}"}`),{profile}));
 assert.ok([...parsed.getElementsByTagName('path')].some(p=>p.getAttribute('class')==='arch-reference-connector'&&p.getAttribute('d')===d));
 for(const invalid of ['M 0 0 L','M 0 0 onload=alert(1)','M 0 0 A -2 4 0 0 0 2 3'])
  assert.throws(()=>arch.renderToString(source(`route data -> pickup {path "${invalid}"}`),{profile}),arch.ArchError);
});

test('reference routing rejects unknown or unrelated targets, invalid controls, duplicates and specialist renderers',()=>{
 const invalid=[
  ['route missing -> pickup {}',/Unknown reference element/],
  ['route data -> missing {}',/Unknown relationship/],
  ['route a -> pickup {}',/not a graphical reference/],
  ['route data -> pickup {to -0.1}',/between 0 and 1/],
  ['route data -> pickup {to 1.1}',/between 0 and 1/],
  ['route data -> pickup {to right}',/position along/],
  ['route data -> pickup {from nowhere}',/Unknown port/],
  ['route data -> pickup {curve cubic}',/Unknown curve/],
  ['route data -> pickup {curve bezier via (0,0)}',/two control points/],
  ['route data -> pickup {label (0,0)}',/Unknown routing attribute/],
  ['route data -> pickup {to 0.1 to 0.2}',/Duplicate routing attribute/],
  ['route data -> pickup {} route data -> pickup {}',/Duplicate reference route/],
  ['route data -> pickup {} diagram class {}',/only supported for connected/]
 ];
 for(const [routing,message] of invalid) {
  const result=arch.validate(source(routing),{profile});assert.equal(result.valid,false,routing);
  assert.match(result.diagnostics[0].message,message);assert.ok(result.diagnostics[0].line>0);
 }
 const specialist=source('route data -> pickup {} diagram class {}').replace(/place \w+ at \([^)]*\)/g,'');
 assert.match(arch.validate(specialist,{profile}).diagnostics[0].message,/only supported for connected/);
 const model=arch.parse(source('route data -> pickup {}'),{profile});
 model.views[0].referenceRoutes.push(model.views[0].referenceRoutes[0]);assert.equal(arch.validate(model).valid,false);
 assert.match(arch.renderToString('@help routing'),/route NODE_ID/);
});

test('routes address per-edge occurrences too; hidden references and labels-only views retain their presentation',()=>{
 const routing='route data -> pickup {from left to 0.2 via (-500,-300) curve straight}';
 const repeated=graphOf(source(`referenceOccurrences perEdge ${routing}`).replace('place data at (480,-240)',''));
 assert.notEqual(ref(repeated).node,ref(repeated,'delivery').node);
 assert.ok(ref(repeated).d);assert.equal(ref(repeated,'delivery').d,undefined);
 assert.equal(ref(repeated).node.referenceIdentityLines.join(''),'ID: data');
 for(const selection of ['exclude data','referenceDisplay labels']) {
  const graph=graphOf(source(`${routing} ${selection}`));assert.equal(graph.referenceNodes.length,0);
  assert.ok(graph.edges.every(e=>e.labelLines.join(' ').includes('Dataset [data]')));
 }
});
