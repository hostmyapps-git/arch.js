import test from 'node:test';
import assert from 'node:assert/strict';
import * as arch from '../src/arch.js';
const body='package p "P" {service a "A" package q "Q" {service b "B"} service c "C"} service other "Other" relation r a -> c "Uses"';
const source=(rules,model=body)=>`architecture "Filters" {model {${model}} view v "V" {${rules}}}`;
const ids=rules=>arch.layout(arch.parse(source(rules))).nodes.map(n=>n.id);

test('exclude wins over include regardless of directive order and removes incident relationships',()=>{
  assert.deepEqual(ids('exclude other'),['p','a','q','b','c']);
  for(const rules of ['include a, other exclude a','exclude a include a, other']) assert.deepEqual(ids(rules),['other']);
  const model=arch.parse(source('include p exclude c'));
  assert.equal(arch.layout(model).edges.length,0);
  assert.ok(!arch.renderToString(model).includes('data-node="c"'));
  assert.equal(model.nodes.length,6);
  assert.equal(arch.layout(arch.parse(source(''))).edges.length,1);
});

test('container exclusions remove subtrees without resurrecting included descendants or unused ancestors',()=>{
  assert.deepEqual(ids('include b exclude p'),[]);
  assert.deepEqual(ids('include b exclude b'),[]);
  assert.deepEqual(ids('include p exclude q'),['p','a','c']);
  assert.deepEqual(ids('include p exclude a, q, c'),['p']);
  assert.deepEqual(ids('include b, c exclude b'),['p','c']);
  assert.equal(arch.validate(source('exclude missing')).valid,false);
  assert.equal(arch.validate(source('exclude a exclude b')).valid,false);
  const model=arch.parse(source('exclude a'));
  assert.equal(arch.validate(JSON.parse(JSON.stringify(model))).valid,true);
  model.views[0].exclude='a';assert.equal(arch.validate(model).valid,false);
});

test('exclude is shared by specialized renderers and viewpoint rules, but does not suppress model validation',()=>{
  const profile={nodeTypes:{service:{}},relationTypes:{flow:{}},viewpoints:{required:{requiredNodes:['service']}}};
  const node='service a "A"';
  assert.equal(arch.validate(source('exclude a viewpoint required',node),{profile}).valid,false);
  assert.equal(arch.validate(source('exclude a', 'service a "A" {unknown "bad"}')).valid,false);
  assert.match(arch.renderToString(source('exclude other diagram matrix', 'service a "A" service other "Other"')), /data-cell="a:a"/);
  assert.equal(arch.validate(source('exclude other diagram sequence {participants [a, other]}','service a "A" service other "Other"')).valid,false);
  const model=arch.parse(source('include a, other exclude a','service a "A" service other "Other"'));
  const copy=JSON.stringify(model);arch.renderToString(model);assert.equal(JSON.stringify(model),copy);
});
