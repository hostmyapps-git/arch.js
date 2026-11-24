import test from 'node:test';
import assert from 'node:assert/strict';
import * as arch from '../src/arch.js';
import {compileProfile, matches, concreteSubtypes, typeConnections} from '../src/profiles.js';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const definition = () => ({id:'alias-example', version:'1', defaultRelation:'calls',
  nodeTypes:{
    Base:{abstract:true, attributes:{code:{type:'string',required:true}}},
    System:{extends:'Base',template:'system'},
    Special:{extends:'Service'},
    Group:{template:'package',contains:['Service']},
    Ref:{attributes:{subject:{type:'reference',targets:['Service'],required:true}}},
  },
  relationTypes:{calls:{from:['Service'],to:['System'],style:'dependency',allowSelf:false,acyclic:true,
    outgoing:{max:1},attributes:{payload:{type:'reference',targets:['Service'],many:true}}},
    specializedCall:{extends:'invokes'}},
  aliases:{nodeTypes:{Service:{target:'System',description:'Vocabulary name'},AnotherService:'Service',Abstract:'Base'},relationTypes:{invokes:'calls',invokeAgain:'invokes'}},
  viewpoints:{V:{nodes:['Service','Ref','Group'],relations:['invokeAgain'],requiredNodes:['Service'],requiredRelations:['invokes'],
    connections:[{nodes:['Service'],relations:['invokes'],direction:'outgoing',min:0,max:1}],
    references:[{nodes:['Ref'],attributes:['subject']}]}}
});
const source = (body,view='view v "V" {}') => `architecture "Alias test" { model {${body}} ${view} }`;
const pair = 'Service a "A" {code "1"} System b "B" {code "2"} relation link a -> b "calls" {type invokes payload [a]}';
const errors = (s,p=definition()) => arch.validate(s,{profile:p}).diagnostics.map(d=>d.message).join('\n');

test('aliases have symmetric identity across selectors, inheritance and concrete candidates without losing source names',()=>{
  const p=compileProfile(definition());
  for(const a of ['System','Service','AnotherService']) for(const b of ['System','Service','AnotherService']) assert.equal(matches(a,[b],p.nodeTypes),true);
  assert.equal(matches('Special',['AnotherService'],p.nodeTypes),true);
  assert.equal(matches('Service',['Special'],p.nodeTypes),false);
  assert.deepEqual(concreteSubtypes('System',p.nodeTypes),['Special']);
  assert.deepEqual(p.nodeTypes.Service.attributes,p.nodeTypes.System.attributes);
  assert.equal(p.nodeTypes.Service.aliasOf,'System');assert.equal(p.nodeTypes.AnotherService.aliasOf,'System');
  assert.deepEqual(p.nodeTypes.Service.extends,'Base');
  const m=arch.parse(source(pair),{profile:definition()}),graph=arch.layout(m);
  assert.deepEqual(m.nodes.map(n=>n.type),['Service','System']);assert.equal(m.edges[0].type,'invokes');
  assert.deepEqual(graph.nodes.map(n=>n.type),['Service','System']);assert.equal(graph.edges[0].type,'invokes');assert.equal(graph.edges[0].canonicalType,'calls');
  assert.match(arch.renderToString(source(pair),{profile:definition()}),/data-type="invokes"/);
  for(const format of ['json','dsl']) {
    const translated=arch.translate(source(pair),{format,profile:definition()});
    assert.equal(arch.parse(translated,{profile:definition()}).nodes[0].type,'Service');
    assert.equal(arch.parse(translated,{profile:definition()}).edges[0].type,'invokes');
  }
  const json=JSON.parse(JSON.stringify(m));assert.doesNotThrow(()=>arch.layout(json));
});

