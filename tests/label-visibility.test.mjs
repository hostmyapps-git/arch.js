import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.studio.js';

const source=rules=>`architecture "Labels" {model {system a "A" system b "B" relation send a -> b "Transfers data" relation reply b -> a "Acknowledges"} view v "V" {place b at (600,0) ${rules}} view clean "Clean" {}}`;
const xml=svg=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(svg,'image/svg+xml');
const groups=d=>[...d.getElementsByTagName('g')];

test('label none hides the entire label and icon while preserving relationship data, tooltip and other views',()=>{
 const model=arch.parse(source('routes {icon core.cloud} route send {label none}')),before=JSON.stringify(model),graph=arch.layout(model);
 const edge=graph.edges.find(e=>e.id==='send');assert.equal(edge.labelHidden,true);assert.deepEqual(edge.labelLines,[]);assert.equal(edge.labelWidth,0);assert.equal(edge.labelHeight,0);assert.equal(edge.labelIcon,undefined);
 assert.equal(edge.title,'Transfers data');assert.equal(edge.labelText,'Transfers data');
 for(const theme of ['light','dark']) {
  const d=xml(arch.renderToString(model,{theme}));
  assert.equal(groups(d).filter(g=>g.getAttribute('data-label-for')==='send').length,0);
  assert.equal(groups(d).filter(g=>g.getAttribute('class')==='arch-edge').length,2);
  assert.equal(groups(d).find(g=>g.getAttribute('data-edge')==='send').getElementsByTagName('title')[0].textContent,'Transfers data');
  assert.equal(groups(d).filter(g=>g.getAttribute('data-label-for')==='reply').length,1);
 }
 assert.ok(arch.layout(model,{view:'clean'}).edges.every(e=>e.labelLines.length));assert.equal(JSON.stringify(model),before);
});

test('global label none applies by default and specific positions restore inherited icons independently of declaration order',()=>{
 const defaults='routes {label none icon core.cloud}',local='route send {label (400,-100)}';
 const one=arch.layout(arch.parse(source(`${defaults} ${local}`))),two=arch.layout(arch.parse(source(`${local} ${defaults}`)));
 const geometry=graph=>graph.edges.map(({loc,labelIconLoc,...edge})=>edge);
 assert.deepEqual(geometry(one),geometry(two));
 const visible=one.edges.find(e=>e.id==='send'),hidden=one.edges.find(e=>e.id==='reply');
 assert.equal(visible.labelHidden,false);assert.deepEqual(visible.label,{x:400,y:-100});assert.equal(visible.labelIcon,'core.cloud');assert.ok(visible.labelLines.length);
 assert.equal(hidden.labelHidden,true);assert.equal(hidden.labelIcon,undefined);
 assert.doesNotThrow(()=>arch.renderToString(source('routes {label none icon missing.icon}')),'hidden icons are not resolved or rendered');
});

test('route stereotypes render independently of text and icons and round-trip through JSON', () => {
  const input = source(`routes {showStereotype true icon core.cloud}
    route send {showLabel false}
    route reply {showStereotype false}`)
    .replace('"Transfers data" relation','"Transfers data" {type dependency} relation');
  const model = arch.parse(input);
  const [send,reply] = arch.layout(model).edges;
  assert.deepEqual(send.labelLines,['«dependency»']);
  assert.equal(send.labelIcon,'core.cloud');
  assert.deepEqual(reply.labelLines,['Acknowledges']);
  assert.deepEqual(arch.layout(model,{view:'clean'}).edges[0].labelLines,['Transfers data']);
  assert.deepEqual(arch.layout(input.replace('showLabel false','showLabel true')).edges[0].labelLines,
    ['«dependency»','Transfers data']);

  const options = {idPrefix:'route-stereotypes'};
  const svg = arch.renderToString(input,options);
  const label = groups(xml(svg)).find(group=>group.getAttribute('data-label-for')==='send');
  assert.equal(label.textContent,'«dependency»');
  assert.equal(arch.renderToString(arch.translate(input),options),svg);
  assert.deepEqual(arch.layout(input.replace('showLabel false','label none')).edges[0].labelLines,[]);
  assert.equal(arch.layout(input.replace('showLabel false','label none')).edges[0].labelWidth,0);
  assert.equal(arch.layout(source('routes {showStereotype true}')).edges[0].labelLines[0],'«flow»');
  for (const rules of ['route send {showStereotype "false"}','routes {showStereotype 1}'])
    assert.match(arch.validate(source(rules)).diagnostics[0].message,/showStereotype must be true or false/);
});

test('tree groups can show relationship stereotypes while hiding regular labels', () => {
  const input = `architecture "Tree captions" {
    model {system a "A" system b "B" relation hierarchy a -> b "Contains" {type composition}}
    view v "Hierarchy" {
      tree g {nodes a, b showLabels false}
      route hierarchy {showStereotype true}
    }
  }`;
  const graph = arch.layout(input);
  assert.deepEqual(graph.edges[0].labelLines,['«composition»']);
  assert.ok(graph.edges[0].labelWidth>0);
});

