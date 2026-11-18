import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
for(const id of ['uaf','naf41-uaf'])arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
const example=await readFile('examples/naf41-service-functions.arch','utf8');
const cutout=await readFile('examples/naf41-service-functions-cutout.arch','utf8');
const doc=(body,view='')=>`architecture "S4" {config {profile naf41-uaf} model {${body}} view v "S4" {viewpoint S4 ${view}}}`;
const body=`Service s "S" ServiceFunction root "Root" ServiceFunction child "Child" ServiceFunction leaf "Leaf"
 relation enable root -> s "enables" {type EnablesService}
 relation first root -> child "aggregates" {type ServiceFunctionAggregation}
 relation second child -> leaf "aggregates" {type ServiceFunctionAggregation}`;

test('S4 p.112 reproduces all five elements and four links without synthetic service links on constituent functions',async()=>{
 assert.deepEqual(arch.validate(example).diagnostics,[]);
 const model=arch.parse(example),graph=arch.layout(model),before=JSON.stringify(model);
 assert.equal(graph.nodes.length,5);assert.equal(graph.edges.length,4);
 assert.deepEqual(model.edges.map(e=>[e.type,e.source,e.target]),[
  ['EnablesService','receiving','situation'],['EnablesService','storing','situation'],
  ['ServiceFunctionAggregation','storing','persisting'],['ServiceFunctionAggregation','storing','notifying']]);
 assert.equal(JSON.stringify(model),before);
 for(const theme of ['light','dark']) {
  const options={theme,idPrefix:'s4'},svg=arch.renderToString(model,options);
  assert.equal(arch.renderToString(arch.translate(example),options),svg);
  for(const file of ['arch.js','arch.min.js']) {
   const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
   for(const id of ['uaf','naf41-uaf'])context.arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
   assert.equal(context.arch.renderToString(example,options),svg);
  }
 }
});

test('S4 cut-out supports all nine directed patterns, optional roles and activities, while preserving native UAF meanings',()=>{
 assert.deepEqual(arch.validate(cutout).diagnostics,[]);
 const model=arch.parse(cutout);assert.equal(model.nodes.length,6);assert.equal(model.edges.length,10);
 for(const edge of model.edges) {
  const reversed=structuredClone(model),item=reversed.edges.find(e=>e.id===edge.id);
  [item.source,item.target]=[item.target,item.source];
  if(edge.type!=='ServiceFunctionAggregation')assert.equal(arch.validate(reversed).valid,false,edge.type);
 }
 assert.ok(arch.validate(doc('Service s "S" ServiceFunction fn "F" relation perform s -> fn "performs" {type IsCapableToPerform}')).valid);
 assert.equal(arch.validate(doc('Service s "S" ServiceFunction fn "F" relation wrong fn -> s "enables" {type IsCapableToPerform}')).valid,false);
 assert.equal(arch.validate(cutout.replace('type ConsumesService','type Consumes')).valid,false);
 assert.equal(arch.validate(cutout.replace('type ProvidesService','type AccessesServiceFunction')).valid,false);
});

test('S4 transitive contextual coverage handles deep/shared hierarchies, legacy direction, view selection, draft and orphan errors',()=>{
 assert.deepEqual(arch.validate(doc(body)).diagnostics,[]);
 assert.ok(arch.validate(doc(body.replace('root -> s','s -> root').replace('type EnablesService','type IsCapableToPerform'))).valid);
 const shared=body+' ServiceFunction other "Other" relation share other -> leaf "aggregates" {type ServiceFunctionAggregation} relation en other -> s "enables" {type EnablesService}';
 assert.deepEqual(arch.validate(doc(shared)).diagnostics,[]);
 assert.ok(arch.validate(doc(shared.replace('ServiceFunction other','Service t "Other service" ServiceFunction other').replace('relation en other -> s','relation en other -> t'))).valid);
 for(const invalid of [body+' ServiceFunction orphan "Orphan"',body.replace(/relation first[^}]+}/,''),body.replace(/relation enable[^}]+}/,'')]) {
  assert.equal(arch.validate(doc(invalid)).valid,false);
  const report=arch.validate(doc(invalid).replace('profile naf41-uaf','profile naf41-uaf validation draft'));
  assert.ok(report.valid);assert.ok(report.diagnostics.length>0);
 }
 assert.equal(arch.validate(doc(body,'exclude child')).valid,false,'unselected ancestor cannot transmit coverage');
 assert.equal(arch.validate(doc(body,'exclude s')).valid,false);
 assert.ok(arch.validate(doc(body,'style child {display none}')).valid,'presentation hiding retains semantic membership');
 for(const extra of ['relation loop leaf -> root "cycle" {type ServiceFunctionAggregation}','relation self root -> root "self" {type ServiceFunctionAggregation}'])
  assert.equal(arch.validate(doc(body+extra)).valid,false);
 arch.registerProfile('s4-specialized',{extends:'naf41-uaf',nodeTypes:{SpecialFunction:{extends:'ServiceFunction'}},relationTypes:{SpecialAggregation:{extends:'ServiceFunctionAggregation'}}});
 assert.ok(arch.validate(doc(body).replace('profile naf41-uaf','profile s4-specialized').replaceAll('ServiceFunction ','SpecialFunction ').replaceAll('type ServiceFunctionAggregation','type SpecialAggregation')).valid);
});

test('generic connection through schema validates selectors and counts reachable evidence once',()=>{
 const base={nodeTypes:{fn:{},service:{}},relationTypes:{group:{from:['fn'],to:['fn']},enable:{from:['fn'],to:['service']}},viewpoints:{V:{connections:[{nodes:['fn'],relations:['enable'],counterparts:['service'],direction:'outgoing',min:1,max:1,through:{relations:['group'],direction:'incoming'}}]}}};
 const source=`architecture "Through" {model {fn root "Root" fn a "A" fn b "B" fn leaf "Leaf" service s "S"
  relation e root -> s "Enables" {type enable}
  relation ra root -> a "G" {type group} relation rb root -> b "G" {type group}
  relation al a -> leaf "G" {type group} relation bl b -> leaf "G" {type group}}
  view v "V" {viewpoint V}}`;
 assert.ok(arch.validate(source,{profile:base}).valid,'diamond paths do not duplicate a matching edge');
 assert.ok(arch.validate(source.replace('relation bl b -> leaf "G" {type group}', 'relation bl b -> leaf "G" {type group} relation cycle leaf -> root "G" {type group}'),{profile:base}).valid,'generic traversal terminates even without an acyclic relation constraint');
 assert.ok(arch.validate(source.replace('viewpoint V','viewpoint V style root {display none}'),{profile:base}).valid);
 for(const through of [{relations:['missing']},{relations:['*']},{relations:['group'],direction:'either'},{relations:['group'],unexpected:true},null]) {
  const bad=structuredClone(base);bad.viewpoints.V.connections[0].through=through;
  assert.throws(()=>arch.registerProfile('bad-through',bad),arch.ArchError);
 }
 const outgoing=structuredClone(base);outgoing.viewpoints.V.connections[0].through.direction='outgoing';
 assert.equal(arch.validate(source,{profile:outgoing}).valid,false);
 assert.match(arch.validate(source.replace('viewpoint V','viewpoint V exclude root'),{profile:base}).diagnostics.map(d=>d.message).join('\n'),/through incoming group/);
});
