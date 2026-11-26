import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
for(const id of ['uaf','naf41-uaf'])arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
const example=await readFile('examples/naf41-service-parameters.arch','utf8');
const doc=(body,view='')=>`architecture "S7" {config {profile naf41-uaf} model {${body}} view s7 "S7" {viewpoint S7 ${view}}}`;
const model='ServiceFunction fn "Receive" ServiceFunctionParameter p "Incoming" InformationProduct report "Report" relation has fn -> p "has" {type HasServiceFunctionParameter} relation involves p -> report "involves" {type InvolvesLogicalResource}';
test('S7 p.120 supports both parameter chains, extends and embeds S3, and preserves JSON and bundles',async()=>{
 assert.deepEqual(arch.validate(example).diagnostics,[]);
 for(const view of ['s7','embeddedS7']) {
  const g=arch.layout(example,{view});assert.equal(g.nodes.length,15);assert.equal(g.edges.length,15);
  assert.equal(g.edges.filter(e=>e.type==='InvolvesLogicalResource').length,2);
  assert.equal(arch.renderToString(example,{view,idPrefix:'s7'}),arch.renderToString(arch.translate(example),{view,idPrefix:'s7'}));
  for(const file of ['arch.core.min.js', 'arch.min.js']){const c=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),c);for(const id of ['uaf','naf41-uaf'])c.arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));assert.equal(c.arch.renderToString(example,{view,idPrefix:'s7'}),arch.renderToString(example,{view,idPrefix:'s7'}));}
 }
});
test('logical involves accepts information items, rejects physical/active targets, wrong sources and reversed edges',()=>{
 for(const type of ['InformationProduct','InformationElement'])assert.equal(arch.validate(doc(model.replace('InformationProduct',type))).valid,true);
 for(const body of [model.replace('InformationProduct','DataProductType'),model.replace('InformationProduct','ServiceFunction'),model.replace('p -> report','report -> p'),model.replace('ServiceFunctionParameter p','ServiceOperationParameter p')])assert.equal(arch.validate(doc(body)).valid,false);
});
test('S7 requires function ownership and visible known payloads; unmodeled payloads remain reviewable',()=>{
 for(const body of [model.replace(/ relation has[^}]+}/,''),model.replace(/ relation involves[^}]+}/,'')]) {
  const report=arch.validate(doc(body));assert.equal(report.valid,!body.includes('relation involves'));if(report.valid)assert.equal(report.reviewRequired,true);const draft=arch.validate(doc(body),{validation:'draft'});assert.equal(draft.valid,true);assert.ok(draft.diagnostics.length);
 }
 const refs='ServiceFunction fn "Receive" InformationProduct report "Report" ServiceFunctionParameter p "Incoming" {owner fn resource report}';
 assert.equal(arch.validate(doc(refs)).valid,true);
 assert.equal(arch.validate(doc(refs,'include fn,p')).valid,false);
 assert.equal(arch.validate(doc(model,'exclude report')).valid,false);
 assert.equal(arch.validate(doc(refs.replace('InformationProduct','PhysicalMaterial'))).valid,true,'legacy physical references remain compatible');
 assert.equal(arch.validate(doc(model.replace('ServiceFunction fn','ServiceOperation fn'))).valid,false);
});
test('S3 retains optional physical traces and excludes logical function-parameter relationships',()=>{
 assert.deepEqual(arch.validate(example).diagnostics,[]);
 const wrong=doc(model).replace('viewpoint S7','viewpoint S3');assert.equal(arch.validate(wrong).valid,false);
});
