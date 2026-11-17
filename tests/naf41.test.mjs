import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
import { cases, document } from './fixtures/naf41/cases.mjs';
for (const id of ['uaf', 'naf41-uaf']) arch.registerProfile(id, JSON.parse(await readFile(`profiles/${id}.json`, 'utf8')));
const coverage = JSON.parse(await readFile('profiles/naf41/coverage.json', 'utf8'));
const errors = source => arch.validate(source).diagnostics.map(d => d.message).join('\n');
const without = (id, relationship) => document(id, cases[id].replace(new RegExp(`relation ${relationship} [^}]*}`), ''));

test('C3 permits specialization/grouping context without a dependency on every capability, as in NAF p.93',async()=>{
  const source=await readFile('tests/fixtures/naf41/c3-specialization.arch','utf8');
  for(const validation of ['strict','draft']) {
    const report=arch.validate(source,{validation});assert.equal(report.valid,true);assert.deepEqual(report.diagnostics,[]);
    const g=arch.layout(source,{validation});assert.equal(g.kind,undefined);assert.equal(g.nodes.length,5);assert.equal(g.edges.length,4);assert.deepEqual(g.treeGroups[0].roots,['c_SAR']);
  }
  assert.equal(arch.validate(source.replace('Capability c_SAR "SAR"','Capability c_SAR "SAR" Capability context "Context only"')).valid,true);
  assert.match(errors(source.replace(/relation c3\.[23] [^}]*}/g,'')),/CapabilityDependency/);
  assert.match(errors(source.replace('c_maritimeSAR -> c_SAR "is kind of"','capabilityGroup_c2 -> c_SAR "is kind of"')),/not allowed for CapabilityGeneralization/);
  assert.match(arch.help('viewpoints naf41-uaf C3'),/Not every displayed capability/);
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    for(const p of ['uaf','naf41-uaf'])context.arch.registerProfile(p,JSON.parse(await readFile(`profiles/${p}.json`,'utf8')));
    assert.equal(context.arch.validate(source).valid,true);
  }
});

test('NAFv4.1 sources are pinned, including the CP1252 ADMBw reference and documented semantic differences', async () => {
  for (const source of coverage.sources) assert.equal(createHash('sha256').update(await readFile(source.file)).digest('hex'), source.sha256);
  assert.equal(coverage.admbwReference.domainStereotypes, 318);
  assert.equal(coverage.admbwReference.declaredFoundation, 'NAF 4.0');
  assert.deepEqual(coverage.admbwReference.comparisons.find(c => c.name === 'Evaluates').endpoints, [
    { role: 'client', types: ['FulfilmentCriterion'] }, { role: 'supplier', types: ['FitCriterion'] },
  ]);
  assert.equal(coverage.counts.viewpoints, 47);
  assert.match(arch.help('profiles naf41-uaf'), /not a claim|No certification/);
  assert.match(arch.help('viewpoints naf41-uaf C7'), /printed page 98/);
});

test('all 47 NAFv4.1 viewpoints accept independently authored scenarios and render valid SVG', () => {
  const expected = 'C1 C2 C3 C4 C5 C7 C8 Cr S1 S2 S3 S4 S5 S6 S7 S8 Sr C1-S1 L1 L2 L2-L3 L3 L4 L5 L6 L7 L8 Lr P1 P2 P3 P4 L4-P4 P5 P6 P7 P8 Pr A1 A2 A3 A4 A5 A6 A7 A8 Ar'.split(' ').sort();
  assert.deepEqual(Object.keys(cases).sort(), expected);
  assert.deepEqual(Object.keys(arch.getProfile('naf41-uaf').viewpoints).sort(), expected);
  for (const id of expected) {
    assert.equal(arch.validate(document(id)).valid, true, `${id}: ${errors(document(id))}`);
    const svg = arch.renderToString(document(id));
    const doc = new DOMParser({ onError: (level, msg) => { throw new Error(`${id}: ${level}: ${msg}`); } }).parseFromString(svg, 'image/svg+xml');
    assert.equal(doc.documentElement.localName, 'svg');
    assert.equal(arch.validate(document(id, '')).valid, id === 'L2-L3', `${id}: mandatory content; concept view intentionally permits no formal content`);
  }
});

test('C7 requires the complete capability-criterion-measure chain for every criterion', () => {
  for (const link of ['characterizes','evaluates']) assert.equal(arch.validate(without('C7',link)).valid, false, link);
  const orphan = document('C7', cases.C7 + ' AssessmentCriterion orphan "Unused criterion" { expression "Must be allocated" }');
  assert.match(errors(orphan), /orphan requires.*CharacterizesCapability/);
  assert.match(errors(document('C7', 'Capability c "C" Measurement m "Disconnected measurement"')), /AssessmentCriterion|Measure/);
  const reversed = document('C7', cases.C7.replace('measure -> criterion', 'criterion -> measure'));
  assert.equal(arch.validate(reversed).valid, false);
  assert.match(errors(document('C7',cases.C7,'include cap, criterion')), /Measure|EvaluatesCriterion/);
});

