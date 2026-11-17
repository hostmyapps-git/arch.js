import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as arch from '../src/arch.js';

const document = (nodes, views = '', config = '') => `architecture "Test" { ${config} model { ${nodes} } ${views} }`;
const profile = (id = 'test-profile') => ({ id, version: '1', defaultRelation: 'uses',
  nodeTypes: {
    entity: { template: 'node', abstract: true, attributes: { owner: { required: true, minLength: 1 } } },
    actor: { extends: 'entity', template: 'person' },
    system: { extends: 'entity', template: 'system', attributes: {
      level: { type: 'integer', min: 1, max: 3 }, active: { type: 'boolean' }, status: { enum: ['draft', 'live'] } } },
    group: { template: 'package', contains: ['entity', 'group'] },
  },
  relationTypes: { uses: { from: ['actor'], to: ['system'], style: 'dependency', allowSelf: false,
    attributes: { secure: { type: 'boolean', required: true } } } },
  viewpoints: { context: { nodes: ['entity', 'group'], relations: ['uses'], requiredNodes: ['actor', 'system'], requiredRelations: ['uses'] } },
});
const pair = 'actor u "User" { owner "People" } system s "System" { owner "Apps" level 2 active true status live } relation e u -> s "Uses" { secure true }';
const view = 'view v "Context" { viewpoint context }';
const errors = (source, options) => arch.validate(source, options).diagnostics.map(d => d.message).join('\n');

test('viewpoint connection node exclusions include descendants and do not change type/endpoint compatibility',()=>{
  const p={
    defaultRelation:'link',
    nodeTypes:{base:{},ordinary:{extends:'base'},optional:{extends:'base'},child:{extends:'optional'}},
    relationTypes:{link:{from:['base'],to:['base']}},
    viewpoints:{v:{nodes:['base'],relations:['link'],connections:[{nodes:['base'],nodesExclude:['optional'],relations:['link'],min:1,direction:'either'}]}},
  };
  const source=document('ordinary a "A" ordinary b "B" optional c "Optional" child d "Optional child" relation e a -> b "Linked"','view v "V"{viewpoint v}');
  assert.equal(arch.validate(source,{profile:p}).valid,true);
  assert.match(errors(source.replace('child d','ordinary d'),{profile:p}),/d requires.*connections/);
  assert.equal(arch.validate(source.replace('a -> b','a -> c').replace('ordinary b "B"',''),{profile:p}).valid,true,'excluded nodes remain legal endpoints');
  assert.throws(()=>arch.registerProfile('bad-exclusion',{...p,viewpoints:{v:{...p.viewpoints.v,connections:[{...p.viewpoints.v.connections[0],nodesExclude:['missing']}]}}}),/unknown node type/);
  assert.ok(!arch.getProfiles().includes('bad-exclusion'));
});

test('default profile keeps existing syntax and separates semantic types from templates', () => {
  const m = arch.parse(document('service a "A" database b "B" relation e a -> b "Reads"'));
  assert.equal(m.profile.id, 'default'); assert.equal(arch.validate(m).valid, true);
  assert.equal(arch.layout(m).edges[0].style, 'flow');
  const graph = arch.layout(arch.parse(document(pair, view), { profile: profile() }));
  assert.equal(graph.nodes[0].type, 'actor'); assert.equal(graph.nodes[0].template, 'person');
  assert.equal(graph.edges[0].type, 'uses'); assert.equal(graph.edges[0].style, 'dependency');
  assert.match(arch.renderToString(document(pair, view), { profile: profile() }), /data-type="uses" data-style="dependency"/);
});

test('profiles register atomically, return detached data, and parsed models retain their profile snapshot', () => {
  const schema = profile('snapshot'); arch.registerProfile('snapshot', schema);
  const model = arch.parse(document(pair, view), { profile: 'snapshot' });
  schema.nodeTypes.actor.template = 'database';
  const copy = arch.getProfile('snapshot'); copy.nodeTypes.actor.template = 'artifact';
  assert.equal(arch.layout(model).nodes[0].template, 'person');
  assert.equal(arch.getProfile('snapshot').nodeTypes.actor.template, 'person');
  assert.ok(arch.getProfiles().includes('snapshot'));
  assert.throws(() => arch.registerProfile('snapshot', { nodeTypes: {} }));
  assert.equal(arch.getProfile('snapshot').nodeTypes.actor.template, 'person');
  const next = profile('snapshot'); next.nodeTypes.actor.template = 'component'; arch.registerProfile('snapshot', next);
  assert.equal(arch.layout(model).nodes[0].template, 'person');
  assert.equal(arch.layout(model, { profile: 'snapshot' }).nodes[0].template, 'component');
  assert.equal(arch.layout(JSON.parse(JSON.stringify(model))).nodes[0].template, 'person');
});

