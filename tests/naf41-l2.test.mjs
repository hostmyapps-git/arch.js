import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

for(const id of ['uaf','naf41-uaf'])arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
const example=await readFile('examples/naf41-needlines.arch','utf8');
const cutout=await readFile('examples/naf41-needlines-cutout.arch','utf8');
const doc=(model,view='')=>`architecture "L2" {config {profile naf41-uaf} model {${model}} view l2 "L2" {viewpoint L2 ${view}}}`;
const compact='Node a "A" Node b "B" relation line a -> b "tasking" {type Needline}';
const objectified='Node a "A" Node b "B" Needline obj "Tasking" relation line a -> b "tasking" {type Needline needline obj}';
const errors=source=>arch.validate(source).diagnostics.map(d=>d.message).join('\n');

test('L1 can exclude L2 relationship IDs while sharing all endpoint nodes',()=>{
  const source=`architecture "Shared L1 and L2" {
    config {profile naf41-uaf}
    model {
      Node node_search "Search"
      Node node_assetControl "Asset Control"
      Node node_rescue "Rescue"
      relation l1.1 node_search -> node_rescue "aggregates" {type GroupsLogicalResource}
      relation l2.1 node_search -> node_assetControl "control" {type Needline}
      relation l2.2 node_search -> node_rescue "status" {type Needline}
    }
    view l1 "L1" {
      viewpoint L1
      exclude l2.1, l2.2
      diagram tree
    }
    view l2 "L2" {
      viewpoint L2
      exclude l1.1
    }
    view l1Detail "L1 detail" {extends l1}
    view l1Embedded "Embedded L1" {viewpoint L1 embed l1Detail}
  }`;
  for(const input of [source,arch.translate(source)]) {
    assert.deepEqual(arch.validate(input).diagnostics,[]);
    for(const view of ['l1','l1Detail','l1Embedded','l2']) {
      const graph=arch.layout(input,{view});
      assert.equal(graph.nodes.length,3);
      assert.deepEqual(graph.edges.map(edge=>edge.id),view==='l2'?['l2.1','l2.2']:['l1.1']);
    }
  }
  const styled=source.replace('exclude l2.1, l2.2','style l2.1 {display none} style l2.2 {display none}');
  assert.match(errors(styled),/Relationship type Needline is not allowed.*exclude l2\.1/);
  assert.match(errors(source.replace('exclude l1.1','exclude [l1.1,l2.1,l2.2]')),/Requires a Needline relationship/);
  assert.match(errors(source.replace('exclude l2.1, l2.2','exclude l2.1, missing')),/Unknown element or relationship.*missing/);
  assert.match(errors(source.replace('exclude l2.1, l2.2','include l2.1')),/Unknown element.*l2\.1/);
});

test('L3 can reuse a Needline and its Node endpoints from L2 as optional context',()=>{
  const source=`architecture "Shared L2 and L3" {
    config {profile naf41-uaf}
    model {
      Node node_search "Search"
      Node node_rescue "Rescue"
      Needline need_status "Status need"
      LogicalActor observer "Observer"
      LogicalActor coordinator "Coordinator"
      InformationProduct report "Status report"
      InformationProduct request "Requested information"
      relation l2.2 node_search -> node_rescue "status" {type Needline needline need_status}
      relation aggregatesSearch node_search -> observer "aggregates" {type GroupsLogicalResource}
      relation aggregatesRescue node_rescue -> coordinator "aggregates" {type GroupsLogicalResource}
      relation l3.1 observer -> coordinator "reports status" {type LogicalInteraction conveyed [report] needline need_status}
      relation requested need_status -> request "asks for exchange of" {type ConveysLogicalResource}
    }
    view l2 "L2" {viewpoint L2 include node_search,node_rescue,need_status}
    view l3 "L3" {viewpoint L3}
    view l3Compact "L3 without context" {viewpoint L3 include observer,coordinator,report}
  }`;
  assert.deepEqual(arch.validate(source).diagnostics,[]);
  const full=arch.layout(source,{view:'l3'});
  assert.ok(full.edges.some(edge=>edge.id==='l2.2'));
  assert.ok(full.referenceNodes.some(ref=>ref.edgeId==='l2.2'&&ref.nodeId==='need_status'));
  assert.deepEqual(arch.layout(source,{view:'l3Compact'}).edges.map(edge=>edge.id),['l3.1']);
  assert.deepEqual(arch.validate(source.replace('viewpoint L3}', 'viewpoint L3 exclude request}')).diagnostics,[]);
  assert.match(errors(source.replace('viewpoint L3}', 'viewpoint L3 exclude report}')),/l3\.1\.conveyed references report.*must be visible/);
  assert.match(errors(source.replace('viewpoint L3}', 'viewpoint L3 exclude l3.1}')),/Missing required relationship type LogicalInteraction/);
});

