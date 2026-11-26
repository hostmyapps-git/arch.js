import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.js';
for(const id of ['uaf','naf41-uaf'])arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
const example=await readFile('examples/naf41-service-sequence.arch','utf8');
const cutout=await readFile('examples/naf41-service-sequence-cutout.arch','utf8');
const xml=svg=>new DOMParser().parseFromString(svg,'image/svg+xml');
const attr=(doc,name,value)=>[...doc.getElementsByTagName('g')].filter(g=>g.getAttribute(name)===value);

test('positioned S6 lifelines combine calculated heights with a straight reverse message at fractional ports',async()=>{
 const source=await readFile('examples/naf41-service-sequence-placed.arch','utf8');
 assert.deepEqual(arch.validate(source).diagnostics,[]);
 const graph=arch.layout(source),nodes=new Map(graph.nodes.map(n=>[n.id,n]));
 const left=nodes.get('serviceLifeline_coordinationServiceLifeline'),right=nodes.get('serviceLifeline_sarServiceLifeline');
 const request=nodes.get('serviceInteraction_requestSortie'),edge=graph.edges.find(e=>e.id==='s6.8');
 assert.equal(left.height,5*request.height);assert.equal(right.height,left.height);
 assert.deepEqual(edge.points,[{x:right.x,y:right.y+right.height*0.6},{x:left.x+left.width,y:left.y+left.height*0.6}]);
 assert.equal(edge.points[0].y,edge.points[1].y);assert.equal((edge.d.match(/ L /g)??[]).length,1);
 assert.ok(edge.label.y+edge.labelHeight/2<edge.points[0].y,'reply caption stays above the attachment arrow');
 const requestEdge=graph.edges.find(e=>e.id==='s6.7');assert.ok(requestEdge.label.y>requestEdge.points[0].y,'request caption stays below its edge');
 const caption=graph.referenceNodes.find(o=>o.edgeId==='s6.8').connectorLabel;
 assert.ok(caption.y-caption.height/2-(edge.label.y+edge.labelHeight/2)>=8,'reply and objectification captions have clear separation');
 const explicit=arch.layout(source.replace('from left 0.6 to right 0.6 curve straight','from left 0.6 to right 0.6 curve straight label (440,610)'));
 assert.deepEqual(explicit.edges.find(e=>e.id==='s6.8').label,{x:440,y:610},'manual label positions remain unchanged');
 assert.equal(arch.renderToString(source,{idPrefix:'placed'}),arch.renderToString(arch.translate(source),{idPrefix:'placed'}));
});