test('typed attributes, inherited requirements, enum values and numeric/text boundaries are enforced', () => {
  const p = profile();
  assert.equal(arch.validate(document(pair, view), { profile: p }).valid, true);
  assert.match(errors(document(pair.replace('owner "People"', '')), { profile: p }), /Missing required attribute owner/);
  assert.match(errors(document(pair.replace('owner "People"', 'owner ""')), { profile: p }), /text length/);
  assert.match(errors(document(pair.replace('level 2', 'level 4')), { profile: p }), /Number outside/);
  assert.match(errors(document(pair.replace('level 2', 'level 1.5')), { profile: p }), /expected integer/);
  assert.match(errors(document(pair.replace('active true', 'active "true"')), { profile: p }), /expected boolean/);
  assert.match(errors(document(pair.replace('status live', 'status invalid')), { profile: p }), /Value must be one of/);
  assert.match(errors(document(pair.replace('secure true', '')), { profile: p }), /Missing required attribute secure/);
  assert.match(errors(document(pair.replace('level 2', 'undefinedField 2')), { profile: p }), /Unknown attribute/);
  assert.match(errors(document('entity a "Abstract" { owner "A" }'), { profile: p }), /Abstract node type/);
  assert.match(errors(document(pair.replace('owner "Apps"', 'owner 4')), { profile: p }), /expected string/);
});

test('endpoint rules use type inheritance; relationship inheritance preserves styles and attributes', () => {
  const p = profile();
  p.nodeTypes.specialActor = { extends: 'actor' };
  p.relationTypes.secureUse = { extends: 'uses', style: 'realization' };
  assert.equal(arch.validate(document(pair.replace('actor u', 'specialActor u').replace('secure true', 'type secureUse secure true')), { profile: p }).valid, true);
  assert.match(errors(document(pair.replace('u -> s', 's -> u')), { profile: p }), /source of type system/);
  assert.match(errors(document(pair.replace('u -> s', 'u -> u')), { profile: p }), /Self-relationships/);
  p.relationTypes.uses.abstract = true;
  p.defaultRelation = 'secureUse';
  assert.match(errors(document(pair.replace('secure true', 'type uses secure true')), { profile: p }), /Abstract relationship type/);
  assert.equal(arch.validate(document(pair.replace('secure true', 'type secureUse secure true')), { profile: p }).valid, true);
});

test('cardinality validates the entire model, including derived relations and incoming counts', () => {
  const p = profile(); p.relationTypes.uses.outgoing = { min: 1, max: 1 }; p.relationTypes.uses.incoming = { min: 1, max: 1 };
  p.relationTypes.special = { extends: 'uses' };
  assert.equal(arch.validate(document(pair.replace('secure true', 'type special secure true')), { profile: p }).valid, true);
  assert.match(errors(document(pair + ' relation another u -> s "Again" { secure true }'), { profile: p }), /uses.outgoing/);
  assert.match(errors(document(pair + ' actor alone "Alone" { owner "People" }'), { profile: p }), /alone: uses.outgoing/);
  assert.match(errors(document(pair + ' system unused "Unused" { owner "Apps" }'), { profile: p }), /unused: uses.incoming/);
});

test('custom containers support nesting and coordinates while child whitelists remain semantic', () => {
  const p = profile();
  const m = arch.parse(document('group outer "Outer" { group inner "Inner" { actor u "U" { owner "A" } } }',
    'view v "V" { place outer at (100, 200) place u at (20, 30) }'), { profile: p });
  const graph = arch.layout(m), inner = graph.nodes.find(n => n.id === 'inner'), user = graph.nodes.find(n => n.id === 'u');
  assert.equal(user.x - inner.x, 48); assert.equal(user.y - inner.y, 102);
  assert.equal(graph.nodes[0].type, 'group'); assert.equal(graph.nodes[0].container, true);
  assert.match(arch.renderToString(m), /class="arch-package"/);
  p.nodeTypes.group.contains = ['system'];
  assert.match(errors(document('group g "G" { actor u "U" { owner "A" } }'), { profile: p }), /actor is not allowed in group/);
  assert.match(errors(document('actor a "A" { owner "A" actor b "B" { owner "B" } }'), { profile: p }), /a is not a container/);
});

