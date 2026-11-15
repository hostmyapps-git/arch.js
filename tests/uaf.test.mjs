import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';
import { matches } from '../src/profiles.js';
import { orderProfiles } from '../scripts/profile-order.mjs';

const uaf = JSON.parse(await readFile('profiles/uaf.json', 'utf8'));
const naf = JSON.parse(await readFile('profiles/naf4-uaf.json', 'utf8'));
const coverage = JSON.parse(await readFile('profiles/uaf/coverage.json', 'utf8'));
arch.registerProfile(uaf.id, uaf); arch.registerProfile(naf.id, naf);
const source = (model, viewpoint, extra = '') => `architecture "UAF test" { config { profile ${viewpoint ? 'naf4-uaf' : 'uaf'} } model { ${model} } ${viewpoint ? `view v "V" { viewpoint ${viewpoint} ${extra} }` : ''} }`;
const report = (model, viewpoint, extra) => arch.validate(source(model, viewpoint, extra));
const errors = (model, viewpoint, extra) => report(model, viewpoint, extra).diagnostics.map(d => d.message).join('\n');
const software = 'Software sw "Software" { isStandardConfiguration false }';

test('UAF catalog reproduces all 211 native stereotypes, abstract flags and native multiple inheritance', async () => {
  const xml = new DOMParser().parseFromString(await readFile('ReferenceDocs/uaf/UAFP-1.0.xmi', 'utf8'), 'application/xml');
  const xmi = 'http://www.omg.org/spec/XMI/20131001', elements = [...xml.getElementsByTagName('*')];
  const byId = new Map(elements.map(e => [e.getAttributeNS(xmi, 'id'), e]));
  const native = elements.filter(e => e.getAttributeNS(xmi, 'type') === 'uml:Stereotype');
  assert.equal(native.length, 211);
  assert.deepEqual(Object.keys(uaf.nodeTypes).filter(n => !coverage.adapterTypes.includes(n)).sort(), native.map(e => e.getAttribute('name')).sort());
  for (const element of native) {
    const rule = uaf.nodeTypes[element.getAttribute('name')];
    assert.equal(rule.abstract, element.getAttribute('isAbstract') === 'true');
    const parents = [...element.childNodes].filter(n => n.nodeType === 1 && n.tagName === 'generalization').map(g => byId.get(g.getAttribute('general')))
      .filter(e => e?.getAttributeNS(xmi, 'type') === 'uml:Stereotype').map(e => e.getAttribute('name'));
    assert.deepEqual(typeof rule.extends === 'string' ? [rule.extends] : rule.extends ?? [], parents);
  }
  const expanded = arch.getProfile('uaf');
  for (const base of ['OperationalAgent','ResourcePerformer','CapableElement','Asset','UAFElement'])
    assert.equal(matches('KnownResource', [base], expanded.nodeTypes), true, base);
  for (const base of ['OperationalActivity','Function']) assert.equal(matches('SecurityProcess', [base], expanded.nodeTypes), true);
  assert.equal(Object.keys(expanded.nodeTypes).length, 213);
});

test('all reference sources are pinned and coverage distinguishes enforced rules from deferred constraints', async () => {
  for (const item of coverage.sources.sources) assert.equal(createHash('sha256').update(await readFile(item.file)).digest('hex'), item.sha256);
  assert.equal(coverage.relationTypes, 43); assert.equal(coverage.viewpoints.length, 20);
  assert.ok(coverage.unimplementedNativeConstraints.length > 0);
  assert.deepEqual(coverage.deferredEndpointMappings.map(e => e.name).sort(), ['ProtectsInContext','SameAs']);
  assert.ok(coverage.relations.find(r => r.name === 'Implements').sourceIds.length > 0);
  assert.ok(coverage.normalizations.some(n => n.originalName === 'URI ' && n.name === 'URI'));
});

test('IsCapableToPerform checks the conditional source-target pairs and rejects Cartesian-product mistakes', () => {
  const declarations = `OperationalPerformer op "Operational" OperationalActivity activity "Activity"
    ServiceSpecification service "Service" ServiceFunction serviceFunction "Service function"
    ${software} Function fn "Function" Project project "Project" { isStandardConfiguration false }
    ProjectActivity task "Project activity"`;
  for (const [a,b] of [['op','activity'],['service','serviceFunction'],['sw','fn'],['project','task']])
    assert.equal(report(`${declarations} relation e ${a} -> ${b} "" { type IsCapableToPerform }`).valid, true, `${a}->${b}`);
  for (const [a,b] of [['op','fn'],['service','activity'],['sw','serviceFunction'],['sw','task'],['fn','op']])
    assert.match(errors(`${declarations} relation e ${a} -> ${b} "" { type IsCapableToPerform }`), /Typkombination/);
});