test('S6 p.118 supports both objectified messages, timeline/service context and sequence/connected views in JSON and bundles',async()=>{
 assert.deepEqual(arch.validate(example).diagnostics,[]);
 const model=arch.parse(example),before=JSON.stringify(model);assert.equal(model.nodes.length,10);assert.equal(model.edges.length,9);
 for(const theme of ['light','dark'])for(const view of ['s6','connected']) {
  const options={theme,view,idPrefix:'s6'},svg=arch.renderToString(model,options),doc=xml(svg);
  assert.equal(arch.renderToString(arch.translate(example),options),svg);
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
   const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
   for(const id of ['uaf','naf41-uaf'])context.arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
   assert.equal(context.arch.renderToString(example,options),svg);
  }
  if(view==='s6') {
   assert.equal([...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-message')).length,2);
   assert.equal(attr(doc,'class','arch-sequence-reference').length,2);
   assert.equal(attr(doc,'class','arch-sequence-context-edge').length,7);
   assert.equal([...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-node')).length,10);
   assert.equal(attr(doc,'data-node','request').length,1);assert.equal(attr(doc,'data-node','acknowledgement').length,1);
   assert.equal([...doc.getElementsByTagName('tspan')].filter(t=>t.textContent==='is equal to').length,2);
  } else assert.equal(attr(doc,'class','arch-reference-label').length,2);
 }
 assert.equal(JSON.stringify(model),before);
});

test('S6 cut-out includes function enabling, timeline, interfaces, operations and event-to-interaction triggers',()=>{
 assert.deepEqual(arch.validate(cutout).diagnostics,[]);
 const model=arch.parse(cutout);assert.equal(model.nodes.length,7);assert.equal(model.edges.length,7);
 for(const edge of model.edges)if(edge.type!=='ServiceInteraction') {
  const reversed=structuredClone(model),item=reversed.edges.find(e=>e.id===edge.id);
  [item.source,item.target]=[item.target,item.source];assert.equal(arch.validate(reversed).valid,false,edge.type);
 }
 const svg=arch.renderToString(cutout),doc=xml(svg);
 assert.equal(attr(doc,'data-message-kind','sync').length,1);assert.match(svg,/h65 v35 h-65/);
 assert.equal(attr(doc,'class','arch-sequence-context-edge').length,6);
 assert.match(svg,/triggers/);assert.match(svg,/relates to/);
});

test('S6 enforces selected lifeline ownership and single object bindings while retaining compact message references',()=>{
 const orphan=example.replace(' interaction request}','}');
 assert.equal(arch.validate(orphan).valid,false);
 assert.ok(arch.validate(orphan.replace('profile naf41-uaf','profile naf41-uaf validation draft')).valid);
 assert.equal(arch.validate(example.replace('interaction acknowledgement}','interaction request}')).valid,false);
 assert.equal(arch.validate(example.replace('interaction request}','interaction s3}')).valid,false);
 for(const id of ['request','coordination','coordinationLine'])assert.equal(arch.validate(example.replaceAll('viewpoint S6',`viewpoint S6 exclude ${id}`)).valid,false,id);
 const compact=`architecture "Compact" {config {profile naf41-uaf} model {
  Service a "A" Service b "B" ServiceLifeline la "A line" {represents a} ServiceLifeline lb "B line" {represents b}
  ServiceEvent event "Event" ServiceOperation operation "Op"
  relation e la -> lb "Request" {type ServiceInteraction order 1 event event operation operation}}
  view s6 "S6" {viewpoint S6 diagram sequence {}}}`;
 assert.deepEqual(arch.validate(compact).diagnostics,[]);assert.match(arch.renderToString(compact),/data-message="1"/);
 assert.doesNotMatch(arch.renderToString(compact),/arch-sequence-reference/);
 const sameOwner=example.replace('ServiceLifeline coordinationLine "Coordination Service Lifeline"','ServiceLifeline coordinationLine "Coordination Service Lifeline" {represents coordination}');
 assert.ok(arch.validate(sameOwner).valid);
 assert.equal(arch.validate(sameOwner.replace('{represents coordination}','{represents sar}')).valid,false);
});

test('sequence uses optional numeric ordering and context independently, with automatic profile message discovery',()=>{
 const reordered=example.replace('order 1 interaction request','order 9 interaction request').replace('order 2 interaction acknowledgement','order 3 interaction acknowledgement');
 const doc=xml(arch.renderToString(reordered)),messages=[...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-message'));
 assert.deepEqual(messages.map(g=>g.getAttribute('data-edge')),['acknowledgeMessage','requestMessage']);
 for(const change of ['order 0 interaction acknowledgement','order 1 interaction acknowledgement'])assert.equal(arch.validate(example.replace('order 2 interaction acknowledgement',change)).valid,false);
 assert.equal(arch.validate(example.replace('orderAttribute order','orderAttribute missing')).valid,false);
 assert.equal(arch.validate(example.replace('showContext true','showContext yes')).valid,false);
 const noContext=xml(arch.renderToString(example.replace('showContext true','showContext false')));
 assert.equal(attr(noContext,'class','arch-sequence-context-edge').length,0);
 assert.equal(attr(noContext,'class','arch-sequence-reference').length,2);
 const automatic=xml(arch.renderToString(example.replace('participants [coordinationLine,sarLine]','')));
 assert.equal([...automatic.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-node')).length,10);
 const hidden=xml(arch.renderToString(example.replace('participants [coordinationLine,sarLine]','').replaceAll('viewpoint S6','viewpoint S6 style requestMessage {display none} style acknowledgeMessage {display none}')));
 assert.equal([...hidden.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-message')).length,0,'hiding all messages must not turn context links into messages');
 const labelMode=arch.renderToString(example.replaceAll('viewpoint S6','viewpoint S6 referenceDisplay labels'));
 assert.doesNotMatch(labelMode,/arch-sequence-reference/);assert.match(labelMode,/is equal to/);
});

test('sequence objectification metadata works without NAF types, escapes captions and preserves async/return styles',()=>{
 const profile={nodeTypes:{actor:{},object:{}},relationTypes:{message:{from:['actor'],to:['actor'],sequenceMessage:true,attributes:{bound:{type:'reference',targets:['object']}},referenceLabels:{bound:'<identity>&'},referenceDisplay:'nodes',referenceConnectorLabels:true}}};
 const source=`architecture "Generic" {model {actor a "A" actor b "B" object note "Bound object" relation one a -> b "Request" {type message bound note} relation two b -> a "Return" {type message}}
 view v "V" {diagram sequence {asyncMessages [one] returns [two]}}}`;
 const svg=arch.renderToString(source,{profile});assert.match(svg,/&lt;identity&gt;&amp;/);assert.match(svg,/data-message-kind="async"/);assert.match(svg,/data-message-kind="return"/);
 assert.equal(attr(xml(svg),'class','arch-sequence-reference').length,1);
 const bad=structuredClone(profile);bad.relationTypes.message.sequenceMessage='yes';assert.throws(()=>arch.registerProfile('bad-sequence',bad),arch.ArchError);
});