test('L2 p.129 supports all four nodes and six directed needlines, including cycles and parallel connections',async()=>{
  for(const validation of ['strict','draft'])assert.deepEqual(arch.validate(example,{validation}).diagnostics,[]);
  const g=arch.layout(example);assert.equal(g.nodes.length,4);assert.equal(g.edges.length,6);assert.equal(g.referenceNodes.length,0);
  assert.deepEqual(g.edges.map(e=>[e.id,e.source,e.target]),[
    ['controlSearch','search','assetControl'],['status','search','rescue'],['taskRescue','assetControl','rescue'],
    ['controlAsset','assetControl','tacticalC2'],['rescueTask','tacticalC2','rescue'],['taskSearch','tacticalC2','search']]);
  assert.ok(g.edges.every(e=>e.type==='Needline'&&e.style==='flow'));
  const parallel=doc(compact+' relation other a -> b "status" {type Needline}');assert.equal(arch.validate(parallel).valid,true);
  const expected=arch.renderToString(example,{idPrefix:'l2'});
  assert.equal(arch.renderToString(arch.translate(example),{idPrefix:'l2'}),expected);
  for(const file of ['arch.js','arch.min.js']) {
    const c=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),c);vm.runInContext(await readFile('profiles/profiles.js','utf8'),c);
    assert.equal(c.arch.renderToString(example,{idPrefix:'l2'}),expected);
  }
});

test('L2 objectification uses an identity-preserving card, captioned connector and explicit conveys relationship',()=>{
  assert.deepEqual(arch.validate(cutout).diagnostics,[]);
  const model=arch.parse(cutout),before=JSON.stringify(model),g=arch.layout(model,{view:'objectified'});
  assert.equal(g.nodes.length,4);assert.equal(g.edges.length,2);assert.equal(g.referenceNodes.length,1);
  const connector=g.referenceNodes[0];assert.equal(connector.nodeId,'taskingNeed');assert.equal(connector.edgeId,'tasking');
  assert.equal(connector.connectorLabelText,'is equal to');assert.equal(connector.route.to,.5);
  assert.equal(connector.node,g.nodes.find(n=>n.id==='taskingNeed'));
  assert.deepEqual([g.edges.find(e=>e.id==='payload').source,g.edges.find(e=>e.id==='payload').target],['taskingNeed','taskingOrder']);
  for(const theme of ['light','dark']) {
    const expected=arch.renderToString(model,{view:'objectified',theme,idPrefix:'objectified'});
    assert.match(expected,/>is equal to</);assert.match(expected,/>conveys</);
    assert.equal(arch.renderToString(arch.translate(cutout),{view:'objectified',theme,idPrefix:'objectified'}),expected);
  }
  assert.equal(JSON.stringify(model),before);
});

test('complete legacy endpoint references remain valid without generating edges or requiring payload visibility',()=>{
  const legacy='Node a "A" Node b "B" InformationProduct info "Report" Needline obj "Need" {source a target b conveyed [info]}';
  for(const view of ['', 'include a,b,obj','exclude info']) {
    const s=doc(legacy,view);assert.deepEqual(arch.validate(s).diagnostics,[]);assert.equal(arch.layout(s).edges.length,0);
  }
  const bound=objectified.replace('Needline obj "Tasking"','Needline obj "Tasking" {source a target b}');
  assert.equal(arch.validate(doc(bound)).valid,true);
  assert.match(errors(doc(legacy,'include a,obj')),/obj.target references b.*must be visible/);
  assert.match(errors(doc(legacy.replace('target b','target missing'))),/unknown reference missing/);
});

test('L2 binding validates optional objects, selected evidence, unique identity and consistent endpoint pairs',()=>{
  assert.deepEqual(arch.validate(doc(compact)).diagnostics,[]);
  assert.deepEqual(arch.validate(doc(objectified,'include a,b')).diagnostics,[],'object card is optional');
  assert.deepEqual(arch.validate(doc(objectified,'style obj {display none}')).diagnostics,[]);
  assert.match(errors(doc(objectified.replace(' needline obj',''))),/Requires a selected Needline relationship bound through needline/);
  assert.match(errors(doc(objectified,'include a,obj')),/Requires a selected Needline relationship/);
  const duplicate=objectified+' relation second b -> a "return" {type Needline needline obj}';
  assert.match(errors(doc(duplicate,'include a,b')),/Object must bind exactly one Needline relationship; found 2/);
  const inconsistent=objectified.replace('Needline obj "Tasking"','Needline obj "Tasking" {source b target a}');
  assert.match(errors(doc(inconsistent,'include a,b')),/Endpoint references disagree with relationship line/);
  const partial=objectified.replace('Needline obj "Tasking"','Needline obj "Tasking" {source a}');
  assert.match(errors(doc(partial)),/Provide both source and target/);
  const draft=arch.validate(doc(partial),{validation:'draft'});assert.equal(draft.valid,true);assert.ok(draft.diagnostics.some(d=>d.message.includes('Provide both')));
  assert.match(errors(doc('Node a "A" Node b "B" relation dep a -> b "depends" {type LogicalDependency}')),/Requires a Needline relationship/);
});