test('Implements is directed from physical implementation to specification with domain-specific endpoint pairs', () => {
  const declarations = `${software} OperationalPerformer op "Op" OperationalActivity activity "Activity" Function fn "Function"
    ServiceFunction sf "Service function" ServiceSpecification service "Service"
    DataElement data "Data" InformationElement info "Information"`;
  for (const [a,b] of [['sw','op'],['fn','activity'],['fn','sf'],['data','info']])
    assert.equal(report(`${declarations} relation r ${a} -> ${b} "" { type Implements }`).valid, true);
  for (const [a,b] of [['op','sw'],['fn','service'],['data','activity']])
    assert.match(errors(`${declarations} relation r ${a} -> ${b} "" { type Implements }`), /Typkombination/);
});

test('capability/service traceability and service consumption enforce actual UAF directions', () => {
  const declarations = 'Capability cap "Capability" ServiceSpecification svc "Service" OperationalActivity task "Task"';
  assert.equal(report(`${declarations} relation e svc -> cap "" { type Exhibits }`).valid, true);
  assert.match(errors(`${declarations} relation e cap -> svc "" { type Exhibits }`), /source vom Typ Capability/);
  assert.equal(report(`${declarations} relation e task -> svc "" { type Consumes }`).valid, true);
  assert.match(errors(`${declarations} relation e svc -> task "" { type Consumes }`), /source vom Typ ServiceSpecification/);
  assert.match(errors('OperationalAgent abstract "Must fail"'), /Abstrakter Knotentyp/);
});

test('taxonomy generalizations draw solid triangles and reject self loops, cycles and wrong domains', () => {
  const nodes = 'Capability a "A" Capability b "B"';
  const edge = 'relation r a -> b "" { type CapabilityGeneralization }';
  assert.equal(report(nodes + edge, 'C1').valid, true);
  const svg = arch.renderToString(source(nodes + edge, 'C1'));
  const path = svg.match(/class="arch-edge"[\s\S]*?<\/g>/)[0];
  assert.match(path, /triangle/); assert.ok(!path.includes('stroke-dasharray'));
  assert.match(errors(nodes + edge + ' relation back b -> a "" { type CapabilityGeneralization }'), /Zyklus/);
  assert.match(errors(nodes + ' relation self a -> a "" { type CapabilityGeneralization }'), /Selbstbeziehung/);
  assert.match(errors(nodes + ' ServiceSpecification svc "S" relation bad svc -> a "" { type CapabilityGeneralization }'), /source vom Typ ServiceSpecification/);
});

test('exchange payload references are required, typed, unique and checked independently of visual inclusion', () => {
  const nodes = 'OperationalPerformer a "A" OperationalPerformer b "B" InformationElement info "Report"';
  const edge = 'relation e a -> b "Report" { type OperationalExchange conveyed [info] trustlevel 0.8 }';
  assert.equal(report(nodes + edge, 'L3').valid, true);
  assert.match(errors(nodes + edge.replace('conveyed [info]', '')), /Pflichtattribut conveyed/);
  assert.match(errors(nodes + edge.replace('[info]', '[missing]')), /unbekannte Referenz missing/);
  assert.match(errors(nodes + edge.replace('[info]', '[a]')), /Referenztyp OperationalPerformer/);
  assert.match(errors(nodes + edge.replace('[info]', '[info, info]')), /doppelte/);
  assert.match(errors(nodes + edge.replace('[info]', '[]')), /Listenlänge/);
  assert.equal(report(nodes + edge, 'L3', 'include a, b').valid, true);
});

test('UML action/port adapters validate behavior and interface types and preserve the catalog separation', () => {
  const body = 'OperationalActivity activity "Activity" ServiceFunction sf "Wrong domain" OperationalActivityAction action "Action" { behavior activity }';
  assert.equal(report(body).valid, true);
  assert.match(errors(body.replace('behavior activity', 'behavior sf')), /Referenztyp ServiceFunction/);
  assert.match(errors(body.replace('behavior activity', '')), /Pflichtattribut behavior/);
  assert.equal(report('ServiceSpecification svc "S" ServiceInterface api "API" ServicePort p "P" { owner svc interfaceType api }').valid, true);
  assert.match(errors('OperationalPerformer op "Op" ServiceInterface api "API" OperationalPort p "P" { interfaceType api }'), /Referenztyp ServiceInterface/);
});

