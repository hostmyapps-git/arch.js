import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
for(const id of ['uaf','naf41-uaf'])arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
const example=await readFile('examples/naf41-service-states.arch','utf8');
const cutout=await readFile('examples/naf41-service-states-cutout.arch','utf8');

test('S5 p.115 has a transition node bound to its state edge and a separate event trigger, including labeled/routable objectification',async()=>{
 assert.deepEqual(arch.validate(example).diagnostics,[]);
 const model=arch.parse(example),before=JSON.stringify(model),graph=arch.layout(model);
 assert.equal(graph.nodes.length,5);assert.equal(graph.edges.length,4);
 assert.equal(model.nodes.find(n=>n.id==='loss').type,'ServiceStateTransition');
 const edge=model.edges.find(e=>e.id==='stateChange');
 assert.equal(edge.type,'ServiceStateTransition');assert.equal(edge.attributes.transition,'loss');
 assert.deepEqual([edge.source,edge.target],['inService','outOfService']);
 const connector=graph.referenceNodes[0];assert.equal(connector.nodeId,'loss');assert.equal(connector.edgeId,'stateChange');
 assert.equal(connector.connectorLabelText,'is equal to');assert.equal(connector.route.to,.5);
 assert.equal(graph.nodes.filter(n=>n.id==='loss').length,1);assert.equal(connector.node,graph.nodes.find(n=>n.id==='loss'));
 for(const theme of ['light','dark']) {
  const options={theme,idPrefix:'s5'},svg=arch.renderToString(model,options);
  assert.match(svg,/class="arch-reference-label"/);assert.match(svg,/>is equal to</);
  assert.equal(arch.renderToString(arch.translate(example),options),svg);
  for(const file of ['arch.js','arch.min.js']) {
   const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
   for(const id of ['uaf','naf41-uaf'])context.arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
   assert.equal(context.arch.renderToString(example,options),svg);
  }
 }
 assert.equal(JSON.stringify(model),before);
 assert.match(arch.renderToString('@help types naf41-uaf ServiceStateTransition'),/Objectified/);
 assert.match(arch.renderToString('@help relations naf41-uaf ServiceStateTransition'),/transition/);
});

test('S5 supports all cut-out patterns and legacy compact ownership, mode and event references',()=>{
 assert.deepEqual(arch.validate(cutout).diagnostics,[]);
 const model=arch.parse(cutout);assert.equal(model.nodes.length,9);assert.equal(model.edges.length,10);
 for(const edge of model.edges)if(!['ServiceStateTransition','AggregatesServiceStateGroup'].includes(edge.type)) {
  const reversed=structuredClone(model),item=reversed.edges.find(e=>e.id===edge.id);
  [item.source,item.target]=[item.target,item.source];assert.equal(arch.validate(reversed).valid,false,edge.type);
 }
 const legacy=`architecture "Legacy" {config {profile naf41-uaf} model {
  ServiceSpecification s "Service" ServiceState a "A" {owner s} ServiceState b "B" {owner s}
  ServiceFunction f "F" ServiceMode mode "Mode" {function f} ServiceEvent event "Event"
  relation transition a -> b "Change" {type ServiceStateTransition event event}
  relation enables a -> mode "Enables" {type EnablesServiceMode}}
  view s5 "S5" {viewpoint S5}}`;
 assert.deepEqual(arch.validate(legacy).diagnostics,[]);assert.equal(arch.layout(legacy).referenceNodes.length,0);
 assert.doesNotMatch(arch.renderToString(legacy),/arch-reference-label/);
 assert.ok(arch.validate(legacy.replace('a -> b "Change"','a -> a "Change"').replace('ServiceState b "B" {owner s}','')).valid,'self transitions remain legal');
});

