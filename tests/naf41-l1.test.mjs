import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.studio.js';

for (const id of ['uaf','naf41-uaf']) arch.registerProfile(id, JSON.parse(await readFile(`profiles/${id}.json`, 'utf8')));
const example = await readFile('examples/naf41-logical-taxonomy.arch', 'utf8');
const doc = (model, view='') => `architecture "L1" {config {profile naf41-uaf} model {${model}} view l1 "L1" {viewpoint L1 ${view}}}`;
const errors = source => arch.validate(source).diagnostics.map(d => d.message).join('\n');

test('L1 p.127 example accepts every displayed stereotype and relationship without invented activities', async () => {
  for (const validation of ['strict','draft']) assert.deepEqual(arch.validate(example,{validation}).diagnostics,[]);
  const g = arch.layout(example);
  assert.equal(g.nodes.length,12);
  assert.equal(g.edges.length,11);
  assert.deepEqual(g.nodes.filter(n => n.type === 'LogicalEquipment').map(n => n.id), ['communicationDevice','onshoreRescueVessel','surveillanceSystem']);
  assert.equal(g.nodes.find(n => n.id === 'crew').type,'LogicalActor');
  assert.equal(g.nodes.some(n => n.type === 'OperationalActivity'),false);
  assert.deepEqual(g.edges.filter(e => e.type === 'OperationalGeneralization').map(e => [e.source,e.target]), [['waterborneRescue','rescue'],['airborneRescue','rescue'],['spaceRescue','rescue']]);
  assert.equal(g.edges.find(e => e.id === 'aggregatesRescue').target,'rescue');
  const svg = arch.renderToString(example,{idPrefix:'l1'});
  assert.equal(arch.renderToString(arch.translate(example),{idPrefix:'l1'}),svg);
  for (const file of ['arch.core.min.js', 'arch.min.js']) {
    const context=vm.createContext({});
    vm.runInContext(await readFile(file,'utf8'),context);
    vm.runInContext(await readFile('profiles/profiles.js','utf8'),context);
    assert.equal(context.arch.renderToString(example,{idPrefix:'l1'}),svg);
  }
});

test('logical actor and equipment remain distinct concrete types with inherited relationship compatibility and help', () => {
  const profile=arch.getProfile('naf41-uaf');
  for(const type of ['LogicalActor','LogicalEquipment']) {
    const rule=profile.nodeTypes[type];
    assert.equal(rule.abstract,false);
    assert.equal(rule.aliasOf,undefined);
    assert.match(arch.help(`types naf41-uaf ${type}`),/OperationalPerformer/);
    assert.match(arch.help(`connections naf41-uaf ${type}`),/GroupsLogicalResource/);
    assert.equal(arch.getProfile('uaf').nodeTypes[type],undefined,'base UAF profile remains unchanged');
  }
  const trace='architecture "Trace" {config {profile naf41-uaf} model {LogicalActor crew "Crew" LogicalEquipment radio "Radio" InformationProduct report "Report" relation flow crew -> radio "reports" {type LogicalInteraction conveyed [report]}} view l3 "L3" {viewpoint L3}}';
  assert.deepEqual(arch.validate(trace).diagnostics,[]);
});

test('L1 permits a singleton or a node taxonomy without obligating every node to contain resources or behavior', () => {
  assert.deepEqual(arch.validate(doc('Node root "Root"')).diagnostics,[]);
  const source=doc('Node root "Root" Node child "Child" relation kind child -> root "is a kind of" {type OperationalGeneralization}','diagram tree');
  assert.deepEqual(arch.validate(source).diagnostics,[]);
  assert.match(arch.renderToString(source),/Child/);
  assert.equal(arch.validate(doc('')).valid,false,'a logical node is still required');
  assert.equal(arch.validate(doc('Capability cap "SAR"')).valid,false);
  assert.deepEqual(arch.validate(doc('OperationalArchitecture n "Legacy node" OperationalPerformer p "Legacy resource" OperationalActivity a "Activity" relation groupP n -> p "groups" {type GroupsLogicalResource} relation groupA n -> a "groups" {type GroupsLogicalResource}')).diagnostics,[]);
});

test('L1 still requires grouping for each selected resource or activity, including optional passive resources', () => {
  for(const type of ['LogicalActor','LogicalEquipment','OperationalPerformer','OperationalActivity','InformationProduct']) {
    const model=`Node n "Node" ${type} resource "Resource" relation groups n -> resource "aggregates" {type GroupsLogicalResource}`;
    assert.deepEqual(arch.validate(doc(model)).diagnostics,[],type);
    assert.match(errors(doc(model.replace(/ relation groups.*$/,''))),/resource requires.*incoming connections.*GroupsLogicalResource/,type);
    assert.match(errors(doc(model,'include resource')),/Missing required node type OperationalArchitecture/);
  }
  const wrong=doc('Node n "Node" LogicalActor crew "Crew" relation groups crew -> n "aggregates" {type GroupsLogicalResource}');
  assert.match(errors(wrong),/not allowed for GroupsLogicalResource/);
});

test('L1 active-resource specializations can inherit grouping from a selected general resource', () => {
  const model='Node n "Node" LogicalEquipment general "Equipment" LogicalEquipment specialized "Radio" relation groups n -> general "aggregates" {type GroupsLogicalResource} relation kind specialized -> general "is a kind of" {type OperationalGeneralization}';
  assert.deepEqual(arch.validate(doc(model)).diagnostics,[]);
  assert.match(errors(doc(model.replace(/ relation kind.*$/,''))),/specialized requires.*through outgoing OperationalGeneralization/);
  assert.match(errors(doc(model.replace('specialized -> general','general -> specialized'))),/specialized requires/,'group membership does not propagate from a subtype to its general type');
  assert.equal(arch.validate(doc(model,'include n,specialized')).valid,false,'an unselected ancestor cannot satisfy visible grouping');
  const cycle=model+' relation cycle general -> specialized "is a kind of" {type OperationalGeneralization}';
  assert.equal(arch.validate(doc(cycle)).valid,false,'native specialization cycles remain invalid');
});