test('architecture-wide route stereotypes apply to connected views and both forms of tree', () => {
  const input = `architecture "Global captions" {
    config {profile default showRouteStereotypes true views all}
    model {
      system a "A" system b "B" system c "C"
      relation ab a -> b "Contains B" {type composition}
      relation bc b -> c "Contains C" {type composition}
    }
    view connected "Connected" {}
    view inheritedGroup "Inherited group" {tree g {nodes a, b, c showLabels false}}
    view overrideConnected "Connected overrides" {
      routes {showStereotype false}
      route ab {showStereotype true}
    }
    view overrideGroup "Group overrides" {
      routes {showStereotype false}
      tree g {nodes a, b, c showLabels false showStereotype true}
      route ab {showStereotype false}
    }
    view standalone "Standalone" {diagram tree {showLabels false}}
    view overrideTree "Tree override" {diagram tree {showStereotype false}}
  }`;
  const labels = (view, value=input) => Object.fromEntries(arch.layout(value,{view}).edges.map(edge=>[edge.id,edge.labelLines]));
  const both = {ab:['«composition»','Contains B'],bc:['«composition»','Contains C']};
  const types = {ab:['«composition»'],bc:['«composition»']};
  assert.deepEqual(labels('connected'),both);
  assert.deepEqual(labels('inheritedGroup'),types);
  assert.deepEqual(labels('overrideConnected'),{ab:both.ab,bc:['Contains C']});
  assert.deepEqual(labels('overrideGroup'),{ab:[],bc:types.bc});
  assert.deepEqual(labels('standalone'),types);
  assert.deepEqual(labels('overrideTree'),{ab:['Contains B'],bc:['Contains C']});
  const local = input.replace('showRouteStereotypes true','showRouteStereotypes false')
    .replace('diagram tree {showLabels false}','diagram tree {showLabels false showStereotype true}');
  assert.deepEqual(labels('standalone',local),types);

  const json = JSON.parse(arch.translate(input));
  assert.equal(json.architecture.config.showRouteStereotypes,true);
  const options = {idPrefix:'all-route-stereotypes'};
  assert.equal(arch.renderToString(json,options),arch.renderToString(input,options));
  assert.deepEqual(labels('connected',input.replace('profile default showRouteStereotypes true views all','showRouteStereotypes true')),both);
  for (const invalid of [
    input.replace('showRouteStereotypes true','showRouteStereotypes yes'),
    input.replace('diagram tree {showLabels false}','diagram tree {showStereotype yes}'),
    input.replace('nodes a, b, c showLabels false','nodes a, b, c showStereotype yes')
  ]) assert.match(arch.validate(invalid).diagnostics[0].message,/must be true or false/);
});

test('hidden labels do not expand bounds and work with Bezier and free-path routes',()=>{
 for(const route of ['curve bezier via (200,-100), (400,-100)','path "M 220 48 Q 350 -150 600 48"']) {
  const hidden=arch.layout(arch.parse(source(`routes {label (90000,90000)} route send {label none ${route}} route reply {label none}`)));
  assert.ok(hidden.bounds.width<2000&&hidden.bounds.height<2000);
  assert.ok(hidden.edges.every(e=>Number.isFinite(e.label.x)&&Number.isFinite(e.label.y)));
  assert.equal(groups(xml(arch.renderToString(source(`routes {label none} route send {${route}}`)))).filter(g=>g.getAttribute('class')==='arch-edge-label').length,0);
 }
});

test('hidden reference labels retain conveyed cards and annotations; invalid visibility values are rejected',()=>{
 const profile={nodeTypes:{actor:{template:'person'},item:{template:'artifact'}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'both'}}};
 const text=`architecture "Payload" {model {actor a "A" actor b "B" item data "Dataset" relation transfer a -> b "Sends" {type flow payload [data]}} view v "V" {routes {label none icon core.cloud}}}`;
 const graph=arch.layout(arch.parse(text,{profile}));assert.match(graph.edges[0].labelText,/Dataset \[data\]/);assert.equal(graph.referenceNodes.length,1);assert.equal(graph.referenceNodes[0].route,undefined);
 const d=xml(arch.renderToString(text,{profile}));assert.equal(groups(d).filter(g=>g.getAttribute('class')==='arch-edge-label').length,0);assert.equal(groups(d).filter(g=>g.getAttribute('class')==='arch-edge-reference').length,1);
 assert.equal(arch.validate(text.replace('routes {label none icon core.cloud}', 'route data -> transfer {showStereotype true}'),{profile}).valid,false);
 assert.equal([...d.getElementsByTagName('path')].filter(p=>p.getAttribute('class')==='arch-reference-connector').length,1);
 for(const rules of ['routes {label hidden}','route send {label false}','route send {label none label (0,0)}'])assert.equal(arch.validate(source(rules)).valid,false);
 const model=arch.parse(source(''));model.views[0].routeDefaults={label:'hidden'};assert.equal(arch.validate(model).valid,false);
 assert.match(arch.renderToString('@help routing'),/label none/);
});