test('NAF C2 Goal maps to EnterpriseGoal and all three goals satisfy the inherited viewpoint and relationship rules',()=>{
  const profile=arch.getProfile('naf41-uaf');assert.deepEqual(profile.nodeTypes.Goal.extends,['EnterpriseGoal']);
  assert.equal(profile.nodeTypes.Goal.abstract,false);assert.equal(arch.getProfile('uaf').nodeTypes.Goal,undefined);
  const body=cases.C2.replace('EnterpriseGoal goal "Save lives"','Goal goal "Increase Coverage" {benefits ["Coverage"]}')+
    ' Goal response "Improve Response Times" Goal manpower "Reduce Manpower"'+
    ' relation responseGoal vision -> response "Specifies" {type SpecifiesGoal} relation manpowerGoal vision -> manpower "Specifies" {type SpecifiesGoal}';
  const source=document('C2',body);assert.equal(arch.validate(source).valid,true,errors(source));
  const svg=arch.renderToString(source);for(const title of ['Increase Coverage','Improve Response Times','Reduce Manpower'])assert.ok(svg.includes(title));
  assert.match(errors(document('C2',body.replace('relation manpowerGoal vision -> manpower "Specifies" {type SpecifiesGoal}',''))),/manpower requires.*SpecifiesGoal/);
  assert.match(errors(document('C2',body.replace('vision -> response','response -> vision'))),/not allowed for SpecifiesGoal/);
  assert.match(errors(document('C2',body.replace('["Coverage"]','[1]'))),/expected string/);
  assert.match(arch.help('types naf41-uaf Goal'),/EnterpriseGoal/);assert.match(arch.help('connections naf41-uaf Goal'),/SpecifiesGoal/);
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'same'}),arch.renderToString(source,{idPrefix:'same'}));
});

test('the user C1 taxonomy accepts out-of-view Goals and generated profile scripts work with both library bundles',async()=>{
  const source=await readFile('tests/fixtures/naf41/goal-taxonomy.arch','utf8');
  assert.equal(arch.validate(source).valid,true,errors(source));
  assert.equal(arch.validate(source,{validation:'strict'}).valid,true);
  const model=arch.parse(source),graph=arch.layout(model);assert.equal(model.nodes.filter(n=>n.type==='Goal').length,3);assert.equal(graph.nodes.length,6);assert.equal(graph.edges.length,5);
  const expected=arch.renderToString(source,{idPrefix:'same'});
  for(const bundle of ['arch.js','arch.min.js'])for(const scripts of [['profiles/uaf.js','profiles/naf41-uaf.js'],['profiles/profiles.js']]) {
    const context=vm.createContext({});vm.runInContext(await readFile(bundle,'utf8'),context);
    for(const script of scripts)vm.runInContext(await readFile(script,'utf8'),context);
    assert.equal(context.arch.renderToString(source,{idPrefix:'same'}),expected);
  }
});

test('C2 cut-out supports all three desires targets, and the page 91 phase-to-vision tree needs no direct capability link',async()=>{
  const source=await readFile('examples/naf41-enterprise-vision.arch','utf8');
  assert.equal(arch.validate(source).valid,true,errors(source));
  assert.ok(!source.includes('type DesiresCapability'));
  const graph=arch.layout(source,{view:'tree'}),byId=new Map(graph.nodes.map(n=>[n.id,n]));
  assert.deepEqual(graph.tree.roots,['horizon']);assert.equal(graph.nodes.length,6);assert.equal(graph.edges.length,5);
  assert.equal(byId.get('vision').treeParent,'horizon');assert.equal(byId.get('coverage').treeParent,'vision');
  assert.equal(byId.get('maritime').treeParent,'vision');assert.equal(byId.get('response').treeDepth,2);
  assert.match(errors(source.replace('type DesiresVision','type CapabilityGeneralization')),/source of type EnterprisePhase is not allowed/);
  // Validate legacy direct-capability semantics independently of tree-only options.
  assert.equal(arch.validate(document('C2',cases.C2)).valid,true);
  const goalBody=cases.C2.replace('phase -> cap "DesiresCapability" { type DesiresCapability }','phase -> goal "DesiresGoal" { type DesiresGoal }');
  assert.equal(arch.validate(document('C2',goalBody)).valid,true,errors(document('C2',goalBody)));
  assert.match(errors(source.replace('relation desires horizon -> vision "desires" { type DesiresVision }','').replace('route desires { from top to bottom }','')),/horizon requires.*DesiresCapability, DesiresVision, DesiresGoal/);
  assert.match(errors(source.replace('horizon -> vision','vision -> horizon')),/not allowed for DesiresVision/);
  assert.match(errors(source.replace('horizon -> vision','horizon -> coverage')),/not allowed for DesiresVision/);
  assert.match(arch.help('connections naf41-uaf EnterprisePhase'),/DesiresVision/);
  assert.match(arch.help('connections naf41-uaf Goal'),/DesiresGoal/);
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'same'}),arch.renderToString(source,{idPrefix:'same'}));
});