test('aliases apply to reference targets, containment, view requirements, pair exclusions and endpoint roles',()=>{
  const p=definition(),s=source('Group g "G" {System a "A" {code "1"}} System b "B" {code "2"} Ref r "R" {subject a} relation link a -> b "Calls" {type calls}', 'view v "V" {viewpoint V}');
  assert.equal(arch.validate(s,{profile:p}).valid,true,errors(s,p));
  p.relationTypes.calls.pairs=[{from:['Service'],to:['Service'],toExclude:['Special']}];
  assert.equal(arch.validate(source(pair),{profile:p}).valid,true);
  assert.match(errors(source(pair.replace('System b','Special b')),p),/Type combination/);
  p.viewpoints.V.connections[0].nodesExclude=['AnotherService'];p.viewpoints.V.connections[0].min=1;
  assert.equal(arch.validate(s,{profile:p}).valid,true,'exclusions resolve aliases symmetrically');
  assert.equal(typeConnections('Service',compileProfile(p)).outgoing.some(r=>r.type==='invokes'),true);
  const inspection=arch.inspectSource(source(pair.replace('Service a','System a')+' Ref r "Ref"'),{profile:definition()});
  assert.ok(inspection.diagnostics.find(d=>d.attribute==='subject').candidates.some(c=>c.example==='subject "a"'));
});

test('relationship aliases share cardinality and cycle checks without duplicate diagnostics',()=>{
  assert.equal(arch.validate(source(pair),{profile:definition()}).valid,true);
  const s=source(pair+' relation second a -> b "Again" {type calls}');
  const messages=errors(s).split('\n');assert.equal(messages.filter(m=>m.includes('a: calls.outgoing')).length,1);assert.equal(messages.length,1);
  const cycle=errors(source(pair+' relation back b -> a "Back" {type invokeAgain}'));
  assert.equal(cycle.split('\n').filter(m=>m.includes('Cycles are not allowed')).length,1);
  assert.match(errors(source(pair.replace('code "1"',''))),/a: Missing required attribute code/);
  const abstract=arch.validate(source('Abstract a "A" {code "1"}'),{profile:definition()});
  assert.equal(abstract.valid,false);assert.match(abstract.diagnostics[0].message,/Abstract node type.*Abstract/);assert.ok(abstract.diagnostics[0].candidates.includes('Service'));
});

test('alias compilation rejects cycles, collisions, semantic overrides and unknown or wrong-kind targets atomically',()=>{
  for(const mutate of [
    p=>p.aliases.nodeTypes.Service='AnotherService',
    p=>p.aliases.nodeTypes.Missing='NoSuchType',
    p=>p.aliases.nodeTypes.Service='calls',
    p=>p.nodeTypes.Service={extends:'System'},
    p=>p.aliases.nodeTypes.Service={target:'System',attributes:{}},
    p=>p.aliases.relationTypes.invokes='invokeAgain',
    p=>p.aliases.nodeTypes.architecture='System',
  ]) {const p=definition();mutate(p);assert.throws(()=>compileProfile(p),/alias|Alias/);}
  const p=compileProfile(definition()),snapshot=JSON.parse(JSON.stringify(p));
  snapshot.nodeTypes.Service.template='database';assert.throws(()=>compileProfile(snapshot),/cannot override target rules/);
  assert.equal(p.nodeTypes.System.template,'system');
  assert.throws(()=>arch.registerProfile('alias-example',{...definition(),aliases:{nodeTypes:{Service:'missing'}}}));
  assert.ok(!arch.getProfiles().includes('alias-example'));
});

test('inherited aliases follow canonical overrides but cannot be shadowed or retargeted in derived profiles',()=>{
  arch.registerProfile('alias-base',{...definition(),id:'alias-base'});
  const p=compileProfile({id:'alias-child',extends:'alias-base@1',nodeTypes:{System:{extends:'Base',template:'database'}}});
  assert.equal(p.nodeTypes.Service.template,'database');
  for(const extra of [{nodeTypes:{Service:{template:'service'}}},{aliases:{nodeTypes:{Service:'Ref'}}}]) assert.throws(()=>compileProfile({id:'bad',extends:'alias-base',...extra}),/Alias Service/);
  assert.doesNotThrow(()=>compileProfile(JSON.parse(JSON.stringify(p))));
});

