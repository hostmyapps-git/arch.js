import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as arch from '../src/arch.js';
import { typeConnections } from '../src/profiles.js';

const schema = {
  nodeTypes: {
    ABase: {abstract:true}, A: {extends:'ABase'}, AChild: {extends:'A'}, ABlocked: {extends:'A'},
    BBase: {abstract:true}, B: {extends:'BBase'}, BBlocked: {extends:'BBase'}, D: {},
  },
  relationTypes: {
    Route: {from:['ABase'],to:['BBase'],pairs:[{from:['ABase'],to:['BBase'],fromExclude:['ABlocked'],toExclude:['BBlocked']}],allowSelf:false,acyclic:true},
    Back: {from:['BBase'],to:['ABase']},
    AbstractRoute: {abstract:true,from:['A'],to:['B']}, DerivedRoute: {extends:'AbstractRoute'},
    Narrow: {from:['A'],to:['B'],pairs:[{from:['*'],to:['*']}]},
    Peer: {from:['A'],to:['A'],allowSelf:false},
  },
};
arch.registerProfile('connections_demo', schema);
const connections = type => typeConnections(type, arch.getProfile('connections_demo'));
const entry = (list, type) => list.find(item=>item.type===type);

test('connection summaries honor inherited endpoints, concrete types, pairs and both exclusions', () => {
  const result = connections('A');
  assert.deepEqual(entry(result.outgoing,'Route').counterparts,['B']);
  assert.equal(entry(result.outgoing,'Route').allowSelf,false);
  assert.equal(entry(result.outgoing,'Route').acyclic,true);
  assert.deepEqual(entry(result.incoming,'Back').counterparts,['B','BBlocked']);
  assert.ok(result.outgoing.some(item=>item.type==='DerivedRoute'));
  assert.ok(!result.outgoing.some(item=>item.type==='AbstractRoute'));
  assert.deepEqual(entry(connections('AChild').outgoing,'Route').counterparts,['B']);
  assert.ok(!entry(connections('ABlocked').outgoing,'Route'));
  assert.deepEqual(entry(connections('B').incoming,'Route').counterparts,['A','AChild']);
  assert.ok(!entry(connections('BBlocked').incoming,'Route'));
  assert.deepEqual(connections('D').outgoing,[]);
  assert.deepEqual(connections('D').incoming,[]);
  assert.equal(connections('ABase').abstract,true);
});

test('reported combinations agree with model validation and distinguish self-links from equal endpoint types', () => {
  const p = arch.getProfile('connections_demo'), snapshot = JSON.stringify(p);
  const nodes = Object.keys(p.nodeTypes).filter(name=>!p.nodeTypes[name].abstract);
  for (const source of nodes) {
    const summary = typeConnections(source,p);
    for (const [type,rule] of Object.entries(p.relationTypes)) if (!rule.abstract) for (const target of nodes) {
      const document = `architecture "Check" { model { ${source} s "S" ${target} t "T" relation e s -> t "" {type ${type}} } }`;
      const valid = arch.validate(document,{profile:p}).valid;
      assert.equal(!!entry(summary.outgoing,type)?.counterparts.includes(target),valid,`${source} ${type} ${target}`);
      assert.equal(!!entry(typeConnections(target,p).incoming,type)?.counterparts.includes(source),valid);
    }
  }
  assert.ok(entry(typeConnections('A',p).outgoing,'Peer').counterparts.includes('A'));
  assert.equal(arch.validate('architecture "Self" { model { A s "S" relation e s -> s "" {type Peer} } }',{profile:p}).valid,false);
  assert.equal(JSON.stringify(p),snapshot);
});

test('help exposes both directions, discoverable links, inline profiles, empty results and useful errors', () => {
  const text = arch.help('connections connections_demo A');
  assert.match(text,/Outgoing relationships/); assert.match(text,/Incoming relationships/);
  assert.match(text,/Relationship overview\nOutgoing:/);
  assert.match(text,/Route: A -> B\n/);
  assert.match(text,/details: @help relations connections_demo Route/);
  assert.match(arch.help('types connections_demo A'),/@help connections connections_demo A/);
  assert.match(arch.help('relations connections_demo'),/@help connections connections_demo NODE_TYPE/);
  assert.match(arch.help('connections'),/Choose a node type/);
  assert.match(arch.help('connections connections_demo D'),/\(none\)/);
  assert.match(arch.help('connections . A',{profile:schema}),/Route: A -> B/);
  const inline = 'architecture "Local" { config { type A {} type B {} relation Connect {from A to B} }\n @help connections . A\n }';
  assert.match(arch.renderToString(inline),/Connect: A -&gt; B/);
  assert.match(arch.renderMarkdown('```arch\n'+inline+'\n```'),/data-arch-help="connections"/);
  for (const query of ['connections connections_demo Missing','connections missing A','connections connections_demo A extra']) {
    assert.equal(arch.validate('@help '+query).valid,false); assert.throws(()=>arch.help(query),arch.ArchError);
  }
});

test('OperationalPerformer help lists the supported UAF relation types in the right directions', async () => {
  arch.registerProfile('uaf',JSON.parse(await readFile('profiles/uaf.json','utf8')));
  const summary = typeConnections('OperationalPerformer',arch.getProfile('uaf'));
  assert.deepEqual(summary.outgoing.map(item=>item.type),['DesiredEffect','Exhibits','IsCapableToPerform','OperationalExchange','OperationalGeneralization','Refine']);
  assert.deepEqual(summary.incoming.map(item=>item.type),['Affects','Implements','OperationalExchange','OperationalGeneralization','Protects']);
  assert.ok(entry(summary.outgoing,'IsCapableToPerform').counterparts.includes('OperationalActivity'));
  assert.ok(entry(summary.incoming,'Implements').counterparts.includes('Software'));
  const text = arch.help('connections uaf OperationalPerformer');
  assert.match(text,/IsCapableToPerform: OperationalPerformer -> OperationalActivity/);
  assert.match(arch.renderToString('@help connections uaf OperationalPerformer'),/data-arch-help="connections"/);
});
