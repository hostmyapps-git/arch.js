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
  assert.throws(() => arch.registerProfile('ambiguous', schema), /ambiguous/);
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
  assert.throws(() => arch.parse(source('group g "G" {members [[a]]}'), {profile:schema}), /Nested/);
  assert.throws(() => arch.registerProfile('bad-target', {nodeTypes:{x:{attributes:{r:{type:'reference',targets:['absent']}}}}}), /unknown node type/);
  assert.throws(() => arch.registerProfile('bad-list', {nodeTypes:{x:{attributes:{r:{type:'string',uniqueItems:true}}}}}), /many/);
});

test('generic dates and comparisons check real calendars and timezone order, never coerce invalid values', () => {
  const schema = {nodeTypes:{period:{attributes:{start:{type:'string',format:'date-time'},end:{type:'string',format:'date-time'},day:{format:'date'}},comparisons:[{left:'start',op:'<=',right:'end'}]}}};
  assert.equal(arch.validate(source('period p "P" {start "2026-01-01T00:00:00+02:00" end "2025-12-31T23:00:00Z" day "2024-02-29"}'),{profile:schema}).valid,true);
  for(const fields of ['day "2025-02-29"','day "2026-04-31"','start "2026-01-01T25:00:00Z"','start 1 end 2',
    'start "2027-01-01T00:00:00Z" end "2026-01-01T00:00:00Z"'])
    assert.equal(arch.validate(source(`period p "P" {${fields}}`),{profile:schema}).valid,false);
  assert.throws(()=>arch.registerProfile('bad-comparison',{nodeTypes:{p:{comparisons:[{left:'a',op:'<=',right:'b'}]}}}),/compatible/);
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
  assert.throws(()=>arch.registerProfile('bad-pair',{nodeTypes:{x:{}},relationTypes:{r:{pairs:[{from:['missing'],to:['x']}]}}}),/unknown node type/);
});

test('view connection checks distinguish counterpart types instead of counting unrelated allocations', () => {
  const schema = { nodeTypes: { product: {}, team: {}, tool: {} }, relationTypes: { assigned: { from: ['product'], to: ['team','tool'] } },
    viewpoints: { allocation: { connections: [{ nodes: ['product'], relations: ['assigned'], counterparts: ['team'], min: 1 }] } } };
  const body = 'product p "P" team t "T" tool editor "Editor" relation r p -> editor "Uses" { type assigned }';
  const doc = body => `architecture "Allocation" { model { ${body} } view v "V" { viewpoint allocation } }`;
  const report = arch.validate(doc(body), { profile: schema });
  assert.equal(report.valid, false);
  assert.match(report.diagnostics[0].message, /assigned; counterpart: team.*found 0/);
  assert.equal(arch.validate(doc(body + ' relation a p -> t "Owned by" { type assigned }'), { profile: schema }).valid, true);
  assert.throws(() => arch.registerProfile('bad-counterpart', { ...schema, viewpoints: { v: { connections: [{ counterparts: ['missing'] }] } } }), /unknown node type/);
});

test('designated node and edge references must be visible without forcing unrelated references into a view', () => {
  const schema = { nodeTypes: { item: { attributes: { owner: { type: 'reference', targets: ['item'] }, background: { type: 'reference', targets: ['item'] } } } },
    relationTypes: { transfer: { attributes: { payload: { type: 'reference', targets: ['item'], many: true } } } },
    viewpoints: { detail: { references: [{ nodes: ['item'], attributes: ['owner'] }, { relations: ['transfer'], attributes: ['payload'] }] } } };
  const body = 'item a "A" { owner b background context } item b "B" item context "Elsewhere" relation r a -> a "Transfer" { type transfer payload [b] }';
  const doc = selection => `architecture "References" { model { ${body} } view v "V" { viewpoint detail include ${selection} } }`;
  const missing = arch.validate(doc('a'), { profile: schema });
  assert.equal(missing.valid, false);
  assert.deepEqual(missing.diagnostics.map(d => [d.elementId,d.attribute]).sort(), [['a','owner'],['r','payload']]);
  assert.equal(arch.validate(doc('a, b'), { profile: schema }).valid, true, 'unlisted background reference stays model-global');
  for (const references of [[{ nodes: ['item'], attributes: ['missing'] }], [{ nodes: ['item'], relations: ['transfer'], attributes: ['owner'] }], [{ nodes: ['*'], attributes: ['owner'] }]])
    assert.throws(() => arch.registerProfile('bad-reference-check', { ...schema, viewpoints: { v: { references } } }), /reference/);
});