test('NAF views enforce mandatory membership, no undeclared viewpoint bypass, and per-element allocations', () => {
  assert.equal(report('Capability c "C"', 'C1').valid, true);
  assert.match(errors('ServiceSpecification s "S"', 'C1'), /Knotentyp ServiceSpecification/);
  assert.match(errors('Capability c "C"', 'notImplemented'), /Unbekannter Viewpoint/);
  assert.equal(arch.validate('architecture "No view" {config {profile naf4-uaf} model {Capability c "C"}}').valid, false);
  const allocations = 'OperationalPerformer op "Op" OperationalActivity a "A" OperationalActivity b "B" relation r op -> a "" {type IsCapableToPerform}';
  assert.match(errors(allocations, 'L4'), /b benötigt/);
  assert.equal(report(allocations + ' relation r2 op -> b "" {type IsCapableToPerform}', 'L4').valid, true);
  assert.equal(report(allocations, 'L4', 'include op, a').valid, true);
});

test('all 20 supported NAF viewpoints have independent positive architecture fixtures', () => {
  const fixtures = {
    C1: 'Capability c "C"', C2: 'EnterpriseVision v "Vision" Capability c "C"',
    C3: 'Capability c "C"', C4: 'StandardOperationalActivity p "Standard process"',
    C7: 'Capability c "C" Measurement m "Measure"', C8: 'Capability c "C" Requirement r "Requirement" relation x c -> r "" {type Refine}',
    S1: 'ServiceSpecification s "S"', S3: 'ServiceSpecification s "S" ServiceInterface i "I"',
    S4: 'ServiceSpecification s "S" ServiceFunction f "F" relation x s -> f "" {type IsCapableToPerform}',
    'C1-S1': 'ServiceSpecification s "S" Capability c "C" relation x s -> c "" {type Exhibits}',
    L1: 'OperationalPerformer p "P"', 'L2-L3': 'Capability c "C"',
    L3: 'OperationalPerformer a "A" OperationalPerformer b "B" InformationElement i "I" relation x a -> b "" {type OperationalExchange conveyed [i]}',
    L4: 'OperationalPerformer p "P" OperationalActivity a "A" relation x p -> a "" {type IsCapableToPerform}',
    P1: software, P2: software,
    P3: `${software} ResourceArtifact b "B" {isStandardConfiguration false} DataElement d "D" relation x sw -> b "" {type ResourceExchange conveyed [d]}`,
    P4: `${software} Function f "F" relation x sw -> f "" {type IsCapableToPerform}`,
    'L4-P4': 'Function f "F" OperationalActivity a "A" relation x f -> a "" {type Implements}',
    A8: 'Standard s "S"'
  };
  assert.deepEqual(Object.keys(fixtures).sort(), Object.keys(naf.viewpoints).sort());
  for (const [id, body] of Object.entries(fixtures)) {
    assert.equal(report(body, id).valid, true, `${id}: ${errors(body, id)}`);
    assert.match(arch.renderToString(source(body, id)), /<svg/);
  }
});

test('native enum, required boolean, URI and temporal attributes are validated and invalid dates cannot crash reports', () => {
  assert.match(errors('Software s "S"'), /isStandardConfiguration/);
  assert.equal(report('DataModel d "D" {kind Logical}').valid, true);
  assert.match(errors('DataModel d "D" {kind logical}'), /Wert muss aus/);
  assert.match(errors('Capability c "C" { URI "not-a-uri" }'), /ungültiges Format uri/);
  const period = 'ActualProject p "P" {projectKind Project startDate "2026-01-01T00:00:00Z" endDate "2027-01-01T00:00:00Z"}';
  assert.equal(report(period).valid, true);
  assert.match(errors(period.replace('2027-01-01', '2025-01-01')), /startDate <= endDate/);
  assert.match(errors(period.replace('2026-01-01', '2026-02-30')), /ungültiges Format/);
  assert.doesNotThrow(() => report('ActualProject p "P" {projectKind Project startDate 1 endDate 2}'));
  assert.equal(report('ActualProject p "P" {projectKind Project startDate 1 endDate 2}').valid, false);
});

test('generic profile dependency ordering registers bases before derived profiles and rejects ambiguous graphs', () => {
  assert.deepEqual(orderProfiles([naf,uaf]).map(p => p.id), ['uaf','naf4-uaf']);
  assert.throws(() => orderProfiles([{id:'x',extends:'missing'}]), /Missing or cyclic/);
  assert.throws(() => orderProfiles([{id:'x',extends:'y'},{id:'y',extends:'x'}]), /cyclic/);
  assert.throws(() => orderProfiles([{id:'x'},{id:'x'}]), /Duplicate/);
});

test('the UAF example validates and exports all nine named views with a reproducible profile snapshot', async () => {
  const model = arch.parse(await readFile('examples/uaf.arch', 'utf8'));
  assert.equal(model.profile.id, 'naf4-uaf'); assert.equal(model.views.length, 9);
  for (const view of model.views) assert.match(arch.renderToString(model, {view:view.id}), /data-type="(?:Capability|OperationalPerformer|ServiceSpecification|Function|Software)"/);
  assert.equal(arch.validate(JSON.parse(JSON.stringify(model))).valid, true);
});