test('viewpoints enforce visible type whitelists, required types and optional mandatory selection', () => {
  const p = profile();
  assert.equal(arch.validate(document(pair, view), { profile: p }).valid, true);
  assert.match(errors(document(pair, 'view v "V" { viewpoint context include u }'), { profile: p }), /Missing required node type system/);
  p.viewpoints.context.nodes = ['actor'];
  assert.match(errors(document(pair, view), { profile: p }), /node type system is not allowed in viewpoint/);
  delete p.viewpoints.context.nodes;
  p.relationTypes.other = { from: ['actor'], to: ['system'] };
  assert.match(errors(document(pair.replace('secure true', 'type other'), view), { profile: p }), /Relationship type other/);
  assert.equal(arch.validate(document(pair.replace('secure true', 'type other')), { profile: p }).valid, true);
  p.viewpoints.context.relations = [];
  assert.match(errors(document(pair, view), { profile: p }), /Relationship type uses is not allowed/);
});

test('unknown and missing viewpoints report view IDs; required relations honor visible endpoints', () => {
  const p = profile(); p.requireViewpoint = true;
  assert.match(errors(document(pair), { profile: p }), /requires a viewpoint/);
  assert.match(errors(document(pair, 'view x "X" { viewpoint missing }'), { profile: p }), /Unknown viewpoint/);
  const report = arch.validate(document(pair, 'view x "X" { viewpoint context include u }'), { profile: p });
  assert.ok(report.diagnostics.some(d => d.viewId === 'x' && d.message.includes('Missing required relationship type uses')));
});

test('API selection takes precedence over document selection and inline rules without weakening it', () => {
  arch.registerProfile('parameter', profile('parameter'));
  const inline = 'config { type anything { template database } }';
  assert.equal(arch.parse(document('anything a "A"', '', inline)).profile.id, 'inline');
  assert.match(errors(document('anything a "A"', '', inline), { profile: 'parameter' }), /Unknown element type/);
  assert.equal(arch.parse(document(pair, view, 'config { profile parameter }')).profile.id, 'parameter');
  assert.equal(arch.parse(document(pair, view, 'config { profile does-not-exist }'), { profile: 'parameter' }).profile.id, 'parameter');
  assert.match(errors(document(pair), { profile: 'does-not-exist' }), /Unknown profile/);
  assert.equal(arch.parse(document('service a "A"')).profile.id, 'default');
});

test('inline config uses the same rules, allows forward declarations and profile extension', () => {
  const source = document('client a "A" { contact "Team" } server b "B" relation e a -> b "" { encrypted true }', '', `config {
    id custom version "2" defaultRelation calls
    type client { template person attributes { attribute contact { required true } } }
    type server { template node }
    relation calls { from client to server style dependency attribute encrypted { type boolean required true } }
  }`);
  const model = arch.parse(source); assert.equal(model.profile.id, 'custom'); assert.equal(model.profile.version, '2');
  assert.match(arch.renderToString(model), /data-style="dependency"/);
  const extension = arch.parse(document('custom c "C" service s "S"', '', 'config { extends default type custom { template artifact } }'));
  assert.equal(extension.profile.nodeTypes.custom.template, 'artifact'); assert.ok(extension.profile.nodeTypes.service);
  assert.throws(() => arch.parse(document('', '', 'config { type a {} type a {} }')), /Duplicate/);
  assert.throws(() => arch.parse(document('', '', 'config { profile default type a {} }')), /Choose either/);
  assert.throws(() => arch.parse(document('', '', 'config {} config {}')), /Only one config/);
  assert.throws(() => arch.parse(document('', '', 'config { type a { nonsense true } }')), /Unknown profile rule/);
  const base = { nodeTypes: { service: { template: 'service' } }, relationTypes: { flow: {} }, defaultRelation: null };
  arch.registerProfile('no-default', base);
  arch.registerProfile('no-default-child', { extends: 'no-default' });
  assert.equal(arch.getProfile('no-default-child').defaultRelation, null);
  assert.match(errors(document('service a "A" relation e a -> a ""'), { profile: 'no-default-child' }), /explicit type/);
});

