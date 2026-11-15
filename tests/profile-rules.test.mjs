import test from 'node:test';
import assert from 'node:assert/strict';
import * as arch from '../src/arch.js';
const source = body => `architecture "Rules" { model { ${body} } }`;

test('multiple inheritance is generic, diamond-safe, supports both config and JSON, and detects ambiguous fields', () => {
  const schema = { nodeTypes: {
    base: { abstract: true, attributes: { code: { required: true } } },
    left: { extends: 'base', attributes: { x: { type: 'number' } } },
    right: { extends: 'base', attributes: { y: { type: 'boolean' } } },
    combined: { extends: ['left','right'] }
  }, relationTypes: { edge: { from:['base'], to:['base'] } } };
  assert.equal(arch.validate(source('combined c "C" {code "C" x 1 y true}'), {profile:schema}).valid, true);
  assert.equal(arch.validate(source('combined c "C"'), {profile:schema}).diagnostics.length, 1);
  schema.nodeTypes.right.attributes.code = { type:'number' };
  assert.throws(() => arch.registerProfile('ambiguous', schema), /mehrdeutige/);
  schema.nodeTypes.combined.attributes = {code:{type:'integer'}};
  assert.doesNotThrow(() => arch.registerProfile('resolved', schema));
  const inline = 'architecture "Inline" { config {type a {} type b {} type c {extends a, b}} model {c n "N"}}';
  assert.equal(arch.validate(inline).valid, true);
});

test('generic lists and references enforce targets, cardinality, uniqueness, source errors and schema errors', () => {
  const schema = { nodeTypes: {
    entry: {}, other: {}, group: {attributes: {
      members: {type:'reference', targets:['entry'], many:true, minItems:1, maxItems:2, uniqueItems:true, required:true},
      ratings: {type:'integer', many:true, min:0, max:5}
    }}
  }};
  const valid = 'entry a "A" entry b "B" group g "G" {members [a,b] ratings [1,5]}';
  assert.equal(arch.validate(source(valid), {profile:schema}).valid, true);
  for (const bad of [valid.replace('[a,b]','[a,a]'),valid.replace('[a,b]','[]'),valid.replace('[a,b]','[a,missing]'),
    valid.replace('entry b','other b'),valid.replace('[1,5]','[1,6]'),valid.replace('[1,5]','[1,"2"]')])
    assert.equal(arch.validate(source(bad), {profile:schema}).valid, false);
  assert.throws(() => arch.parse(source('group g "G" {members [[a]]}'), {profile:schema}), /Verschachtelte/);
  assert.throws(() => arch.registerProfile('bad-target', {nodeTypes:{x:{attributes:{r:{type:'reference',targets:['absent']}}}}}), /unbekannter Knotentyp/);
  assert.throws(() => arch.registerProfile('bad-list', {nodeTypes:{x:{attributes:{r:{type:'string',uniqueItems:true}}}}}), /many/);
});

test('generic dates and comparisons check real calendars and timezone order, never coerce invalid values', () => {
  const schema = {nodeTypes:{period:{attributes:{start:{type:'string',format:'date-time'},end:{type:'string',format:'date-time'},day:{format:'date'}},comparisons:[{left:'start',op:'<=',right:'end'}]}}};
  assert.equal(arch.validate(source('period p "P" {start "2026-01-01T00:00:00+02:00" end "2025-12-31T23:00:00Z" day "2024-02-29"}'),{profile:schema}).valid,true);
  for(const fields of ['day "2025-02-29"','day "2026-04-31"','start "2026-01-01T25:00:00Z"','start 1 end 2',
    'start "2027-01-01T00:00:00Z" end "2026-01-01T00:00:00Z"'])
    assert.equal(arch.validate(source(`period p "P" {${fields}}`),{profile:schema}).valid,false);
  assert.throws(()=>arch.registerProfile('bad-comparison',{nodeTypes:{p:{comparisons:[{left:'a',op:'<=',right:'b'}]}}}),/kompatible/);
});

test('paired endpoints and view-local connection checks remain independent of any named framework', () => {
  const schema = {nodeTypes:{producer:{},consumer:{},admin:{extends:'producer'}},relationTypes:{connects:{pairs:[{from:['producer'],fromExclude:['admin'],to:['consumer']}]}}
    ,viewpoints:{context:{connections:[{nodes:['consumer'],relations:['connects'],direction:'incoming',min:1}]}}};
  const valid='producer p "P" consumer c "C" relation r p -> c "" {type connects}';
  assert.equal(arch.validate(source(valid),{profile:schema}).valid,true);
  assert.equal(arch.validate(source(valid.replace('producer p','admin p')),{profile:schema}).valid,false);
  const scoped=`architecture "V" {model {${valid} consumer orphan "Orphan"} view v "V" {viewpoint context}}`;
  assert.equal(arch.validate(scoped,{profile:schema}).valid,false);
  assert.equal(arch.validate(scoped.replace('viewpoint context','viewpoint context include p,c'),{profile:schema}).valid,true);
  assert.throws(()=>arch.registerProfile('bad-pair',{nodeTypes:{x:{}},relationTypes:{r:{pairs:[{from:['missing'],to:['x']}]}}}),/unbekannter Knotentyp/);
});
