import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as arch from '../src/arch.js';

const profile = {
  nodeTypes: {
    Base: { abstract: true }, Middle: { abstract: true, extends: 'Base' },
    Other: { abstract: true }, Direct: { extends: 'Base' },
    Diamond: { extends: ['Middle', 'Other'] }, Unrelated: {}, Empty: { abstract: true },
  },
  relationTypes: { AbstractLink: { abstract: true }, ConcreteLink: { extends: 'AbstractLink' } },
};
arch.registerProfile('candidate_demo', profile);
const document = body => `architecture "Candidates" { config { profile candidate_demo } model { ${body} } }`;

test('abstract node diagnostics list concrete descendants from generic multiple inheritance', () => {
  const report = arch.validate(document('Base item "Item"'));
  assert.equal(report.valid, false);
  const diagnostic = report.diagnostics[0];
  assert.equal(diagnostic.code, 'ARCH_SEMANTIC'); assert.equal(diagnostic.elementId, 'item');
  assert.deepEqual(diagnostic.candidates, ['Diamond', 'Direct']);
  assert.equal(diagnostic.help, '@help types candidate_demo Base');
  assert.match(diagnostic.message, /Concrete subtypes: Diamond, Direct/);
  for (const type of diagnostic.candidates) assert.equal(arch.validate(document(`${type} item "Item"`)).valid, true);
  assert.throws(() => arch.parse(document('Base item "Item"')), error => error.diagnostics[0].candidates.includes('Direct'));
  assert.match(arch.help('types candidate_demo Base'), /Concrete subtypes\nDiamond ID "Title"/);
  assert.match(arch.renderToString('@help types candidate_demo Base').replace(/<[^>]+>/g,''), /Direct ID &quot;Title&quot;/);
  const empty = arch.validate(document('Empty item "Item"')).diagnostics[0];
  assert.deepEqual(empty.candidates, []); assert.match(empty.message, /No concrete subtypes/);
  assert.match(arch.help('types candidate_demo Empty'), /No concrete subtypes/);
});

test('abstract relationship diagnostics and help use relationship inheritance independently', () => {
  const report = arch.validate(document('Direct a "A" Direct b "B" relation link a -> b "" { type AbstractLink }'));
  assert.deepEqual(report.diagnostics[0].candidates, ['ConcreteLink']);
  assert.equal(report.diagnostics[0].help, '@help relations candidate_demo AbstractLink');
  assert.match(arch.help('relations candidate_demo AbstractLink'), /type ConcreteLink/);
});

test('inline profiles use the current-profile help selector and preserve snapshots', () => {
  const source = 'architecture "Local" { config { type Base {abstract true} type Concrete {extends Base} } model {Base n "N"} }';
  const diagnostic = arch.validate(source).diagnostics[0];
  assert.equal(diagnostic.help, '@help types . Base');
  assert.deepEqual(diagnostic.candidates, ['Concrete']);
  const help = source.replace('model {Base n "N"}', diagnostic.help);
  assert.equal(arch.validate(help).valid, true);
  assert.match(arch.renderToString(help).replace(/<[^>]+>/g,''), /Concrete ID &quot;Title&quot;/);
  assert.match(arch.help('types . Base', {profile}), /Diamond/);
  const parsed = arch.parse('@help types candidate_demo Base');
  arch.registerProfile('candidate_demo', {nodeTypes:{Base:{abstract:true}, Replacement:{extends:'Base'}}});
  assert.match(arch.renderToString(parsed).replace(/<[^>]+>/g,''), /Replacement ID/);
  arch.registerProfile('candidate_demo', profile);
});

test('long candidate lists remain complete in diagnostics and help, with concise error messages', () => {
  const nodeTypes = { Base: { abstract: true }, ...Object.fromEntries(Array.from({length:20}, (_,i) => [`Concrete${i}`, {extends:'Base'}])) };
  const report = arch.validate('architecture "Many" {model { Base n "N" }}', { profile: {nodeTypes} });
  assert.equal(report.diagnostics[0].candidates.length, 20);
  assert.match(report.diagnostics[0].message, /\(\+8 more\)/);
  const text = arch.help('types . Base', { profile: {nodeTypes} });
  for (let i=0;i<20;i++) assert.ok(text.includes(`Concrete${i} ID`));
});

test('OperationalAgent user example gets the actual UAF alternatives and a working help command', async () => {
  arch.registerProfile('uaf', JSON.parse(await readFile('profiles/uaf.json','utf8')));
  const source = 'architecture "Fighter" { config {profile uaf} model { OperationalAgent r "fighter" } }';
  const diagnostic = arch.validate(source).diagnostics[0];
  assert.deepEqual(diagnostic.candidates, ['KnownResource','OperationalArchitecture','OperationalMitigation','OperationalPerformer']);
  assert.equal(diagnostic.help, '@help types uaf OperationalAgent');
  assert.match(arch.help('types uaf OperationalAgent'), /OperationalPerformer ID/);
  assert.equal(arch.validate(source.replace('OperationalAgent r','OperationalPerformer r')).valid,true);
});
