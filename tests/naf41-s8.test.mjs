import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

for (const id of ['uaf','naf41-uaf']) arch.registerProfile(id, JSON.parse(await readFile(`profiles/${id}.json`, 'utf8')));
const source = `architecture "S8 example" {
  config {profile naf41-uaf}
  model {
    ServicePolicy policy "In Mission Operation" {ruleKind Guidance}
    Service service "Inshore Rescue Service"
    ServiceConstraint availability "Availability 24x7x52" {ruleKind Constraint}
    ServiceConstraint compliantWithMC326.3 "Compliant with MC 326/3" {ruleKind Constraint}
    relation satisfies service -> policy "satisfies" {type SatisfiesServicePolicy}
    relation groups1 policy -> availability "aggregates" {type GroupsServiceConstraint}
    relation groups2 policy -> compliantWithMC326.3 "aggregates" {type GroupsServiceConstraint}
  }
  view s8 "S8" {
    include policy,service,availability,compliantWithMC326.3
    viewpoint S8
  }
}`;

test('S8 pp.121–122 accepts service-to-policy satisfaction in the explicitly selected view', async () => {
  for (const validation of ['strict','draft']) assert.deepEqual(arch.validate(source, {validation}).diagnostics, []);
  const graph = arch.layout(source);
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.edges.length, 3);
  assert.equal(graph.edges.find(e => e.type === 'SatisfiesServicePolicy').source, 'service');
  const svg = arch.renderToString(source, {idPrefix:'s8'});
  assert.equal(arch.renderToString(arch.translate(source), {idPrefix:'s8'}), svg);
  for (const file of ['arch.js','arch.min.js']) {
    const context = vm.createContext({});
    vm.runInContext(await readFile(file, 'utf8'), context);
    vm.runInContext(await readFile('profiles/profiles.js', 'utf8'), context);
    assert.equal(context.arch.renderToString(source, {idPrefix:'s8'}), svg);
  }
});

test('S8 keeps satisfaction optional, preserves its inverse and still requires constraint grouping', () => {
  const withoutService = source.replace(/    Service service[^\n]+\n/, '').replace(/    relation satisfies[^\n]+\n/, '').replace('policy,service,availability', 'policy,availability');
  assert.deepEqual(arch.validate(withoutService).diagnostics, []);
  const inverse = source.replace('service -> policy', 'policy -> service').replace('type SatisfiesServicePolicy', 'type ServicePolicySatisfiedBy');
  assert.deepEqual(arch.validate(inverse).diagnostics, []);
  const reversed = arch.validate(source.replace('service -> policy', 'policy -> service'));
  assert.equal(reversed.valid, false);
  assert.match(reversed.diagnostics.map(d => d.message).join('\n'), /not allowed for SatisfiesServicePolicy/);
  const ungrouped = arch.validate(source.replace(/    relation groups2[^\n]+\n/, ''));
  assert.equal(ungrouped.valid, false);
  assert.match(ungrouped.diagnostics.map(d => d.message).join('\n'), /compliantWithMC326\.3 requires.*GroupsServiceConstraint/);
});