test('profile documentation survives compilation and snapshots, is escaped in help and cannot inject executable rules', () => {
  const schema = { id: 'documented', title: 'Documented', description: '<script>alert(1)</script>', sources: ['local:source'], limitations: ['Structural checks only'],
    nodeTypes: { item: { title: 'Item', description: 'Business item', sources: ['source:1'] } },
    relationTypes: { link: { description: 'A link' } }, viewpoints: { overview: { title: 'Overview', description: 'One overview', sources: ['source:2'] } } };
  arch.registerProfile(schema.id, schema);
  const profile = arch.getProfile(schema.id);
  assert.equal(profile.nodeTypes.item.description, 'Business item');
  profile.sources.push('changed');
  assert.deepEqual(arch.getProfile(schema.id).sources, ['local:source']);
  assert.match(arch.help('viewpoints documented'), /Overview/);
  assert.match(arch.help('profiles documented'), /Structural checks only/);
  assert.ok(!arch.renderToString('@help profiles documented').includes('<script>'));
  assert.doesNotThrow(() => arch.registerProfile('documented-copy', { ...arch.getProfile(schema.id), id: 'documented-copy' }));
  assert.throws(() => arch.registerProfile('bad-docs', { ...schema, id: 'bad-docs', sources: [() => {}] }), /text list/);
});

test('connection rules accept visible reference evidence without double-counting the same linked counterpart',()=>{
  const schema={nodeTypes:{owner:{},tool:{},item:{attributes:{owners:{type:'reference',targets:['owner','tool'],many:true}}}},
    relationTypes:{owns:{from:['owner'],to:['item']}},viewpoints:{v:{connections:[{nodes:['item'],relations:['owns'],direction:'incoming',counterparts:['owner'],referenceAttributes:['owners'],min:1,max:1}]}}};
  const body='owner a "A" owner b "B" tool t "T" item i "Item"';
  const doc=(extra='',include='')=>`architecture "Evidence" {model{${body}${extra}} view v "V"{viewpoint v ${include}}}`;
  const withRefs=(refs,extra='',include='')=>doc(extra,include).replace('item i "Item"',`item i "Item" {owners [${refs}]}`);
  assert.equal(arch.validate(withRefs('a'),{profile:schema}).valid,true);
  assert.equal(arch.validate(doc(' relation edge a -> i "Owns" {type owns}'),{profile:schema}).valid,true);
  assert.equal(arch.validate(withRefs('a',' relation edge a -> i "Owns" {type owns}'),{profile:schema}).valid,true,'same reference and link count once');
  assert.equal(arch.validate(withRefs('a,a'),{profile:schema}).valid,true,'repeat references count once');
  assert.equal(arch.validate(withRefs('a,b'),{profile:schema}).valid,false,'distinct references reach max count');
  assert.equal(arch.validate(withRefs('a',' relation first a -> i "" {type owns} relation second a -> i "" {type owns}'),{profile:schema}).valid,false,'parallel edges keep existing edge-count semantics');
  assert.equal(arch.validate(withRefs('t'),{profile:schema}).valid,false,'counterpart type filter also applies to references');
  assert.equal(arch.validate(withRefs('a','','include i'),{profile:schema}).valid,false,'hidden reference cannot satisfy a visible connection rule');
  assert.equal(arch.validate(doc(),{profile:schema,validation:'draft'}).conformant,false);
  for(const referenceAttributes of [['missing'],['*']])assert.throws(()=>arch.registerProfile('bad-evidence',{...schema,viewpoints:{v:{connections:[{nodes:['item'],relations:['owns'],referenceAttributes}]}}}),/reference/);
  assert.throws(()=>arch.registerProfile('bad-evidence',{...schema,viewpoints:{v:{connections:[{nodes:['*'],relations:['owns'],referenceAttributes:['owners']}]}}}),/reference/);
});