test('version selectors bind registered revisions, base profiles and help while latest ID and parsed snapshots remain stable',()=>{
  const old={id:'alias-version',version:'1',nodeTypes:{N:{template:'system'}}};
  const next={...old,version:'2',nodeTypes:{N:{template:'database'}}};
  arch.registerProfile(old.id,old);const m=arch.parse(source('N n "N"'),{profile:old.id});arch.registerProfile(next.id,next);
  assert.deepEqual(arch.getProfileVersions(old.id),['1','2']);assert.equal(arch.getProfile(old.id).version,'2');
  assert.equal(arch.layout(m).nodes[0].template,'system');
  assert.equal(arch.layout(source('N n "N"'),{profile:'alias-version@1'}).nodes[0].template,'system');
  assert.equal(arch.layout(source('N n "N"').replace('model {','config {profile "alias-version@2"} model {')).nodes[0].template,'database');
  assert.equal(compileProfile({id:'derived-version',extends:'alias-version@1'}).nodeTypes.N.template,'system');
  assert.match(arch.help('profiles alias-version@1'),/Version: 1/);
  assert.throws(()=>arch.registerProfile(old.id,{...old,nodeTypes:{N:{template:'person'}}}),/revision already registered/);
  assert.throws(()=>arch.registerProfile(old.id,{nodeTypes:{N:{template:'person'}}}),/revision already registered/);
  assert.equal(arch.getProfile(old.id).version,'2');
  assert.throws(()=>arch.getProfile('alias-version@3'),/Unknown profile/);
  for(const version of ['a@b','','a b'])assert.throws(()=>arch.registerProfile('bad-version',{...old,id:'bad-version',version}),/version/);
  assert.doesNotThrow(()=>arch.registerProfile(old.id,old));
});

test('metamodel mappings remain descriptive and help distinguishes aliases from semantic specialization',()=>{
  const p=definition();p.mappings=[{kind:'node',relationship:'partial',source:{framework:'NAF',version:'4.1',type:'Goal'},target:{framework:'UAF',version:'1.0',type:'Base'},description:'Requires semantic review',sources:['local-source']}];
  const compiled=compileProfile(p);assert.equal(compiled.nodeTypes.Goal,undefined);
  assert.equal(arch.validate(source('Goal g "G"'),{profile:p}).valid,false);
  assert.match(arch.help('aliases',{profile:p}),/Service -> System/);
  assert.match(arch.help('types . Service',{profile:p}),/Canonical type: System/);
  assert.match(arch.help('types . System',{profile:p}),/Aliases: AnotherService, Service/);
  assert.match(arch.help('mappings',{profile:p}),/NAF@4.1.Goal -> UAF@1.0.Base/);
  assert.match(arch.help('mappings',{profile:p}),/do not convert/);
  const snapshot=JSON.parse(JSON.stringify(compiled));assert.deepEqual(compileProfile(snapshot).mappings,compiled.mappings);
  for(const mapping of [{...p.mappings[0],relationship:'automatic'}, {...p.mappings[0],source:{framework:'NAF',type:'Goal'}}, {...p.mappings[0],execute:'code'}])assert.throws(()=>compileProfile({...definition(),mappings:[mapping]}),/Mapping/);
});

test('alias and canonical relationship names can share paths, retain edge identities, and work in both distributable bundles',async()=>{
  const p={id:'alias-network',version:'1',nodeTypes:{N:{}},relationTypes:{flow:{style:'dependency'}},aliases:{relationTypes:{connects:'flow'}}};
  const s=source('N a "A" N b "B" N hub "Hub" relation first a -> hub "Carries" {type flow} relation second b -> hub "Carries" {type connects}',
    'view v "Network" {place a at (0,0) place b at (0,300) place hub at (700,150) routes {sharePath stereotypes}}');
  const g=arch.layout(s,{profile:p});assert.equal(g.sharedPaths.length,2);
  assert.deepEqual(g.sharedPaths[0].types,['flow','connects']);assert.deepEqual(g.sharedPaths[0].edgeIds,['first','second']);
  assert.deepEqual(g.edges.map(e=>e.type),['flow','connects']);
  const expected=arch.renderToString(s,{profile:p,idPrefix:'aliases'});
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    context.arch.registerProfile(p.id,p);
    assert.equal(context.arch.renderToString(s,{profile:'alias-network@1',idPrefix:'aliases'}),expected);
    assert.match(context.arch.help('aliases alias-network@1'),/connects -> flow/);
  }
});
