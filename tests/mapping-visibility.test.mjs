import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as a from '../src/arch.js';
const profile={nodeTypes:{parameter:{attributes:{resource:{type:'reference',targets:['resource']}}},resource:{}},relationTypes:{maps:{from:['parameter'],to:['resource'],style:'flow'}},viewpoints:{must:{nodes:['parameter','resource'],relations:['maps'],connections:[{nodes:['parameter'],relations:['maps'],direction:'outgoing',referenceAttributes:['resource'],min:0,visibility:'shall'}]},may:{nodes:['parameter','resource'],relations:['maps'],connections:[{nodes:['parameter'],relations:['maps'],direction:'outgoing',referenceAttributes:['resource'],min:0,visibility:'may'}]}}};
const doc=(body='',view='',config='',vp='must')=>`architecture "Mappings" {config {${config}} model {parameter p "Parameter" resource r "Resource" ${body}} view v "View" {viewpoint ${vp} ${view}}}`;
const link='relation e p -> r "maps" {type maps}';
const opts={profile};
test('shall checks known model assignments: excluded nodes, hidden cards/links, may omission and missing knowledge differ',()=>{
 for(const view of ['exclude r','exclude e','style r {display none}','style e {display none}']) {
  const s=doc(link,view),strict=a.validate(s,opts);assert.equal(strict.valid,false);assert.equal(strict.diagnostics[0].code,'ARCH_MAPPING_HIDDEN');
  const draft=a.validate(s,{profile,validation:'draft'});assert.equal(draft.valid,true);assert.equal(draft.conformant,false);assert.equal(draft.diagnostics[0].mappingStatus,'hidden');
  assert.equal(a.validate(doc(link,view,'','may'),opts).valid,true);
 }
 const missing=a.validate(doc(),opts);assert.equal(missing.valid,true);assert.equal(missing.reviewRequired,true);assert.equal(missing.conformant,undefined);assert.equal(missing.diagnostics[0].mappingStatus,'review');assert.deepEqual(a.validate(doc('','','','may'),opts).diagnostics,[]);
 assert.deepEqual(a.validate(doc(link),opts).diagnostics,[]);
});
test('reference-only mappings require visible counterparts, and one visible link never hides another omitted one',()=>{
 const refs=doc().replace('parameter p "Parameter"','parameter p "Parameter" {resource r}');assert.deepEqual(a.validate(refs,opts).diagnostics,[]);assert.equal(a.validate(refs.replace('viewpoint must','viewpoint must exclude r'),opts).valid,false);
 const two=doc(link+' resource second "Second" relation hidden p -> second "maps" {type maps}','exclude second');assert.equal(a.validate(two,opts).valid,false);
});
test('review/hidden SVG markers are accessible, non-semantic, view-local and independently cleanable without weakening validation',()=>{
 const m=a.parse(doc(),opts),before=JSON.stringify(m);
 for(const validation of ['strict','draft']) {
  const svg=a.renderToString(m,{...opts,validation});
  assert.match(svg,/data-validation-status="review"/);
  assert.match(svg,/Mapping review — 1 item/);
  assert.match(svg,/Mapping not modeled/);
  assert.doesNotMatch(svg,/! = required mapping hidden/);
 }
 assert.equal(JSON.stringify(m),before);
 const hidden=doc(link,'style e {display none}','validation draft'),drawing=a.renderToString(hidden,opts);assert.match(drawing,/data-validation-status="hidden"/);assert.match(drawing,/Draft — 1 validation notices/);assert.ok(!drawing.includes('data-edge="e"'));
 const clean=a.renderToString(hidden,{profile,showValidation:false});assert.doesNotMatch(clean,/arch-validation-marker|arch-validation-notices/);assert.equal(a.validate(hidden,{profile,validation:'strict',showValidation:false}).valid,false);
 assert.doesNotMatch(a.renderToString(doc('','','showValidation false'),opts),/arch-validation-marker|arch-validation-notices/);assert.equal(a.validate(doc('','','showValidation nope'),opts).valid,false);
});
test('stacked and embedded views mark outer obligations on original cards without duplicates; source meta and JSON remain intact',async()=>{
 const s=doc('','','validation draft').replace('view v "View"','view source "Source" {viewpoint may include p,r} view v "View"').replace('viewpoint must','viewpoint must embed source');
 const svg=a.renderToString(s,{profile,views:'all'});assert.equal((svg.match(/data-validation-node="p"/g)??[]).length,1);assert.match(svg,/data-arch-view="v"/);
 const json=a.translate(s,{profile});const translated=a.renderToString(json,{profile,views:'all',idPrefix:'mapping'});assert.equal((translated.match(/data-validation-node="p"/g)??[]).length,1);assert.deepEqual(a.layout(json,{profile,view:'v'}).content.nodes.map(n=>[n.id,n.x,n.y]),a.layout(s,{profile,view:'v'}).content.nodes.map(n=>[n.id,n.x,n.y]));
 const cleanSource=doc('','','showValidation false validation draft');const round=a.translate(cleanSource,{profile});assert.equal(JSON.parse(round).architecture.config.showValidation,false);
 for(const file of ['arch.js','arch.min.js']){const c=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),c);assert.equal(c.arch.renderToString(s,{profile,views:'all',idPrefix:'mapping'}),a.renderToString(s,{profile,views:'all',idPrefix:'mapping'}));}
});
test('generic visibility policies reject invalid declarations and preserve unrelated cardinality rules',()=>{
 for(const check of [{visibility:'sometimes'},{visibility:'shall',min:1},{visibility:'shall',max:2},{visibility:'shall',through:{relations:['maps'],direction:'incoming'}}]) {
  const p=structuredClone(profile);Object.assign(p.viewpoints.must.connections[0],check);assert.throws(()=>a.registerProfile('bad-visibility',p),a.ArchError);
 }
 const p=structuredClone(profile);delete p.viewpoints.must.connections[0].visibility;p.viewpoints.must.connections[0].min=1;assert.equal(a.validate(doc(),{profile:p}).valid,false);
});


test('shall detects mappings hidden inside embedded may-show source views',()=>{
 const s=doc(link,'','','may').replace('view v "View"','view source "Source"').replace('viewpoint may','viewpoint may style e {display none}').replace(/}$/, 'view host "Host" {viewpoint must embed source}}');
 const strict=a.validate(s,opts);assert.equal(strict.valid,false);assert.ok(strict.diagnostics.some(d=>d.viewId==='host'&&d.code==='ARCH_MAPPING_HIDDEN'));
 const draft=a.renderToString(s,{profile,validation:'draft',view:'host'});assert.match(draft,/data-validation-status="hidden"/);assert.doesNotMatch(draft,/data-edge="e"/);
});

test('NAF S3 may omit known resource traces while S7 marks the exact unmodeled Resource parameter for review',async()=>{
 for(const id of ['uaf','naf41-uaf'])a.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
 const source=await readFile('examples/naf41-service-interfaces.arch','utf8');
 const optional=source.replace('viewpoint S3','viewpoint S3 exclude positionReport');assert.deepEqual(a.validate(optional).diagnostics,[]);
 const mandatory=source.replace('viewpoint S3','viewpoint S7');const report=a.validate(mandatory);assert.equal(report.valid,true);assert.equal(report.reviewRequired,true);assert.equal(report.conformant,undefined);assert.deepEqual(report.diagnostics.map(d=>[d.elementId,d.mappingStatus]),[['resource','review']]);
 assert.match(a.renderToString(mandatory),/data-validation-node="resource"/);
 assert.equal(a.validate(mandatory.replace('viewpoint S7','viewpoint S7 exclude positionReport')).valid,false);
});
