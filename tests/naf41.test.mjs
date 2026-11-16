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