test('S5 validates binding cardinality, selected evidence, typed links, ownership and group cycles',()=>{
 const orphan=example.replace(' transition loss}','}').replace(/route loss -> stateChange[^}]+}/,'');
 assert.equal(arch.validate(orphan).valid,false);
 assert.match(arch.validate(orphan).diagnostics.map(d=>d.message).join('\n'),/ServiceStateTransition relationship bound through transition/);
 const draft=arch.validate(orphan.replace('profile naf41-uaf','profile naf41-uaf validation draft'));
 assert.ok(draft.valid);assert.ok(draft.diagnostics.some(d=>d.message.includes('loss')));
 const duplicate=example.replace('relation triggers','relation secondChange outOfService -> inService "Return" {type ServiceStateTransition transition loss}\n relation triggers');
 assert.equal(arch.validate(duplicate).valid,false);
 assert.equal(arch.validate(example.replace('transition loss}','transition denial}')).valid,false);
 for(const id of ['loss','inService','position'])assert.equal(arch.validate(example.replace('viewpoint S5',`viewpoint S5 exclude ${id}`)).valid,false,id);
 assert.ok(arch.validate(example.replace('viewpoint S5','viewpoint S5 style stateChange {display none}')).valid,'presentation hiding does not remove semantic evidence');
 assert.equal(arch.validate(example.replace('relation hasIn position -> inService "has" {type HasServiceState}','')).valid,false);
 assert.ok(arch.validate(example.replace('ServiceState inService "In Service"','ServiceState inService "In Service" {owner position}')).valid,'same owner ref plus explicit edge counts once');
 const contradictory=example.replace('Service position','Service other "Other" Service position').replace('ServiceState inService "In Service"','ServiceState inService "In Service" {owner other}');
 assert.equal(arch.validate(contradictory).valid,false);
 assert.equal(arch.validate(cutout.replace('relation hasMode function -> mode "has" {type HasServiceMode}','')).valid,false);
 for(const extra of ['relation loop subgroup -> group "Cycle" {type AggregatesServiceStateGroup}','relation self group -> group "Self" {type AggregatesServiceStateGroup}'])
  assert.equal(arch.validate(cutout.replace('relation hasReady',`${extra} relation hasReady`)).valid,false);
});

test('S5 reference appearance respects labels-only, shared/per-edge cards and free routing with bounded connector labels',()=>{
 for(const view of ['referenceDisplay nodes','referenceDisplay both','referenceOccurrences perEdge']) {
  const graph=arch.layout(example.replace('viewpoint S5',`viewpoint S5 ${view}`));
  assert.equal(graph.referenceNodes.length,1);const label=graph.referenceNodes[0].connectorLabel;
  assert.ok(label.x-label.width/2>=graph.bounds.x);assert.ok(label.x+label.width/2<=graph.bounds.x+graph.bounds.width);
 }
 const labels=arch.layout(example.replace('viewpoint S5','viewpoint S5 referenceDisplay labels').replace(/route loss -> stateChange[^}]+}/,''));
 assert.equal(labels.referenceNodes.length,0);assert.ok(labels.edges.find(e=>e.id==='stateChange').labelText.includes('is equal to'));
 const free=example.replace('from top to 1/2 curve straight dasharray none','path "M -900 -800 C -800 -1200 900 900 700 350"');
 const graph=arch.layout(free),label=graph.referenceNodes[0].connectorLabel;
 assert.ok(label);assert.ok(graph.bounds.x<-900);assert.ok(graph.bounds.y<-800);
});

test('generic referenced-by evidence is typed, edge-deduplicated, selected and schema-validated; connector labels are escaped',()=>{
 const profile={nodeTypes:{state:{},object:{}},relationTypes:{
  change:{from:['state'],to:['state'],attributes:{a:{type:'reference',targets:['object']},b:{type:'reference',targets:['object']}}},
  bound:{from:['state'],to:['state'],attributes:{object:{type:'reference',targets:['object']}},referenceLabels:{object:'<unsafe>&'},referenceDisplay:'nodes',referenceConnectorLabels:true}
 },viewpoints:{V:{connections:[{nodes:['object'],relations:['change'],direction:'either',min:1,max:1,referencedByAttributes:['a','b']}]}}};
 const source=`architecture "Binding" {model {state a "A" state b "B" object obj "Object" relation e a -> b "Change" {type change a obj b obj}} view v "V" {viewpoint V}}`;
 assert.ok(arch.validate(source,{profile}).valid,'one edge counts once even if both attributes reference the same object');
 assert.equal(arch.validate(source.replace('viewpoint V','viewpoint V exclude a'),{profile}).valid,false);
 const rendered=source.replace('type change a obj b obj','type bound object obj').replace('viewpoint V','');
 assert.match(arch.renderToString(rendered,{profile}),/&lt;unsafe&gt;&amp;/);
 for(const edit of [r=>r.referencedByAttributes=['missing'],r=>r.relations=['*'],r=>r.direction='outgoing',r=>r.counterparts=['state'],r=>r.through={relations:['change']},r=>r.referencedByAttributes=['*']]) {
  const bad=structuredClone(profile);edit(bad.viewpoints.V.connections[0]);assert.throws(()=>arch.registerProfile('bad-bind',bad),arch.ArchError);
 }
 const bad=structuredClone(profile);bad.relationTypes.bound.referenceConnectorLabels='yes';assert.throws(()=>arch.registerProfile('bad-label',bad),arch.ArchError);
});