test('L2 may omit known conveyed resources and explicit conveys links while retaining typed model validation',()=>{
  const body=objectified+' InformationProduct info "Report" relation payload obj -> info "conveys" {type ConveysLogicalResource}';
  for(const view of ['', 'exclude info','style info {display none}','style payload {display none}']) {
    assert.deepEqual(arch.validate(doc(body,view)).diagnostics,[],view);
    assert.equal(arch.layout(doc(body,view)).edges.some(e=>e.id==='payload'),view==='');
  }
  assert.equal(arch.layout(cutout,{view:'withoutPayload'}).nodes.length,3);
  assert.equal(arch.layout(cutout,{view:'compact'}).referenceNodes.length,0);
  assert.match(errors(doc(body.replace('InformationProduct info','PhysicalMaterial info'))),/target of type PhysicalMaterial is not allowed for ConveysLogicalResource/);
  assert.match(errors(doc(body.replace('obj -> info','a -> info'))),/source of type Node is not allowed for ConveysLogicalResource/);
});

test('Needline endpoints and bindings stay in the logical-node domain and reject invalid references',()=>{
  for(const type of ['LogicalNode','OperationalArchitecture'])assert.equal(arch.validate(doc(compact.replace('Node a',`${type} a`))).valid,true);
  for(const type of ['LogicalActor','LogicalEquipment','Service'])assert.match(errors(doc(compact.replace('Node a',`${type} a`))),/source of type .* is not allowed for Needline/);
  assert.match(errors(doc(compact.replace('a -> b','a -> a'))),/Self-relationships are not allowed/);
  assert.match(errors(doc(objectified.replace('needline obj','needline a'))),/Reference type Node is not allowed/);
  assert.match(errors(doc(objectified.replace('needline obj','needline missing'))),/unknown reference missing/);
  assert.match(arch.help('relations naf41-uaf Needline'),/needline/);
  assert.match(arch.help('types naf41-uaf Needline'),/Objectified/);
});

test('Needline assignment connectors retain fractional routing, free paths, labels-only mode and bounded export',()=>{
  const view='place a at (0,0) place b at (800,0) place obj at (300,350) route obj -> line {from top 1/4 to 3/4 via (350,200) curve rounded}';
  const s=doc(objectified,view),g=arch.layout(s);assert.equal(g.referenceNodes[0].route.to,.75);
  assert.ok(g.referenceNodes[0].points.some(p=>p.x===350&&p.y===200));assert.match(arch.renderToString(s),/arch-reference-label/);
  assert.equal(arch.layout(doc(objectified,view+' referenceDisplay labels')).referenceNodes.length,0);
  const free=doc(objectified,'route obj -> line {path "M -900 -700 L 0 0"}');
  assert.ok(arch.layout(free).bounds.x<-900);assert.ok(arch.layout(free).bounds.y<-700);
});

test('generic objectification rules validate profile schemas and work without NAF-specific names',()=>{
  const profile={nodeTypes:{endpoint:{},object:{attributes:{src:{type:'reference',targets:['endpoint']},dst:{type:'reference',targets:['endpoint']}}}},relationTypes:{link:{from:['endpoint'],to:['endpoint'],attributes:{identity:{type:'reference',targets:['object']}}}},viewpoints:{V:{objectifications:[{nodes:['object'],relations:['link'],attribute:'identity',endpoints:{source:'src',target:'dst'},allowLegacy:true,required:true}]}}};
  const source='architecture "Generic" {model {endpoint a "A" endpoint b "B" object obj "Object" relation r a -> b "Link" {type link identity obj}} view v "V" {viewpoint V}}';
  assert.deepEqual(arch.validate(source,{profile}).diagnostics,[]);
  for(const edit of [r=>r.nodes=['*'],r=>r.relations=['missing'],r=>r.attribute='missing',r=>r.required='yes',r=>delete r.endpoints,r=>r.endpoints.target='missing',r=>r.endpoints.target='src']) {
    const bad=structuredClone(profile);edit(bad.viewpoints.V.objectifications[0]);assert.throws(()=>arch.registerProfile('bad-objectification',bad),arch.ArchError);
  }
  const wrong=structuredClone(profile);wrong.relationTypes.link.attributes.identity.many=true;assert.throws(()=>arch.registerProfile('bad-many',wrong),arch.ArchError);
});