test('runtime diagnostics include all semantic errors and source locations without executing rules', () => {
  const report = arch.validate('architecture "T" {\n model {\n actor u "U"\n system s "S" { owner "A" level 99 }\n }\n}', { profile: profile() });
  assert.equal(report.valid, false); assert.equal(report.profile.id, 'test-profile');
  assert.ok(report.diagnostics.some(d => d.line === 3 && d.elementId === 'u' && d.attribute === 'owner'));
  assert.ok(report.diagnostics.some(d => d.line === 4 && d.attribute === 'level'));
  assert.equal(arch.validate('invalid').valid, false); assert.equal(arch.validate(null).valid, false);
  assert.equal(arch.validate({}).valid, false);
  assert.throws(() => arch.parse(document('actor u "U"'), { profile: profile() }), e => e.diagnostics.length === 1);
});

test('generic numeric metadata supports large finite values while drawing coordinates stay bounded', () => {
  const p = { nodeTypes: { initiative: { attributes: { budget: { type: 'number', min: 0 }, year: { type: 'integer' } } } } };
  const model = arch.parse(document('initiative a "A" { budget 1.2e12 year 2026 }'), { profile: p });
  assert.equal(model.nodes[0].attributes.budget, 1.2e12);
  assert.throws(() => arch.parse(document('initiative a "A"', 'view v "V" { place a at (1e12,0) }'), { profile: p }), /Coordinate/);
  assert.throws(() => arch.parse(document('initiative a "A" { budget 1e999 }'), { profile: p }), /finite/);
});

test('schema validation rejects unknown settings, unsafe presentation, broken references and cycles atomically', () => {
  for (const bad of [
    {}, { nodeTypes: {} }, { nodeTypes: { a: { template: '<script>' } } },
    { nodeTypes: { a: { abstract: 'true' } } }, { nodeTypes: { a: { container: true, template: 'node' } } },
    { nodeTypes: { a: { extends: 'b' }, b: { extends: 'a' } } },
    { nodeTypes: { a: { attributes: { owner: { type: 'function' } } } } },
    { nodeTypes: { a: { attributes: { id: {} } } } },
    { nodeTypes: { a: { attributes: { number: { type: 'integer', min: 9, max: 1 } } } } },
    { nodeTypes: { a: { accent: 'url(evil)' } } }, { nodeTypes: { a: { icon: 'a\" onclick=\"b' } } },
    { nodeTypes: { a: {} }, relationTypes: { calls: { from: ['missing'] } } },
    { nodeTypes: { a: {} }, relationTypes: { calls: { outgoing: { min: 2, max: 1 } } } },
    { nodeTypes: { a: {} }, viewpoints: { x: { requiredNodes: ['missing'] } } },
    { nodeTypes: { a: {} }, validate: 'eval()' },
  ]) assert.throws(() => arch.registerProfile('bad-schema', bad), arch.ArchError);
  assert.ok(!arch.getProfiles().includes('bad-schema'));
  assert.throws(() => arch.registerProfile('a', { id: 'b', nodeTypes: { x: {} } }), /match/);
  assert.throws(() => arch.getProfile('missing'), /Unknown profile/);
});

test('prototype-like names work as data across profiles, attributes, types and views', () => {
  const schema = JSON.parse('{"id":"safe","nodeTypes":{"__proto__":{"template":"service","attributes":{"constructor":{"required":true}}}}}');
  const source = document('__proto__ constructor "Safe" { constructor "Data" }', 'view __proto__ "V" { style constructor { accent "#abc" } }');
  assert.match(arch.renderToString(source, { profile: schema }), /data-type="__proto__"/);
  assert.equal(Object.prototype.polluted, undefined);
});

test('profile selection propagates through layout, SVG and Markdown without mutating models', () => {
  const source = document(pair, view), p = profile();
  const model = arch.parse(source, { profile: p }), snapshot = JSON.stringify(model);
  assert.equal(arch.layout(model).profile.id, p.id);
  assert.match(arch.renderMarkdown('```arch\n' + source + '\n```', { profile: p }), /data-type="actor"/);
  arch.renderToString(model); assert.equal(JSON.stringify(model), snapshot);
  const modified = JSON.parse(snapshot); modified.nodes[1].attributes.level = 100;
  assert.throws(() => arch.renderToString(modified), /Number outside/);
});

test('all shipped inline and registered-profile examples validate and render every view', async () => {
  const schema = JSON.parse(await readFile('profiles/enterprise.json', 'utf8'));
  arch.registerProfile(schema.id, schema);
  for (const file of ['profiles', 'external-profile']) {
    const model = arch.parse(await readFile(`examples/${file}.arch`, 'utf8'));
    assert.equal(arch.validate(model).valid, true);
    for (const v of model.views) assert.match(arch.renderToString(model, { view: v.id }), /data-type="(?:actor|domain|product|record)"/);
  }
});