test('required allocations and roadmaps cannot pass with disconnected look-alike content', () => {
  for (const [id, link] of [['C2','goalLink'],['C3','depends'],['C4','supports'],['C5','desires'],['C8','constraintLink'],['Cr','delivers'],['S2','depends'],['S3','specifies'],['S4','performs'],['S8','groups'],['Sr','fulfils'],['L1','groupsActivity'],['L4','allocation2'],['L8','constrains'],['Lr','defines'],['P2','groupsActive'],['P3','implements2'],['P4','uses'],['L4-P4','implements'],['P8','relates'],['Pr','delivers'],['A2','frames'],['A3','governs'],['A4','extends'],['A5','statusLink'],['A6','succession'],['Ar','defines']])
    assert.equal(arch.validate(without(id,link)).valid, false, `${id}/${link}`);
});

test('needlines and designated structural references must have correctly typed visible targets', () => {
  assert.match(errors(document('L2', cases.L2.replace('source centre','source missing'))), /unknown reference missing/);
  assert.match(errors(document('L2', cases.L2.replace('OperationalArchitecture centre','ServiceSpecification centre'))), /Reference type ServiceSpecification/);
  assert.match(errors(document('L2',cases.L2,'include centre, need')), /need.target references team.*must be visible/);
  assert.match(errors(document('L3',cases.L3,'include performer, centre')), /conveyed references information.*must be visible/);
  assert.match(errors(document('S7',cases.S7,'include parameter, fn')), /resource references report.*must be visible/);
  assert.match(errors(document('S7','ServiceParameter parameter "Untyped"')), /ServiceInterfaceParameter/);
  assert.match(errors(document('S7',cases.S7.replace('owner fn', 'owner report'))), /Reference type PhysicalMaterial/);
});

test('state, sequence and foundation adapters retain typed ownership, values and acyclic versions', () => {
  for (const id of ['S5','L5','P5']) assert.equal(arch.validate(without(id,'transition')).valid, false, id);
  for (const id of ['S6','L6','P6']) assert.match(errors(document(id,cases[id].replace('order 1','order 0'))), /order/);
  assert.match(errors(document('S5',cases.S5.replace('owner service','owner active'))), /Reference type ServiceState/);
  assert.match(errors(document('A6',cases.A6 + ' relation back next -> first "Cycle" { type ArchitectureVersionSuccession }')), /Cycles/);
  assert.match(errors(document('Cr',cases.Cr.replace('2027-01-01','2027-02-30'))), /date/);
  assert.match(errors(document('A1','GlossaryTerm term "SAR"')), /Missing required attribute definition/);
  assert.match(errors(document('A7','Measure m "Response time"')), /Missing required attribute unit/);
});

test('new profile remains separate, has helpful abstract-type candidates and rejects unknown viewpoints', () => {
  assert.equal(arch.getProfile('uaf').nodeTypes.Measure, undefined);
  assert.match(errors(document('L1',cases.L1.replace('OperationalPerformer performer','OperationalAgent performer'))), /Abstract node type.*OperationalAgent/);
  assert.match(arch.help('types naf41-uaf OperationalAgent'), /OperationalArchitecture|OperationalPerformer/);
  assert.match(arch.help('connections naf41-uaf OperationalPerformer'), /LogicalInteraction|FulfilsLogicalReadiness/);
  assert.match(errors(document('C1').replace('viewpoint C1','viewpoint C6')), /Unknown viewpoint/);
});

test('the editable NAFv4.1 example validates as one model across its nine views', async () => {
  const source = await readFile('examples/naf41.arch', 'utf8');
  assert.equal(arch.validate(source).valid, true, errors(source));
  const model = arch.parse(source);
  assert.equal(model.views.length, 9);
  for (const view of model.views) assert.match(arch.renderToString(model, { view: view.id }), /<svg/);
  for (const bundle of ['arch.js','arch.min.js']) for (const scripts of [['profiles/uaf.js','profiles/naf41-uaf.js'],['profiles/profiles.js']]) {
    const context = vm.createContext({});
    vm.runInContext(await readFile(bundle,'utf8'),context);
    for (const script of scripts) vm.runInContext(await readFile(script,'utf8'),context);
    assert.equal(context.arch.validate(source).valid,true,`${bundle}/${scripts.join(',')}`);
    const svg = context.arch.renderToString(source,{view:'structure'});
    assert.ok(svg.includes('source: commandNode'));
    assert.ok(svg.includes('target: rescueNode'));
  }
});
